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

    // Rent Collection Metrics
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
      const amount = normalizeAmount(p.amountDue);
      total += amount;

      if (p.status === "PAID") {
        collected += amount;
      } else if (p.status === "PENDING" || p.status === "PARTIALLY_PAID") {
        if (p.dueDate && new Date(p.dueDate) < now) {
          overdue += amount;
        } else {
          pending += amount;
        }
      }
    });

    // Commission Metrics (Current Month)
    const commissionsThisMonth = await CommissionRecord.find({
      agentId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }).lean();

    // Commission Metrics (Previous Month)
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const commissionsPreviousMonth = await CommissionRecord.find({
      agentId,
      createdAt: { $gte: startOfPreviousMonth, $lte: endOfPreviousMonth },
    }).lean();

    let commissionEarned = 0;
    let platformFeeDue = 0;
    let platformFeePaid = 0;
    let platformFeePreviousMonth = 0;
    let netEarnings = 0;

    // Current month calculations
    commissionsThisMonth.forEach((c) => {
      const gross = normalizeAmount(c.agentGrossCommission);
      const platformFee = normalizeAmount(c.agentPlatformFee);
      const net = normalizeAmount(c.agentNetCommission);

      // Commission earned: Total gross commission
      commissionEarned += gross;
      
      // Net earnings: Agent earnings after platform fee (commission - platform fee)
      netEarnings += net;

      // Platform fee due: All platform fees from current month commissions
      // Commissions are only created when tenant payment is PAID, so this shows platform fee for this month
      platformFeeDue += platformFee;

      // Platform fee paid: Only count platform fees that have been marked as paid
      if (c.platformFeePaid === true) {
        platformFeePaid += platformFee;
      }
    });

    // Previous month platform fee calculation
    commissionsPreviousMonth.forEach((c) => {
      const platformFee = normalizeAmount(c.agentPlatformFee);
      platformFeePreviousMonth += platformFee;
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
      status: "PENDING",
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

    const mapPayment = (p) => {
      const lease = p.leaseId;
      const property = lease?.propertyId || null;
      const tenant = lease?.tenantId || null;

      return {
        _id: p._id,
        status: p.status,
        dueDate: p.dueDate,
        paidDate: p.paidDate || null,
        amountDue: normalizeAmount(p.amountDue),
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
        platformFeeDue,
        platformFeePaid,
        platformFeePreviousMonth,
        netEarnings,
      },
      recentRentPayments: recentPaid.map(mapPayment),
      upcomingRentDue: upcomingDue.map(mapPayment),
    };
  }
}

module.exports = FinanceDashboardService;


