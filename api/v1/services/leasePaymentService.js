const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const LeasePrerequisite = require("../../../models/LeasePrerequisite");
const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");
const Tenant = require("../../../models/Tenant");
const Landlord = require("../../../models/Landlord");
const User = require("../../../models/User");
const CommissionRecord = require("../../../models/CommissionRecord");
const LandlordPayment = require("../../../models/LandlordPayment");
const AppError = require("../../../utils/appError");
const { generateInvoicePDF, generateReceiptPDF } = require("../../../utils/pdfGenerator");
const CommissionService = require("./commissionService");

class LeasePaymentService {
  static async getByLease(leaseId, agentId, agencyId) {
    // Only filter by agentId/agencyId if provided (null means PLATFORM_ADMIN - no filter)
    const leaseQuery = { _id: leaseId };
    if (agencyId) {
      leaseQuery.agencyId = agencyId;
    } else if (agentId) {
      leaseQuery.agentId = agentId;
    }
    // If both are null, query only by _id (PLATFORM_ADMIN case)
    
    const lease = await Lease.findOne(leaseQuery).lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    let records = await LeasePaymentRecord.find({ leaseId })
      .sort({ dueDate: -1, createdAt: -1 })
      .lean();

    // Normalize Decimal128 amounts so frontend doesn't see $NaN
    const normalizeAmount = (v) => {
      if (v === null || v === undefined) return null;
      try {
        // v may be Decimal128 or a plain number
        if (typeof v === "number") return v;
        if (typeof v === "string") return parseFloat(v);
        if (typeof v === "object" && v !== null) {
          if (typeof v.toString === "function") {
            const n = parseFloat(v.toString());
            return Number.isNaN(n) ? null : n;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    // Fetch landlord payments for each record
    const recordIds = records.map((r) => r._id);
    const landlordPayments = await LandlordPayment.find({
      paymentRecordId: { $in: recordIds },
    }).lean();

    const landlordPaymentMap = new Map();
    landlordPayments.forEach((lp) => {
      landlordPaymentMap.set(lp.paymentRecordId, lp);
    });

    records = records.map((r) => {
      const landlordPayment = landlordPaymentMap.get(r._id);
      return {
        ...r,
        amountDue: normalizeAmount(r.amountDue),
        amountPaid: normalizeAmount(r.amountPaid),
        charges: Array.isArray(r.charges)
          ? r.charges.map((c) => ({
              ...c,
              amount: normalizeAmount(c.amount),
            }))
          : [],
        landlordPayment: landlordPayment
          ? {
              _id: landlordPayment._id,
              status: landlordPayment.status,
              netAmount: normalizeAmount(landlordPayment.netAmount),
              grossAmount: normalizeAmount(landlordPayment.grossAmount),
              paidAt: landlordPayment.paidAt,
              paymentMethod: landlordPayment.paymentMethod,
              paymentReference: landlordPayment.paymentReference,
            }
          : null,
      };
    });

    return { lease, records };
  }

  static async create(leaseId, data, agentId, agencyId) {
    // Only filter by agentId/agencyId if provided (null means PLATFORM_ADMIN - no filter)
    const leaseQuery = { _id: leaseId };
    if (agencyId) {
      leaseQuery.agencyId = agencyId;
    } else if (agentId) {
      leaseQuery.agentId = agentId;
    }
    // If both are null, query only by _id (PLATFORM_ADMIN case)
    
    const lease = await Lease.findOne(leaseQuery).lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    // Issue 9: Prevent payment creation for terminated/cancelled leases
    if (lease.status === 'TERMINATED' || lease.status === 'CANCELLED') {
      throw new AppError(`Cannot create payment for ${lease.status} lease`, 400);
    }

    // Issue 18: Validate required fields
    if (!data.label || data.label.trim() === "") {
      throw new AppError("Payment label is required", 400);
    }
    if (!data.amountDue || Number(data.amountDue) <= 0) {
      throw new AppError("Payment amount must be a positive number", 400);
    }

    // Issue 6: Check for duplicate payments for same month (for RENT type)
    if (data.type === "RENT" && data.dueDate) {
      const dueDate = new Date(data.dueDate);
      const startOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
      const endOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59);

      const existing = await LeasePaymentRecord.findOne({
        leaseId,
        type: "RENT",
        dueDate: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $ne: "CANCELLED" },
      });

      if (existing) {
        throw new AppError("A rent payment record already exists for this month", 400);
      }
    }

    // Issue 8: Validate charges array
    if (data.charges && Array.isArray(data.charges)) {
      for (let i = 0; i < data.charges.length; i++) {
        const charge = data.charges[i];
        if (!charge.label || charge.label.trim() === "") {
          throw new AppError(`Charge ${i + 1} must have a label`, 400);
        }
        if (charge.amount === undefined || charge.amount === null) {
          throw new AppError(`Charge ${i + 1} must have an amount`, 400);
        }
        const amount = Number(charge.amount);
        if (isNaN(amount) || amount < 0) {
          throw new AppError(`Charge ${i + 1} amount must be a positive number`, 400);
        }
      }
    }

    const record = await LeasePaymentRecord.create({
      leaseId,
      agentId,
      type: data.type || "OTHER",
      label: data.label,
      dueDate: data.dueDate || null,
      amountDue: data.amountDue,
      status: data.status || "PENDING",
      amountPaid: null,
      paidDate: null,
      paymentMethod: null,
      paymentReference: null,
      notes: data.notes || null,
      charges: Array.isArray(data.charges)
        ? data.charges.map((c) => ({
            label: c.label,
            amount: c.amount,
            description: c.description || null,
            utilityType: c.utilityType || null,
          }))
        : [],
      invoiceUrl: null,
      receiptUrl: null,
      isFirstMonthRent: !!data.isFirstMonthRent,
      isSecurityDeposit: !!data.isSecurityDeposit,
    });

    // Generate invoice PDF
    try {
      const property = await Property.findById(lease.propertyId).lean();
      const tenant = await Tenant.findById(lease.tenantId).lean();
      const landlord = await Landlord.findById(lease.landlordId).lean();
      const agent = await User.findById(agentId).lean();

      if (property && tenant && landlord && agent) {
        const currencySettings = {
          currencySymbol: agent.currencySymbol || "$",
          currencyLocale: agent.currencyLocale || "en-US",
        };
        const invoiceUrl = await generateInvoicePDF(record, lease, property, tenant, landlord, agent, currencySettings);
        record.invoiceUrl = invoiceUrl;
        await record.save();
      }
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      // Don't fail the creation if PDF generation fails
    }

    await this._syncPrerequisitesForRecord(record);

    // Create notification for rent due
    try {
      const { notifyRentDue } = require("../../../utils/notificationHelper");
      await notifyRentDue(record._id, leaseId, agentId);
    } catch (error) {
      console.error("Error creating rent due notification:", error);
      // Don't fail payment record creation if notification fails
    }

    return record.toObject();
  }

  static async update(id, data, agentId, agencyId) {
    const record = await LeasePaymentRecord.findById(id);
    if (!record) {
      throw new AppError("Payment record not found", 404);
    }

    // Only filter by agentId/agencyId if provided (null means PLATFORM_ADMIN - no filter)
    const leaseQuery = { _id: record.leaseId };
    if (agencyId) {
      leaseQuery.agencyId = agencyId;
    } else if (agentId) {
      leaseQuery.agentId = agentId;
    }
    // If both are null, query only by _id (PLATFORM_ADMIN case)
    
    const lease = await Lease.findOne(leaseQuery).lean();
    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const wasPaid = record.status === "PAID";
    const willBePaid = data.status === "PAID" || (data.amountPaid && data.amountPaid > 0 && !data.status);

    // Issue 7: Prevent amount changes if commission is PAID
    if (wasPaid && (data.amountDue !== undefined || (data.charges !== undefined && Array.isArray(data.charges)))) {
      const existingCommission = await CommissionRecord.findOne({
        paymentRecordId: record._id,
        status: "PAID",
      }).lean();

      if (existingCommission) {
        throw new AppError("Cannot change payment amount after commission is paid", 400);
      }
    }

    if (data.type !== undefined) record.type = data.type;
    if (data.label !== undefined) record.label = data.label;
    if (data.dueDate !== undefined) record.dueDate = data.dueDate || null;
    if (data.amountDue !== undefined) record.amountDue = data.amountDue;
    if (data.status !== undefined) record.status = data.status;
    if (data.amountPaid !== undefined) record.amountPaid = data.amountPaid;
    if (data.paidDate !== undefined) record.paidDate = data.paidDate || null;
    if (data.paymentMethod !== undefined) record.paymentMethod = data.paymentMethod || null;
    if (data.paymentReference !== undefined) record.paymentReference = data.paymentReference || null;
    if (data.notes !== undefined) record.notes = data.notes || null;
    if (data.charges !== undefined && Array.isArray(data.charges)) {
      // Issue 8: Validate charges array
      for (let i = 0; i < data.charges.length; i++) {
        const charge = data.charges[i];
        if (!charge.label || charge.label.trim() === "") {
          throw new AppError(`Charge ${i + 1} must have a label`, 400);
        }
        if (charge.amount === undefined || charge.amount === null) {
          throw new AppError(`Charge ${i + 1} must have an amount`, 400);
        }
        const amount = Number(charge.amount);
        if (isNaN(amount) || amount < 0) {
          throw new AppError(`Charge ${i + 1} amount must be a positive number`, 400);
        }
      }

      record.charges = data.charges.map((c) => ({
        label: c.label,
        amount: c.amount,
        description: c.description || null,
        utilityType: c.utilityType || null,
      }));
    }

    // Auto-determine status if amountPaid is set but status is not
    if (data.amountPaid !== undefined && !data.status) {
      const totalAmountDue = Number(record.amountDue || 0) + 
        (Array.isArray(record.charges) ? record.charges.reduce((sum, c) => sum + Number(c.amount || 0), 0) : 0);
      const amountPaid = Number(data.amountPaid || 0);
      if (amountPaid >= totalAmountDue) {
        record.status = "PAID";
        if (!record.paidDate) record.paidDate = new Date();
      } else if (amountPaid > 0) {
        record.status = "PARTIALLY_PAID";
      }
    }

    await record.save();

    // Handle commission records based on payment status
    try {
      const existingCommission = await CommissionRecord.findOne({
        paymentRecordId: record._id,
      }).lean();

      if (record.status === "PAID") {
        // Payment is PAID - ensure commission exists and is up-to-date
        if (!existingCommission) {
          // Create new commission if payment just became PAID
          await CommissionService.calculateAndRecord(record, agentId, agencyId);
        } else {
          // Update existing commission (handles amount changes and reactivation)
          await CommissionService.recalculateAndUpdate(record, agentId, agencyId);
        }

        // Mark commission as PAID when tenant payment is fully paid
        await CommissionRecord.updateOne(
          { paymentRecordId: record._id },
          {
            status: "PAID",
            paidAt: record.paidDate || new Date(),
          }
        );
      } else if (wasPaid && existingCommission) {
        // Payment was PAID but is now not PAID - cancel commissions
        // This handles: CANCELLED, PENDING, PARTIALLY_PAID, SENT
        if (record.status !== "PAID") {
          await CommissionRecord.updateOne(
            { paymentRecordId: record._id },
            { status: "CANCELLED" }
          );
          await LandlordPayment.updateOne(
            { paymentRecordId: record._id },
            { status: "CANCELLED" }
          );
        }
      }
    } catch (error) {
      console.error("Error managing commissions:", error);
      // Don't fail the update if commission calculation fails
    }

    // Create notification for rent paid when status changes to PAID
    if (!wasPaid && record.status === "PAID") {
      try {
        const { notifyRentPaid } = require("../../../utils/notificationHelper");
        await notifyRentPaid(record._id, record.leaseId, agentId);
      } catch (error) {
        console.error("Error creating rent paid notification:", error);
        // Don't fail payment update if notification fails
      }
    }

    // Generate receipt PDF if status just became PAID
    if (!wasPaid && (record.status === "PAID" || willBePaid) && !record.receiptUrl) {
      try {
        const property = await Property.findById(lease.propertyId).lean();
        const tenant = await Tenant.findById(lease.tenantId).lean();
        const landlord = await Landlord.findById(lease.landlordId).lean();
        const agent = await User.findById(agentId).lean();

        if (property && tenant && landlord && agent) {
          const currencySettings = {
            currencySymbol: agent.currencySymbol || "$",
            currencyLocale: agent.currencyLocale || "en-US",
          };
          const receiptUrl = await generateReceiptPDF(record, lease, property, tenant, landlord, agent, currencySettings);
          record.receiptUrl = receiptUrl;
          await record.save();
        }
      } catch (error) {
        console.error("Error generating receipt PDF:", error);
        // Don't fail the update if PDF generation fails
      }
    }

    await this._syncPrerequisitesForRecord(record);

    return record.toObject();
  }

  static async _syncPrerequisitesForRecord(record) {
    if (record.status !== "PAID") {
      return;
    }

    const updates = [];

    if (record.isSecurityDeposit) {
      updates.push(
        LeasePrerequisite.updateOne(
          { leaseId: record.leaseId, type: "SECURITY_DEPOSIT_PAID" },
          {
            $set: {
              isCompleted: true,
              completedAt: record.paidDate || new Date(),
              amount: record.amountPaid || record.amountDue,
            },
          }
        )
      );
    }

    if (record.isFirstMonthRent) {
      updates.push(
        LeasePrerequisite.updateOne(
          { leaseId: record.leaseId, type: "FIRST_MONTH_RENT_PAID" },
          {
            $set: {
              isCompleted: true,
              completedAt: record.paidDate || new Date(),
              amount: record.amountPaid || record.amountDue,
            },
          }
        )
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }

  static async getByIdWithRelated(id, agentId, agencyId) {
    const record = await LeasePaymentRecord.findById(id).lean();
    if (!record) {
      throw new AppError("Payment record not found", 404);
    }

    // Only filter by agentId/agencyId if provided (null means PLATFORM_ADMIN - no filter)
    const leaseQuery = { _id: record.leaseId };
    if (agencyId) {
      leaseQuery.agencyId = agencyId;
    } else if (agentId) {
      leaseQuery.agentId = agentId;
    }
    // If both are null, query only by _id (PLATFORM_ADMIN case)
    
    const lease = await Lease.findOne(leaseQuery).lean();
    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    // Issue 17: Get related commission and landlord payment using reverse links, with fallback
    let commissionRecord = record.commissionRecordId
      ? await CommissionRecord.findById(record.commissionRecordId).lean()
      : null;

    let landlordPayment = record.landlordPaymentId
      ? await LandlordPayment.findById(record.landlordPaymentId).lean()
      : null;

    // Fallback: If reverse links missing, use forward links
    if (!commissionRecord) {
      commissionRecord = await CommissionRecord.findOne({
        paymentRecordId: record._id,
      }).lean();
    }

    if (!landlordPayment && commissionRecord) {
      landlordPayment = await LandlordPayment.findOne({
        commissionRecordId: commissionRecord._id,
      }).lean();
    }

    // Normalize Decimal128 amounts
    const normalizeAmount = (v) => {
      if (v === null || v === undefined) return null;
      try {
        if (v.constructor && v.constructor.name === "Decimal128") {
          return parseFloat(v.toString());
        }
        return typeof v === "number" ? v : parseFloat(v);
      } catch {
        return null;
      }
    };

    const normalizedRecord = {
      ...record,
      amountDue: normalizeAmount(record.amountDue),
      amountPaid: normalizeAmount(record.amountPaid),
      charges: Array.isArray(record.charges)
        ? record.charges.map((c) => ({
            ...c,
            amount: normalizeAmount(c.amount),
          }))
        : [],
    };

    const normalizedCommission = commissionRecord
      ? {
          ...commissionRecord,
          paymentAmount: normalizeAmount(commissionRecord.paymentAmount),
          agentGrossCommission: normalizeAmount(commissionRecord.agentGrossCommission),
          agentPlatformFee: normalizeAmount(commissionRecord.agentPlatformFee),
          agentNetCommission: normalizeAmount(commissionRecord.agentNetCommission),
          agencyGrossCommission: normalizeAmount(commissionRecord.agencyGrossCommission),
          agencyPlatformFee: normalizeAmount(commissionRecord.agencyPlatformFee),
          agencyNetCommission: normalizeAmount(commissionRecord.agencyNetCommission),
          platformCommission: normalizeAmount(commissionRecord.platformCommission),
          landlordNetAmount: normalizeAmount(commissionRecord.landlordNetAmount),
        }
      : null;

    const normalizedLandlordPayment = landlordPayment
      ? {
          ...landlordPayment,
          grossAmount: normalizeAmount(landlordPayment.grossAmount),
          netAmount: normalizeAmount(landlordPayment.netAmount),
          adjustments: Array.isArray(landlordPayment.adjustments)
            ? landlordPayment.adjustments.map((adj) => ({
                ...adj,
                amount: normalizeAmount(adj.amount),
              }))
            : [],
        }
      : null;

    return {
      paymentRecord: normalizedRecord,
      commissionRecord: normalizedCommission,
      landlordPayment: normalizedLandlordPayment,
      lease,
    };
  }

  /**
   * Get all payment records across all leases with filters
   * @param {string} agentId - Agent ID
   * @param {string|null} agencyId - Agency ID (if agency admin)
   * @param {Object} filters - Filter options
   * @returns {Object} - Payment records with related data and summary
   */
  static async getAllPayments(agentId, agencyId, filters = {}) {
    const {
      propertyId,
      tenantId,
      landlordId,
      status,
      type,
      dateFrom,
      dateTo,
      month,
      year,
      limit = 1000,
      offset = 0,
    } = filters;

    // Build lease query based on agent/agency (null means PLATFORM_ADMIN - no filter)
    const leaseQuery = {};
    if (agencyId) {
      leaseQuery.agencyId = agencyId;
    } else if (agentId) {
      leaseQuery.agentId = agentId;
    }
    // If both are null, query all leases (PLATFORM_ADMIN case)

    // Get all leases for this agent/agency (or all if PLATFORM_ADMIN)
    const leases = await Lease.find(leaseQuery)
      .select("_id propertyId tenantId landlordId")
      .lean();

    const leaseIds = leases.map((l) => l._id);

    if (leaseIds.length === 0) {
      return {
        records: [],
        summary: {
          total: 0,
          collected: 0,
          pending: 0,
          overdue: 0,
        },
        filterOptions: {
          properties: [],
          tenants: [],
          landlords: [],
        },
      };
    }

    // Build payment query
    const paymentQuery = { leaseId: { $in: leaseIds } };

    // Apply filters
    if (status && status !== "all") {
      paymentQuery.status = status;
    }

    if (type && type !== "all") {
      paymentQuery.type = type;
    }

    if (dateFrom || dateTo) {
      paymentQuery.dueDate = {};
      if (dateFrom) {
        paymentQuery.dueDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        paymentQuery.dueDate.$lte = new Date(dateTo);
      }
    }

    if (month) {
      paymentQuery.dueDate = paymentQuery.dueDate || {};
      paymentQuery.dueDate.$gte = new Date(year || new Date().getFullYear(), month - 1, 1);
      paymentQuery.dueDate.$lte = new Date(year || new Date().getFullYear(), month, 0, 23, 59, 59);
    }

    if (year && !month) {
      paymentQuery.dueDate = paymentQuery.dueDate || {};
      paymentQuery.dueDate.$gte = new Date(year, 0, 1);
      paymentQuery.dueDate.$lte = new Date(year, 11, 31, 23, 59, 59);
    }

    // Get payment records
    let records = await LeasePaymentRecord.find(paymentQuery)
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    // Filter by property, tenant, landlord if specified
    if (propertyId || tenantId || landlordId) {
      const filteredLeases = leases.filter((lease) => {
        if (propertyId && lease.propertyId !== propertyId) return false;
        if (tenantId && lease.tenantId !== tenantId) return false;
        if (landlordId && lease.landlordId !== landlordId) return false;
        return true;
      });

      const filteredLeaseIds = filteredLeases.map((l) => l._id);
      records = records.filter((r) => filteredLeaseIds.includes(r.leaseId));
    }

    // Populate related data
    const leaseMap = new Map(leases.map((l) => [l._id, l]));

    // Get unique property, tenant, landlord IDs for filter options
    const propertyIds = [...new Set(leases.map((l) => l.propertyId).filter(Boolean))];
    const tenantIds = [...new Set(leases.map((l) => l.tenantId).filter(Boolean))];
    const landlordIds = [...new Set(leases.map((l) => l.landlordId).filter(Boolean))];

    const [properties, tenants, landlords] = await Promise.all([
      Property.find({ _id: { $in: propertyIds } })
        .select("_id title address city")
        .lean(),
      Tenant.find({ _id: { $in: tenantIds } })
        .select("_id firstName lastName email")
        .lean(),
      Landlord.find({ _id: { $in: landlordIds } })
        .select("_id contactPersonName email")
        .lean(),
    ]);

    const propertyMap = new Map(properties.map((p) => [p._id, p]));
    const tenantMap = new Map(tenants.map((t) => [t._id, t]));
    const landlordMap = new Map(landlords.map((l) => [l._id, l]));

    // Normalize Decimal128 amounts
    const normalizeAmount = (v) => {
      if (v === null || v === undefined) return null;
      try {
        if (typeof v === "number") return v;
        if (typeof v === "string") return parseFloat(v);
        if (typeof v === "object" && v !== null) {
          if (typeof v.toString === "function") {
            const n = parseFloat(v.toString());
            return Number.isNaN(n) ? null : n;
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    // Enrich records with related data
    const enrichedRecords = records.map((record) => {
      const lease = leaseMap.get(record.leaseId);
      const property = lease ? propertyMap.get(lease.propertyId) : null;
      const tenant = lease ? tenantMap.get(lease.tenantId) : null;
      const landlord = lease ? landlordMap.get(lease.landlordId) : null;

      return {
        ...record,
        amountDue: normalizeAmount(record.amountDue),
        amountPaid: normalizeAmount(record.amountPaid),
        charges: Array.isArray(record.charges)
          ? record.charges.map((c) => ({
              ...c,
              amount: normalizeAmount(c.amount),
            }))
          : [],
        property: property || null,
        tenant: tenant || null,
        landlord: landlord || null,
        lease: lease
          ? {
              _id: lease._id,
              propertyId: lease.propertyId,
              tenantId: lease.tenantId,
              landlordId: lease.landlordId,
            }
          : null,
      };
    });

    // Calculate summary
    const allRecords = await LeasePaymentRecord.find({
      leaseId: { $in: leaseIds },
    }).lean();

    const summary = {
      total: allRecords.reduce((sum, r) => sum + (normalizeAmount(r.amountDue) || 0), 0),
      collected: allRecords
        .filter((r) => r.status === "PAID")
        .reduce((sum, r) => sum + (normalizeAmount(r.amountPaid) || 0), 0),
      pending: allRecords
        .filter((r) => r.status === "PENDING" || r.status === "SENT")
        .reduce((sum, r) => sum + (normalizeAmount(r.amountDue) || 0), 0),
      overdue: allRecords
        .filter((r) => {
          const isOverdue =
            (r.status === "PENDING" || r.status === "SENT") &&
            r.dueDate &&
            new Date(r.dueDate) < new Date();
          return isOverdue;
        })
        .reduce((sum, r) => sum + (normalizeAmount(r.amountDue) || 0), 0),
    };

    return {
      records: enrichedRecords,
      summary,
      filterOptions: {
        properties: properties.map((p) => ({
          id: p._id,
          title: p.title || p.address || "Property",
        })),
        tenants: tenants.map((t) => ({
          id: t._id,
          name: `${t.firstName || ""} ${t.lastName || ""}`.trim() || t.email || "Tenant",
        })),
        landlords: landlords.map((l) => ({
          id: l._id,
          name: l.contactPersonName || l.email || "Landlord",
        })),
      },
    };
  }

  /**
   * Delete a payment record and all related records
   * @param {string} id - Payment record ID
   * @param {string} agentId - Agent ID
   * @param {string|null} agencyId - Agency ID
   * @returns {Object} - Deleted payment record
   */
  static async delete(id, agentId, agencyId) {
    const record = await LeasePaymentRecord.findById(id);
    if (!record) {
      throw new AppError("Payment record not found", 404);
    }

    const leaseQuery = agencyId
      ? { _id: record.leaseId, agencyId }
      : { _id: record.leaseId, agentId };
    const lease = await Lease.findOne(leaseQuery).lean();
    if (!lease) {
      throw new AppError("Lease not found or access denied", 404);
    }

    // Find and delete related statement rows
    // Statement rows are linked through leaseId, periodMonth, and periodYear
    // When payment records are created from imports, paymentReference is set to "IMPORT-{rowId}"
    const AgentStatementRow = require("../../../models/AgentStatementRow");
    const mongoose = require("mongoose");
    
    if (record.dueDate) {
      const dueDate = new Date(record.dueDate);
      const periodMonth = dueDate.getMonth() + 1;
      const periodYear = dueDate.getFullYear();

      // Build query to find statement rows that match this payment record
      const query = {
        leaseId: record.leaseId,
        periodMonth,
        periodYear,
        status: "APPLIED",
      };

      // If payment record has a paymentReference like "IMPORT-{rowId}", extract the rowId
      if (record.paymentReference && record.paymentReference.startsWith("IMPORT-")) {
        const rowIdString = record.paymentReference.replace("IMPORT-", "");
        // Convert string to ObjectId for matching
        try {
          const rowId = new mongoose.Types.ObjectId(rowIdString);
          query._id = rowId;
        } catch (e) {
          // If conversion fails, try matching by string
          query._id = rowIdString;
        }
      } else if (record.paymentReference) {
        // If paymentReference doesn't match the pattern, try exact match
        query.paymentReference = record.paymentReference;
      }

      const statementRows = await AgentStatementRow.find(query);

      // Delete matching statement rows
      if (statementRows.length > 0) {
        await AgentStatementRow.deleteMany({
          _id: { $in: statementRows.map((r) => r._id) },
        });
      }
    }

    // Delete related commission records
    const CommissionRecord = require("../../../models/CommissionRecord");
    await CommissionRecord.deleteMany({ paymentRecordId: record._id });

    // Delete related landlord payments
    await LandlordPayment.deleteMany({ paymentRecordId: record._id });

    // Delete related notifications
    const Notification = require("../../../models/Notification");
    await Notification.deleteMany({ paymentRecordId: record._id });

    // Delete the payment record itself
    await LeasePaymentRecord.findByIdAndDelete(id);

    return record.toObject();
  }

}

module.exports = LeasePaymentService;


