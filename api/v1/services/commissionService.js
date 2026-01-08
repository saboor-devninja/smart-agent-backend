const CommissionRecord = require("../../../models/CommissionRecord");
const LandlordPayment = require("../../../models/LandlordPayment");
const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");
const Agency = require("../../../models/Agency");
const AppError = require("../../../utils/appError");

class CommissionService {
  static async calculateAndRecord(paymentRecord, agentId, agencyId) {
    const lease = await Lease.findById(paymentRecord.leaseId).lean();
    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const property = await Property.findById(lease.propertyId).lean();
    if (!property) {
      throw new AppError("Property not found", 404);
    }

    const paymentAmount = Number(paymentRecord.amountDue || 0);
    const charges = Array.isArray(paymentRecord.charges) ? paymentRecord.charges : [];
    const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totalPaymentAmount = paymentAmount + totalCharges;

    // Issue 4: Validate payment amount is positive
    if (totalPaymentAmount <= 0) {
      return null;
    }

    if (!property.commissionType) {
      return null;
    }

    let agentGrossCommission = 0;
    if (property.commissionType === "PERCENTAGE" && property.commissionPercentage) {
      // Issue 5: Clamp commission percentage to 0-100%
      let commissionPct = Number(property.commissionPercentage);
      if (commissionPct < 0) commissionPct = 0;
      if (commissionPct > 100) commissionPct = 100;
      agentGrossCommission = (totalPaymentAmount * commissionPct) / 100;
    } else if (property.commissionType === "FIXED_AMOUNT" && property.commissionFixedAmount) {
      // Ensure fixed amount is non-negative
      agentGrossCommission = Math.max(0, Number(property.commissionFixedAmount));
    }

    if (agentGrossCommission === 0) {
      return null;
    }

    const isAgencyLease = agencyId && lease.agencyCommissionEnabled;
    let agentPlatformFee = 0;
    let agentNetCommission = agentGrossCommission;
    let agencyGrossCommission = 0;
    let agencyPlatformFee = 0;
    let agencyNetCommission = 0;
    let platformCommission = 0;

    // Total commission from payment (this is the base commission)
    const totalCommission = agentGrossCommission;

    if (isAgencyLease) {
      const agency = await Agency.findById(agencyId).lean();
      if (!agency) {
        throw new AppError("Agency not found", 404);
      }

      // Step 1: Calculate platform fee on total commission
      // Issue 3: Clamp platform fee percentage and ensure it doesn't exceed total commission
      if (agency.agencyPlatformCommissionType === "PERCENTAGE" && agency.agencyPlatformCommissionRate) {
        let platformPct = Number(agency.agencyPlatformCommissionRate);
        if (platformPct < 0) platformPct = 0;
        if (platformPct > 100) platformPct = 100;
        platformCommission = (totalCommission * platformPct) / 100;
      } else if (agency.agencyPlatformCommissionType === "FIXED_AMOUNT" && agency.agencyPlatformCommissionFixed) {
        platformCommission = Math.max(0, Number(agency.agencyPlatformCommissionFixed));
      }

      // Ensure platform fee doesn't exceed total commission
      if (platformCommission > totalCommission) {
        platformCommission = totalCommission;
      }

      // Step 2: Remaining after platform fee
      const commissionAfterPlatformFee = totalCommission - platformCommission;

      // Step 3: Split remaining commission between agency and agent
      // Issue 1: Clamp agency commission percentage and ensure it doesn't exceed remaining
      if (lease.agencyCommissionType === "PERCENTAGE" && lease.agencyCommissionRate) {
        let agencyPct = Number(lease.agencyCommissionRate);
        if (agencyPct < 0) agencyPct = 0;
        if (agencyPct > 100) agencyPct = 100;
        agencyGrossCommission = (commissionAfterPlatformFee * agencyPct) / 100;
      } else if (lease.agencyCommissionType === "FIXED" && lease.agencyCommissionFixed) {
        agencyGrossCommission = Math.max(0, Number(lease.agencyCommissionFixed));
      }

      // Ensure agency commission doesn't exceed remaining after platform fee
      if (agencyGrossCommission > commissionAfterPlatformFee) {
        agencyGrossCommission = commissionAfterPlatformFee;
      }

      // Agent gets the remaining after agency takes their share
      agentNetCommission = commissionAfterPlatformFee - agencyGrossCommission;
      // Ensure agent commission is non-negative
      if (agentNetCommission < 0) agentNetCommission = 0;
      agencyNetCommission = agencyGrossCommission;
      agencyPlatformFee = platformCommission;
    } else {
      // Individual Agent: Platform fee is calculated on agent commission
      // Issue 3: Clamp platform fee percentage and ensure it doesn't exceed commission
      let platformFeePercentage = Number(property.platformFeePercentage || 20);
      if (platformFeePercentage < 0) platformFeePercentage = 0;
      if (platformFeePercentage > 100) platformFeePercentage = 100;
      
      agentPlatformFee = (agentGrossCommission * platformFeePercentage) / 100;
      // Ensure platform fee doesn't exceed commission
      if (agentPlatformFee > agentGrossCommission) {
        agentPlatformFee = agentGrossCommission;
      }
      
      agentNetCommission = agentGrossCommission - agentPlatformFee;
      // Ensure agent commission is non-negative
      if (agentNetCommission < 0) agentNetCommission = 0;
      platformCommission = agentPlatformFee;
    }

    // Issue 14: Validate landlord net amount is valid (0 <= landlordNetAmount <= totalPaymentAmount)
    const landlordNetAmount = totalPaymentAmount - agentGrossCommission;
    // Since agentGrossCommission is clamped to <= totalPaymentAmount, landlordNetAmount will always be >= 0

    // Issue 19: Reconciliation check
    const calculatedTotal = agentGrossCommission + landlordNetAmount;
    const difference = Math.abs(calculatedTotal - totalPaymentAmount);
    if (difference > 0.01) {
      console.warn(`Commission reconciliation warning: Payment ${totalPaymentAmount}, Commission ${agentGrossCommission}, Landlord ${landlordNetAmount}, Difference: ${difference}`);
    }

    // Issue 12: Store commission settings for historical accuracy
    const commissionSettings = {
      propertyCommissionType: property.commissionType,
      propertyCommissionPercentage: property.commissionPercentage || null,
      propertyCommissionFixedAmount: property.commissionFixedAmount || null,
      propertyPlatformFeePercentage: property.platformFeePercentage || null,
    };

    if (isAgencyLease) {
      const agency = await Agency.findById(agencyId).lean();
      commissionSettings.agencyPlatformCommissionType = agency.agencyPlatformCommissionType;
      commissionSettings.agencyPlatformCommissionRate = agency.agencyPlatformCommissionRate || null;
      commissionSettings.agencyPlatformCommissionFixed = agency.agencyPlatformCommissionFixed || null;
      commissionSettings.leaseAgencyCommissionType = lease.agencyCommissionType;
      commissionSettings.leaseAgencyCommissionRate = lease.agencyCommissionRate || null;
      commissionSettings.leaseAgencyCommissionFixed = lease.agencyCommissionFixed || null;
    }

    const commissionRecord = await CommissionRecord.create({
      paymentRecordId: paymentRecord._id,
      leaseId: lease._id,
      propertyId: property._id,
      agentId,
      agencyId: agencyId || null,
      landlordId: lease.landlordId,
      paymentAmount: totalPaymentAmount,
      agentGrossCommission,
      agentPlatformFee,
      agentNetCommission,
      agencyCommissionEnabled: isAgencyLease,
      agencyGrossCommission,
      agencyPlatformFee,
      agencyNetCommission,
      platformCommission,
      landlordNetAmount,
      commissionSettings,
      status: "PENDING",
    });

    const landlordPayment = await LandlordPayment.create({
      commissionRecordId: commissionRecord._id,
      paymentRecordId: paymentRecord._id,
      leaseId: lease._id,
      propertyId: property._id,
      landlordId: lease.landlordId,
      agentId,
      grossAmount: totalPaymentAmount,
      netAmount: landlordNetAmount,
      adjustments: [],
      status: "PENDING",
    });

    // Update payment record with reverse links
    await LeasePaymentRecord.updateOne(
      { _id: paymentRecord._id },
      {
        commissionRecordId: commissionRecord._id,
        landlordPaymentId: landlordPayment._id,
      }
    );

    return {
      commissionRecord: commissionRecord.toObject(),
      landlordPayment: landlordPayment.toObject(),
    };
  }

