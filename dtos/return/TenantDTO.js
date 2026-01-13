const { formatDateForResponse } = require("../../utils/dateUtils");

class TenantDTO {
  static setDTO(tenant) {
    const tenantData = {};

    tenantData._id = tenant._id;
    tenantData.agentId = tenant.agentId;
    tenantData.agencyId = tenant.agencyId || null;

    if (tenant.agentId && typeof tenant.agentId === "object") {
      tenantData.agent = {
        _id: tenant.agentId._id,
        firstName: tenant.agentId.firstName,
        lastName: tenant.agentId.lastName,
        email: tenant.agentId.email,
      };
      tenantData.agentName = `${tenant.agentId.firstName || ""} ${tenant.agentId.lastName || ""}`.trim();
    } else {
      tenantData.agent = null;
      tenantData.agentName = null;
    }

    tenantData.firstName = tenant.firstName;
    tenantData.lastName = tenant.lastName;
    tenantData.email = tenant.email || null;
    tenantData.phoneNumber = tenant.phoneNumber || null;
    tenantData.profilePicture = tenant.profilePicture || null;
    tenantData.address = tenant.address || null;
    tenantData.city = tenant.city || null;
    tenantData.country = tenant.country || null;
    tenantData.postalCode = tenant.postalCode || null;
    tenantData.dateOfBirth = tenant.dateOfBirth ? formatDateForResponse(tenant.dateOfBirth) : null;
    tenantData.idNumber = tenant.idNumber || null;
    tenantData.idType = tenant.idType || null;
    tenantData.emergencyContactName = tenant.emergencyContactName || null;
    tenantData.emergencyContactPhone = tenant.emergencyContactPhone || null;
    tenantData.emergencyContactRelationship = tenant.emergencyContactRelationship || null;
    tenantData.notes = tenant.notes || null;
    tenantData.createdAt = tenant.createdAt;
    tenantData.updatedAt = tenant.updatedAt;

    if (tenant.leases && Array.isArray(tenant.leases)) {
      tenantData.leases = tenant.leases;
      tenantData.activeLeasesCount = tenant.leases.filter((lease) => lease.status === "ACTIVE").length;
      tenantData.hasActiveLease = tenantData.activeLeasesCount > 0;
    } else {
      tenantData.leases = [];
      tenantData.activeLeasesCount = 0;
      tenantData.hasActiveLease = false;
    }

    if (tenant.ratings && Array.isArray(tenant.ratings)) {
      tenantData.ratings = tenant.ratings;
      if (tenant.ratings.length > 0) {
        const totalRating = tenant.ratings.reduce((sum, rating) => sum + rating.rating, 0);
        tenantData.averageRating = totalRating / tenant.ratings.length;
      } else {
        tenantData.averageRating = null;
      }
    } else {
      tenantData.ratings = [];
      tenantData.averageRating = null;
    }

    // Include KYC status
    tenantData.kycStatus = tenant.kycStatus || "PENDING";
    tenantData.kycVerifiedAt = tenant.kycVerifiedAt ? formatDateForResponse(tenant.kycVerifiedAt) : null;
    tenantData.kycVerifiedBy = tenant.kycVerifiedBy || null;

    // Include payment statistics
    if (tenant.paymentStats) {
      tenantData.paymentStats = {
        totalPaid: tenant.paymentStats.totalPaid || 0,
        totalDue: tenant.paymentStats.totalDue || 0,
        nextPayment: tenant.paymentStats.nextPayment
          ? {
              amount: tenant.paymentStats.nextPayment.amount || 0,
              dueDate: tenant.paymentStats.nextPayment.dueDate
                ? formatDateForResponse(tenant.paymentStats.nextPayment.dueDate)
                : null,
            }
          : null,
      };
    } else {
      tenantData.paymentStats = {
        totalPaid: 0,
        totalDue: 0,
        nextPayment: null,
      };
    }

    return tenantData;
  }

  static setDTOList(tenants) {
    return tenants.map((tenant) => this.setDTO(tenant));
  }

  static getDisplayName(tenant) {
    if (!tenant) return null;
    return `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim() || "Unknown Tenant";
  }
}

module.exports = TenantDTO;

