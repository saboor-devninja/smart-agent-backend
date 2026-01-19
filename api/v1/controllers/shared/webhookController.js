const EmailService = require("../../services/emailService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;
const config = require("../../../../config/config");

exports.resendWebhook = tryCatchAsync(async (req, res, next) => {
  const event = req.body;

  if (event.type === "email.received") {
    const emailData = event.data;

    // Extract email body from various possible fields (Resend webhook structure may vary)
    let textBody = emailData.text || emailData.body || "";
    let htmlBody = emailData.html || null;

    // Check content object if it exists
    if (!textBody && emailData.content) {
      textBody = emailData.content.text || emailData.content.body || "";
      htmlBody = htmlBody || emailData.content.html || null;
    }

    // Check raw body fields
    if (!textBody) {
      textBody = emailData.raw_body || emailData.rawBody || "";
    }

    // Extract headers - could be in different formats
    let headers = emailData.headers || {};
    
    // If headers are not provided, try to extract from message_id or other fields
    // Resend might provide headers in a different structure
    if (!headers || Object.keys(headers).length === 0) {
      headers = {};
      
      // Try to extract common headers from the data
      if (emailData.message_id) {
        headers["message-id"] = emailData.message_id;
      }
      if (emailData["in-reply-to"]) {
        headers["in-reply-to"] = emailData["in-reply-to"];
      }
      if (emailData.in_reply_to) {
        headers["in-reply-to"] = emailData.in_reply_to;
      }
      if (emailData.references) {
        headers["references"] = emailData.references;
      }
      if (emailData.reply_to) {
        headers["reply-to"] = emailData.reply_to;
      }
    }

    // If body is still missing, fetch from Resend API using email_id
    const emailId = emailData.email_id;
    if ((!textBody || !htmlBody) && emailId && config.email?.resendApiKey) {
      try {
        console.log(`📧 Fetching email content from Resend API for email_id: ${emailId}`);
        const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${config.email.resendApiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const emailContent = await response.json();
          
          // Update text and HTML body from API response
          if (emailContent.text && !textBody) {
            textBody = emailContent.text;
            console.log("✅ Fetched text body from Resend API");
          }
          if (emailContent.html && !htmlBody) {
            htmlBody = emailContent.html;
            console.log("✅ Fetched HTML body from Resend API");
          }

          // Also update headers if available
          if (emailContent.headers && Object.keys(emailContent.headers).length > 0) {
            headers = { ...headers, ...emailContent.headers };
          }

          // Update other fields that might be useful
          if (emailContent.from && !emailData.from) {
            emailData.from = typeof emailContent.from === "string" 
              ? emailContent.from 
              : emailContent.from?.email || emailData.from;
          }

          // Update subject if missing
          if (emailContent.subject && !emailData.subject) {
            emailData.subject = emailContent.subject;
          }
        } else {
          console.error(
            `❌ Error fetching email from Resend API: ${response.status} ${response.statusText}`
          );
          const errorText = await response.text();
          console.error("❌ Error details:", errorText);
        }
      } catch (fetchError) {
        console.error("❌ Error fetching email from Resend API:", fetchError.message);
        // Continue processing even if API fetch fails
      }
    }

    // Extract 'to' field - could be array or string
    const toField = emailData.to || [];

    // Log for debugging
    console.log("📧 Processing incoming email:", {
      from: emailData.from,
      subject: emailData.subject,
      hasText: !!textBody,
      hasHtml: !!htmlBody,
      to: toField,
      messageId: emailData.message_id,
    });

    try {
      const result = await EmailService.processIncomingEmail({
        from: emailData.from,
        subject: emailData.subject || "(no subject)",
        text: textBody,
        html: htmlBody,
        headers: headers,
        to: toField,
        messageId: emailData.message_id || emailData.message_id,
      });

      if (result) {
        if (result.type === "reply") {
          console.log("Email reply processed successfully:", result.data._id);
        } else if (result.type === "inbound") {
          console.log("Inbound email processed successfully:", result.data._id);
        }
      } else {
        console.log("Email processed but no action taken (not a reply or inbound to known identity)");
      }
    } catch (error) {
      console.error("Error processing incoming email:", error);
      // Don't throw - we still want to return 200 to Resend
    }
  }

  return apiResponse.successResponse(res, {}, "Webhook processed", success);
});
