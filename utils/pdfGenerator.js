const PDFDocument = require("pdfkit");
const { uploadBufferToS3 } = require("./s3");

function formatCurrency(amount, currencySymbol = "$", currencyLocale = "en-US") {
  return `${currencySymbol}${Number(amount).toFixed(2)}`;
}

async function generateInvoicePDF(record, lease, property, tenant, landlord, agent, currencySettings = {}) {
  const currencySymbol = currencySettings.currencySymbol || "$";
  const currencyLocale = currencySettings.currencyLocale || "en-US";
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const timestamp = Date.now();
          const s3Key = `invoices/${record.leaseId}/${record._id}-invoice-${timestamp}.pdf`;
          const invoiceUrl = await uploadBufferToS3(pdfBuffer, s3Key, "application/pdf");
          resolve(invoiceUrl);
        } catch (error) {
          reject(error);
        }
      });
      doc.on("error", reject);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "center" });
      doc.moveDown(0.5);

      // Invoice Number and Date
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(record._id).slice(-6).toUpperCase()}`;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice #: ${invoiceNumber}`, { align: "left" });
      doc.text(`Date: ${new Date(record.createdAt || new Date()).toLocaleDateString()}`, {
        align: "left",
      });
      if (record.dueDate) {
        doc.text(`Due Date: ${new Date(record.dueDate).toLocaleDateString()}`, { align: "left" });
      }
      doc.moveDown(1);

      // Bill To Section
      doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(tenant.firstName + " " + tenant.lastName, 50, doc.y + 15);
      if (tenant.email) doc.text(tenant.email, 50, doc.y);
      if (tenant.phoneNumber) doc.text(tenant.phoneNumber, 50, doc.y);
      doc.moveDown(1);

      // Property and Landlord Info
      doc.fontSize(12).font("Helvetica-Bold").text("Property:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(property.title || "N/A", 50, doc.y + 15);
      if (property.address) doc.text(property.address, 50, doc.y);
      if (property.city) doc.text(`${property.city}${property.state ? `, ${property.state}` : ""}`, 50, doc.y);

      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica-Bold").text("Landlord:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      const landlordName = landlord.isOrganization
        ? landlord.organizationName
        : `${landlord.firstName || ""} ${landlord.lastName || ""}`.trim();
      doc.text(landlordName || "N/A", 50, doc.y + 15);
      doc.moveDown(1.5);

      // Line items table
      const tableTop = doc.y;
      const itemHeight = 20;
      let currentY = tableTop;

      // Table header
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Description", 50, currentY);
      doc.text("Amount", 450, currentY, { align: "right" });
      currentY += itemHeight;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

      // Base amount
      doc.fontSize(10).font("Helvetica");
      currentY += 5;
      doc.text(record.label || "Payment", 50, currentY);
      const baseAmount = Number(record.amountDue || 0);
      doc.text(formatCurrency(baseAmount, currencySymbol, currencyLocale), 450, currentY, { align: "right" });
      currentY += itemHeight;

      // Additional charges
      if (Array.isArray(record.charges) && record.charges.length > 0) {
        record.charges.forEach((charge) => {
          if (charge.label && charge.amount) {
            doc.text(charge.label, 50, currentY);
            const chargeAmount = Number(charge.amount || 0);
            doc.text(formatCurrency(chargeAmount, currencySymbol, currencyLocale), 450, currentY, { align: "right" });
            currentY += itemHeight;
          }
        });
      }

      // Total
      currentY += 5;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      doc.fontSize(12).font("Helvetica-Bold");
      const totalCharges = Array.isArray(record.charges)
        ? record.charges.reduce((sum, c) => sum + Number(c.amount || 0), 0)
        : 0;
      const totalAmount = baseAmount + totalCharges;
      doc.text("TOTAL", 50, currentY);
      doc.text(formatCurrency(totalAmount, currencySymbol, currencyLocale), 450, currentY, { align: "right" });
      currentY += itemHeight;

      // Status
      doc.moveDown(1);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Status: ${record.status || "PENDING"}`, 50, doc.y);

      // Notes
      if (record.notes) {
        doc.moveDown(1);
        doc.text(`Notes: ${record.notes}`, 50, doc.y);
      }

      // Footer
      doc.fontSize(8).font("Helvetica");
      doc.text("Thank you for your business!", 50, doc.page.height - 100, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function generateReceiptPDF(record, lease, property, tenant, landlord, agent, currencySettings = {}) {
  const currencySymbol = currencySettings.currencySymbol || "$";
  const currencyLocale = currencySettings.currencyLocale || "en-US";
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", async () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          const timestamp = Date.now();
          const s3Key = `receipts/${record.leaseId}/${record._id}-receipt-${timestamp}.pdf`;
          const receiptUrl = await uploadBufferToS3(pdfBuffer, s3Key, "application/pdf");
          resolve(receiptUrl);
        } catch (error) {
          reject(error);
        }
      });
      doc.on("error", reject);

      // Header
      doc.fontSize(24).font("Helvetica-Bold").text("PAYMENT RECEIPT", { align: "center" });
      doc.moveDown(0.5);

      // Receipt Number and Date
      const receiptNumber = `RCP-${new Date().getFullYear()}-${String(record._id).slice(-6).toUpperCase()}`;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Receipt #: ${receiptNumber}`, { align: "left" });
      doc.text(`Date: ${record.paidDate ? new Date(record.paidDate).toLocaleDateString() : new Date().toLocaleDateString()}`, {
        align: "left",
      });
      doc.moveDown(1);

      // Paid By Section
      doc.fontSize(12).font("Helvetica-Bold").text("Paid By:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(tenant.firstName + " " + tenant.lastName, 50, doc.y + 15);
      if (tenant.email) doc.text(tenant.email, 50, doc.y);
      if (tenant.phoneNumber) doc.text(tenant.phoneNumber, 50, doc.y);
      doc.moveDown(1);

      // Property Info
      doc.fontSize(12).font("Helvetica-Bold").text("Property:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(property.title || "N/A", 50, doc.y + 15);
      if (property.address) doc.text(property.address, 50, doc.y);
      doc.moveDown(1.5);

      // Payment Details
      doc.fontSize(12).font("Helvetica-Bold").text("Payment Details:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Description: ${record.label || "Payment"}`, 50, doc.y + 15);
      if (record.paymentMethod) doc.text(`Payment Method: ${record.paymentMethod}`, 50, doc.y);
      if (record.paymentReference) doc.text(`Reference: ${record.paymentReference}`, 50, doc.y);
      doc.moveDown(1);

      // Amount Paid
      doc.fontSize(14).font("Helvetica-Bold");
      const amountPaid = Number(record.amountPaid || 0);
      doc.text(`Amount Paid: ${formatCurrency(amountPaid, currencySymbol, currencyLocale)}`, 50, doc.y, { align: "left" });
      doc.moveDown(1);

      // Notes
      if (record.notes) {
        doc.fontSize(10).font("Helvetica");
        doc.text(`Notes: ${record.notes}`, 50, doc.y);
        doc.moveDown(1);
      }

      // Footer
      doc.fontSize(8).font("Helvetica");
      doc.text("Thank you for your payment!", 50, doc.page.height - 100, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Generate PDF and return buffer (for email attachments)
async function generateInvoicePDFBuffer(record, lease, property, tenant, landlord, agent, currencySettings = {}) {
  const currencySymbol = currencySettings.currencySymbol || "$";
  const currencyLocale = currencySettings.currencyLocale || "en-US";
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        } catch (error) {
          reject(error);
        }
      });
      doc.on("error", reject);

      // Same content as generateInvoicePDF but return buffer instead of uploading
      doc.fontSize(24).font("Helvetica-Bold").text("INVOICE", { align: "center" });
      doc.moveDown(0.5);

      const invoiceNumber = record.invoiceNumber || `INV-${new Date().getFullYear()}-${String(record._id).slice(-6).toUpperCase()}`;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice #: ${invoiceNumber}`, { align: "left" });
      doc.text(`Date: ${new Date(record.createdAt || new Date()).toLocaleDateString()}`, { align: "left" });
      if (record.dueDate) {
        doc.text(`Due Date: ${new Date(record.dueDate).toLocaleDateString()}`, { align: "left" });
      }
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(tenant.firstName + " " + tenant.lastName, 50, doc.y + 15);
      if (tenant.email) doc.text(tenant.email, 50, doc.y);
      if (tenant.phoneNumber) doc.text(tenant.phoneNumber, 50, doc.y);
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Property:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(property.title || "N/A", 50, doc.y + 15);
      if (property.address) doc.text(property.address, 50, doc.y);
      if (property.city) doc.text(`${property.city}${property.state ? `, ${property.state}` : ""}`, 50, doc.y);

      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica-Bold").text("Landlord:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      const landlordName = landlord.isOrganization
        ? landlord.organizationName
        : `${landlord.firstName || ""} ${landlord.lastName || ""}`.trim();
      doc.text(landlordName || "N/A", 50, doc.y + 15);
      doc.moveDown(1.5);

      const tableTop = doc.y;
      const itemHeight = 20;
      let currentY = tableTop;

      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Description", 50, currentY);
      doc.text("Amount", 450, currentY, { align: "right" });
      currentY += itemHeight;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();

      doc.fontSize(10).font("Helvetica");
      currentY += 5;
      doc.text(record.label || "Payment", 50, currentY);
      const baseAmount = Number(record.amountDue || 0);
      doc.text(formatCurrency(baseAmount, currencySymbol, currencyLocale), 450, currentY, { align: "right" });
      currentY += itemHeight;

      if (Array.isArray(record.charges) && record.charges.length > 0) {
        record.charges.forEach((charge) => {
          if (charge.label && charge.amount) {
            doc.text(charge.label, 50, currentY);
            const chargeAmount = Number(charge.amount || 0);
            doc.text(formatCurrency(chargeAmount, currencySymbol, currencyLocale), 450, currentY, { align: "right" });
            currentY += itemHeight;
          }
        });
      }

      currentY += 5;
      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      doc.fontSize(12).font("Helvetica-Bold");
      const totalCharges = Array.isArray(record.charges)
        ? record.charges.reduce((sum, c) => sum + Number(c.amount || 0), 0)
        : 0;
      const totalAmount = baseAmount + totalCharges;
      doc.text("TOTAL", 50, currentY);
      doc.text(formatCurrency(totalAmount, currencySymbol, currencyLocale), 450, currentY, { align: "right" });
      currentY += itemHeight;

      doc.moveDown(1);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Status: ${record.status || "PENDING"}`, 50, doc.y);

      if (record.notes) {
        doc.moveDown(1);
        doc.text(`Notes: ${record.notes}`, 50, doc.y);
      }

      doc.fontSize(8).font("Helvetica");
      doc.text("Thank you for your business!", 50, doc.page.height - 100, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function generateReceiptPDFBuffer(record, lease, property, tenant, landlord, agent, currencySettings = {}) {
  const currencySymbol = currencySettings.currencySymbol || "$";
  const currencyLocale = currencySettings.currencyLocale || "en-US";
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        try {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        } catch (error) {
          reject(error);
        }
      });
      doc.on("error", reject);

      // Same content as generateReceiptPDF but return buffer instead of uploading
      doc.fontSize(24).font("Helvetica-Bold").text("PAYMENT RECEIPT", { align: "center" });
      doc.moveDown(0.5);

      const receiptNumber = record.receiptNumber || `RCP-${new Date().getFullYear()}-${String(record._id).slice(-6).toUpperCase()}`;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Receipt #: ${receiptNumber}`, { align: "left" });
      doc.text(`Date: ${record.paidDate ? new Date(record.paidDate).toLocaleDateString() : new Date().toLocaleDateString()}`, { align: "left" });
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Paid By:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(tenant.firstName + " " + tenant.lastName, 50, doc.y + 15);
      if (tenant.email) doc.text(tenant.email, 50, doc.y);
      if (tenant.phoneNumber) doc.text(tenant.phoneNumber, 50, doc.y);
      doc.moveDown(1);

      doc.fontSize(12).font("Helvetica-Bold").text("Property:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(property.title || "N/A", 50, doc.y + 15);
      if (property.address) doc.text(property.address, 50, doc.y);
      doc.moveDown(1.5);

      doc.fontSize(12).font("Helvetica-Bold").text("Payment Details:", 50, doc.y);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Description: ${record.label || "Payment"}`, 50, doc.y + 15);
      if (record.paymentMethod) doc.text(`Payment Method: ${record.paymentMethod}`, 50, doc.y);
      if (record.paymentReference) doc.text(`Reference: ${record.paymentReference}`, 50, doc.y);
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold");
      const amountPaid = Number(record.amountPaid || 0);
      doc.text(`Amount Paid: ${formatCurrency(amountPaid, currencySymbol, currencyLocale)}`, 50, doc.y, { align: "left" });
      doc.moveDown(1);

      if (record.notes) {
        doc.fontSize(10).font("Helvetica");
        doc.text(`Notes: ${record.notes}`, 50, doc.y);
        doc.moveDown(1);
      }

      doc.fontSize(8).font("Helvetica");
      doc.text("Thank you for your payment!", 50, doc.page.height - 100, { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateInvoicePDF,
  generateReceiptPDF,
  generateInvoicePDFBuffer,
  generateReceiptPDFBuffer,
};

