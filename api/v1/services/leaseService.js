const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");
const Tenant = require("../../../models/Tenant");
const Landlord = require("../../../models/Landlord");
const TenantService = require("./tenantService");
const AppError = require("../../../utils/appError");
const { formatDateForStorage } = require("../../../utils/dateUtils");
const LeaseReturnDTO = require("../../../dtos/return/LeaseDTO");

async function generateLeaseNumber() {
  const currentYear = new Date().getFullYear();
  const baseNumber = `LSE-${currentYear}-`;

  const lastLease = await Lease.findOne({
    leaseNumber: { $regex: `^${baseNumber}` },
  })
    .sort({ leaseNumber: -1 })
    .lean();

  let nextNumber = 1;
  if (lastLease) {
    const parts = lastLease.leaseNumber.split('-');
    const lastNumber = parseInt(parts[2] || '0');
    nextNumber = lastNumber + 1;
  }

  return `${baseNumber}${nextNumber.toString().padStart(3, '0')}`;
}

function calculateEndDate(startDate, durationInMonths) {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationInMonths);
  return endDate;
}

const LeaseDocument = require("../../../models/LeaseDocument");
const { uploadBufferToS3 } = require("../../../utils/s3");

class LeaseService {
  static async createLease(data, agentId, agencyId, files = {}) {
    const property = await Property.findById(data.propertyId);
    if (!property) {
      throw new AppError('Property not found', 404);
    }

    if (agencyId) {
      if (property.agencyId?.toString() !== agencyId.toString()) {
        throw new AppError('Property does not belong to your agency', 403);
      }
    } else {
      if (property.agentId?.toString() !== agentId.toString()) {
        throw new AppError('Property does not belong to you', 403);
      }
    }

    let tenant;
    let createdTenant = false;

    if (data.tenantId) {
      tenant = await Tenant.findById(data.tenantId);
      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      if (agencyId) {
        if (tenant.agencyId?.toString() !== agencyId.toString()) {
          throw new AppError('Tenant does not belong to your agency', 403);
        }
      } else {
        if (tenant.agentId?.toString() !== agentId.toString()) {
          throw new AppError('Tenant does not belong to you', 403);
        }
      }
    } else if (data.tenantFirstName && data.tenantLastName) {
      const tenantData = {
        firstName: data.tenantFirstName,
        lastName: data.tenantLastName,
        email: data.tenantEmail || null,
        phoneNumber: data.tenantPhoneNumber || null,
      };

      const createdTenantData = await TenantService.createTenant(
        tenantData,
        property.agentId,
        agencyId,
        null
      );

      tenant = await Tenant.findById(createdTenantData._id);
      createdTenant = true;
    } else {
      throw new AppError('Either tenantId or tenant information (firstName, lastName) is required', 400);
    }

    if (property.landlordId !== data.landlordId) {
      throw new AppError('Landlord ID does not match property', 400);
    }

    const landlord = await Landlord.findById(data.landlordId);
    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    const existingLease = await Lease.findOne({
      propertyId: data.propertyId,
      status: { $in: ['DRAFT', 'PENDING_START', 'ACTIVE'] },
    });

    if (existingLease) {
      const statusLabel = existingLease.status === 'DRAFT' ? 'draft' 
        : existingLease.status === 'PENDING_START' ? 'pending' 
        : 'active';
      throw new AppError(
        `This property already has a ${statusLabel} lease (${existingLease.leaseNumber}). Please terminate or delete the existing lease before creating a new one.`,
        400
      );
    }

    if (data.leaseDuration && property.minimumLease && data.leaseDuration < property.minimumLease) {
      throw new AppError(`Lease duration must be at least ${property.minimumLease} months (property minimum)`, 400);
    }

    if (data.leaseDuration && property.maximumLease && data.leaseDuration > property.maximumLease) {
      throw new AppError(`Lease duration must not exceed ${property.maximumLease} months (property maximum)`, 400);
    }

    const leaseNumber = await generateLeaseNumber();

    const startDate = formatDateForStorage(data.startDate);
    const endDate = data.endDate 
      ? formatDateForStorage(data.endDate)
      : calculateEndDate(startDate, data.leaseDuration);

    let leaseStatus = data.status || 'DRAFT';
    
    if (leaseStatus === 'ACTIVE') {
      throw new AppError('Leases must be created as DRAFT. Use the activate endpoint to activate a lease after it is ready.', 400);
    }

    const leaseData = {
      propertyId: data.propertyId,
      tenantId: tenant._id,
      agentId: agentId,
      landlordId: data.landlordId,
      agencyId: agencyId || null,
      leaseNumber: leaseNumber,
      rentAmount: data.rentAmount,
      rentFrequency: data.rentFrequency || 'MONTHLY',
      dueDay: data.dueDay,
      startDate: startDate,
      endDate: endDate,
      leaseDuration: data.leaseDuration,
      status: leaseStatus,
      securityDeposit: data.securityDeposit,
      lateFeeEnabled: data.lateFeeEnabled || false,
      lateFeeType: data.lateFeeType || null,
      lateFee: data.lateFee || null,
      lateFeePercentage: data.lateFeePercentage || null,
      lateFeeDays: data.lateFeeDays || 5,
      petDeposit: data.petDeposit || null,
      autoRenewal: data.autoRenewal || false,
      renewalNotice: data.renewalNotice || 30,
      terminationNotice: data.terminationNotice || 30,
      earlyTerminationFee: data.earlyTerminationFee || null,
      signedAt: data.signedAt ? formatDateForStorage(data.signedAt) : new Date(),
      witnessName: data.witnessName || null,
      notes: data.notes || null,
      platformCommissionOverride: data.platformCommissionOverride || false,
      platformCommissionType: data.platformCommissionType || null,
      platformCommissionRate: data.platformCommissionRate || null,
      platformCommissionFixed: data.platformCommissionFixed || null,
      agencyCommissionEnabled: data.agencyCommissionEnabled || false,
      agencyCommissionType: data.agencyCommissionType || null,
      agencyCommissionRate: data.agencyCommissionRate || null,
      agencyCommissionFixed: data.agencyCommissionFixed || null,
    };

    const lease = await Lease.create(leaseData);

    if (lease.status === 'ACTIVE' || lease.status === 'PENDING_START') {
      await this.updatePropertyAvailability(lease.propertyId);
    }

    if (data.inspectionNotes) {
      lease.inspectionNotes = data.inspectionNotes;
      await lease.save();
    }

    if (files && files.documents) {
      const documentFiles = Array.isArray(files.documents) ? files.documents : [files.documents];
      await Promise.all(
        documentFiles.map(async (file, index) => {
          if (!file || !file[0]) return;
          const docData = data[`documents[${index}]`] || {};
          const fileUrl = await uploadBufferToS3(
            file[0].buffer,
            `lease-documents/${lease._id}/${Date.now()}-${file[0].originalname}`,
            file[0].mimetype || "application/pdf"
          );
          await LeaseDocument.create({
            leaseId: lease._id,
            agentId: agentId,
            documentName: docData.name || file[0].originalname.replace(/\.[^/.]+$/, ""),
            documentType: docData.type || "lease_agreement",
            fileUrl: fileUrl,
            fileSize: file[0].size,
            mimeType: file[0].mimetype,
            notes: docData.notes || null,
            isForSignature: false,
          });
        })
      );
    }

    if (files && files.inspectionMedia) {
      const inspectionFiles = Array.isArray(files.inspectionMedia) ? files.inspectionMedia : [files.inspectionMedia];
      await Promise.all(
        inspectionFiles.map(async (file) => {
          if (!file || !file[0]) return;
          const fileUrl = await uploadBufferToS3(
            file[0].buffer,
            `lease-inspection/${lease._id}/${Date.now()}-${file[0].originalname}`,
            file[0].mimetype || "image/jpeg"
          );
          await LeaseDocument.create({
            leaseId: lease._id,
            agentId: agentId,
            documentName: file[0].originalname.replace(/\.[^/.]+$/, ""),
            documentType: "inspection_report",
            fileUrl: fileUrl,
            fileSize: file[0].size,
            mimeType: file[0].mimetype,
            notes: "Inspection media",
            isForSignature: false,
          });
        })
      );
    }

    const populatedLease = await Lease.findById(lease._id)
      .populate("propertyId", "title address city state country")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    const leaseDTO = LeaseReturnDTO.setDTO(populatedLease);
    
    if (createdTenant) {
      leaseDTO.createdTenant = {
        _id: tenant._id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
      };
    }

    return leaseDTO;
  }

