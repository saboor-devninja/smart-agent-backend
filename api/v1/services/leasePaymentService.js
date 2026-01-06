const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const LeasePrerequisite = require("../../../models/LeasePrerequisite");
const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");
const Tenant = require("../../../models/Tenant");
const Landlord = require("../../../models/Landlord");
const User = require("../../../models/User");
const AppError = require("../../../utils/appError");
const { generateInvoicePDF, generateReceiptPDF } = require("../../../utils/pdfGenerator");

class LeasePaymentService {
  static async getByLease(leaseId, agentId, agencyId) {
    const leaseQuery = agencyId ? { _id: leaseId, agencyId } : { _id: leaseId, agentId };
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

    records = records.map((r) => ({
      ...r,
      amountDue: normalizeAmount(r.amountDue),
      amountPaid: normalizeAmount(r.amountPaid),
      charges: Array.isArray(r.charges)
        ? r.charges.map((c) => ({
            ...c,
            amount: normalizeAmount(c.amount),
          }))
        : [],
    }));

    return { lease, records };
  }

  static async create(leaseId, data, agentId, agencyId) {
    const leaseQuery = agencyId ? { _id: leaseId, agencyId } : { _id: leaseId, agentId };
    const lease = await Lease.findOne(leaseQuery).lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
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
        const invoiceUrl = await generateInvoicePDF(record, lease, property, tenant, landlord, agent);
        record.invoiceUrl = invoiceUrl;
        await record.save();
      }
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      // Don't fail the creation if PDF generation fails
    }

    await this._syncPrerequisitesForRecord(record);

    return record.toObject();
  }

  static async update(id, data, agentId, agencyId) {
    const record = await LeasePaymentRecord.findById(id);
    if (!record) {
      throw new AppError("Payment record not found", 404);
    }

    const leaseQuery = agencyId
      ? { _id: record.leaseId, agencyId }
      : { _id: record.leaseId, agentId };
    const lease = await Lease.findOne(leaseQuery).lean();
    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const wasPaid = record.status === "PAID";
    const willBePaid = data.status === "PAID" || (data.amountPaid && data.amountPaid > 0 && !data.status);

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
      record.charges = data.charges.map((c) => ({
        label: c.label,
        amount: c.amount,
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

    // Generate receipt PDF if status just became PAID
    if (!wasPaid && (record.status === "PAID" || willBePaid) && !record.receiptUrl) {
      try {
        const property = await Property.findById(lease.propertyId).lean();
        const tenant = await Tenant.findById(lease.tenantId).lean();
        const landlord = await Landlord.findById(lease.landlordId).lean();
        const agent = await User.findById(agentId).lean();

        if (property && tenant && landlord && agent) {
          const receiptUrl = await generateReceiptPDF(record, lease, property, tenant, landlord, agent);
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
}

module.exports = LeasePaymentService;