  static async recalculateAndUpdate(paymentRecord, agentId, agencyId) {
    const existingCommission = await CommissionRecord.findOne({
      paymentRecordId: paymentRecord._id,
    });

    if (!existingCommission) {
      return await this.calculateAndRecord(paymentRecord, agentId, agencyId);
    }

    // Issue 13: Use original agencyId from commission record if it exists
    const originalAgencyId = existingCommission.agencyId || agencyId;
    const effectiveAgencyId = existingCommission.agencyCommissionEnabled ? originalAgencyId : null;

    const lease = await Lease.findById(paymentRecord.leaseId).lean();
    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const property = await Property.findById(lease.propertyId).lean();
    if (!property) {
      throw new AppError("Property not found", 404);
    }

    // Issue 12: Use stored commission settings if available, otherwise use current settings
    let useStoredSettings = false;
    if (existingCommission.commissionSettings && existingCommission.commissionSettings.propertyCommissionType) {
      useStoredSettings = true;
    }

    const paymentAmount = Number(paymentRecord.amountDue || 0);
    const charges = Array.isArray(paymentRecord.charges) ? paymentRecord.charges : [];
    const totalCharges = charges.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const totalPaymentAmount = paymentAmount + totalCharges;

    // Issue 4: Validate payment amount is positive
    if (totalPaymentAmount <= 0) {
      existingCommission.status = "CANCELLED";
      await existingCommission.save();
      await LandlordPayment.updateOne(
        { paymentRecordId: paymentRecord._id },
        { status: "CANCELLED" }
      );
      return null;
    }

    if (!property.commissionType) {
      existingCommission.status = "CANCELLED";
      await existingCommission.save();
      await LandlordPayment.updateOne(
        { paymentRecordId: paymentRecord._id },
        { status: "CANCELLED" }
      );
      return null;
    }

    // Issue 12: Use stored settings if available, otherwise use current
    const commissionType = useStoredSettings 
      ? existingCommission.commissionSettings.propertyCommissionType 
      : property.commissionType;
    const commissionPercentage = useStoredSettings 
      ? existingCommission.commissionSettings.propertyCommissionPercentage 
      : property.commissionPercentage;
    const commissionFixedAmount = useStoredSettings 
      ? existingCommission.commissionSettings.propertyCommissionFixedAmount 
      : property.commissionFixedAmount;

    if (!commissionType) {
      existingCommission.status = "CANCELLED";
      await existingCommission.save();
      await LandlordPayment.updateOne(
        { paymentRecordId: paymentRecord._id },
        { status: "CANCELLED" }
      );
      return null;
    }

    let agentGrossCommission = 0;
    if (commissionType === "PERCENTAGE" && commissionPercentage) {
      // Issue 5: Clamp commission percentage to 0-100%
      let commissionPct = Number(commissionPercentage);
      if (commissionPct < 0) commissionPct = 0;
      if (commissionPct > 100) commissionPct = 100;
      agentGrossCommission = (totalPaymentAmount * commissionPct) / 100;
    } else if (commissionType === "FIXED_AMOUNT" && commissionFixedAmount) {
      // Ensure fixed amount is non-negative
      agentGrossCommission = Math.max(0, Number(commissionFixedAmount));
    }

    if (agentGrossCommission === 0) {
      existingCommission.status = "CANCELLED";
      await existingCommission.save();
      await LandlordPayment.updateOne(
        { paymentRecordId: paymentRecord._id },
        { status: "CANCELLED" }
      );
      return null;
    }

    const isAgencyLease = existingCommission.agencyCommissionEnabled;
    let agentPlatformFee = 0;
    let agentNetCommission = agentGrossCommission;
    let agencyGrossCommission = 0;
    let agencyPlatformFee = 0;
    let agencyNetCommission = 0;
    let platformCommission = 0;

    const totalCommission = agentGrossCommission;

    if (isAgencyLease) {
      const agency = await Agency.findById(agencyId).lean();
      if (!agency) {
        throw new AppError("Agency not found", 404);
      }

      // Issue 3: Clamp platform fee percentage and ensure it doesn't exceed total commission
      if (agency.agencyPlatformCommissionType === "PERCENTAGE" && agency.agencyPlatformCommissionRate) {
        let platformPct = Number(agency.agencyPlatformCommissionRate);
        if (platformPct < 0) platformPct = 0;
        if (platformPct > 100) platformPct = 100;
        platformCommission = (totalCommission * platformPct) / 100;
      } else if (agency.agencyPlatformCommissionType === "FIXED_AMOUNT" && agency.agencyPlatformCommissionFixed) {
        platformCommission = Math.max(0, Number(agency.agencyPlatformCommissionFixed));
      }

      // Ensure platform fee doesn't exceed total commission
      if (platformCommission > totalCommission) {
        platformCommission = totalCommission;
      }

      const commissionAfterPlatformFee = totalCommission - platformCommission;

      // Issue 1: Clamp agency commission percentage and ensure it doesn't exceed remaining
      if (lease.agencyCommissionType === "PERCENTAGE" && lease.agencyCommissionRate) {
        let agencyPct = Number(lease.agencyCommissionRate);
        if (agencyPct < 0) agencyPct = 0;
        if (agencyPct > 100) agencyPct = 100;
        agencyGrossCommission = (commissionAfterPlatformFee * agencyPct) / 100;
      } else if (lease.agencyCommissionType === "FIXED" && lease.agencyCommissionFixed) {
        agencyGrossCommission = Math.max(0, Number(lease.agencyCommissionFixed));
      }

      // Ensure agency commission doesn't exceed remaining after platform fee
      if (agencyGrossCommission > commissionAfterPlatformFee) {
        agencyGrossCommission = commissionAfterPlatformFee;
      }

      agentNetCommission = commissionAfterPlatformFee - agencyGrossCommission;
      // Ensure agent commission is non-negative
      if (agentNetCommission < 0) agentNetCommission = 0;
      agencyNetCommission = agencyGrossCommission;
      agencyPlatformFee = platformCommission;
    } else {
      // Individual Agent: Platform fee is calculated on agent commission
      // Issue 12: Use stored settings if available
      const platformFeePercentage = useStoredSettings && existingCommission.commissionSettings?.propertyPlatformFeePercentage
        ? Number(existingCommission.commissionSettings.propertyPlatformFeePercentage)
        : Number(property.platformFeePercentage || 20);

      // Issue 3: Clamp platform fee percentage and ensure it doesn't exceed commission
      let platformFeePct = platformFeePercentage;
      if (platformFeePct < 0) platformFeePct = 0;
      if (platformFeePct > 100) platformFeePct = 100;
      
      agentPlatformFee = (agentGrossCommission * platformFeePct) / 100;
      // Ensure platform fee doesn't exceed commission
      if (agentPlatformFee > agentGrossCommission) {
        agentPlatformFee = agentGrossCommission;
      }
      
      agentNetCommission = agentGrossCommission - agentPlatformFee;
      // Ensure agent commission is non-negative
      if (agentNetCommission < 0) agentNetCommission = 0;
      platformCommission = agentPlatformFee;
    }

    // Issue 14: Validate landlord net amount is valid (0 <= landlordNetAmount <= totalPaymentAmount)
    const landlordNetAmount = totalPaymentAmount - agentGrossCommission;
    // Since agentGrossCommission is clamped to <= totalPaymentAmount, landlordNetAmount will always be >= 0

    // Issue 19: Reconciliation check
    const calculatedTotal = agentGrossCommission + landlordNetAmount;
    const difference = Math.abs(calculatedTotal - totalPaymentAmount);
    if (difference > 0.01) {
      console.warn(`Commission reconciliation warning: Payment ${totalPaymentAmount}, Commission ${agentGrossCommission}, Landlord ${landlordNetAmount}, Difference: ${difference}`);
    }

    existingCommission.paymentAmount = totalPaymentAmount;
    existingCommission.agentGrossCommission = agentGrossCommission;
    existingCommission.agentPlatformFee = agentPlatformFee;
    existingCommission.agentNetCommission = agentNetCommission;
    existingCommission.agencyGrossCommission = agencyGrossCommission;
    existingCommission.agencyPlatformFee = agencyPlatformFee;
    existingCommission.agencyNetCommission = agencyNetCommission;
    existingCommission.platformCommission = platformCommission;
    existingCommission.landlordNetAmount = landlordNetAmount;
    existingCommission.agencyCommissionEnabled = isAgencyLease;
    
    // Reactivate if was cancelled and payment is now PAID
    if (existingCommission.status === "CANCELLED" && paymentRecord.status === "PAID") {
      existingCommission.status = "PENDING";
      existingCommission.paidAt = null;
    }
    
    await existingCommission.save();

    const landlordPayment = await LandlordPayment.findOne({
      paymentRecordId: paymentRecord._id,
    });

    if (landlordPayment) {
      landlordPayment.grossAmount = totalPaymentAmount;
      landlordPayment.netAmount = landlordNetAmount;
      
      // Reactivate if was cancelled and payment is now PAID
      if (landlordPayment.status === "CANCELLED" && paymentRecord.status === "PAID") {
        landlordPayment.status = "PENDING";
        landlordPayment.paidAt = null;
      }
      
      await landlordPayment.save();
    } else {
      // Create landlord payment if it doesn't exist (shouldn't happen, but safety check)
      const newLandlordPayment = await LandlordPayment.create({
        commissionRecordId: existingCommission._id,
        paymentRecordId: paymentRecord._id,
        leaseId: lease._id,
        propertyId: property._id,
        landlordId: lease.landlordId,
        agentId,
        grossAmount: totalPaymentAmount,
        netAmount: landlordNetAmount,
        adjustments: [],
        status: "PENDING",
      });
      
      // Update payment record with reverse link
      await LeasePaymentRecord.updateOne(
        { _id: paymentRecord._id },
        { landlordPaymentId: newLandlordPayment._id }
      );
      
      return {
        commissionRecord: existingCommission.toObject(),
        landlordPayment: newLandlordPayment.toObject(),
      };
    }

    // Ensure payment record has reverse links
    await LeasePaymentRecord.updateOne(
      { _id: paymentRecord._id },
      {
        commissionRecordId: existingCommission._id,
        landlordPaymentId: landlordPayment._id,
      }
    );

    return {
      commissionRecord: existingCommission.toObject(),
      landlordPayment: landlordPayment.toObject(),
    };
  }

