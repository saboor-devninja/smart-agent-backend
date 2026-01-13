const EmailService = require("../../services/emailService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;

exports.resendWebhook = tryCatchAsync(async (req, res, next) => {
  const event = req.body;

  if (event.type === "email.received") {
    const emailData = event.data;

    try {
      const result = await EmailService.processIncomingEmail({
        from: emailData.from,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        headers: emailData.headers || {},
        to: emailData.to,
      });

      if (result) {
        if (result.type === "reply") {
          console.log("Email reply processed successfully:", result.data._id);
        } else if (result.type === "inbound") {
          console.log("Inbound email processed successfully:", result.data._id);
        }
      }
    } catch (error) {
      console.error("Error processing incoming email:", error);
    }
  }

  return apiResponse.successResponse(res, {}, "Webhook processed", success);
});
