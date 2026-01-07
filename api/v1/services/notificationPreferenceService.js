const NotificationPreference = require("../../../models/NotificationPreference");
const AppError = require("../../../utils/appError");

class NotificationPreferenceService {
  static async getByUserId(userId) {
    let preferences = await NotificationPreference.findOne({ userId }).lean();

    if (!preferences) {
      preferences = await NotificationPreference.create({
        userId,
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        popupEnabled: false,
        quietStartHr: null,
        quietEndHr: null,
        mutedTypes: [],
      });
    }

    return preferences;
  }

  static async update(userId, data) {
    const updateData = {};

    if (data.inAppEnabled !== undefined) updateData.inAppEnabled = data.inAppEnabled;
    if (data.emailEnabled !== undefined) updateData.emailEnabled = data.emailEnabled;
    if (data.smsEnabled !== undefined) updateData.smsEnabled = data.smsEnabled;
    if (data.popupEnabled !== undefined) updateData.popupEnabled = data.popupEnabled;
    if (data.quietStartHr !== undefined) updateData.quietStartHr = data.quietStartHr || null;
    if (data.quietEndHr !== undefined) updateData.quietEndHr = data.quietEndHr || null;
    if (data.mutedTypes !== undefined) {
      updateData.mutedTypes = Array.isArray(data.mutedTypes) ? data.mutedTypes : [];
    }

    if (updateData.quietStartHr !== undefined && updateData.quietStartHr !== null) {
      if (updateData.quietStartHr < 0 || updateData.quietStartHr > 23) {
        throw new AppError("Quiet start hour must be between 0 and 23", 400);
      }
    }

    if (updateData.quietEndHr !== undefined && updateData.quietEndHr !== null) {
      if (updateData.quietEndHr < 0 || updateData.quietEndHr > 23) {
        throw new AppError("Quiet end hour must be between 0 and 23", 400);
      }
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { userId },
      updateData,
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return preferences;
  }
}

module.exports = NotificationPreferenceService;

