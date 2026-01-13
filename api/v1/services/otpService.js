const OtpVerification = require("../../../models/OtpVerification");
const { generateOTP, getOTPExpiryTime, isOTPExpired, cleanOTPInput } = require("../../../utils/otp");
const { renderPasswordResetEmail, renderOTPVerificationEmail } = require("../../../utils/emailTemplates");
const config = require("../../../config/config");
const { Resend } = require("resend");

const resend = config.email?.resendApiKey ? new Resend(config.email.resendApiKey) : null;

class OtpService {
  /**
   * Send OTP email
   */
  static async sendOTPEmail(email, otp, type = "EMAIL_VERIFICATION") {
    try {
      const isPasswordReset = type === "PASSWORD_RESET";
      const htmlContent = isPasswordReset
        ? renderPasswordResetEmail(otp, email)
        : renderOTPVerificationEmail(otp, email);

      console.log("========================================");
      console.log(`🔐 OTP ${isPasswordReset ? "PASSWORD RESET" : "VERIFICATION"} CODE (TEST MODE)`);
      console.log(`Email: ${email}`);
      console.log(`OTP Code: ${otp}`);
      console.log("========================================");

      if (resend) {
        try {
          const { data, error } = await resend.emails.send({
            from: "Smart Agent <no-reply@smaartagent.com>",
            to: email,
            subject: isPasswordReset
              ? "Reset your password - Smart Agent"
              : "Verify your email - Smart Agent",
            html: htmlContent,
          });

          if (error) {
            console.error("Resend API error (continuing with test):", error);
          } else {
            console.log("Email sent successfully:", data);
          }
        } catch (emailError) {
          console.error("Email sending failed (continuing with test):", emailError);
        }
      }

      return true;
    } catch (error) {
      console.error("Failed to send OTP email:", error);
      return false;
    }
  }

  /**
   * Create and send OTP
   */
  static async createAndSendOTP(email, type = "EMAIL_VERIFICATION") {
    await OtpVerification.deleteMany({ email, type });

    const otp = generateOTP();
    const expiresAt = getOTPExpiryTime();

    await OtpVerification.create({
      email,
      type,
      otp,
      expiresAt,
    });

    const emailSent = await this.sendOTPEmail(email, otp, type);

    if (!emailSent) {
      await OtpVerification.deleteMany({ email, type });
      throw new Error("Failed to send verification email. Please try again.");
    }

    return { success: true, otp };
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(email, otp, type = "EMAIL_VERIFICATION") {
    const cleanedOtp = cleanOTPInput(otp);
    const otpRecord = await OtpVerification.findOne({ email, type });

    if (!otpRecord) {
      return { success: false, message: "Verification code not found. Please request a new one." };
    }

    if (otpRecord.isExpired()) {
      return { success: false, message: "Verification code has expired. Please request a new one." };
    }

    if (otpRecord.hasExceededAttempts()) {
      return {
        success: false,
        message: "Maximum verification attempts exceeded. Please request a new code.",
      };
    }

    if (otpRecord.otp !== cleanedOtp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return { success: false, message: "Invalid verification code." };
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return { success: true, message: "Verification code verified successfully." };
  }

  /**
   * Get OTP record
   */
  static async getOTPRecord(email, type = "EMAIL_VERIFICATION") {
    return await OtpVerification.findOne({ email, type });
  }

  /**
   * Delete OTP records
   */
  static async deleteOTPRecords(email, type = "EMAIL_VERIFICATION") {
    return await OtpVerification.deleteMany({ email, type });
  }
}

module.exports = OtpService;
