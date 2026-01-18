const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { success, badRequest } = require("../../../../utils/statusCode").statusCode;
const LeasePaymentRecord = require("../../../../models/LeasePaymentRecord");
const Lease = require("../../../../models/Lease");
const Property = require("../../../../models/Property");
const Tenant = require("../../../../models/Tenant");
const Landlord = require("../../../../models/Landlord");
const User = require("../../../../models/User");
const { generateInvoicePDFBuffer, generateReceiptPDFBuffer } = require("../../../../utils/pdfGenerator");

/**
 * Generate PDF buffer for invoice/receipt
 * POST /api/v1/agent/pdf/generate
 */
exports.generatePDF = tryCatchAsync(async (req, res, next) => {
  const { type, leaseId, recordId } = req.body;

  if (!type || !leaseId || !recordId) {
    return next(new AppError("type, leaseId, and recordId are required", badRequest));
  }

  if (type !== "invoice" && type !== "receipt") {
    return next(new AppError("type must be 'invoice' or 'receipt'", badRequest));
  }

  const agentId = req.user._id;
  const agencyId = req.user.agencyId || null;

  // Get lease and verify access
  const leaseQuery = agencyId ? { _id: leaseId, agencyId } : { _id: leaseId, agentId };
  const lease = await Lease.findOne(leaseQuery).lean();

  if (!lease) {
    return next(new AppError("Lease not found or access denied", 404));
  }

  // Get payment record
  const record = await LeasePaymentRecord.findOne({
    _id: recordId,
    leaseId,
  }).lean();

  if (!record) {
    return next(new AppError("Payment record not found", 404));
  }

  // Get related data
  const [property, tenant, landlord, agent] = await Promise.all([
    Property.findById(lease.propertyId).lean(),
    Tenant.findById(lease.tenantId).lean(),
    Landlord.findById(lease.landlordId).lean(),
    User.findById(agentId).lean(),
  ]);

  if (!property || !tenant || !landlord || !agent) {
    return next(new AppError("Related data not found", 404));
  }

  // Currency settings
  const currencySettings = {
    currencySymbol: agent.currencySymbol || "$",
    currencyLocale: agent.currencyLocale || "en-US",
  };

  // Generate PDF buffer
  let pdfBuffer;
  let filename;

  if (type === "invoice") {
    pdfBuffer = await generateInvoicePDFBuffer(record, lease, property, tenant, landlord, agent, currencySettings);
    const invoiceNumber = record.invoiceNumber || `INV-${new Date().getFullYear()}-${String(record._id).slice(-6).toUpperCase()}`;
    filename = `Invoice-${invoiceNumber}.pdf`;
  } else {
    pdfBuffer = await generateReceiptPDFBuffer(record, lease, property, tenant, landlord, agent, currencySettings);
    const receiptNumber = record.receiptNumber || `RCP-${new Date().getFullYear()}-${String(record._id).slice(-6).toUpperCase()}`;
    filename = `Receipt-${receiptNumber}.pdf`;
  }

  // Convert to base64 for email attachment
  const base64PDF = pdfBuffer.toString("base64");

  return apiResponse.successResponse(
    res,
    {
      pdf: base64PDF,
      filename,
      type: "application/pdf",
    },
    "PDF generated successfully",
    success
  );
});
