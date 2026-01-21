const DocuSignEnvelope = require("../../../models/DocuSignEnvelope");
const LeaseDocument = require("../../../models/LeaseDocument");
const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");
const Landlord = require("../../../models/Landlord");
const Tenant = require("../../../models/Tenant");
const AppError = require("../../../utils/appError");
const { createEnvelopeFromDocument } = require("../../../utils/docusign");
const { uploadBufferToS3 } = require("../../../utils/s3");
const EmailService = require("./emailService");

class DocuSignService {
  static async createEnvelope(leaseId, documents, agentId, agencyId, emailSubject) {
    const lease = await Lease.findById(leaseId)
      .populate("propertyId")
      .populate("tenantId")
      .populate("landlordId")
      .lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    if (lease.agentId !== agentId) {
      if (agencyId && lease.agencyId !== agencyId) {
        throw new AppError("Unauthorized access to this lease", 403);
      }
      if (!agencyId) {
        throw new AppError("Unauthorized access to this lease", 403);
      }
    }

    if (documents.length === 0) {
      throw new AppError("At least one document is required for DocuSign envelope", 400);
    }

    const property = await Property.findById(lease.propertyId).lean();
    const landlord = await Landlord.findById(lease.landlordId).lean();
    const tenant = await Tenant.findById(lease.tenantId).lean();

    if (!property || !landlord || !tenant) {
      throw new AppError("Property, landlord, or tenant not found", 404);
    }

    const landlordName = landlord.isOrganization
      ? landlord.organizationName
      : `${landlord.firstName} ${landlord.lastName}`;
    const landlordEmail = landlord.isOrganization
      ? (landlord.contactPersonEmail || landlord.email)
      : landlord.email;
    const tenantName = `${tenant.firstName} ${tenant.lastName}`;
    const tenantEmail = tenant.email;

    if (!landlordEmail || !tenantEmail) {
      throw new AppError("Landlord and tenant must have email addresses for DocuSign", 400);
    }

    const primaryDocument = documents[0];
    let fileBase64;

    if (primaryDocument.file && primaryDocument.file.buffer) {
      fileBase64 = primaryDocument.file.buffer.toString("base64");
    } else if (primaryDocument.buffer) {
      fileBase64 = primaryDocument.buffer.toString("base64");
    } else {
      throw new AppError("Document file is required", 400);
    }

    // Prefer original filename (with extension) so DocuSign can detect file type.
    // Fall back to provided name, and if it has no extension, append .pdf.
    let fileName =
      primaryDocument.file?.name || primaryDocument.name || "lease_agreement.pdf";
    if (!/\.[a-zA-Z0-9]+$/.test(fileName)) {
      fileName = `${fileName}.pdf`;
    }

    try {
      const envelopeResponse = await createEnvelopeFromDocument({
        fileName,
        fileBase64,
        landlord: {
          name: landlordName,
          email: landlordEmail,
        },
        tenant: {
          name: tenantName,
          email: tenantEmail,
        },
        emailSubject: emailSubject || "Lease agreement for signature",
      });

      const recipients = [
        {
          email: landlordEmail,
          name: landlordName,
          role: "landlord",
          status: "sent",
        },
        {
          email: tenantEmail,
          name: tenantName,
          role: "tenant",
          status: "sent",
        },
      ];

      const docuSignEnvelope = await DocuSignEnvelope.create({
        envelopeId: envelopeResponse.envelopeId,
        leaseId: leaseId,
        agentId: agentId,
        agencyId: agencyId || null,
        emailSubject: emailSubject || "Lease agreement for signature",
        status: "SENT",
        recipients: recipients,
        documentCount: documents.length,
        documentNames: documents.map((doc) => doc.name || doc.file?.name || "document"),
        notes: documents.map((doc) => doc.notes || "").join("; "),
      });

      const leaseDocuments = await Promise.all(
        documents.map(async (doc) => {
          const buffer = doc.file.buffer || Buffer.from(doc.file);
          const fileUrl = await uploadBufferToS3(
            buffer,
            `docusign-documents/${leaseId}/${Date.now()}-${doc.file.name || doc.name || "document"}`,
            doc.file.type || "application/pdf"
          );

          return LeaseDocument.create({
            leaseId: leaseId,
            agentId: agentId,
            documentName: doc.name || doc.file.name || "document",
            documentType: doc.type || "lease_agreement",
            fileUrl: fileUrl,
            fileSize: doc.file.size || null,
            mimeType: doc.file.type || "application/pdf",
            notes: doc.notes || null,
            docusignEnvelopeId: envelopeResponse.envelopeId,
            isForSignature: true,
          });
        })
      );

      return {
        envelopeId: envelopeResponse.envelopeId,
        envelope: docuSignEnvelope,
        documents: leaseDocuments,
      };
    } catch (error) {
      console.error("DocuSign envelope creation error:", error);
      throw new AppError(
        error.message || "Failed to create DocuSign envelope",
        error.statusCode || 500
      );
    }
  }

