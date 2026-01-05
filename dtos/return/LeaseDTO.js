const { formatDateForResponse } = require("../../utils/dateUtils");
const PropertyDTO = require("./PropertyDTO");
const TenantDTO = require("./TenantDTO");
const LandlordDTO = require("./LandlordDTO");

class LeaseDTO {
  static setDTO(lease) {
    const leaseData = {};

    leaseData._id = lease._id;
    leaseData.propertyId = lease.propertyId;
    leaseData.tenantId = lease.tenantId;
    leaseData.agentId = lease.agentId;
    leaseData.landlordId = lease.landlordId;
    leaseData.agencyId = lease.agencyId || null;

    if (lease.propertyId && typeof lease.propertyId === 'object') {
      leaseData.property = PropertyDTO.setDTO(lease.propertyId);
      leaseData.propertyTitle = lease.propertyId.title || null;
      leaseData.propertyAddress = lease.propertyId.address || null;
    } else {
      leaseData.property = null;
      leaseData.propertyTitle = null;
      leaseData.propertyAddress = null;
    }

    if (lease.tenantId && typeof lease.tenantId === 'object') {
      leaseData.tenant = TenantDTO.setDTO(lease.tenantId);
      leaseData.tenantName = TenantDTO.getDisplayName(lease.tenantId);
    } else {
      leaseData.tenant = null;
      leaseData.tenantName = null;
    }

    if (lease.landlordId && typeof lease.landlordId === 'object') {
      leaseData.landlord = LandlordDTO.setDTO(lease.landlordId);
      leaseData.landlordName = LandlordDTO.getDisplayName(lease.landlordId);
    } else {
      leaseData.landlord = null;
      leaseData.landlordName = null;
    }

    if (lease.agentId && typeof lease.agentId === 'object') {
      leaseData.agent = {
        _id: lease.agentId._id,
        firstName: lease.agentId.firstName,
        lastName: lease.agentId.lastName,
        email: lease.agentId.email,
      };
      leaseData.agentName = `${lease.agentId.firstName || ""} ${lease.agentId.lastName || ""}`.trim();
    } else {
      leaseData.agent = null;
      leaseData.agentName = null;
    }

    leaseData.leaseNumber = lease.leaseNumber;
    leaseData.rentAmount = lease.rentAmount ? parseFloat(lease.rentAmount.toString()) : null;
    leaseData.rentFrequency = lease.rentFrequency || 'MONTHLY';
    leaseData.dueDay = lease.dueDay || null;
    leaseData.startDate = lease.startDate ? formatDateForResponse(lease.startDate) : null;
    leaseData.endDate = lease.endDate ? formatDateForResponse(lease.endDate) : null;
    leaseData.leaseDuration = lease.leaseDuration || null;
    leaseData.status = lease.status || 'DRAFT';
    leaseData.actualStartDate = lease.actualStartDate ? formatDateForResponse(lease.actualStartDate) : null;
    leaseData.canStartReason = lease.canStartReason || null;
    leaseData.readyToStart = lease.readyToStart !== undefined ? lease.readyToStart : false;
    leaseData.startedBy = lease.startedBy || null;
    leaseData.startedAt = lease.startedAt ? formatDateForResponse(lease.startedAt) : null;
    leaseData.securityDeposit = lease.securityDeposit ? parseFloat(lease.securityDeposit.toString()) : null;
    leaseData.lateFeeEnabled = lease.lateFeeEnabled !== undefined ? lease.lateFeeEnabled : false;
    leaseData.lateFeeType = lease.lateFeeType || null;
    leaseData.lateFee = lease.lateFee ? parseFloat(lease.lateFee.toString()) : null;
    leaseData.lateFeePercentage = lease.lateFeePercentage ? parseFloat(lease.lateFeePercentage.toString()) : null;
    leaseData.lateFeeDays = lease.lateFeeDays || 5;
    leaseData.petDeposit = lease.petDeposit ? parseFloat(lease.petDeposit.toString()) : null;
    leaseData.autoRenewal = lease.autoRenewal !== undefined ? lease.autoRenewal : false;
    leaseData.renewalNotice = lease.renewalNotice || 30;
    leaseData.terminationNotice = lease.terminationNotice || 30;
    leaseData.earlyTerminationFee = lease.earlyTerminationFee ? parseFloat(lease.earlyTerminationFee.toString()) : null;
    leaseData.signedAt = lease.signedAt ? formatDateForResponse(lease.signedAt) : null;
    leaseData.witnessName = lease.witnessName || null;
    leaseData.notes = lease.notes || null;
    leaseData.platformCommissionOverride = lease.platformCommissionOverride !== undefined ? lease.platformCommissionOverride : false;
    leaseData.platformCommissionType = lease.platformCommissionType || null;
    leaseData.platformCommissionRate = lease.platformCommissionRate ? parseFloat(lease.platformCommissionRate.toString()) : null;
    leaseData.platformCommissionFixed = lease.platformCommissionFixed ? parseFloat(lease.platformCommissionFixed.toString()) : null;
    leaseData.agencyCommissionEnabled = lease.agencyCommissionEnabled !== undefined ? lease.agencyCommissionEnabled : false;
    leaseData.agencyCommissionType = lease.agencyCommissionType || null;
    leaseData.agencyCommissionRate = lease.agencyCommissionRate ? parseFloat(lease.agencyCommissionRate.toString()) : null;
    leaseData.agencyCommissionFixed = lease.agencyCommissionFixed ? parseFloat(lease.agencyCommissionFixed.toString()) : null;
    leaseData.createdAt = lease.createdAt;
    leaseData.updatedAt = lease.updatedAt;

    return leaseData;
  }

  static setDTOList(leases) {
    return leases.map(lease => this.setDTO(lease));
  }
}

module.exports = LeaseDTO;

