const LeasePrerequisite = require("../../../models/LeasePrerequisite");
const Lease = require("../../../models/Lease");
const AppError = require("../../../utils/appError");

class LeasePrerequisiteService {
  static async getByLease(leaseId, agentId, agencyId) {
    const lease = await Lease.findOne(
      agencyId ? { _id: leaseId, agencyId } : { _id: leaseId, agentId }
    ).lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const prerequisites = await LeasePrerequisite.find({ leaseId })
      .sort({ isRequired: -1, priority: 1, createdAt: 1 })
      .lean();

    return { lease, prerequisites };
  }

  static async create(leaseId, data, agentId, agencyId) {
    const lease = await Lease.findOne(
      agencyId ? { _id: leaseId, agencyId } : { _id: leaseId, agentId }
    ).lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const prerequisite = await LeasePrerequisite.create({
      leaseId,
      agentId,
      type: data.type || "CUSTOM",
      title: data.title,
      description: data.description || null,
      isRequired: data.isRequired !== undefined ? data.isRequired : true,
      amount: data.amount || null,
      dueDate: data.dueDate || null,
      priority: data.priority || 1,
      notes: data.notes || null,
      documentUrl: data.documentUrl || null,
      customType: data.customType || null,
    });

    return prerequisite.toObject();
  }

  static async updateStatus(id, isCompleted, userId) {
    const prerequisite = await LeasePrerequisite.findById(id);

    if (!prerequisite) {
      throw new AppError("Prerequisite not found", 404);
    }

    prerequisite.isCompleted = isCompleted;
    prerequisite.completedAt = isCompleted ? new Date() : null;
    prerequisite.completedBy = isCompleted ? userId : null;

    await prerequisite.save();

    return prerequisite.toObject();
  }

  static async getRequiredIncompleteCount(leaseId) {
    const count = await LeasePrerequisite.countDocuments({
      leaseId,
      isRequired: true,
      isCompleted: false,
    });
    return count;
  }

  static async createDefaultForLease(lease, agentId) {
    const existingCount = await LeasePrerequisite.countDocuments({ leaseId: lease._id });
    if (existingCount > 0) {
      return;
    }

    const docs = [];

    docs.push({
      leaseId: lease._id,
      agentId,
      type: "FIRST_MONTH_RENT_PAID",
      title: "First month rent paid",
      description: "Confirm the first month rent has been received before starting the lease.",
      isRequired: true,
      isCompleted: false,
      priority: 1,
      amount: lease.rentAmount || null,
    });

    docs.push({
      leaseId: lease._id,
      agentId,
      type: "SECURITY_DEPOSIT_PAID",
      title: "Security deposit received",
      description: "Confirm the full security deposit has been received.",
      isRequired: true,
      isCompleted: false,
      priority: 2,
      amount: lease.securityDeposit || null,
    });

    docs.push({
      leaseId: lease._id,
      agentId,
      type: "DOCUMENTS_SIGNED",
      title: "Lease documents signed",
      description: "Ensure all required documents have been signed (including DocuSign envelopes).",
      isRequired: true,
      isCompleted: false,
      priority: 3,
    });

    await LeasePrerequisite.insertMany(docs);
  }

  static async revalidateAmountsForLease(leaseId, rentAmount, securityDeposit) {
    const updates = [];

    if (rentAmount !== undefined) {
      updates.push(
        LeasePrerequisite.updateMany(
          {
            leaseId,
            type: "FIRST_MONTH_RENT_PAID",
            isCompleted: false,
          },
          {
            $set: {
              amount: rentAmount || null,
            },
          }
        )
      );
    }

    if (securityDeposit !== undefined) {
      updates.push(
        LeasePrerequisite.updateMany(
          {
            leaseId,
            type: "SECURITY_DEPOSIT_PAID",
            isCompleted: false,
          },
          {
            $set: {
              amount: securityDeposit || null,
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

module.exports = LeasePrerequisiteService;


