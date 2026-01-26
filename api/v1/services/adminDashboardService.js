const User = require("../../../models/User");
const Property = require("../../../models/Property");
const Lease = require("../../../models/Lease");
const CommissionRecord = require("../../../models/CommissionRecord");
const LandlordPayment = require("../../../models/LandlordPayment");

class AdminDashboardService {
  static async getDashboardStats() {
    // Get total users (agents and agency admins only, not platform admins)
    const totalUsers = await User.countDocuments({
      role: { $in: ["AGENT", "AGENCY_ADMIN"] },
    });

    // Get total properties
    const totalProperties = await Property.countDocuments({});

    // Get active leases
    const activeLeases = await Lease.countDocuments({
      status: "ACTIVE",
    });

    // Calculate platform revenue from CommissionRecord.platformCommission
    // This is the total platform commission collected from all paid commissions
    const commissionRecords = await CommissionRecord.aggregate([
      {
        $match: {
          status: "PAID",
        },
      },
      {
        $group: {
          _id: null,
          totalPlatformRevenue: {
            $sum: {
              $cond: [
                { $ifNull: ["$platformCommission", false] },
                { $toDouble: "$platformCommission" },
                0,
              ],
            },
          },
        },
      },
    ]);

    const platformRevenue = commissionRecords[0]?.totalPlatformRevenue || 0;

    // Convert Decimal128 to number if needed
    const normalizeAmount = (value) => {
      if (!value) return 0;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const num = parseFloat(value);
        return Number.isNaN(num) ? 0 : num;
      }
      // Handle Decimal128
      if (value.toString) {
        const num = parseFloat(value.toString());
        return Number.isNaN(num) ? 0 : num;
      }
      return 0;
    };

    return {
      totalUsers,
      totalProperties,
      activeLeases,
      platformRevenue: normalizeAmount(platformRevenue),
    };
  }
}

module.exports = AdminDashboardService;