  static async getSigningUrl(envelopeId, recipientRole, agentId, agencyId) {
    let envelope = await DocuSignEnvelope.findOne({
      envelopeId: envelopeId,
      agentId: agentId,
    }).lean();

    if (!envelope) {
      if (agencyId) {
        envelope = await DocuSignEnvelope.findOne({
          envelopeId: envelopeId,
          agencyId: agencyId,
        }).lean();
        if (!envelope) {
          throw new AppError("Envelope not found", 404);
        }
      } else {
        throw new AppError("Envelope not found", 404);
      }
    }

    if (recipientRole === "landlord") {
      // Prefer recipient info stored on the envelope (what was actually sent to DocuSign)
      const envRecipient =
        envelope.recipients?.find((r) => r.role === "landlord") || null;

      let landlordName = envRecipient?.name || "";
      let landlordEmail = envRecipient?.email || "";

      // Fallback to current landlord record if needed
      if (!landlordName || !landlordEmail) {
        const lease = await Lease.findById(envelope.leaseId)
          .populate("landlordId")
          .lean();

        if (!lease) {
          throw new AppError("Lease not found", 404);
        }

        const landlord = await Landlord.findById(lease.landlordId).lean();
        if (!landlord) {
          throw new AppError("Landlord not found", 404);
        }

        landlordName =
          landlord.isOrganization && landlord.organizationName
            ? landlord.organizationName
            : `${landlord.firstName || ""} ${landlord.lastName || ""}`.trim();
        landlordEmail = landlord.isOrganization
          ? landlord.contactPersonEmail || landlord.email
          : landlord.email;
      }

      if (!landlordEmail) {
        throw new AppError(
          "Landlord must have an email address for DocuSign",
          400
        );
      }

      const { createRecipientViewUrl } = require("../../../utils/docusign");
      const signingUrl = await createRecipientViewUrl({
        envelopeId: envelopeId,
        name: landlordName,
        email: landlordEmail,
        clientUserId: "landlord",
      });

      return { signingUrl, recipient: { name: landlordName, email: landlordEmail } };
    } else if (recipientRole === "tenant") {
      // Prefer recipient info stored on the envelope
      const envRecipient =
        envelope.recipients?.find((r) => r.role === "tenant") || null;

      let tenantName = envRecipient?.name || "";
      let tenantEmail = envRecipient?.email || "";

      // Fallback to current tenant record if needed
      if (!tenantName || !tenantEmail) {
        const lease = await Lease.findById(envelope.leaseId)
          .populate("tenantId")
          .lean();

        if (!lease) {
          throw new AppError("Lease not found", 404);
        }

        const tenant = await Tenant.findById(lease.tenantId).lean();
        if (!tenant) {
          throw new AppError("Tenant not found", 404);
        }

        tenantName = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim();
        tenantEmail = tenant.email;
      }

      if (!tenantEmail) {
        throw new AppError(
          "Tenant must have an email address for DocuSign",
          400
        );
      }

      const { createRecipientViewUrl } = require("../../../utils/docusign");
      const signingUrl = await createRecipientViewUrl({
        envelopeId: envelopeId,
        name: tenantName,
        email: tenantEmail,
        clientUserId: "tenant",
      });

      return { signingUrl, recipient: { name: tenantName, email: tenantEmail } };
    } else {
      throw new AppError("Invalid recipient role. Must be 'landlord' or 'tenant'", 400);
    }
  }

