const multer = require("multer");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { badRequest, success, created } = require("../../../../utils/statusCode").statusCode;
const AgentStatementImport = require("../../../../models/AgentStatementImport");
const AgentStatementRow = require("../../../../models/AgentStatementRow");
const Tenant = require("../../../../models/Tenant");

// Multer instance for CSV/XLSX upload (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Expose the multer middleware so routes can use it
exports.uploadStatementFile = upload.single("file");

/**
 * Simple CSV parser for our template
 */
function parseCsv(buffer) {
  const text = buffer.toString("utf-8");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file must contain a header row and at least one data row");
  }

  const header = lines[0].split(",").map((h) => h.trim());
  const requiredColumns = [
    "TenantName",
    "TransactionDate",
    "Amount",
    "PeriodMonth",
    "PeriodYear",
  ];

  const missing = requiredColumns.filter(
    (col) => !header.some((h) => h.toLowerCase() === col.toLowerCase())
  );

  if (missing.length > 0) {
    throw new Error(`Missing required columns in CSV: ${missing.join(", ")}`);
  }

  const indexOf = (col) =>
    header.findIndex((h) => h.toLowerCase() === col.toLowerCase());

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length === 0 || parts.every((p) => p === "")) continue;

    const get = (idx) => (idx >= 0 && idx < parts.length ? parts[idx] : "");

    const tenantName = get(indexOf("TenantName"));
    const transactionDateStr = get(indexOf("TransactionDate"));
    const amountStr = get(indexOf("Amount"));
    const periodMonthStr = get(indexOf("PeriodMonth"));
    const periodYearStr = get(indexOf("PeriodYear"));
    const bankReferenceIdx = header.findIndex(
      (h) => h.toLowerCase() === "bankreference"
    );
    const bankReference = bankReferenceIdx >= 0 ? get(bankReferenceIdx) : "";

    if (!tenantName || !transactionDateStr || !amountStr) {
      // Skip obviously invalid rows
      continue;
    }

    const amount = parseFloat(amountStr);
    const periodMonth = parseInt(periodMonthStr, 10);
    const periodYear = parseInt(periodYearStr, 10);
    const transactionDate = new Date(transactionDateStr);

    if (!amount || Number.isNaN(amount) || !transactionDate.getTime()) {
      continue;
    }

    rows.push({
      rawTenantName: tenantName,
      transactionDate,
      amount,
      periodMonth: periodMonth || transactionDate.getMonth() + 1,
      periodYear: periodYear || transactionDate.getFullYear(),
      bankReference: bankReference || null,
    });
  }

  return rows;
}

/**
 * POST /api/v1/agent/finance/imports/upload
 * Upload a CSV statement and create an import batch + rows
 */
exports.uploadStatement = tryCatchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded. Please upload a CSV file.", badRequest));
  }

  const agentId = req.user._id;
  const agencyId = req.user.agencyId || null;

  let parsedRows;
  try {
    parsedRows = parseCsv(req.file.buffer);
  } catch (err) {
    return next(new AppError(err.message || "Failed to parse CSV file", badRequest));
  }

  if (!parsedRows.length) {
    return next(
      new AppError("No valid rows found in the CSV file. Please check the template.", badRequest)
    );
  }

  // Create import batch
  const importDoc = await AgentStatementImport.create({
    agentId,
    agencyId,
    originalFileName: req.file.originalname,
    periodMonth: parsedRows[0].periodMonth || null,
    periodYear: parsedRows[0].periodYear || null,
    totalRows: parsedRows.length,
  });

  // Preload tenants for simple name-based suggestions
  const tenants = await Tenant.find({
    $or: [
      { agentId },
      agencyId ? { agencyId } : null,
    ].filter(Boolean),
  })
    .select("firstName lastName")
    .lean();

  const makeFullName = (t) =>
    `${t.firstName || ""} ${t.lastName || ""}`.trim().toLowerCase();

  const tenantNamesMap = new Map();
  tenants.forEach((t) => {
    const key = makeFullName(t);
    if (!tenantNamesMap.has(key)) {
      tenantNamesMap.set(key, t._id);
    }
  });

  // Create rows with basic suggestions
  const rowDocs = await AgentStatementRow.insertMany(
    parsedRows.map((row) => {
      const key = row.rawTenantName.trim().toLowerCase();
      const suggestedTenantId = tenantNamesMap.get(key) || null;

      return {
        importId: importDoc._id,
        agentId,
        agencyId,
        rawTenantName: row.rawTenantName,
        transactionDate: row.transactionDate,
        amount: row.amount,
        periodMonth: row.periodMonth,
        periodYear: row.periodYear,
        bankReference: row.bankReference,
        suggestedTenantId,
      };
    })
  );

  const matchedRows = rowDocs.filter((r) => r.suggestedTenantId).length;
  const unmatchedRows = rowDocs.length - matchedRows;

  importDoc.matchedRows = matchedRows;
  importDoc.unmatchedRows = unmatchedRows;
  await importDoc.save();

  return apiResponse.successResponse(
    res,
    {
      import: importDoc,
      rows: rowDocs.map((r) => ({
        _id: r._id,
        rawTenantName: r.rawTenantName,
        transactionDate: r.transactionDate,
        amount: r.amount,
        periodMonth: r.periodMonth,
        periodYear: r.periodYear,
        bankReference: r.bankReference,
        suggestedTenantId: r.suggestedTenantId,
        status: r.status,
      })),
    },
    "Statement uploaded successfully. Please map tenants and review records.",
    created
  );
});

