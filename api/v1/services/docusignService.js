const DocuSignEnvelope = require("../../../models/DocuSignEnvelope");
const LeaseDocument = require("../../../models/LeaseDocument");
const Lease = require("../../../models/Lease");
const Property = require("../../../models/Property");
const Landlord = require("../../../models/Landlord");
const Tenant = require("../../../models/Tenant");
const AppError = require("../../../utils/appError");
const { createEnvelopeFromDocument } = require("../../../utils/docusign");
const { uploadBufferToS3 } = require("../../../utils/s3");

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
      ? landlord.contactPersonEmail || landlord.email
      : landlord.email;

    const tenantName = `${tenant.firstName} ${tenant.lastName}`;
    const tenantEmail = tenant.email;

    if (!landlordEmail || !tenantEmail) {
      throw new AppError("Landlord and tenant must have email addresses for DocuSign", 400);
    }

    const primaryDocument = documents[0];
    let fileBase64;

    if (primaryDocument.buffer) {
      fileBase64 = primaryDocument.buffer.toString("base64");
    } else if (primaryDocument.file) {
      const buffer = Buffer.from(await primaryDocument.file.arrayBuffer());
      fileBase64 = buffer.toString("base64");
    } else {
      throw new AppError("Document file is required", 400);
    }

    const fileName = primaryDocument.name || primaryDocument.file?.name || "lease_agreement.pdf";

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
        documents.map(async (doc, index) => {
          let fileUrl;
          if (index === 0) {
            fileUrl = await uploadBufferToS3(
              Buffer.from(await doc.file.arrayBuffer()),
              `docusign-documents/${leaseId}/${Date.now()}-${doc.file.name}`,
              doc.file.type || "application/pdf"
            );
          } else {
            const buffer = doc.buffer || Buffer.from(await doc.file.arrayBuffer());
            fileUrl = await uploadBufferToS3(
              buffer,
              `docusign-documents/${leaseId}/${Date.now()}-${doc.file.name}`,
              doc.file.type || "application/pdf"
            );
          }

          return LeaseDocument.create({
            leaseId: leaseId,
            agentId: agentId,
            documentName: doc.name || doc.file.name,
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
    const envelope = await DocuSignEnvelope.findOne({
      envelopeId: envelopeId,
      agentId: agentId,
    }).lean();

    if (!envelope) {
      if (agencyId) {
        const agencyEnvelope = await DocuSignEnvelope.findOne({
          envelopeId: envelopeId,
          agencyId: agencyId,
        }).lean();
        if (!agencyEnvelope) {
          throw new AppError("Envelope not found", 404);
        }
      } else {
        throw new AppError("Envelope not found", 404);
      }
    }

    const lease = await Lease.findById(envelope.leaseId)
      .populate("landlordId")
      .populate("tenantId")
      .lean();

    if (!lease) {
      throw new AppError("Lease not found", 404);
    }

    const landlord = await Landlord.findById(lease.landlordId).lean();
    const tenant = await Tenant.findById(lease.tenantId).lean();

    if (recipientRole === "landlord") {
      const landlordName = landlord.isOrganization
        ? landlord.organizationName
        : `${landlord.firstName} ${landlord.lastName}`;
      const landlordEmail = landlord.isOrganization
        ? landlord.contactPersonEmail || landlord.email
        : landlord.email;

      const { createRecipientViewUrl } = require("../../../utils/docusign");
      const signingUrl = await createRecipientViewUrl({
        envelopeId: envelopeId,
        name: landlordName,
        email: landlordEmail,
        clientUserId: "landlord",
      });

      return { signingUrl, recipient: { name: landlordName, email: landlordEmail } };
    } else if (recipientRole === "tenant") {
      const tenantName = `${tenant.firstName} ${tenant.lastName}`;
      const tenantEmail = tenant.email;

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
}

module.exports = DocuSignService;

