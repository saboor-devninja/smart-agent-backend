const crypto = require("crypto");
const SentEmail = require("../../../models/SentEmail");
const EmailReply = require("../../../models/EmailReply");
const EmailIdentity = require("../../../models/EmailIdentity");
const config = require("../../../config/config");
const { Resend } = require("resend");

const resend = config.email?.resendApiKey ? new Resend(config.email.resendApiKey) : null;

class EmailService {
  /**
   * Get or create email identity for user
   */
  static async getOrCreateEmailIdentity(userId, userRole) {
    let identity = await EmailIdentity.findOne({ userId, isDefault: true });

    if (!identity) {
      const User = require("../../../models/User");
      const user = await User.findById(userId).lean();

      if (!user) {
        throw new Error("User not found");
      }

      const displayName = user.role === "AGENCY_ADMIN" && user.companyName
        ? user.companyName
        : `${user.firstName} ${user.lastName}`;

      const email = `${user.email.split("@")[0]}@smaartagent.com`;

      identity = await EmailIdentity.create({
        userId,
        email,
        displayName,
        role: userRole || user.role,
        isDefault: true,
        isActive: true,
      });
    }

    return identity;
  }

  /**
   * Send email
   */
  static async sendEmail(senderId, recipients, subject, body, htmlBody, attachments = [], options = {}) {
    const identity = await this.getOrCreateEmailIdentity(senderId, options.role);

    const tempId = crypto.randomUUID();
    const replyToEmail = `reply-${tempId}@smaartagent.com`;
    const threadId = options.threadId || tempId; // Use provided threadId or create new one

    // Store the original htmlBody (before wrapping) in database
    // We'll wrap it in full HTML document structure when sending to Resend
    const sentEmail = await SentEmail.create({
      senderId,
      fromEmailIdentityId: identity._id,
      subject,
      body,
      htmlBody: htmlBody || null, // Store original, not wrapped version
      recipients,
      attachments,
      status: "PENDING",
      replyToEmail,
      threadId,
      isKyc: options.isKyc || false,
      tenantId: options.tenantId,
      landlordId: options.landlordId,
    });

    if (resend) {
      try {
        const recipientEmails = Array.isArray(recipients)
          ? recipients.map((r) => (typeof r === "string" ? r : r.email))
          : [recipients];

        const emailPromises = recipientEmails.map(async (recipientEmail, index) => {
          const uniqueMessageId = `<${tempId}-${index}@smaartagent.com>`;

          // Wrap HTML in proper document structure for email clients
          // htmlBody is already sanitized by XSS in the controller (preserves <p>, <br>, etc.)
          let formattedHtml = htmlBody;
          
          if (formattedHtml) {
            // If HTML doesn't start with <html>, wrap it in a proper HTML structure
            // This ensures email clients recognize it as HTML
            const trimmedHtml = formattedHtml.trim();
            if (!trimmedHtml.toLowerCase().startsWith("<!doctype") && !trimmedHtml.toLowerCase().startsWith("<html")) {
              // Wrap the sanitized HTML content in a complete HTML document
              formattedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
${trimmedHtml}
</body>
</html>`;
            }
          } else {
            // If no htmlBody, create simple HTML from text body
            const textWithBreaks = body.replace(/\n/g, "<br>");
            formattedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px;">
  <p>${textWithBreaks}</p>
</body>
</html>`;
          }

          // Debug: Log HTML to verify it's correct
          if (process.env.NODE_ENV === "development") {
            console.log("[EmailService] Sending HTML email to:", recipientEmail);
            console.log("[EmailService] HTML length:", formattedHtml.length);
            console.log("[EmailService] HTML starts with:", formattedHtml.substring(0, 50));
            console.log("[EmailService] HTML contains <p>:", formattedHtml.includes("<p>"));
            console.log("[EmailService] HTML contains <br>:", formattedHtml.includes("<br>"));
            console.log("[EmailService] HTML contains <html>:", formattedHtml.includes("<html>"));
          }

          // Ensure HTML is a string and not escaped
          const htmlToSend = typeof formattedHtml === "string" ? formattedHtml : String(formattedHtml);

          const { data, error } = await resend.emails.send({
            from: `${identity.displayName} <${identity.email}>`,
            to: recipientEmail,
            replyTo: replyToEmail,
            subject,
            html: htmlToSend,
            text: body,
            headers: {
              "Message-ID": uniqueMessageId,
              "X-Email-ID": tempId,
            },
            ...(attachments.length > 0 && { attachments }),
          });

          if (error) {
            console.error(`Failed to send email to ${recipientEmail}:`, error);
            return { success: false, email: recipientEmail, error: error.message };
          }

          return { success: true, email: recipientEmail, resendId: data?.id };
        });

        const results = await Promise.all(emailPromises);
        const successCount = results.filter((r) => r.success).length;

        if (successCount > 0) {
          sentEmail.status = "SENT";
          sentEmail.sentAt = new Date();
          sentEmail.resendEmailId = results[0].resendId;
          sentEmail.messageId = `<${tempId}-0@smaartagent.com>`;
        } else {
          sentEmail.status = "FAILED";
          sentEmail.error = results.map((r) => r.error).join(", ");
        }

        await sentEmail.save();
      } catch (error) {
        console.error("Email sending error:", error);
        sentEmail.status = "FAILED";
        sentEmail.error = error.message;
        await sentEmail.save();
      }
    } else {
      console.log("Resend not configured, email not sent (test mode)");
      sentEmail.status = "SENT";
      sentEmail.sentAt = new Date();
      await sentEmail.save();
    }

    return sentEmail;
  }

  /**
   * Get sent emails (outgoing only)
   */
  static async getSentEmails(userId, filters = {}) {
    const query = { senderId: userId, isInbound: { $ne: true } };

    if (filters.isKyc !== undefined) {
      query.isKyc = filters.isKyc;
    }

    if (filters.tenantId) {
      query.tenantId = filters.tenantId;
    }

    if (filters.landlordId) {
      query.landlordId = filters.landlordId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.threadId) {
      query.threadId = filters.threadId;
    }

    const emails = await SentEmail.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .skip(filters.offset || 0)
      .populate("tenantId", "firstName lastName email")
      .populate("landlordId", "contactPersonName contactPersonEmail")
      .populate("fromEmailIdentityId", "email displayName")
      .populate("replies")
      .lean();

    const total = await SentEmail.countDocuments(query);

    return { emails, total };
  }

  /**
   * Get inbox - only sent emails (replies are shown in thread view, not in table)
   */
  static async getInbox(userId, filters = {}) {
    // Build query for emails
    // Only show sent emails in the table - replies are shown in thread view only
    // For KYC emails with tenantId, we need to get:
    // 1. Emails sent by the user to the tenant (senderId = userId, tenantId = filters.tenantId, isKyc = true)
    // 2. Inbound emails received from the tenant (isInbound = true, tenantId = filters.tenantId, isKyc = true)
    //    BUT only if they are NOT replies (standalone inbound emails)
    let query = {};

    if (filters.isKyc && filters.tenantId) {
      // For KYC emails, we need to get both sent and received emails for this tenant
      // But exclude inbound emails that are replies (they should only show in thread)
      query = {
        $or: [
          { senderId: userId, tenantId: filters.tenantId, isKyc: true },
          { 
            isInbound: true, 
            tenantId: filters.tenantId, 
            isKyc: true,
            // Only include standalone inbound emails, not replies
            // Replies are identified by having a threadId that matches another email's _id
          },
        ],
      };
    } else {
      // For regular emails, show all emails for this user where they are the sender.
      // This includes:
      // - Sent emails (outbound)
      // - Standalone inbound emails created as new threads (isInbound = true)
      //
      // Replies are stored separately in EmailReply and are only shown in the thread view,
      // so they will NOT appear as separate rows in this inbox table.
      query = {
        senderId: userId,
      };
    }

    if (filters.isKyc !== undefined && !filters.tenantId) {
      query.isKyc = filters.isKyc;
    }

    if (filters.tenantId && !filters.isKyc) {
      query.tenantId = filters.tenantId;
    }

    if (filters.landlordId) {
      query.landlordId = filters.landlordId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.threadId) {
      query.threadId = filters.threadId;
    }

    const emails = await SentEmail.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 200) // fetch more to allow de-duplication by thread
      .skip(filters.offset || 0)
      .populate("tenantId", "firstName lastName email")
      .populate("landlordId", "contactPersonName contactPersonEmail")
      .populate("fromEmailIdentityId", "email displayName")
      .lean();

    // Get reply counts for each email
    const emailIds = emails.map((e) => e._id);
    const replyCounts = await EmailReply.aggregate([
      { $match: { sentEmailId: { $in: emailIds } } },
      { $group: { _id: "$sentEmailId", count: { $sum: 1 } } },
    ]);

    const replyCountMap = {};
    replyCounts.forEach((rc) => {
      replyCountMap[rc._id] = rc.count;
    });

    // Add reply counts to emails
    const emailsWithCounts = emails.map((email) => ({
      ...email,
      replyCount: replyCountMap[email._id] || 0,
    }));

    // Group by threadId so only one entry per thread appears in the inbox table
    const seenThreads = new Set();
    const groupedEmails = [];

    for (const email of emailsWithCounts) {
      const threadKey = email.threadId || email._id.toString();
      if (seenThreads.has(threadKey)) continue;
      seenThreads.add(threadKey);
      groupedEmails.push(email);
    }

    const total = groupedEmails.length;

    return { emails: groupedEmails, total };
  }

