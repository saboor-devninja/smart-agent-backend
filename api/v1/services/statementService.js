const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const LandlordPayment = require("../../../models/LandlordPayment");
const CommissionRecord = require("../../../models/CommissionRecord");
const Landlord = require("../../../models/Landlord");
const Tenant = require("../../../models/Tenant");
const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");

class StatementService {
  static async getCombinedStatements(agentId, filters = {}) {
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

    const now = new Date();
    const queryFilters = { agentId };

    if (filters.startDate) {
      queryFilters.createdAt = { ...queryFilters.createdAt, $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      queryFilters.createdAt = {
        ...queryFilters.createdAt,
        $lte: new Date(filters.endDate + "T23:59:59"),
      };
    }

    // Get all landlords for this agent
    const landlords = await Landlord.find({ agentId }).select("_id firstName lastName isOrganization organizationName").lean();

    // Get all tenants through leases
    const leases = await Lease.find({ agentId }).select("tenantId").lean();
    const tenantIds = [...new Set(leases.map((l) => l.tenantId))];
    const tenants = await Tenant.find({ _id: { $in: tenantIds } })
      .select("_id firstName lastName email")
      .lean();

    // Get landlord payments - filter by dueDate or createdAt within date range
    const landlordPaymentQuery = { agentId };
    const dateRangeQuery = {};
    if (filters.startDate) {
      dateRangeQuery.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      dateRangeQuery.$lte = new Date(filters.endDate + "T23:59:59");
    }
    if (Object.keys(dateRangeQuery).length > 0) {
      // Filter by dueDate if available, otherwise createdAt
      landlordPaymentQuery.$or = [
        { dueDate: dateRangeQuery },
        { createdAt: dateRangeQuery },
      ];
    }
    if (filters.status && filters.status !== "all") {
      landlordPaymentQuery.status = filters.status;
    }

    const landlordPayments = await LandlordPayment.find(landlordPaymentQuery)
      .populate("leaseId", "leaseNumber")
      .populate("propertyId", "title address")
      .lean();

    // Get tenant payments (lease payment records) - filter by dueDate within date range
    const tenantPaymentQuery = { agentId, type: "RENT" };
    if (filters.startDate) {
      tenantPaymentQuery.dueDate = { ...tenantPaymentQuery.dueDate, $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
      tenantPaymentQuery.dueDate = {
        ...tenantPaymentQuery.dueDate,
        $lte: new Date(filters.endDate + "T23:59:59"),
      };
    }
    if (filters.status && filters.status !== "all") {
      tenantPaymentQuery.status = filters.status;
    }

    const tenantPayments = await LeasePaymentRecord.find(tenantPaymentQuery)
      .populate({
        path: "leaseId",
        select: "leaseNumber tenantId propertyId",
        populate: [
          { path: "tenantId", select: "firstName lastName email" },
          { path: "propertyId", select: "title address" },
        ],
      })
      .lean();

    // Build combined statements
    const statements = [];

    // Add landlord statements
    const landlordMap = new Map();
    landlords.forEach((landlord) => {
      const payments = landlordPayments.filter((p) => p.landlordId === landlord._id);
      const total = payments.reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const paid = payments
        .filter((p) => p.status === "PAID" || p.status === "PROCESSED")
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const unpaid = payments
        .filter((p) => p.status !== "PAID" && p.status !== "PROCESSED" && p.status !== "CANCELLED")
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const overdue = payments
        .filter((p) => {
          if (p.status === "PAID" || p.status === "PROCESSED" || p.status === "CANCELLED") return false;
          if (!p.dueDate) return false;
          return new Date(p.dueDate) < now;
        })
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const partial = payments
        .filter((p) => p.status === "PARTIALLY_PAID")
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);

      if (payments.length > 0 || total > 0) {
        landlordMap.set(landlord._id, {
          _id: landlord._id,
          type: "LANDLORD",
          name: landlord.isOrganization
            ? landlord.organizationName
            : `${landlord.firstName} ${landlord.lastName}`,
          email: null,
          total,
          paid,
          unpaid,
          overdue,
          partial,
          paymentCount: payments.length,
        });
      }
    });

    // Add tenant statements
    const tenantMap = new Map();
    tenants.forEach((tenant) => {
      const payments = tenantPayments.filter(
        (p) => p.leaseId?.tenantId?._id === tenant._id || p.leaseId?.tenantId === tenant._id
      );
      const total = payments.reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);
      const paid = payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + normalizeAmount(p.amountPaid || p.amountDue), 0);
      const unpaid = payments
        .filter((p) => p.status !== "PAID" && p.status !== "CANCELLED")
        .reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);
      const overdue = payments
        .filter((p) => {
          if (p.status === "PAID" || p.status === "CANCELLED") return false;
          if (!p.dueDate) return false;
          return new Date(p.dueDate) < now;
        })
        .reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);
      const partial = payments
        .filter((p) => p.status === "PARTIALLY_PAID")
        .reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);

      if (payments.length > 0 || total > 0) {
        tenantMap.set(tenant._id, {
          _id: tenant._id,
          type: "TENANT",
          name: `${tenant.firstName} ${tenant.lastName}`,
          email: tenant.email || null,
          total,
          paid,
          unpaid,
          overdue,
          partial,
          paymentCount: payments.length,
        });
      }
    });

    // Combine and return
    return {
      landlords: Array.from(landlordMap.values()),
      tenants: Array.from(tenantMap.values()),
    };
  }

  static async getStatementDetails(agentId, type, id, filters = {}) {
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

    const now = new Date();

    if (type === "LANDLORD") {
      const landlord = await Landlord.findOne({ _id: id, agentId })
        .select("_id firstName lastName isOrganization organizationName email phoneNumber")
        .lean();

      if (!landlord) {
        throw new Error("Landlord not found");
      }

      const paymentQuery = { agentId, landlordId: id };
      const dateRangeQuery = {};
      if (filters.startDate) {
        dateRangeQuery.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateRangeQuery.$lte = new Date(filters.endDate + "T23:59:59");
      }
      if (Object.keys(dateRangeQuery).length > 0) {
        paymentQuery.$or = [
          { dueDate: dateRangeQuery },
          { createdAt: dateRangeQuery },
        ];
      }
      if (filters.status && filters.status !== "all") {
        paymentQuery.status = filters.status;
      }

      const payments = await LandlordPayment.find(paymentQuery)
        .populate("leaseId", "leaseNumber startDate endDate")
        .populate("propertyId", "title address")
        .populate("paymentRecordId", "label type")
        .sort({ createdAt: -1 })
        .lean();

      const total = payments.reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const paid = payments
        .filter((p) => p.status === "PAID" || p.status === "PROCESSED")
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const unpaid = payments
        .filter((p) => p.status !== "PAID" && p.status !== "PROCESSED" && p.status !== "CANCELLED")
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const overdue = payments
        .filter((p) => {
          if (p.status === "PAID" || p.status === "PROCESSED" || p.status === "CANCELLED") return false;
          if (!p.dueDate) return false;
          return new Date(p.dueDate) < now;
        })
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);
      const partial = payments
        .filter((p) => p.status === "PARTIALLY_PAID")
        .reduce((sum, p) => sum + normalizeAmount(p.netAmount), 0);

      return {
        type: "LANDLORD",
        entity: {
          _id: landlord._id,
          name: landlord.isOrganization
            ? landlord.organizationName
            : `${landlord.firstName} ${landlord.lastName}`,
          email: landlord.email || null,
          phoneNumber: landlord.phoneNumber || null,
        },
        payments: payments.map((p) => ({
          _id: p._id,
          docNumber: p.docNumber,
          leaseNumber: p.leaseId?.leaseNumber || "-",
          propertyTitle: p.propertyId?.title || "-",
          propertyAddress: p.propertyId?.address || "-",
          label: p.paymentRecordId?.label || "Payment",
          grossAmount: normalizeAmount(p.grossAmount),
          netAmount: normalizeAmount(p.netAmount),
          adjustments: p.adjustments || [],
          status: p.status,
          dueDate: p.dueDate,
          paidAt: p.paidAt || null,
          createdAt: p.createdAt,
        })),
        totals: {
          total,
          paid,
          unpaid,
          overdue,
          partial,
          count: payments.length,
        },
      };
    } else if (type === "TENANT") {
      const tenant = await Tenant.findOne({ _id: id }).select("_id firstName lastName email phoneNumber").lean();

      if (!tenant) {
        throw new Error("Tenant not found");
      }

      // Get leases for this tenant
      const leases = await Lease.find({ agentId, tenantId: id }).select("_id").lean();
      const leaseIds = leases.map((l) => l._id);

      if (leaseIds.length === 0) {
        return {
          type: "TENANT",
          entity: {
            _id: tenant._id,
            name: `${tenant.firstName} ${tenant.lastName}`,
            email: tenant.email || null,
            phoneNumber: tenant.phoneNumber || null,
          },
          payments: [],
          totals: { total: 0, paid: 0, unpaid: 0, overdue: 0, partial: 0, count: 0 },
        };
      }

      const paymentQuery = { agentId, leaseId: { $in: leaseIds }, type: "RENT" };
      if (filters.startDate) {
        paymentQuery.dueDate = { ...paymentQuery.dueDate, $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        paymentQuery.dueDate = {
          ...paymentQuery.dueDate,
          $lte: new Date(filters.endDate + "T23:59:59"),
        };
      }
      if (filters.status && filters.status !== "all") {
        paymentQuery.status = filters.status;
      }

      const payments = await LeasePaymentRecord.find(paymentQuery)
        .populate({
          path: "leaseId",
          select: "leaseNumber startDate endDate propertyId",
          populate: {
            path: "propertyId",
            select: "title address",
          },
        })
        .sort({ dueDate: -1, createdAt: -1 })
        .lean();

      const total = payments.reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);
      const paid = payments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + normalizeAmount(p.amountPaid || p.amountDue), 0);
      const unpaid = payments
        .filter((p) => p.status !== "PAID" && p.status !== "CANCELLED")
        .reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);
      const overdue = payments
        .filter((p) => {
          if (p.status === "PAID" || p.status === "CANCELLED") return false;
          if (!p.dueDate) return false;
          return new Date(p.dueDate) < now;
        })
        .reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);
      const partial = payments
        .filter((p) => p.status === "PARTIALLY_PAID")
        .reduce((sum, p) => sum + normalizeAmount(p.amountDue), 0);

      return {
        type: "TENANT",
        entity: {
          _id: tenant._id,
          name: `${tenant.firstName} ${tenant.lastName}`,
          email: tenant.email || null,
          phoneNumber: tenant.phoneNumber || null,
        },
        payments: payments.map((p) => ({
          _id: p._id,
          invoiceNumber: p.invoiceNumber,
          receiptNumber: p.receiptNumber,
          leaseNumber: p.leaseId?.leaseNumber || "-",
          propertyTitle: p.leaseId?.propertyId?.title || "-",
          propertyAddress: p.leaseId?.propertyId?.address || "-",
          label: p.label,
          amountDue: normalizeAmount(p.amountDue),
          amountPaid: normalizeAmount(p.amountPaid),
          charges: p.charges || [],
          status: p.status,
          dueDate: p.dueDate,
          paidDate: p.paidDate || null,
          createdAt: p.createdAt,
        })),
        totals: {
          total,
          paid,
          unpaid,
          overdue,
          partial,
          count: payments.length,
        },
      };
    }

    throw new Error("Invalid type. Must be LANDLORD or TENANT");
  }

  /**
   * Get generic statement - aggregates all tenant payments, landlord payments, and commissions
   * Shows all records in one consolidated view
   */
  static async getGenericStatement(agentId, filters = {}) {
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

    // Build date range query
    const dateRangeQuery = {};
    if (filters.startDate) {
      dateRangeQuery.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      dateRangeQuery.$lte = new Date(filters.endDate + "T23:59:59");
    }

    // Get all tenant payment records (invoices/receipts)
    const tenantPaymentQuery = { agentId, type: "RENT" };
    if (Object.keys(dateRangeQuery).length > 0) {
      tenantPaymentQuery.dueDate = dateRangeQuery;
    }
    if (filters.status && filters.status !== "all") {
      tenantPaymentQuery.status = filters.status;
    }

    const tenantPayments = await LeasePaymentRecord.find(tenantPaymentQuery)
      .populate({
        path: "leaseId",
        select: "leaseNumber tenantId landlordId propertyId",
        populate: [
          { path: "tenantId", select: "firstName lastName email" },
          { path: "landlordId", select: "firstName lastName isOrganization organizationName" },
          { path: "propertyId", select: "title address" },
        ],
      })
      .sort({ dueDate: -1, createdAt: -1 })
      .lean();

    // Get all landlord payments
    const landlordPaymentQuery = { agentId };
    if (Object.keys(dateRangeQuery).length > 0) {
      landlordPaymentQuery.$or = [
        { dueDate: dateRangeQuery },
        { createdAt: dateRangeQuery },
      ];
    }
    if (filters.status && filters.status !== "all") {
      landlordPaymentQuery.status = filters.status;
    }

    const landlordPayments = await LandlordPayment.find(landlordPaymentQuery)
      .populate("paymentRecordId", "_id")
      .lean();

    // Get all commission records
    const commissionQuery = { agentId };
    if (Object.keys(dateRangeQuery).length > 0) {
      commissionQuery.createdAt = dateRangeQuery;
    }
    if (filters.status && filters.status !== "all") {
      commissionQuery.status = filters.status;
    }

    const commissions = await CommissionRecord.find(commissionQuery)
      .populate("paymentRecordId", "_id")
      .lean();

    // Create maps for quick lookup
    const landlordPaymentMap = new Map();
    landlordPayments.forEach((lp) => {
      if (lp.paymentRecordId?._id) {
        landlordPaymentMap.set(lp.paymentRecordId._id.toString(), lp);
      }
    });

    const commissionMap = new Map();
    commissions.forEach((c) => {
      if (c.paymentRecordId?._id) {
        commissionMap.set(c.paymentRecordId._id.toString(), c);
      }
    });

    // Combine all records
    const records = tenantPayments.map((tp) => {
      const landlordPayment = landlordPaymentMap.get(tp._id.toString());
      const commission = commissionMap.get(tp._id.toString());

      const charges = Array.isArray(tp.charges) ? tp.charges : [];
      const totalCharges = charges.reduce((sum, c) => sum + normalizeAmount(c.amount), 0);
      const totalAmountDue = normalizeAmount(tp.amountDue) + totalCharges;

      return {
        paymentRecordId: tp._id,
        tenant: {
          _id: tp.leaseId?.tenantId?._id || null,
          name: tp.leaseId?.tenantId
            ? `${tp.leaseId.tenantId.firstName} ${tp.leaseId.tenantId.lastName}`
            : "-",
          email: tp.leaseId?.tenantId?.email || null,
        },
        landlord: {
          _id: tp.leaseId?.landlordId?._id || null,
          name: tp.leaseId?.landlordId
            ? tp.leaseId.landlordId.isOrganization
              ? tp.leaseId.landlordId.organizationName
              : `${tp.leaseId.landlordId.firstName} ${tp.leaseId.landlordId.lastName}`
            : "-",
        },
        property: {
          _id: tp.leaseId?.propertyId?._id || null,
          title: tp.leaseId?.propertyId?.title || "-",
          address: tp.leaseId?.propertyId?.address || "-",
        },
        leaseNumber: tp.leaseId?.leaseNumber || "-",
        invoiceReceipt: {
          label: tp.label,
          amountDue: totalAmountDue,
          amountPaid: normalizeAmount(tp.amountPaid),
          status: tp.status,
          paidDate: tp.paidDate || null,
          invoiceNumber: tp.invoiceNumber || null,
          receiptNumber: tp.receiptNumber || null,
        },
        landlordPayment: landlordPayment
          ? {
              _id: landlordPayment._id,
              netAmount: normalizeAmount(landlordPayment.netAmount),
              grossAmount: normalizeAmount(landlordPayment.grossAmount),
              status: landlordPayment.status,
              paidAt: landlordPayment.paidAt || null,
              paymentMethod: landlordPayment.paymentMethod || null,
              paymentReference: landlordPayment.paymentReference || null,
            }
          : null,
        agentCommission: commission
          ? {
              _id: commission._id,
              agentNetCommission: normalizeAmount(commission.agentNetCommission),
              agentGrossCommission: normalizeAmount(commission.agentGrossCommission),
              status: commission.status,
              paidAt: commission.paidAt || null,
            }
          : null,
        dueDate: tp.dueDate,
        createdAt: tp.createdAt,
      };
    });

    return {
      records,
      totals: {
        totalRecords: records.length,
        tenantPaymentsTotal: records.reduce((sum, r) => sum + r.invoiceReceipt.amountDue, 0),
        tenantPaymentsPaid: records
          .filter((r) => r.invoiceReceipt.status === "PAID")
          .reduce((sum, r) => sum + r.invoiceReceipt.amountPaid, 0),
        landlordPaymentsTotal: records
          .filter((r) => r.landlordPayment)
          .reduce((sum, r) => sum + (r.landlordPayment?.netAmount || 0), 0),
        landlordPaymentsPaid: records
          .filter((r) => r.landlordPayment && (r.landlordPayment.status === "PAID" || r.landlordPayment.status === "PROCESSED"))
          .reduce((sum, r) => sum + (r.landlordPayment?.netAmount || 0), 0),
        commissionsTotal: records
          .filter((r) => r.agentCommission)
          .reduce((sum, r) => sum + (r.agentCommission?.agentNetCommission || 0), 0),
        commissionsPaid: records
          .filter((r) => r.agentCommission && r.agentCommission.status === "PAID")
          .reduce((sum, r) => sum + (r.agentCommission?.agentNetCommission || 0), 0),
      },
    };
  }
}

module.exports = StatementService;

