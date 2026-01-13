const Tenant = require("../../../models/Tenant");
const Lease = require("../../../models/Lease");
const AppError = require("../../../utils/appError");
const { uploadFile, generateTenantProfilePath, deleteFile } = require("../../../utils/s3");
const { formatDateForStorage } = require("../../../utils/dateUtils");
const TenantReturnDTO = require("../../../dtos/return/TenantDTO");

class TenantService {
  static async createTenant(data, agentId, agencyId, profilePictureFile) {
    const tenantData = {
      agentId: agentId,
      agencyId: agencyId || null,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phoneNumber: data.phoneNumber || null,
      profilePicture: data.profilePicture || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      postalCode: data.postalCode || null,
      dateOfBirth: data.dateOfBirth ? formatDateForStorage(data.dateOfBirth) : null,
      idNumber: data.idNumber || null,
      idType: data.idType || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      emergencyContactRelationship: data.emergencyContactRelationship || null,
      notes: data.notes || null,
    };

    const tenant = await Tenant.create(tenantData);

    if (profilePictureFile && profilePictureFile.size > 0) {
      const uploadPath = generateTenantProfilePath(tenant._id);
      const uploadResult = await uploadFile(profilePictureFile, uploadPath);

      if (uploadResult.error) {
        await Tenant.findByIdAndDelete(tenant._id);
        throw new AppError(`Failed to upload profile picture: ${uploadResult.error}`, 500);
      }

      tenant.profilePicture = uploadResult.url;
      await tenant.save();
    }

    const populatedTenant = await Tenant.findById(tenant._id)
      .populate("agentId", "firstName lastName email")
      .lean();

    return TenantReturnDTO.setDTO(populatedTenant);
  }

  static async getTenants(agentId, agencyId, filters = {}) {
    const query = {};

    // For platform admin (agentId and agencyId are null), don't filter by agent/agency
    if (agentId !== null && agencyId !== null) {
      if (agencyId) {
        query.agencyId = agencyId;
      } else {
        query.agentId = agentId;
      }
    }

    if (filters.city) {
      query.city = new RegExp(filters.city, "i");
    }

    if (filters.country) {
      query.country = new RegExp(filters.country, "i");
    }

    if (filters.search) {
      query.$or = [
        { firstName: new RegExp(filters.search, "i") },
        { lastName: new RegExp(filters.search, "i") },
        { email: new RegExp(filters.search, "i") },
        { phoneNumber: new RegExp(filters.search, "i") },
      ];
    }

    const limit = parseInt(filters.limit) || 10;
    const skip = parseInt(filters.skip) || 0;

    const tenants = await Tenant.find(query)
      .populate("agentId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalCount = await Tenant.countDocuments(query);

    const TenantRating = require("../../../models/TenantRating");

    const tenantsWithRelations = await Promise.all(
      tenants.map(async (tenant) => {
        const activeLeases = await Lease.find({
          tenantId: tenant._id,
          status: "ACTIVE",
        })
          .select("_id status startDate endDate propertyId")
          .lean();

        const ratings = await TenantRating.find({ tenantId: tenant._id })
          .populate("agentId", "firstName lastName")
          .select("rating comment agentId")
          .lean();

        return {
          ...tenant,
          leases: activeLeases,
          ratings: ratings,
        };
      })
    );

    return {
      tenants: TenantReturnDTO.setDTOList(tenantsWithRelations),
      totalCount,
      count: tenantsWithRelations.length,
    };
  }

  static async getTenantById(id, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const tenant = await Tenant.findOne(query)
      .populate("agentId", "firstName lastName email")
      .lean();

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    const Lease = require("../../../models/Lease");
    const TenantRating = require("../../../models/TenantRating");
    const Property = require("../../../models/Property");

    const leases = await Lease.find({ tenantId: tenant._id })
      .select("_id status startDate endDate propertyId rentAmount")
      .lean();

    const leasesWithProperties = await Promise.all(
      leases.map(async (lease) => {
        if (lease.propertyId) {
          const property = await Property.findById(lease.propertyId)
            .select("title address city")
            .lean();
          return {
            ...lease,
            propertyId: property,
          };
        }
        return lease;
      })
    );

    const ratings = await TenantRating.find({ tenantId: tenant._id })
      .populate("agentId", "firstName lastName")
      .select("rating comment createdAt agentId")
      .sort({ createdAt: -1 })
      .lean();

    // Calculate payment statistics
    const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
    const leaseIds = leasesWithProperties.map((l) => l._id);

    const normalizeAmount = (v) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = parseFloat(v);
        return Number.isNaN(n) ? 0 : n;
      }
      return 0;
    };

    let totalPaid = 0;
    let totalDue = 0;
    let nextPayment = null;

    if (leaseIds.length > 0) {
      const allPayments = await LeasePaymentRecord.find({
        leaseId: { $in: leaseIds },
        type: "RENT",
      })
        .sort({ dueDate: 1 })
        .lean();

      // Calculate total paid (sum of amountPaid for PAID records)
      const paidPayments = allPayments.filter((p) => p.status === "PAID");
      totalPaid = paidPayments.reduce(
        (sum, p) => sum + normalizeAmount(p.amountPaid || p.amountDue),
        0
      );

      // Calculate total due (sum of amountDue for PENDING/PARTIALLY_PAID records)
      const unpaidPayments = allPayments.filter(
        (p) => p.status === "PENDING" || p.status === "PARTIALLY_PAID"
      );
      totalDue = unpaidPayments.reduce(
        (sum, p) => sum + normalizeAmount(p.amountDue),
        0
      );

      // Find next payment (earliest unpaid payment with dueDate >= today)
      const now = new Date();
      const upcomingPayments = allPayments.filter(
        (p) =>
          (p.status === "PENDING" || p.status === "PARTIALLY_PAID") &&
          p.dueDate &&
          new Date(p.dueDate) >= now
      );

      if (upcomingPayments.length > 0) {
        const next = upcomingPayments[0];
        nextPayment = {
          amount: normalizeAmount(next.amountDue),
          dueDate: next.dueDate ? new Date(next.dueDate) : null,
        };
      }
    }

