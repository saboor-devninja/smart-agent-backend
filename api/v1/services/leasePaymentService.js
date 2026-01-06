const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const LeasePrerequisite = require("../../../models/LeasePrerequisite");
const Lease = require("../../../models/Lease");
const AppError = require("../../../utils/appError");

class LeasePaymentService {
  static async getByLease(leaseId, agentId, agencyId) {
    const leaseQuery = agencyId ? { _id: leaseId, agencyId } : { _id: leaseId, agentId };
    const lease = await Lease.findOne(leaseQuery).lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const records = await LeasePaymentRecord.find({ leaseId })
      .sort({ dueDate: -1, createdAt: -1 })
      .lean();

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
      amountPaid: data.amountPaid || null,
      paidDate: data.paidDate || null,
      paymentMethod: data.paymentMethod || null,
      paymentReference: data.paymentReference || null,
      notes: data.notes || null,
      charges: Array.isArray(data.charges)
        ? data.charges.map((c) => ({
            label: c.label,
            amount: c.amount,
          }))
        : [],
      invoiceUrl: data.invoiceUrl || null,
      receiptUrl: data.receiptUrl || null,
      isFirstMonthRent: !!data.isFirstMonthRent,
      isSecurityDeposit: !!data.isSecurityDeposit,
    });

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
    if (data.invoiceUrl !== undefined) record.invoiceUrl = data.invoiceUrl || null;
    if (data.receiptUrl !== undefined) record.receiptUrl = data.receiptUrl || null;

    await record.save();

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


