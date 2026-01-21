const DocuSignService = require("../../services/docusignService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { created, success, badRequest } = require("../../../../utils/statusCode").statusCode;
const multer = require("multer");
const { parseNestedFormData } = require("../../../../utils/parseFormData");

const upload = multer({ storage: multer.memoryStorage() });

exports.createEnvelope = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const leaseId = parsedBody.leaseId;

  if (!leaseId) {
    return next(new AppError("Lease ID is required", badRequest));
  }

  const files = req.files || [];
  if (files.length === 0) {
    return next(new AppError("At least one document file is required", badRequest));
  }

  const documents = [];
  let docIndex = 0;
  while (parsedBody[`documents[${docIndex}][name]`] || files[`documents[${docIndex}][file]`]) {
    const name = parsedBody[`documents[${docIndex}][name]`] || "";
    const type = parsedBody[`documents[${docIndex}][type]`] || "lease_agreement";
    const notes = parsedBody[`documents[${docIndex}][notes]`] || "";

    const fileField = files[`documents[${docIndex}][file]`];
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    
    if (file) {
      documents.push({
        name: name || file.originalname.replace(/\.[^/.]+$/, ""),
        type,
        notes,
        file: {
          name: file.originalname,
          size: file.size,
          type: file.mimetype,
          buffer: file.buffer,
          arrayBuffer: async () => file.buffer,
        },
      });
    }
    docIndex++;
  }

  if (documents.length === 0) {
    return next(new AppError("At least one document is required", badRequest));
  }

  const emailSubject = parsedBody.emailSubject || "Lease agreement for signature";

  const result = await DocuSignService.createEnvelope(
    leaseId,
    documents,
    req.user._id,
    req.user.agencyId || null,
    emailSubject
  );

  return apiResponse.successResponse(
    res,
    { envelope: result.envelope, envelopeId: result.envelopeId },
    "DocuSign envelope created successfully",
    created
  );
});

exports.getSigningUrl = tryCatchAsync(async (req, res, next) => {
  const { envelopeId } = req.params;
  const { recipientRole } = req.query;

  if (!envelopeId) {
    return next(new AppError("Envelope ID is required", badRequest));
  }

  if (!recipientRole || !["landlord", "tenant"].includes(recipientRole)) {
    return next(new AppError("Recipient role must be 'landlord' or 'tenant'", badRequest));
  }

  const result = await DocuSignService.getSigningUrl(
    envelopeId,
    recipientRole,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { signingUrl: result.signingUrl, recipient: result.recipient },
    "Signing URL generated successfully",
    success
  );
});

exports.sendSigningEmails = tryCatchAsync(async (req, res, next) => {
  const { envelopeId } = req.params;

  if (!envelopeId) {
    return next(new AppError("Envelope ID is required", badRequest));
  }

  const result = await DocuSignService.sendSigningEmails(
    envelopeId,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { result },
    "DocuSign signing emails sent",
    success
  );
});
exports.sendSigningEmails = tryCatchAsync(async (req, res, next) => {
  const { envelopeId } = req.params;

  if (!envelopeId) {
    return next(new AppError("Envelope ID is required", badRequest));
  }

  const result = await DocuSignService.sendSigningEmails(
    envelopeId,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { result },
    "DocuSign signing emails sent",
    success
  );
});