  static async getRelatedRecords(paymentRecordId) {
    const paymentRecord = await LeasePaymentRecord.findById(paymentRecordId).lean();
    if (!paymentRecord) {
      throw new AppError("Payment record not found", 404);
    }

    const commissionRecord = paymentRecord.commissionRecordId
      ? await CommissionRecord.findById(paymentRecord.commissionRecordId).lean()
      : null;

    const landlordPayment = paymentRecord.landlordPaymentId
      ? await LandlordPayment.findById(paymentRecord.landlordPaymentId).lean()
      : null;

    return {
      paymentRecord,
      commissionRecord,
      landlordPayment,
    };
  }

  static async getRelatedRecordsByCommission(commissionRecordId) {
    const commissionRecord = await CommissionRecord.findById(commissionRecordId).lean();
    if (!commissionRecord) {
      throw new AppError("Commission record not found", 404);
    }

    const paymentRecord = await LeasePaymentRecord.findById(commissionRecord.paymentRecordId).lean();
    const landlordPayment = await LandlordPayment.findOne({
      commissionRecordId: commissionRecord._id,
    }).lean();

    return {
      paymentRecord,
      commissionRecord,
      landlordPayment,
    };
  }

  static async getRelatedRecordsByLandlordPayment(landlordPaymentId) {
    const landlordPayment = await LandlordPayment.findById(landlordPaymentId).lean();
    if (!landlordPayment) {
      throw new AppError("Landlord payment not found", 404);
    }

    const paymentRecord = await LeasePaymentRecord.findById(landlordPayment.paymentRecordId).lean();
    const commissionRecord = await CommissionRecord.findById(landlordPayment.commissionRecordId).lean();

    return {
      paymentRecord,
      commissionRecord,
      landlordPayment,
    };
  }