/**
 * GET /api/v1/agent/finance/imports/:id
 * Get import batch details and rows for mapping UI
 */
exports.getImport = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;
  const agentId = req.user._id;

  const importDoc = await AgentStatementImport.findOne({
    _id: id,
    agentId,
  }).lean();

  if (!importDoc) {
    return next(new AppError("Import not found", badRequest));
  }

  const rows = await AgentStatementRow.find({ importId: id })
    .populate("suggestedTenantId", "firstName lastName")
    .lean();

  return apiResponse.successResponse(
    res,
    {
      import: importDoc,
      rows,
    },
    "Import retrieved successfully",
    success
  );
});

/**
 * GET /api/v1/agent/finance/imports/check-records
 * Check existing payment records for a lease + month
 */
exports.checkExistingRecords = tryCatchAsync(async (req, res, next) => {
  const { leaseId, periodMonth, periodYear } = req.query;

  if (!leaseId || !periodMonth || !periodYear) {
    return next(new AppError("leaseId, periodMonth, and periodYear are required", badRequest));
  }

  const agentId = req.user._id;
  const agencyId = req.user.agencyId || null;

  const Lease = require("../../../../models/Lease");
  const LeasePaymentRecord = require("../../../../models/LeasePaymentRecord");

  // Verify lease belongs to agent/agency
  const lease = await Lease.findOne({
    _id: leaseId,
    $or: [{ agentId }, agencyId ? { agencyId } : null].filter(Boolean),
  }).lean();

  if (!lease) {
    return next(new AppError("Lease not found or access denied", badRequest));
  }

  // Find all payment records for this lease + month
  const startOfMonth = new Date(parseInt(periodYear), parseInt(periodMonth) - 1, 1);
  const endOfMonth = new Date(parseInt(periodYear), parseInt(periodMonth), 0, 23, 59, 59);

  const existingRecords = await LeasePaymentRecord.find({
    leaseId,
    dueDate: { $gte: startOfMonth, $lte: endOfMonth },
  })
    .sort({ type: 1, createdAt: 1 })
    .lean();

  const records = existingRecords.map((r) => ({
    _id: r._id,
    type: r.type,
    label: r.label,
    amountDue: parseFloat(r.amountDue?.toString() || "0"),
    amountPaid: r.amountPaid ? parseFloat(r.amountPaid.toString()) : null,
    status: r.status,
    dueDate: r.dueDate,
    paidDate: r.paidDate || null,
  }));

  return apiResponse.successResponse(
    res,
    { records },
    "Existing records retrieved successfully",
    success
  );
});

/**
 * POST /api/v1/agent/finance/imports/:id/apply
 * Apply mapping decisions and create/update payment records
 */