  /**
   * Get email replies
   */
  static async getEmailReplies(sentEmailId) {
    return await EmailReply.find({ sentEmailId })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get email thread (sent email + all replies)
   */
  static async getEmailThread(threadId) {
    const sentEmail = await SentEmail.findOne({ threadId })
      .populate("tenantId", "firstName lastName email")
      .populate("landlordId", "contactPersonName contactPersonEmail")
      .populate("fromEmailIdentityId", "email displayName")
      .lean();

    if (!sentEmail) {
      return null;
    }

    const replies = await EmailReply.find({ threadId })
      .sort({ createdAt: 1 }) // Chronological order for thread
      .lean();

    return {
      sentEmail,
      replies,
    };
  }

  /**
   * Get all emails in a thread (including sent emails and replies)
   */
  static async getThreadEmails(threadId) {
    // Normalize threadId: it might be either the threadId or the _id of the root email
    let canonicalThreadId = threadId;

    // Try to find a sent email where this id matches either _id or threadId
    const rootEmail =
      (await SentEmail.findOne({ _id: threadId }).lean()) ||
      (await SentEmail.findOne({ threadId }).lean());

    if (rootEmail) {
      canonicalThreadId = rootEmail.threadId || rootEmail._id.toString();
    }

    const sentEmails = await SentEmail.find({ threadId: canonicalThreadId })
      .populate("fromEmailIdentityId", "email displayName")
      .sort({ createdAt: 1 })
      .lean();

    const replies = await EmailReply.find({ threadId: canonicalThreadId })
      .sort({ createdAt: 1 })
      .lean();

    // Combine and sort chronologically
    // Mark sent emails as outgoing, inbound emails as incoming, replies as incoming
    const allEmails = [
      ...sentEmails.map((email) => ({
        ...email,
        type: email.isInbound ? "received" : "sent",
        direction: email.isInbound ? "incoming" : "outgoing",
      })),
      ...replies.map((reply) => ({
        ...reply,
        type: "reply",
        direction: "incoming",
      })),
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return allEmails;
  }

  /**
   * Process incoming email (webhook) - handles both replies and standalone received emails
   */
  static async processIncomingEmail(webhookData) {
    const { from, subject, text, html, headers, to } = webhookData;

    const replyTo = headers?.["reply-to"] || headers?.["Reply-To"] || from;
    const inReplyTo = headers?.["in-reply-to"] || headers?.["In-Reply-To"];
    const references = headers?.["references"] || headers?.["References"];

    // Extract from email and name
    const fromMatch = from.match(/^(.+?)\s*<(.+)>$/);
    const fromEmail = fromMatch ? fromMatch[2] : from;
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, "") : null;

    // Extract the "to" email address (can be string or array)
    const toEmail = Array.isArray(to) ? to[0] : to;

    // Try to find if this is a reply to an existing email
    let sentEmail = null;

    // 1) Detect replies using reply-to header (standard flow)
    if (replyTo && replyTo.includes("@smaartagent.com")) {
      const emailIdFromReplyTo = replyTo.match(/reply-([^@]+)@/)?.[1];
      if (emailIdFromReplyTo) {
        sentEmail = await SentEmail.findOne({
          $or: [
            { _id: emailIdFromReplyTo },
            { replyToEmail: replyTo },
            { messageId: inReplyTo },
          ],
        });
      }
    }

    // 2) If still not found, detect replies using the \"to\" address
    //    Resend sometimes puts the reply tracking address in \"to\" instead of \"reply-to\"
    if (!sentEmail && toEmail && toEmail.includes("@smaartagent.com")) {
      const emailIdFromTo = toEmail.match(/reply-([^@]+)@/)?.[1];
      if (emailIdFromTo) {
        sentEmail = await SentEmail.findOne({
          $or: [
            { _id: emailIdFromTo },
            { replyToEmail: toEmail },
            { messageId: inReplyTo },
          ],
        });
      }
    }

    // 3) Fallback: try matching by In-Reply-To header only
    if (!sentEmail && inReplyTo) {
      sentEmail = await SentEmail.findOne({ messageId: inReplyTo });
    }

    // If this is a reply, save it as EmailReply
    if (sentEmail) {
      // Extract body - ensure we have a non-empty string
      let replyBody = text || "";
      if (!replyBody && html) {
        // Strip HTML tags to get text content
        replyBody = html.replace(/<[^>]*>/g, "").trim();
      }
      // Fallback if still empty
      if (!replyBody) {
        replyBody = "(no body content)";
      }

      const emailReply = await EmailReply.create({
        sentEmailId: sentEmail._id,
        threadId: sentEmail.threadId || sentEmail._id,
        fromEmail,
        fromName,
        subject: subject || "(no subject)",
        body: replyBody,
        htmlBody: html || null,
        inReplyTo,
        references,
      });

      return { type: "reply", data: emailReply };
    }

    // If not a reply, check if it's sent to one of our email identities
    if (toEmail && toEmail.includes("@smaartagent.com")) {
      // Find the email identity that received this
      const EmailIdentity = require("../../../models/EmailIdentity");
      const emailIdentity = await EmailIdentity.findOne({ email: toEmail });

      if (emailIdentity) {
        // Try to find if this email is from a tenant or landlord
        const Tenant = require("../../../models/Tenant");
        const Landlord = require("../../../models/Landlord");
        
        const tenant = await Tenant.findOne({ email: fromEmail }).lean();
        const landlord = await Landlord.findOne({ 
          $or: [
            { email: fromEmail },
            { contactPersonEmail: fromEmail }
          ]
        }).lean();

        // Create a new inbound email thread
        const crypto = require("crypto");
        const threadId = crypto.randomUUID();

        // Extract body - ensure we have a non-empty string
        let emailBody = text || "";
        if (!emailBody && html) {
          // Strip HTML tags to get text content
          emailBody = html.replace(/<[^>]*>/g, "").trim();
        }
        // Fallback if still empty
        if (!emailBody) {
          emailBody = "(no body content)";
        }

        const inboundEmailData = {
          senderId: emailIdentity.userId,
          fromEmailIdentityId: emailIdentity._id,
          subject: subject || "(no subject)",
          body: emailBody,
          htmlBody: html || null,
          recipients: [{ email: fromEmail, name: fromName }],
          status: "SENT",
          sentAt: new Date(),
          isInbound: true,
          inboundFromEmail: fromEmail,
          inboundFromName: fromName,
          threadId,
          metadata: {
            direction: "INBOUND",
            inbound: true,
            fromEmail,
            fromName,
            toEmail,
          },
        };

        // Link to tenant or landlord if found
        if (tenant) {
          inboundEmailData.tenantId = tenant._id;
        }
        if (landlord) {
          inboundEmailData.landlordId = landlord._id;
        }

        const inboundEmail = await SentEmail.create(inboundEmailData);

        return { type: "inbound", data: inboundEmail };
      }
    }

    console.log("Could not process incoming email - not a reply and not to a known identity");
    return null;
  }

  /**
   * Process email reply (webhook) - DEPRECATED, use processIncomingEmail instead
   */
  static async processEmailReply(webhookData) {
    const result = await this.processIncomingEmail(webhookData);
    if (result && result.type === "reply") {
      return result.data;
    }
    return null;
  }
}

module.exports = EmailService;