    const tenantWithRelations = {
      ...tenant,
      leases: leasesWithProperties,
      ratings: ratings,
      paymentStats: {
        totalPaid,
        totalDue,
        nextPayment,
      },
    };

    return TenantReturnDTO.setDTO(tenantWithRelations);
  }

  static async updateTenant(id, data, agentId, agencyId, profilePictureFile) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const tenant = await Tenant.findOne(query);

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    const oldProfilePicture = tenant.profilePicture;

    if (data.firstName) tenant.firstName = data.firstName;
    if (data.lastName) tenant.lastName = data.lastName;
    if (data.email !== undefined) tenant.email = data.email || null;
    if (data.phoneNumber !== undefined) tenant.phoneNumber = data.phoneNumber || null;
    if (data.address !== undefined) tenant.address = data.address || null;
    if (data.city !== undefined) tenant.city = data.city || null;
    if (data.country !== undefined) tenant.country = data.country || null;
    if (data.postalCode !== undefined) tenant.postalCode = data.postalCode || null;
    if (data.dateOfBirth !== undefined) {
      tenant.dateOfBirth = data.dateOfBirth ? formatDateForStorage(data.dateOfBirth) : null;
    }
    if (data.idNumber !== undefined) tenant.idNumber = data.idNumber || null;
    if (data.idType !== undefined) tenant.idType = data.idType || null;
    if (data.emergencyContactName !== undefined) tenant.emergencyContactName = data.emergencyContactName || null;
    if (data.emergencyContactPhone !== undefined) tenant.emergencyContactPhone = data.emergencyContactPhone || null;
    if (data.emergencyContactRelationship !== undefined) tenant.emergencyContactRelationship = data.emergencyContactRelationship || null;
    if (data.notes !== undefined) tenant.notes = data.notes || null;
    if (data.kycStatus !== undefined) tenant.kycStatus = data.kycStatus;
    if (data.kycVerifiedAt !== undefined) tenant.kycVerifiedAt = data.kycVerifiedAt ? formatDateForStorage(data.kycVerifiedAt) : null;
    if (data.kycVerifiedBy !== undefined) tenant.kycVerifiedBy = data.kycVerifiedBy || null;

    if (profilePictureFile && profilePictureFile.size > 0) {
      const uploadPath = generateTenantProfilePath(tenant._id);
      const uploadResult = await uploadFile(profilePictureFile, uploadPath);

      if (uploadResult.error) {
        throw new AppError(`Failed to upload profile picture: ${uploadResult.error}`, 500);
      }

      tenant.profilePicture = uploadResult.url;

      if (oldProfilePicture) {
        await deleteFile(oldProfilePicture);
      }
    } else if (data.profilePicture === "null" || data.profilePicture === null) {
      if (oldProfilePicture) {
        await deleteFile(oldProfilePicture);
        tenant.profilePicture = null;
      }
    }

    await tenant.save();

    const populatedTenant = await Tenant.findById(tenant._id)
      .populate("agentId", "firstName lastName email")
      .lean();

    const Lease = require("../../../models/Lease");
    const TenantRating = require("../../../models/TenantRating");

    const activeLeases = await Lease.find({
      tenantId: tenant._id,
      status: "ACTIVE",
    })
      .select("_id status startDate endDate propertyId")
      .lean();

    const ratings = await TenantRating.find({ tenantId: tenant._id })
      .populate("agentId", "firstName lastName")
      .select("rating comment agentId")
      .lean();

    const tenantWithRelations = {
      ...populatedTenant,
      leases: activeLeases,
      ratings: ratings,
    };

    return TenantReturnDTO.setDTO(tenantWithRelations);
  }

  static async deleteTenant(id, agentId, agencyId) {
    const query = { _id: id };

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const tenant = await Tenant.findOne(query);

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    const activeLeases = await Lease.countDocuments({
      tenantId: id,
      status: "ACTIVE",
    });

    if (activeLeases > 0) {
      throw new AppError("Cannot delete tenant with active leases", 400);
    }

    if (tenant.profilePicture) {
      await deleteFile(tenant.profilePicture);
    }

    await Tenant.findByIdAndDelete(id);

    return { success: true };
  }

  static async getTenantsForSelect(agentId, agencyId) {
    const query = {};

    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const tenants = await Tenant.find(query)
      .select("_id firstName lastName email phoneNumber")
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return {
      tenants: tenants.map((tenant) => ({
        _id: tenant._id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email,
        phoneNumber: tenant.phoneNumber,
        displayName: `${tenant.firstName} ${tenant.lastName}`.trim(),
      })),
    };
  }

  static async updateKycStatus(id, kycStatus, verifiedBy) {
    const tenant = await Tenant.findById(id);

    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }

    tenant.kycStatus = kycStatus;
    if (kycStatus === "VERIFIED") {
      tenant.kycVerifiedAt = new Date();
      tenant.kycVerifiedBy = verifiedBy;
    } else {
      tenant.kycVerifiedAt = null;
      tenant.kycVerifiedBy = null;
    }

    await tenant.save();

    const populatedTenant = await Tenant.findById(tenant._id)
      .populate("agentId", "firstName lastName email")
      .populate("kycVerifiedBy", "firstName lastName email")
      .lean();

    return TenantReturnDTO.setDTO(populatedTenant);
  }
}

module.exports = TenantService;