exports.applyImport = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { mappings } = req.body; // Array of { rowId, tenantId, leaseId, action: 'CREATE' | 'UPDATE' | 'SKIP', paymentRecordId?: string }

  if (!Array.isArray(mappings)) {
    return next(new AppError("Mappings must be an array", badRequest));
  }

  const agentId = req.user._id;
  const agencyId = req.user.agencyId || null;

  const importDoc = await AgentStatementImport.findOne({
    _id: id,
    agentId,
  });

  if (!importDoc) {
    return next(new AppError("Import not found", badRequest));
  }

  if (importDoc.status === "COMPLETED") {
    return next(new AppError("This import has already been applied", badRequest));
  }

  const LeasePaymentRecord = require("../../../../models/LeasePaymentRecord");
  const Lease = require("../../../../models/Lease");
  const crypto = require("crypto");

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const mapping of mappings) {
    const { rowId, tenantId, leaseId, action, paymentRecordId } = mapping;

    if (action === "SKIP") {
      await AgentStatementRow.findByIdAndUpdate(rowId, { status: "IGNORED" });
      results.skipped++;
      continue;
    }

    if (!tenantId || !leaseId) {
      results.errors.push({ rowId, error: "Tenant ID and Lease ID are required" });
      continue;
    }

    const row = await AgentStatementRow.findById(rowId);
    if (!row || row.importId.toString() !== id) {
      results.errors.push({ rowId, error: "Row not found" });
      continue;
    }

    // Verify lease belongs to agent/agency
    const lease = await Lease.findOne({
      _id: leaseId,
      tenantId,
      $or: [{ agentId }, agencyId ? { agencyId } : null].filter(Boolean),
    }).lean();

    if (!lease) {
      results.errors.push({ rowId, error: "Lease not found or access denied" });
      continue;
    }

    // Generate duplicate hash
    const hashInput = `${agentId}-${row.bankReference || row.transactionDate}-${row.amount}-${row.periodMonth}-${row.periodYear}`;
    const duplicateHash = crypto.createHash("sha256").update(hashInput).digest("hex");

    // Check for existing duplicate
    const existingDuplicate = await AgentStatementRow.findOne({
      duplicateHash,
      status: "APPLIED",
      _id: { $ne: rowId },
    });

    if (existingDuplicate) {
      await AgentStatementRow.findByIdAndUpdate(rowId, {
        status: "DUPLICATE",
        duplicateHash,
      });
      results.errors.push({ rowId, error: "This transaction was already imported" });
      continue;
    }

    // Find or create payment record for this month
    const startOfMonth = new Date(row.periodYear, row.periodMonth - 1, 1);
    const endOfMonth = new Date(row.periodYear, row.periodMonth, 0, 23, 59, 59);

    let paymentRecord = null;

    if (action === "UPDATE") {
      if (paymentRecordId) {
        // Update specific record by ID
        paymentRecord = await LeasePaymentRecord.findOne({
          _id: paymentRecordId,
          leaseId,
          dueDate: { $gte: startOfMonth, $lte: endOfMonth },
        });
      } else {
        // Fallback: find first RENT record for this month
        paymentRecord = await LeasePaymentRecord.findOne({
          leaseId,
          type: "RENT",
          dueDate: { $gte: startOfMonth, $lte: endOfMonth },
        });
      }

      if (paymentRecord) {
        // Update existing record
        const wasPaid = paymentRecord.status === "PAID";
        paymentRecord.status = "PAID";
        paymentRecord.amountPaid = row.amount;
        paymentRecord.paidDate = row.transactionDate;
        paymentRecord.paymentMethod = "BANK_TRANSFER";
        paymentRecord.paymentReference = row.bankReference || `IMPORT-${row._id}`;
        await paymentRecord.save();
        
        // Create/update commission records since payment is now PAID
        try {
          const CommissionService = require("../../services/commissionService");
          const CommissionRecord = require("../../../../models/CommissionRecord");
          
          const existingCommission = await CommissionRecord.findOne({
            paymentRecordId: paymentRecord._id,
          }).lean();

          if (!existingCommission) {
            // Create new commission if payment just became PAID
            await CommissionService.calculateAndRecord(paymentRecord.toObject(), agentId, agencyId);
          } else {
            // Update existing commission (handles amount changes and reactivation)
            await CommissionService.recalculateAndUpdate(paymentRecord.toObject(), agentId, agencyId);
          }

          // Mark commission as PAID when tenant payment is fully paid
          // Agent commission is considered "earned/paid" when tenant pays rent
          await CommissionRecord.updateOne(
            { paymentRecordId: paymentRecord._id },
            {
              status: "PAID",
              paidAt: paymentRecord.paidDate || new Date(),
            }
          );
        } catch (error) {
          console.error("Error creating commission for updated payment record:", error);
          // Don't fail the import if commission calculation fails
        }
        
        results.updated++;
      } else {
        results.errors.push({
          rowId,
          error: paymentRecordId
            ? "Selected payment record not found"
            : "No existing payment record found to update",
        });
        continue;
      }
    } else if (action === "CREATE") {
      // Create new payment record
      const rentAmount = parseFloat(lease.rentAmount.toString());
      paymentRecord = await LeasePaymentRecord.create({
        leaseId,
        agentId,
        agencyId,
        type: "RENT",
        label: `Rent - ${new Date(row.periodYear, row.periodMonth - 1).toLocaleString("default", { month: "long", year: "numeric" })}`,
        dueDate: new Date(row.periodYear, row.periodMonth - 1, lease.dueDay || 1),
        amountDue: rentAmount,
        status: "PAID",
        amountPaid: row.amount,
        paidDate: row.transactionDate,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: row.bankReference || `IMPORT-${row._id}`,
      });
      
      // Create commission records since payment is already PAID
      try {
        const CommissionService = require("../../services/commissionService");
        const CommissionRecord = require("../../../../models/CommissionRecord");
        
        // Create commission and landlord payment records
        await CommissionService.calculateAndRecord(paymentRecord.toObject(), agentId, agencyId);
        
        // Mark commission as PAID since payment is already paid
        await CommissionRecord.updateOne(
          { paymentRecordId: paymentRecord._id },
          {
            status: "PAID",
            paidAt: paymentRecord.paidDate || new Date(),
          }
        );
      } catch (error) {
        console.error("Error creating commission for new payment record:", error);
        // Don't fail the import if commission calculation fails
      }
      
      results.created++;
    } else {
      results.errors.push({ rowId, error: `Invalid action: ${action}` });
      continue;
    }

    // Mark row as applied
    await AgentStatementRow.findByIdAndUpdate(rowId, {
      status: "APPLIED",
      tenantId,
      leaseId,
      duplicateHash,
    });
  }

  // Update import status
  const appliedCount = results.created + results.updated;
  if (appliedCount > 0) {
    importDoc.status = appliedCount === importDoc.totalRows ? "COMPLETED" : "PARTIAL";
    importDoc.appliedRows = appliedCount;
    await importDoc.save();
  }

  return apiResponse.successResponse(
    res,
    {
      results,
      import: importDoc,
    },
    `Import applied: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
    success
  );
});

