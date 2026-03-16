const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const CommissionRecord = require("../../../models/CommissionRecord");

class FinanceDashboardService {
  static async getDashboard(agentId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const normalizeAmount = (v) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = parseFloat(v);
        return Number.isNaN(n) ? 0 : n;
      }
      if (typeof v === "object" && v !== null && typeof v.toString === "function") {
        const n = parseFloat(v.toString());
        return Number.isNaN(n) ? 0 : n;
      }
      return 0;
    };

    // Rent Collection Metrics - Current Month
    const baseQuery = {
      agentId,
      type: "RENT",
      dueDate: { $gte: startOfMonth, $lte: endOfMonth },
    };

    const paymentsThisMonth = await LeasePaymentRecord.find(baseQuery)
      .sort({ dueDate: 1 })
      .lean();

    let pending = 0;
    let collected = 0;
    let overdue = 0;
    let total = 0;

    paymentsThisMonth.forEach((p) => {
      // Skip CANCELLED - don't count toward collection metrics
      if (p.status === "CANCELLED") return;

      const amountDue = normalizeAmount(p.amountDue);
      const charges = Array.isArray(p.charges) ? p.charges : [];
      const totalCharges = charges.reduce((sum, c) => sum + normalizeAmount(c.amount), 0);
      const totalAmount = amountDue + totalCharges;

      total += totalAmount;

      if (p.status === "PAID") {
        collected += totalAmount;
      } else if (p.status === "PARTIALLY_PAID") {
        const amountPaid = normalizeAmount(p.amountPaid);
        collected += amountPaid;
        const remainder = totalAmount - amountPaid;
        if (p.dueDate && new Date(p.dueDate) < now) {
          overdue += remainder;
        } else {
          pending += remainder;
        }
      } else if (p.status === "PENDING" || p.status === "SENT" || p.status === "OVERDUE") {
        // SENT = invoice sent; OVERDUE = cron updated from PENDING when past due
        if (p.dueDate && new Date(p.dueDate) < now) {
          overdue += totalAmount;
        } else {
          pending += totalAmount;
        }
      }
    });

    // Rent Collection overdue = current month only (payments due this month that are past due)
    // Overdue from past months is shown in the Overdue Rent list below, not in this card

    // Commission Metrics - align with Rent Collection (by due date, not paid date)
    // Platform Fee: use LeasePaymentRecord.platformFeeAmount (all statuses: PENDING, PAID, CANCELLED, etc.)
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const paidPaymentIdsThisMonth = paymentsThisMonth
      .filter((p) => p.status === "PAID" || p.status === "PARTIALLY_PAID")
      .map((p) => p._id);

    const paymentsDuePrevMonth = await LeasePaymentRecord.find({
      agentId,
      type: "RENT",
      dueDate: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
    })
      .select("_id platformFeeAmount")
      .lean();

    const commissionsThisMonth = await CommissionRecord.find({
      agentId,
      paymentRecordId: { $in: paidPaymentIdsThisMonth },
    }).lean();

    let commissionEarned = 0;
    let platformFeeTotal = 0;
    let platformFeeOverdue = 0;
    let platformFeePaid = 0;
    let platformFeePreviousMonth = 0;
    let netEarnings = 0;

    // Platform Fee: total, overdue, paid - from payments DUE this month
    paymentsThisMonth.forEach((p) => {
      const fee = normalizeAmount(p.platformFeeAmount);
      platformFeeTotal += fee;

      if (p.platformFeePaid === true) {
        platformFeePaid += fee;
      } else if (fee > 0 && p.dueDate && new Date(p.dueDate) < now) {
        // Overdue: platform fee not paid, due date has passed
        platformFeeOverdue += fee;
      }
    });

    // Commission earned, net earnings = from CommissionRecords (PAID payments only)
    commissionsThisMonth.forEach((c) => {
      const gross = normalizeAmount(c.agentGrossCommission);
      const net = normalizeAmount(c.agentNetCommission);

      commissionEarned += gross;
      netEarnings += net;
    });

    // Platform Fee Previous Month = sum of platformFeeAmount from payments due previous month
    paymentsDuePrevMonth.forEach((p) => {
      platformFeePreviousMonth += normalizeAmount(p.platformFeeAmount);
    });

    const Lease = require("../../../models/Lease");
    const Property = require("../../../models/Property");
    const Tenant = require("../../../models/Tenant");

    // Recent Rent Payments
    const recentPaid = await LeasePaymentRecord.find({
      agentId,
      type: "RENT",
      status: "PAID",
    })
      .sort({ paidDate: -1, createdAt: -1 })
      .limit(5)
      .populate({
        path: "leaseId",
        select: "propertyId tenantId",
        populate: [
          { path: "propertyId", select: "title address" },
          { path: "tenantId", select: "firstName lastName" },
        ],
      })
      .lean();

    // Upcoming Rent Due
    const upcomingDue = await LeasePaymentRecord.find({
      agentId,
      type: "RENT",
      status: { $in: ["PENDING", "SENT"] },
      dueDate: { $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
    })
      .sort({ dueDate: 1 })
      .limit(5)
      .populate({
        path: "leaseId",
        select: "propertyId tenantId",
        populate: [
          { path: "propertyId", select: "title address" },
          { path: "tenantId", select: "firstName lastName" },
        ],
      })
      .lean();

    // Overdue Rent (past due, unpaid - from any month)
    const overduePayments = await LeasePaymentRecord.find({
      agentId,
      type: "RENT",
      status: { $in: ["PENDING", "SENT", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { $lt: now },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .populate({
        path: "leaseId",
        select: "propertyId tenantId",
        populate: [
          { path: "propertyId", select: "title address" },
          { path: "tenantId", select: "firstName lastName" },
        ],
      })
      .lean();

    const mapPayment = (p) => {
      const lease = p.leaseId;
      const property = lease?.propertyId || null;
      const tenant = lease?.tenantId || null;
      const amountDue = normalizeAmount(p.amountDue);
      const charges = Array.isArray(p.charges) ? p.charges : [];
      const totalCharges = charges.reduce((sum, c) => sum + normalizeAmount(c.amount), 0);
      const totalAmount = amountDue + totalCharges;
      const amountPaid = normalizeAmount(p.amountPaid);
      const amountOutstanding = p.status === "PARTIALLY_PAID" ? totalAmount - amountPaid : totalAmount;

      return {
        _id: p._id,
        status: p.status,
        dueDate: p.dueDate,
        paidDate: p.paidDate || null,
        amountDue: totalAmount,
        amountOutstanding,
        property: property
          ? {
              _id: property._id,
              title: property.title,
              address: property.address,
            }
          : null,
        tenant: tenant
          ? {
              _id: tenant._id,
              firstName: tenant.firstName,
              lastName: tenant.lastName,
            }
          : null,
      };
    };

    return {
      rentCollection: {
        pending,
        collected,
        overdue,
        total,
      },
      commission: {
        earned: commissionEarned,
        platformFeeTotal,
        platformFeeOverdue,
        platformFeePaid,
        platformFeePreviousMonth,
        netEarnings,
      },
      recentRentPayments: recentPaid.map(mapPayment),
      upcomingRentDue: upcomingDue.map(mapPayment),
      overdueRentPayments: overduePayments.map(mapPayment),
    };
  }
}

module.exports = FinanceDashboardService;


