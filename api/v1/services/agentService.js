const User = require("../../../models/User");
const Property = require("../../../models/Property");
const Lease = require("../../../models/Lease");
const LeasePaymentRecord = require("../../../models/LeasePaymentRecord");
const CommissionRecord = require("../../../models/CommissionRecord");
const AppError = require("../../../utils/appError");
const bcrypt = require("bcryptjs");

class AgentService {
  /**
   * Get all agents in an agency
   * @param {string} agencyId - Agency ID
   * @returns {Array} - List of agents
   */
  static async getAgencyAgents(agencyId) {
    const agents = await User.find({
      agencyId,
      role: "AGENT",
      isIndependent: false,
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return agents;
  }

  /**
   * Create a new agent for an agency
   * @param {Object} data - Agent data
   * @param {string} agencyId - Agency ID
   * @returns {Object} - Created agent
   */
  static async createAgent(data, agencyId) {
    const { email, password, firstName, lastName, phone, city, country } = data;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError("User with this email already exists", 400);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create agent
    const agent = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      city: city || null,
      country: country || null,
      role: "AGENT",
      agencyId,
      isIndependent: false,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    agent.password = undefined;

    return agent;
  }

  /**
   * Get agent details with statistics
   * @param {string} agentId - Agent ID
   * @param {string} agencyId - Agency ID (for verification)
   * @returns {Object} - Agent with statistics
   */
  static async getAgentDetail(agentId, agencyId) {
    // Verify agent belongs to agency
    const agent = await User.findOne({
      _id: agentId,
      agencyId,
      role: "AGENT",
      isIndependent: false,
    })
      .select("-password")
      .lean();

    if (!agent) {
      throw new AppError("Agent not found", 404);
    }

    // Calculate statistics in parallel
    const [
      totalProperties,
      activeLeases,
      totalRentCollected,
      currentMonthRentCollected,
      totalCommissionsEarned,
      currentMonthCommissionsEarned,
      occupiedProperties,
      properties,
      recentCommissions,
      recentRentPayments,
    ] = await Promise.all([
      // Total properties managed
      Property.countDocuments({ agentId }),
      // Active leases count
      Lease.countDocuments({ agentId, status: "ACTIVE" }),
      // Total rent collected (all time) - sum of amountPaid for PAID records
      LeasePaymentRecord.aggregate([
        {
          $match: {
            agentId,
            status: "PAID",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$amountPaid" } },
          },
        },
      ]),
      // Current month rent collected
      LeasePaymentRecord.aggregate([
        {
          $match: {
            agentId,
            status: "PAID",
            paidDate: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              $lte: new Date(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                0,
                23,
                59,
                59
              ),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$amountPaid" } },
          },
        },
      ]),
      // Total commissions earned (all time)
      CommissionRecord.aggregate([
        {
          $match: { agentId },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$agentNetCommission" } },
          },
        },
      ]),
      // Current month commissions
      CommissionRecord.aggregate([
        {
          $match: {
            agentId,
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              $lte: new Date(
                new Date().getFullYear(),
                new Date().getMonth() + 1,
                0,
                23,
                59,
                59
              ),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $toDouble: "$agentNetCommission" } },
          },
        },
      ]),
      // Occupied properties (properties with active leases)
      Property.countDocuments({
        agentId,
        _id: {
          $in: await Lease.distinct("propertyId", { agentId, status: "ACTIVE" }),
        },
      }),
      // Properties with details
      Property.find({ agentId })
        .populate("landlordId", "firstName lastName isOrganization organizationName")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      // Recent commissions (last 10)
      CommissionRecord.find({ agentId })
        .populate("leaseId", "tenantId")
        .populate("propertyId", "title address")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // Recent rent payments (last 10)
      LeasePaymentRecord.find({ agentId })
        .populate("leaseId", "tenantId")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    // Normalize Decimal128 amounts
    const normalizeAmount = (v) => {
      if (v === null || v === undefined) return 0;
      try {
        if (typeof v === "number") return v;
        if (typeof v === "string") return parseFloat(v) || 0;
        if (typeof v === "object" && v !== null) {
          if (typeof v.toString === "function") {
            const n = parseFloat(v.toString());
            return Number.isNaN(n) ? 0 : n;
          }
        }
        return 0;
      } catch {
        return 0;
      }
    };

    // Calculate occupancy rate
    const occupancyRate =
      totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

    // Calculate average commission per property
    const avgCommissionPerProperty =
      totalProperties > 0 ? totalCommissionsEarned[0]?.total || 0 / totalProperties : 0;

    // Enrich properties with tenant info
    const enrichedProperties = await Promise.all(
      properties.map(async (prop) => {
        const activeLease = await Lease.findOne({
          propertyId: prop._id,
          status: "ACTIVE",
        })
          .populate("tenantId", "firstName lastName")
          .lean();
        return {
          ...prop,
          activeLease: activeLease
            ? {
                _id: activeLease._id,
                tenant: activeLease.tenantId
                  ? {
                      _id: activeLease.tenantId._id,
                      firstName: activeLease.tenantId.firstName,
                      lastName: activeLease.tenantId.lastName,
                    }
                  : null,
              }
            : null,
        };
      })
    );

    // Enrich commissions with property/tenant info
    const enrichedCommissions = recentCommissions.map((comm) => ({
      ...comm,
      agentNetCommission: normalizeAmount(comm.agentNetCommission),
      agentGrossCommission: normalizeAmount(comm.agentGrossCommission),
      agentPlatformFee: normalizeAmount(comm.agentPlatformFee),
    }));

    // Enrich payments with property/tenant info
    const enrichedPayments = await Promise.all(
      recentRentPayments.map(async (payment) => {
        const lease = await Lease.findById(payment.leaseId)
          .populate("propertyId", "title address")
          .populate("tenantId", "firstName lastName")
          .lean();
        return {
          ...payment,
          amountDue: normalizeAmount(payment.amountDue),
          amountPaid: normalizeAmount(payment.amountPaid),
          property: lease?.propertyId || null,
          tenant: lease?.tenantId || null,
        };
      })
    );

    return {
      agent,
      statistics: {
        totalProperties,
        activeLeases,
        totalRentCollected: normalizeAmount(totalRentCollected[0]?.total || 0),
        currentMonthRentCollected: normalizeAmount(currentMonthRentCollected[0]?.total || 0),
        totalCommissionsEarned: normalizeAmount(totalCommissionsEarned[0]?.total || 0),
        currentMonthCommissionsEarned: normalizeAmount(
          currentMonthCommissionsEarned[0]?.total || 0
        ),
        occupancyRate,
        avgCommissionPerProperty,
      },
      properties: enrichedProperties,
      recentCommissions: enrichedCommissions,
      recentRentPayments: enrichedPayments,
    };
  }

  /**
   * Update agent information
   * @param {string} agentId - Agent ID
   * @param {Object} data - Update data
   * @param {string} agencyId - Agency ID (for verification)
   * @returns {Object} - Updated agent
   */
  static async updateAgent(agentId, data, agencyId) {
    // Verify agent belongs to agency
    const agent = await User.findOne({
      _id: agentId,
      agencyId,
      role: "AGENT",
      isIndependent: false,
    });

    if (!agent) {
      throw new AppError("Agent not found", 404);
    }

    // Update allowed fields
    const updateData = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: data.email.toLowerCase(),
        _id: { $ne: agentId },
      });
      if (existingUser) {
        throw new AppError("Email already in use", 400);
      }
      updateData.email = data.email.toLowerCase();
    }
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.country !== undefined) updateData.country = data.country || null;

    // Update password if provided
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const updatedAgent = await User.findByIdAndUpdate(agentId, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    return updatedAgent;
  }

  /**
   * Delete agent (soft delete by setting isActive to false)
   * @param {string} agentId - Agent ID
   * @param {string} agencyId - Agency ID (for verification)
   * @returns {Object} - Deleted agent
   */
  static async deleteAgent(agentId, agencyId) {
    // Verify agent belongs to agency
    const agent = await User.findOne({
      _id: agentId,
      agencyId,
      role: "AGENT",
      isIndependent: false,
    });

    if (!agent) {
      throw new AppError("Agent not found", 404);
    }

    // Check if agent has active leases or properties
    const activeLeases = await Lease.countDocuments({
      agentId,
      status: "ACTIVE",
    });
    const properties = await Property.countDocuments({ agentId });

    if (activeLeases > 0 || properties > 0) {
      throw new AppError(
        "Cannot delete agent with active leases or properties. Please reassign them first.",
        400
      );
    }

    // Soft delete by setting isActive to false
    const deletedAgent = await User.findByIdAndUpdate(
      agentId,
      { isActive: false },
      { new: true }
    ).select("-password");

    return deletedAgent;
  }
}

module.exports = AgentService;