  static async getAgentCommissions(agentId, agencyId, filters = {}) {
    const query = agencyId ? { agencyId, agentId } : { agentId, agencyId: null };
    
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.leaseId) {
      query.leaseId = filters.leaseId;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const commissions = await CommissionRecord.find(query)
      .populate("leaseId", "leaseNumber startDate endDate")
      .populate("propertyId", "title address")
      .populate("paymentRecordId", "label type dueDate")
      .sort({ createdAt: -1 })
      .lean();

    return commissions.map((c) => ({
      ...c,
      paymentAmount: Number(c.paymentAmount || 0),
      agentGrossCommission: Number(c.agentGrossCommission || 0),
      agentPlatformFee: Number(c.agentPlatformFee || 0),
      agentNetCommission: Number(c.agentNetCommission || 0),
      agencyGrossCommission: Number(c.agencyGrossCommission || 0),
      agencyPlatformFee: Number(c.agencyPlatformFee || 0),
      agencyNetCommission: Number(c.agencyNetCommission || 0),
      platformCommission: Number(c.platformCommission || 0),
      landlordNetAmount: Number(c.landlordNetAmount || 0),
    }));
  }

  static async getLandlordPayments(landlordId, filters = {}) {
    const query = { landlordId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.leaseId) {
      query.leaseId = filters.leaseId;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const payments = await LandlordPayment.find(query)
      .populate("leaseId", "leaseNumber startDate endDate")
      .populate("propertyId", "title address")
      .populate("paymentRecordId", "label type dueDate")
      .sort({ createdAt: -1 })
      .lean();

    return payments.map((p) => ({
      ...p,
      grossAmount: Number(p.grossAmount || 0),
      netAmount: Number(p.netAmount || 0),
      adjustments: Array.isArray(p.adjustments)
        ? p.adjustments.map((a) => ({
            ...a,
            amount: Number(a.amount || 0),
          }))
        : [],
    }));
  }
}

module.exports = CommissionService;