  static async sendSigningEmails(envelopeId, agentId, agencyId) {
    let envelope = await DocuSignEnvelope.findOne({
      envelopeId: envelopeId,
      agentId: agentId,
    }).lean();

    if (!envelope) {
      if (agencyId) {
        envelope = await DocuSignEnvelope.findOne({
          envelopeId: envelopeId,
          agencyId: agencyId,
        }).lean();
        if (!envelope) {
          throw new AppError("Envelope not found", 404);
        }
      } else {
        throw new AppError("Envelope not found", 404);
      }
    }

    const results = {
      landlord: null,
      tenant: null,
    };

    // Helper to build landlord/tenant data, reuse logic from getSigningUrl
    const getLandlordInfo = async () => {
      const envRecipient =
        envelope.recipients?.find((r) => r.role === "landlord") || null;

      let name = envRecipient?.name || "";
      let email = envRecipient?.email || "";

      if (!name || !email) {
        const lease = await Lease.findById(envelope.leaseId)
          .populate("landlordId")
          .lean();
        if (!lease) throw new AppError("Lease not found", 404);

        const landlord = await Landlord.findById(lease.landlordId).lean();
        if (!landlord) throw new AppError("Landlord not found", 404);

        name =
          landlord.isOrganization && landlord.organizationName
            ? landlord.organizationName
            : `${landlord.firstName || ""} ${landlord.lastName || ""}`.trim();
        email = landlord.isOrganization
          ? landlord.contactPersonEmail || landlord.email
          : landlord.email;
      }

      if (!email) {
        throw new AppError(
          "Landlord must have an email address for DocuSign",
          400
        );
      }

      return { name, email };
    };

    const getTenantInfo = async () => {
      const envRecipient =
        envelope.recipients?.find((r) => r.role === "tenant") || null;

      let name = envRecipient?.name || "";
      let email = envRecipient?.email || "";

      if (!name || !email) {
        const lease = await Lease.findById(envelope.leaseId)
          .populate("tenantId")
          .lean();
        if (!lease) throw new AppError("Lease not found", 404);

        const tenant = await Tenant.findById(lease.tenantId).lean();
        if (!tenant) throw new AppError("Tenant not found", 404);

        name = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim();
        email = tenant.email;
      }

      if (!email) {
        throw new AppError(
          "Tenant must have an email address for DocuSign",
          400
        );
      }

      return { name, email };
    };

    // Send landlord email
    try {
      const { name, email } = await getLandlordInfo();
      const { createRecipientViewUrl } = require("../../../utils/docusign");
      const signingUrl = await createRecipientViewUrl({
        envelopeId,
        name,
        email,
        clientUserId: "landlord",
      });

      const subject = `Lease ${envelope.leaseId} – DocuSign link for landlord`;
      const body = `Hello ${name},\n\nPlease sign the lease using the following link:\n\n${signingUrl}\n\nThank you.`;
      const htmlBody = `<p>Hello ${name},</p><p>Please sign the lease using the following link:</p><p><a href="${signingUrl}">${signingUrl}</a></p><p>Thank you.</p>`;

      await EmailService.sendEmail(
        agentId,
        [{ email, name }],
        subject,
        body,
        htmlBody,
        [],
        {}
      );

      results.landlord = { success: true };
    } catch (error) {
      console.error("Failed to send DocuSign email to landlord:", error);
      results.landlord = { success: false, error: error.message || "Failed" };
    }

    // Send tenant email
    try {
      const { name, email } = await getTenantInfo();
      const { createRecipientViewUrl } = require("../../../utils/docusign");
      const signingUrl = await createRecipientViewUrl({
        envelopeId,
        name,
        email,
        clientUserId: "tenant",
      });

      const subject = `Lease ${envelope.leaseId} – DocuSign link for tenant`;
      const body = `Hello ${name},\n\nPlease sign the lease using the following link:\n\n${signingUrl}\n\nThank you.`;
      const htmlBody = `<p>Hello ${name},</p><p>Please sign the lease using the following link:</p><p><a href="${signingUrl}">${signingUrl}</a></p><p>Thank you.</p>`;

      await EmailService.sendEmail(
        agentId,
        [{ email, name }],
        subject,
        body,
        htmlBody,
        [],
        {}
      );

      results.tenant = { success: true };
    } catch (error) {
      console.error("Failed to send DocuSign email to tenant:", error);
      results.tenant = { success: false, error: error.message || "Failed" };
    }

    if (!results.landlord?.success && !results.tenant?.success) {
      throw new AppError(
        "Failed to send DocuSign signing emails to landlord and tenant",
        500
      );
    }

    return results;
  }
}

module.exports = DocuSignService;

