const DocuSignEnvelope = require("../../models/DocuSignEnvelope");
const LeaseDocument = require("../../models/LeaseDocument");
const Lease = require("../../models/Lease");
const { verifyDocusignHmac, downloadCombinedDocument } = require("../../utils/docusign");
const { uploadBufferToS3 } = require("../../utils/s3");
const config = require("../../config/config");

function extractFields(payload) {
  let envelopeId;
  let status;
  let completedAt;
  let statusChangedAt;
  let voidedReason;
  let recipients = [];

  if (payload.data) {
    envelopeId = payload.data.envelopeId || payload.data.envelope?.envelopeId;
    status = payload.data.status || payload.data.envelope?.status;
    statusChangedAt = payload.data.statusChangedDateTime
      ? new Date(payload.data.statusChangedDateTime)
      : new Date();
    completedAt =
      status === "completed" && payload.data.completedDateTime
        ? new Date(payload.data.completedDateTime)
        : undefined;
    voidedReason = payload.data.voidedReason || null;

    if (payload.data.recipients) {
      recipients = (payload.data.recipients.signers || []).map((signer) => ({
        recipientId: signer.recipientId,
        status: signer.status,
        email: signer.email,
        name: signer.name,
        signedDateTime: signer.signedDateTime || null,
      }));
    }
  } else if (payload.envelopeId) {
    envelopeId = payload.envelopeId;
    status = payload.status;
    statusChangedAt = payload.statusChangedDateTime ? new Date(payload.statusChangedDateTime) : new Date();
    completedAt = status === "completed" && payload.completedDateTime ? new Date(payload.completedDateTime) : undefined;
    voidedReason = payload.voidedReason || null;

    if (payload.recipients) {
      recipients = (payload.recipients.signers || []).map((signer) => ({
        recipientId: signer.recipientId,
        status: signer.status,
        email: signer.email,
        name: signer.name,
        signedDateTime: signer.signedDateTime || null,
      }));
    }
  }

  return { envelopeId, status, completedAt, statusChangedAt, voidedReason, recipients };
}

async function updateRecipientStatuses(envelopeId, webhookRecipients) {
  if (!webhookRecipients || webhookRecipients.length === 0) {
    return;
  }

  try {
    const envelope = await DocuSignEnvelope.findOne({ envelopeId }).lean();

    if (!envelope) {
      console.warn(`Envelope ${envelopeId} not found for recipient status update`);
      return;
    }

    let currentRecipients = Array.isArray(envelope.recipients) ? envelope.recipients : [];

    const updatedRecipients = currentRecipients.map((recipient) => {
      const webhookRecipient = webhookRecipients.find(
        (wr) => wr.email === recipient.email || wr.recipientId === recipient.recipientId
      );

      if (webhookRecipient) {
        return {
          ...recipient,
          status: webhookRecipient.status,
          signedAt: webhookRecipient.signedDateTime ? new Date(webhookRecipient.signedDateTime) : recipient.signedAt,
        };
      }
      return recipient;
    });

    await DocuSignEnvelope.updateOne(
      { envelopeId },
      { $set: { recipients: updatedRecipients } }
    );

    console.log(`Updated recipient statuses for envelope ${envelopeId}`);
  } catch (error) {
    console.error("Error updating recipient statuses:", error);
  }
}

async function updateLeaseDocumentsAfterSigning(envelopeId, completedAt) {
  try {
    const envelope = await DocuSignEnvelope.findOne({ envelopeId }).lean();
    if (!envelope) {
      throw new Error(`Envelope ${envelopeId} not found`);
    }

    const documents = await LeaseDocument.find({
      docusignEnvelopeId: envelopeId,
      isForSignature: true,
    });

    if (documents.length === 0) {
      console.log(`No documents found for envelope ${envelopeId}`);
      return;
    }

    const signedDocumentBuffer = await downloadCombinedDocument(envelopeId);
    const signedDocumentUrl = await uploadBufferToS3(
      signedDocumentBuffer,
      `docusign-signed/${envelopeId}/${Date.now()}-signed-document.pdf`,
      "application/pdf"
    );

    await DocuSignEnvelope.updateOne(
      { envelopeId },
      { $set: { signedDocumentUrl: signedDocumentUrl } }
    );

    for (const doc of documents) {
      await LeaseDocument.updateOne(
        { _id: doc._id },
        {
          $set: {
            fileUrl: signedDocumentUrl,
            notes: (doc.notes || "") + " [Signed via DocuSign]",
          },
        }
      );
    }

    console.log(`Updated ${documents.length} lease documents with signed version`);

    // Also update the related lease signedAt field if we have a completion time
    if (envelope.leaseId && completedAt) {
      await Lease.updateOne(
        { _id: envelope.leaseId },
        { $set: { signedAt: completedAt } }
      );
      console.log(`Updated lease ${envelope.leaseId} signedAt to ${completedAt.toISOString()}`);
    }
  } catch (error) {
    console.error("Error updating lease documents after signing:", error);
    throw error;
  }
}

async function handleDocuSignWebhook(req, res) {
  console.log("\n========== DocuSign Webhook Received ==========");
  console.log("Timestamp:", new Date().toISOString());

  const signature = req.headers["x-docusign-signature-1"];
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  console.log("HMAC Key configured:", config.docusign.connectHmacKey ? "YES" : "NO");
  console.log("Signature provided:", signature ? "YES" : "NO");

  const hmacResult = verifyDocusignHmac(rawBody, signature);

  if (!hmacResult) {
    console.error("\n!!! HMAC VERIFICATION FAILED !!!");
    return res.status(401).json({ error: "invalid hmac" });
  }

  console.log("✅ HMAC verification passed");

  let parsed;
  try {
    parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch (e) {
    console.error("Failed to parse webhook body:", e);
    return res.status(400).json({ error: "invalid json" });
  }

  const { envelopeId, status, completedAt, statusChangedAt, voidedReason, recipients } =
    extractFields(parsed);

  console.log("Envelope ID:", envelopeId);
  console.log("Status:", status);
  console.log("Recipients count:", recipients?.length || 0);

  if (!envelopeId || !status) {
    console.error("DocuSign webhook missing required fields", { envelopeId, status });
    return res.status(400).json({ error: "missing envelope id or status" });
  }

  try {
    const statusMapping = {
      created: "SENT",
      sent: "SENT",
      delivered: "DELIVERED",
      completed: "COMPLETED",
      declined: "DECLINED",
      voided: "VOIDED",
      signing_complete: "COMPLETED",
    };

    const mappedStatus = statusMapping[status.toLowerCase()] || "SENT";

    const updateData = {
      status: mappedStatus,
      statusChangedAt: statusChangedAt || new Date(),
      lastWebhookAt: new Date(),
    };

    if (completedAt) {
      updateData.completedAt = completedAt;
    }

    if (voidedReason) {
      updateData.voidedReason = voidedReason;
      updateData.voidedAt = new Date();
    }

    await DocuSignEnvelope.updateOne({ envelopeId }, { $set: updateData });

    if (recipients && recipients.length > 0) {
      await updateRecipientStatuses(envelopeId, recipients);
    }

    console.log(`Processing envelope ${envelopeId} with status: ${status}`);

    if (status.toLowerCase() === "completed") {
      try {
        await updateLeaseDocumentsAfterSigning(envelopeId, completedAt);
        console.log(`✅ Successfully updated documents for completed envelope ${envelopeId}`);
      } catch (error) {
        console.error(`❌ Failed to update documents for envelope ${envelopeId}:`, error);
      }
    }

    console.log("✅ Webhook processed successfully");
    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { handleDocuSignWebhook };
