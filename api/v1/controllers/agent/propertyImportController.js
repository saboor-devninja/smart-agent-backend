const multer = require("multer");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { badRequest, success, created } = require("../../../../utils/statusCode").statusCode;
const Landlord = require("../../../../models/Landlord");
const Property = require("../../../../models/Property");
const PropertyService = require("../../services/propertyService");

// Multer instance for CSV upload (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Expose the multer middleware so routes can use it
exports.uploadPropertyFile = upload.single("file");

/**
 * Simple CSV parser for property-only template
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
    "LandlordContactEmail",
    "PropertyTitle",
    "PropertyAddress",
    "PropertyArea",
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
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length === 1 && parts[0] === "") continue; // skip completely empty row

    const get = (col) => {
      const idx = indexOf(col);
      if (idx === -1) return "";
      return parts[idx] ?? "";
    };

    const landlordContactEmail = get("LandlordContactEmail");
    const propertyTitle = get("PropertyTitle");
    const propertyAddress = get("PropertyAddress");
    const propertyAreaRaw = get("PropertyArea");

    // Validate required fields - we'll check these in the processing loop and skip with reason
    rows.push({
      rawIndex: i + 1, // 1-based including header for easier debugging
      landlordContactEmail: landlordContactEmail.toLowerCase().trim(),
      propertyTitle: propertyTitle.trim(),
      propertyAddress: propertyAddress.trim(),
      propertyCity: get("PropertyCity")?.trim() || "",
      propertyState: get("PropertyState")?.trim() || "",
      propertyPostalCode: get("PropertyPostalCode")?.trim() || "",
      propertyCountry: get("PropertyCountry")?.trim() || "",
      propertyAreaRaw: propertyAreaRaw.trim(),
      propertyAreaUnit: (get("PropertyAreaUnit")?.trim().toUpperCase() || "SQ_FT"),
      propertyRentAmountRaw: get("PropertyRentAmount")?.trim() || "",
      propertyBedroomsRaw: get("PropertyBedrooms")?.trim() || "",
      propertyBathroomsRaw: get("PropertyBathrooms")?.trim() || "",
    });
  }

  return rows;
}

/**
 * POST /api/v1/agent/imports/properties/upload
 * Upload a CSV with properties and link them to existing landlords by contact email
 */