  static async getLeases(agentId, agencyId, filters = {}) {
    const query = {};

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    if (filters.propertyId) {
      query.propertyId = filters.propertyId;
    }

    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }

    if (filters.landlordId) {
      query.landlordId = filters.landlordId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.search) {
      query.$or = [
        { leaseNumber: new RegExp(filters.search, "i") },
      ];
    }

    const limit = parseInt(filters.limit) || 10;
    const skip = parseInt(filters.skip) || 0;

    const leases = await Lease.find(query)
      .populate("propertyId", "title address city state country")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await Lease.countDocuments(query);

    return {
      leases: LeaseReturnDTO.setDTOList(leases),
      totalCount,
      count: leases.length,
    };
  }

  static async getLeaseById(id, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query)
      .populate("propertyId", "title address city state country rentAmount securityDeposit")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    return LeaseReturnDTO.setDTO(lease);
  }

  static async updateLease(id, data, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query);

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.status === 'ACTIVE') {
      if (data.propertyId && data.propertyId !== lease.propertyId) {
        throw new AppError('Cannot change property on an active lease', 400);
      }
      
      if (data.tenantId && data.tenantId !== lease.tenantId) {
        throw new AppError('Cannot change tenant on an active lease', 400);
      }
      
      if (data.startDate) {
        throw new AppError('Cannot change start date on an active lease', 400);
      }
    }

    if (data.propertyId && data.propertyId !== lease.propertyId) {
      const property = await Property.findById(data.propertyId);
      if (!property) {
        throw new AppError('Property not found', 404);
      }
      lease.propertyId = data.propertyId;
      lease.landlordId = property.landlordId;
    }

    if (data.tenantId && data.tenantId !== lease.tenantId) {
      const tenant = await Tenant.findById(data.tenantId);
      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }
      lease.tenantId = data.tenantId;
    }

    if (data.rentAmount !== undefined) lease.rentAmount = data.rentAmount;
    if (data.rentFrequency !== undefined) lease.rentFrequency = data.rentFrequency;
    if (data.dueDay !== undefined) lease.dueDay = data.dueDay;
    
    if (data.startDate !== undefined) {
      lease.startDate = formatDateForStorage(data.startDate);
      if (data.leaseDuration !== undefined) {
        lease.endDate = calculateEndDate(lease.startDate, data.leaseDuration);
      } else if (lease.leaseDuration) {
        lease.endDate = calculateEndDate(lease.startDate, lease.leaseDuration);
      }
    }

    if (data.leaseDuration !== undefined) {
      lease.leaseDuration = data.leaseDuration;
      if (lease.startDate) {
        lease.endDate = calculateEndDate(lease.startDate, data.leaseDuration);
      }
    }

    if (data.endDate !== undefined) {
      if (data.endDate) {
        const endDate = formatDateForStorage(data.endDate);
        const startDateToCheck = lease.startDate || (data.startDate ? formatDateForStorage(data.startDate) : null);
        if (startDateToCheck && endDate <= startDateToCheck) {
          throw new AppError('End date must be after start date', 400);
        }
        lease.endDate = endDate;
      } else {
        lease.endDate = null;
      }
    }

    if (data.status !== undefined) {
      const oldStatus = lease.status;
      const newStatus = data.status;
      
      if (oldStatus === 'ACTIVE' && newStatus !== 'ACTIVE' && newStatus !== 'TERMINATED') {
        throw new AppError('Active lease can only be terminated, not changed to other statuses', 400);
      }
      
      if (oldStatus === 'TERMINATED' && newStatus !== 'TERMINATED') {
        throw new AppError('Terminated lease cannot be changed to other statuses', 400);
      }
      
      if (oldStatus === 'CANCELLED' && newStatus !== 'CANCELLED') {
        throw new AppError('Cancelled lease cannot be changed to other statuses', 400);
      }
      
      if (oldStatus === 'PENDING_START' && newStatus === 'DRAFT') {
        throw new AppError('Cannot change PENDING_START lease back to DRAFT', 400);
      }
      
      lease.status = newStatus;
      
      if (newStatus === 'TERMINATED' && !lease.endDate) {
        lease.endDate = new Date();
      }
      
      await this.updatePropertyAvailability(lease.propertyId);
    }
    if (data.securityDeposit !== undefined) lease.securityDeposit = data.securityDeposit;
    if (data.lateFeeEnabled !== undefined) lease.lateFeeEnabled = data.lateFeeEnabled;
    if (data.lateFeeType !== undefined) lease.lateFeeType = data.lateFeeType;
    if (data.lateFee !== undefined) lease.lateFee = data.lateFee;
    if (data.lateFeePercentage !== undefined) lease.lateFeePercentage = data.lateFeePercentage;
    if (data.lateFeeDays !== undefined) lease.lateFeeDays = data.lateFeeDays;
    if (data.petDeposit !== undefined) lease.petDeposit = data.petDeposit;
    if (data.autoRenewal !== undefined) lease.autoRenewal = data.autoRenewal;
    if (data.renewalNotice !== undefined) lease.renewalNotice = data.renewalNotice;
    if (data.terminationNotice !== undefined) lease.terminationNotice = data.terminationNotice;
    if (data.earlyTerminationFee !== undefined) lease.earlyTerminationFee = data.earlyTerminationFee;
    if (data.signedAt !== undefined) lease.signedAt = data.signedAt ? formatDateForStorage(data.signedAt) : lease.signedAt;
    if (data.witnessName !== undefined) lease.witnessName = data.witnessName || null;
    if (data.notes !== undefined) lease.notes = data.notes || null;
    if (data.platformCommissionOverride !== undefined) lease.platformCommissionOverride = data.platformCommissionOverride;
    if (data.platformCommissionType !== undefined) lease.platformCommissionType = data.platformCommissionType || null;
    if (data.platformCommissionRate !== undefined) lease.platformCommissionRate = data.platformCommissionRate || null;
    if (data.platformCommissionFixed !== undefined) lease.platformCommissionFixed = data.platformCommissionFixed || null;
    if (data.agencyCommissionEnabled !== undefined) lease.agencyCommissionEnabled = data.agencyCommissionEnabled;
    if (data.agencyCommissionType !== undefined) lease.agencyCommissionType = data.agencyCommissionType || null;
    if (data.agencyCommissionRate !== undefined) lease.agencyCommissionRate = data.agencyCommissionRate || null;
    if (data.agencyCommissionFixed !== undefined) lease.agencyCommissionFixed = data.agencyCommissionFixed || null;

    await lease.save();

    if (data.status !== undefined || lease.status === 'ACTIVE' || lease.status === 'TERMINATED') {
      await this.updatePropertyAvailability(lease.propertyId);
    }

    const populatedLease = await Lease.findById(lease._id)
      .populate("propertyId", "title address city state country rentAmount securityDeposit")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    return LeaseReturnDTO.setDTO(populatedLease);
  }

  static async updatePropertyAvailability(propertyId) {
    const activeOrPendingLeases = await Lease.countDocuments({
      propertyId,
      status: { $in: ['ACTIVE', 'PENDING_START'] }
    });

    await Property.findByIdAndUpdate(propertyId, {
      isAvailable: activeOrPendingLeases === 0
    });
  }

  static async moveToPendingStart(id, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query);

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.status !== 'DRAFT') {
      throw new AppError(`Cannot move lease to PENDING_START from ${lease.status} status`, 400);
    }

    lease.status = 'PENDING_START';
    lease.readyToStart = true;
    lease.canStartReason = null;

    await lease.save();
    await this.updatePropertyAvailability(lease.propertyId);

    const populatedLease = await Lease.findById(lease._id)
      .populate("propertyId", "title address city state country rentAmount securityDeposit")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    return LeaseReturnDTO.setDTO(populatedLease);
  }

  static async activateLease(id, agentId, agencyId, actualStartDate) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query);

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.status !== 'PENDING_START' && lease.status !== 'DRAFT') {
      throw new AppError(`Cannot activate lease from ${lease.status} status. Lease must be in PENDING_START or DRAFT status`, 400);
    }

    if (!lease.readyToStart && lease.status === 'PENDING_START') {
      throw new AppError('Lease is not ready to start. Please complete all prerequisites', 400);
    }

    const startDate = actualStartDate ? formatDateForStorage(actualStartDate) : new Date();

    lease.status = 'ACTIVE';
    lease.actualStartDate = startDate;
    lease.startedBy = agentId;
    lease.startedAt = new Date();
    lease.readyToStart = true;
    lease.canStartReason = null;

    await lease.save();
    await this.updatePropertyAvailability(lease.propertyId);

    const populatedLease = await Lease.findById(lease._id)
      .populate("propertyId", "title address city state country rentAmount securityDeposit")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    return LeaseReturnDTO.setDTO(populatedLease);
  }

  static async terminateLease(id, agentId, agencyId, terminationDate, reason) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query);

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.status !== 'ACTIVE' && lease.status !== 'PENDING_START') {
      throw new AppError(`Cannot terminate lease from ${lease.status} status. Only ACTIVE or PENDING_START leases can be terminated`, 400);
    }

    const termDate = terminationDate ? formatDateForStorage(terminationDate) : new Date();

    lease.status = 'TERMINATED';
    lease.endDate = termDate;
    if (reason) {
      lease.notes = lease.notes ? `${lease.notes}\n\nTerminated: ${reason}`.trim() : `Terminated: ${reason}`;
    }

    await lease.save();
    await this.updatePropertyAvailability(lease.propertyId);

    const populatedLease = await Lease.findById(lease._id)
      .populate("propertyId", "title address city state country rentAmount securityDeposit")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    return LeaseReturnDTO.setDTO(populatedLease);
  }

  static async cancelLease(id, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query);

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.status !== 'DRAFT' && lease.status !== 'PENDING_START') {
      throw new AppError(`Cannot cancel lease from ${lease.status} status. Only DRAFT or PENDING_START leases can be cancelled`, 400);
    }

    lease.status = 'CANCELLED';

    await lease.save();
    await this.updatePropertyAvailability(lease.propertyId);

    const populatedLease = await Lease.findById(lease._id)
      .populate("propertyId", "title address city state country rentAmount securityDeposit")
      .populate("tenantId", "firstName lastName email phoneNumber")
      .populate("landlordId", "firstName lastName organizationName isOrganization contactPersonName")
      .populate("agentId", "firstName lastName email")
      .lean();

    return LeaseReturnDTO.setDTO(populatedLease);
  }

  static async checkAndTerminateExpiredLeases() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredLeases = await Lease.find({
      status: 'ACTIVE',
      endDate: { $lte: today }
    }).lean();

    const terminated = [];
    const errors = [];

    for (const lease of expiredLeases) {
      try {
        await this.terminateLease(
          lease._id,
          lease.agentId,
          lease.agencyId,
          lease.endDate,
          'Lease expired automatically'
        );
        terminated.push(lease._id);
      } catch (error) {
        errors.push({ leaseId: lease._id, error: error.message });
      }
    }

    return {
      terminated: terminated.length,
      errors: errors.length,
      details: { terminated, errors }
    };
  }

  static async checkAndActivatePendingLeases() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingLeases = await Lease.find({
      status: 'PENDING_START',
      readyToStart: true,
      startDate: { $lte: today }
    }).lean();

    const activated = [];
    const errors = [];

    for (const lease of pendingLeases) {
      try {
        await this.activateLease(
          lease._id,
          lease.agentId,
          lease.agencyId,
          lease.startDate
        );
        activated.push(lease._id);
      } catch (error) {
        errors.push({ leaseId: lease._id, error: error.message });
      }
    }

    return {
      activated: activated.length,
      errors: errors.length,
      details: { activated, errors }
    };
  }

  static async deleteLease(id, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const lease = await Lease.findOne(query);

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.status === 'ACTIVE') {
      throw new AppError("Cannot delete an active lease. Please terminate it first", 400);
    }

    if (lease.status === 'TERMINATED') {
      throw new AppError("Cannot delete a terminated lease. It is a historical record", 400);
    }

    const propertyId = lease.propertyId;

    await Lease.findByIdAndDelete(id);

    if (lease.status === 'PENDING_START') {
      await this.updatePropertyAvailability(propertyId);
    }

    return { message: "Lease deleted successfully" };
  }
}

module.exports = LeaseService;

