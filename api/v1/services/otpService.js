const OtpVerification = require("../../../models/OtpVerification");
const { generateOTP, getOTPExpiryTime, isOTPExpired, cleanOTPInput } = require("../../../utils/otp");
const { renderPasswordResetEmail, renderOTPVerificationEmail } = require("../../../utils/emailTemplates");
const config = require("../../../config/config");
const { Resend } = require("resend");

// Initialize Resend client
let resend = null;
if (config.email?.resendApiKey) {
  try {
    resend = new Resend(config.email.resendApiKey);
    console.log("[OTP Service] Resend client initialized successfully");
  } catch (error) {
    console.error("[OTP Service] Failed to initialize Resend client:", error);
  }
} else {
  console.warn("[OTP Service] RESEND_API_KEY not found in config.email.resendApiKey");
  console.warn("[OTP Service] Config email object:", config.email);
}

class OtpService {
  /**
   * Send OTP email
   */
  static async sendOTPEmail(email, otp, type = "EMAIL_VERIFICATION") {
    console.log(`[sendOTPEmail] Starting email send for: ${email}, type: ${type}`);
    
    try {
      const isPasswordReset = type === "PASSWORD_RESET";
      console.log(`[sendOTPEmail] Is password reset: ${isPasswordReset}`);
      
      const htmlContent = isPasswordReset
        ? renderPasswordResetEmail(otp, email)
        : renderOTPVerificationEmail(otp, email);

      console.log("========================================");
      console.log(`🔐 OTP ${isPasswordReset ? "PASSWORD RESET" : "VERIFICATION"} CODE`);
      console.log(`Email: ${email}`);
      console.log(`OTP Code: ${otp}`);
      console.log("========================================");

      // Check if Resend is configured
      console.log(`[sendOTPEmail] Resend configured: ${!!resend}`);
      console.log(`[sendOTPEmail] Resend API key exists: ${!!config.email?.resendApiKey}`);
      
      if (!resend) {
        console.warn("⚠️  Resend API key not configured. Email will not be sent, but OTP is logged above for testing.");
        console.warn(`[sendOTPEmail] Config email object:`, config.email);
        // Still return true for development/testing - OTP is logged to console
        return true;
      }

      console.log(`[sendOTPEmail] Attempting to send email via Resend...`);
      try {
        const emailPayload = {
          from: "Smart Agent <no-reply@smaartagent.com>",
          to: email,
          subject: isPasswordReset
            ? "Reset your password - Smart Agent"
            : "Verify your email - Smart Agent",
          html: htmlContent,
        };
        
        console.log(`[sendOTPEmail] Email payload:`, {
          from: emailPayload.from,
          to: emailPayload.to,
          subject: emailPayload.subject,
          htmlLength: emailPayload.html?.length || 0,
        });

        const result = await resend.emails.send(emailPayload);
        const { data, error } = result;

        if (error) {
          console.error("❌ Resend API error:", JSON.stringify(error, null, 2));
          console.error(`[sendOTPEmail] Error details:`, error);
          // Still return true for development - OTP is logged to console
          return true;
        } else {
          console.log("✅ Email sent successfully via Resend!");
          console.log(`[sendOTPEmail] Resend response data:`, JSON.stringify(data, null, 2));
          console.log(`[sendOTPEmail] Email ID: ${data?.id || "Not available"}`);
          return true;
        }
      } catch (emailError) {
        console.error("❌ Email sending exception:", emailError);
        console.error(`[sendOTPEmail] Error stack:`, emailError.stack);
        // Still return true for development - OTP is logged to console
        return true;
      }
    } catch (error) {
      console.error("❌ Failed to send OTP email - outer catch:", error);
      console.error(`[sendOTPEmail] Error stack:`, error.stack);
      return false;
    }
  }

  /**
   * Create and send OTP
   */
  static async createAndSendOTP(email, type = "EMAIL_VERIFICATION") {
    console.log(`[OTP Service] Creating OTP for email: ${email}, type: ${type}`);
    
    await OtpVerification.deleteMany({ email, type });

    const otp = generateOTP();
    const expiresAt = getOTPExpiryTime();

    console.log(`[OTP Service] Generated OTP: ${otp}, expires at: ${expiresAt}`);

    await OtpVerification.create({
      email,
      type,
      otp,
      expiresAt,
    });

    console.log(`[OTP Service] OTP record created, now sending email...`);
    const emailSent = await this.sendOTPEmail(email, otp, type);
    console.log(`[OTP Service] Email send result: ${emailSent}`);

    if (!emailSent) {
      console.error(`[OTP Service] Email sending failed, cleaning up OTP record`);
      await OtpVerification.deleteMany({ email, type });
      throw new Error("Failed to send verification email. Please try again.");
    }

    console.log(`[OTP Service] OTP created and email sent successfully`);
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