exports.uploadProperties = tryCatchAsync(async (req, res, next) => {
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

  const results = {
    totalRows: parsedRows.length,
    createdProperties: 0,
    skippedRows: 0,
    errors: [],
    rows: [],
  };

  // Build query for finding landlords (filter by agent/agency)
  const landlordQuery = {};
  if (agencyId) {
    landlordQuery.agencyId = agencyId;
  } else {
    landlordQuery.agentId = agentId;
  }

  // Process each row
  for (const row of parsedRows) {
    const {
      rawIndex,
      landlordContactEmail,
      propertyTitle,
      propertyAddress,
      propertyCity,
      propertyState,
      propertyPostalCode,
      propertyCountry,
      propertyAreaRaw,
      propertyAreaUnit,
      propertyRentAmountRaw,
      propertyBedroomsRaw,
      propertyBathroomsRaw,
    } = row;

    // Validate required fields
    const errors = [];
    if (!landlordContactEmail) {
      errors.push("LandlordContactEmail is required");
    }
    if (!propertyTitle) {
      errors.push("PropertyTitle is required");
    }
    if (!propertyAddress) {
      errors.push("PropertyAddress is required");
    }
    const area = parseFloat(propertyAreaRaw || "0");
    if (!propertyAreaRaw || Number.isNaN(area) || area <= 0) {
      errors.push("PropertyArea is required and must be a positive number");
    }

    if (errors.length > 0) {
      results.skippedRows++;
      results.rows.push({
        rowNumber: rawIndex,
        status: "SKIPPED",
        reason: `Missing required fields: ${errors.join("; ")}`,
        data: row,
      });
      continue;
    }

    try {
      // Find landlord by contact email
      const landlord = await Landlord.findOne({
        ...landlordQuery,
        contactPersonEmail: landlordContactEmail,
      }).lean();

      if (!landlord) {
        results.skippedRows++;
        results.rows.push({
          rowNumber: rawIndex,
          status: "SKIPPED",
          reason: `Landlord with email ${landlordContactEmail} not found. Please create the landlord first or use the landlord+property import.`,
          data: row,
        });
        continue;
      }

      // Check if property already exists (same landlord + address)
      const existingProperty = await Property.findOne({
        landlordId: landlord._id,
        address: propertyAddress,
        agentId: agentId,
        ...(agencyId ? { agencyId } : {}),
      }).lean();

      if (existingProperty) {
        results.skippedRows++;
        results.rows.push({
          rowNumber: rawIndex,
          status: "SKIPPED",
          reason: `Property already exists at ${propertyAddress} for this landlord.`,
          data: row,
        });
        continue;
      }

      // Parse optional fields
      const rentAmount = propertyRentAmountRaw && !Number.isNaN(parseFloat(propertyRentAmountRaw))
        ? parseFloat(propertyRentAmountRaw)
        : null;
      const bedrooms = propertyBedroomsRaw && !Number.isNaN(parseInt(propertyBedroomsRaw))
        ? parseInt(propertyBedroomsRaw)
        : 0;
      const bathrooms = propertyBathroomsRaw && !Number.isNaN(parseFloat(propertyBathroomsRaw))
        ? parseFloat(propertyBathroomsRaw)
        : 0;

      // Create property
      const propertyData = {
        landlordId: landlord._id,
        title: propertyTitle,
        address: propertyAddress,
        city: propertyCity || null,
        state: propertyState || null,
        zipCode: propertyPostalCode || null,
        country: propertyCountry || null,
        area: area,
        areaUnit: propertyAreaUnit === "SQ_M" ? "SQ_M" : "SQ_FT",
        rentAmount: rentAmount,
        bedrooms: bedrooms,
        bathrooms: bathrooms,
      };

      const property = await PropertyService.createProperty(
        propertyData,
        agentId,
        agencyId,
        [], // utilities
        [] // media files
      );

      results.createdProperties++;
      results.rows.push({
        rowNumber: rawIndex,
        status: "CREATED",
        propertyId: property._id,
        propertyTitle: property.title,
        landlordName: landlord.contactPersonName || `${landlord.firstName || ""} ${landlord.lastName || ""}`.trim(),
        data: row,
      });
    } catch (error) {
      results.skippedRows++;
      results.errors.push({
        rowNumber: rawIndex,
        error: error.message || "Unknown error",
      });
      results.rows.push({
        rowNumber: rawIndex,
        status: "ERROR",
        reason: error.message || "Unknown error",
        data: row,
      });
    }
  }

  return apiResponse.successResponse(
    res,
    {
      summary: {
        totalRows: results.totalRows,
        createdProperties: results.createdProperties,
        skippedRows: results.skippedRows,
        errorCount: results.errors.length,
      },
      rows: results.rows,
      errors: results.errors,
    },
    `Import completed: ${results.createdProperties} properties created, ${results.skippedRows} rows skipped.`,
    created
  );
});

/**
 * GET /api/v1/agent/imports/properties/template
 * Download sample CSV template for property-only import
 */
exports.downloadTemplate = tryCatchAsync(async (req, res, next) => {
  const csvContent = [
    "LandlordContactEmail,PropertyTitle,PropertyAddress,PropertyCity,PropertyState,PropertyPostalCode,PropertyCountry,PropertyArea,PropertyAreaUnit,PropertyRentAmount,PropertyBedrooms,PropertyBathrooms",
    "landlord@example.com,Sunset Apartment,123 Main St,Los Angeles,CA,90001,USA,1200,SQ_FT,2500,2,1.5",
  ].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=property-import-template.csv");
  res.send(csvContent);
});
