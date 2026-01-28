const multer = require("multer");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { badRequest, success } = require("../../../../utils/statusCode").statusCode;
const Landlord = require("../../../../models/Landlord");
const Property = require("../../../../models/Property");

// Multer instance for CSV upload (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Expose the multer middleware so routes can use it
exports.uploadLandlordPropertyFile = upload.single("file");

/**
 * Simple CSV parser for landlord + property template
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
    "LandlordContactName",
    "LandlordContactEmail",
    "LandlordContactPhone",
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
    if (parts.length === 1 && parts[0] === "") continue; // skip empty row

    const get = (col) => {
      const idx = indexOf(col);
      if (idx === -1) return "";
      return parts[idx] ?? "";
    };

    const landlordContactName = get("LandlordContactName");
    const landlordContactEmail = get("LandlordContactEmail");
    const landlordContactPhone = get("LandlordContactPhone");
    const landlordAddress = get("LandlordAddress");
    const landlordCity = get("LandlordCity");
    const landlordCountry = get("LandlordCountry");

    const propertyTitle = get("PropertyTitle");
    const propertyAddress = get("PropertyAddress");
    const propertyCity = get("PropertyCity");
    const propertyState = get("PropertyState");
    const propertyPostalCode = get("PropertyPostalCode");
    const propertyCountry = get("PropertyCountry");
    const propertyAreaRaw = get("PropertyArea");
    const propertyAreaUnit = get("PropertyAreaUnit") || "SQ_FT";
    const propertyRentAmountRaw = get("PropertyRentAmount");

    rows.push({
      rawIndex: i + 1, // 1-based including header for easier debugging
      landlordContactName,
      landlordContactEmail,
      landlordContactPhone,
      landlordAddress,
      landlordCity,
      landlordCountry,
      propertyTitle,
      propertyAddress,
      propertyCity,
      propertyState,
      propertyPostalCode,
      propertyCountry,
      propertyAreaRaw,
      propertyAreaUnit,
      propertyRentAmountRaw,
    });
  }

  return rows;
}

/**
 * POST /api/v1/agent/imports/landlords-properties/upload
 * Upload a CSV file and create landlords + properties
 */
exports.importLandlordsAndProperties = tryCatchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(
      new AppError("No file uploaded. Please upload a CSV file exported from Excel.", badRequest)
    );
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
      new AppError(
        "No valid rows found in the CSV file. Please check the template.",
        badRequest
      )
    );
  }

  let createdLandlords = 0;
  let reusedLandlords = 0;
  let createdProperties = 0;
  let skippedRows = 0;

  const rowResults = [];

  for (const row of parsedRows) {
    const {
      rawIndex,
      landlordContactName,
      landlordContactEmail,
      landlordContactPhone,
      landlordAddress,
      landlordCity,
      landlordCountry,
      propertyTitle,
      propertyAddress,
      propertyCity,
      propertyState,
      propertyPostalCode,
      propertyCountry,
      propertyAreaRaw,
      propertyAreaUnit,
      propertyRentAmountRaw,
    } = row;

    const errors = [];

    if (!landlordContactName) {
      errors.push("LandlordContactName is required");
    }
    if (!landlordContactEmail) {
      errors.push("LandlordContactEmail is required");
    }
    if (!landlordContactPhone) {
      errors.push("LandlordContactPhone is required");
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

    const rentAmount =
      propertyRentAmountRaw && !Number.isNaN(parseFloat(propertyRentAmountRaw))
        ? parseFloat(propertyRentAmountRaw)
        : null;

    if (errors.length > 0) {
      skippedRows++;
      rowResults.push({
        rowNumber: rawIndex,
        status: "SKIPPED",
        reason: errors.join("; "),
      });
      continue;
    }

    try {
      // Find or create landlord by contactPersonEmail (email acts as unique key per agent/agency)
      const landlordQuery = {
        contactPersonEmail: landlordContactEmail.toLowerCase(),
      };

      if (agencyId) {
        landlordQuery.agencyId = agencyId;
      } else {
        landlordQuery.agentId = agentId;
      }

      let landlord = await Landlord.findOne(landlordQuery);

      if (!landlord) {
        landlord = await Landlord.create({
          agentId,
          agencyId: agencyId || null,
          isOrganization: false,
          contactPersonName: landlordContactName,
          contactPersonEmail: landlordContactEmail.toLowerCase(),
          contactPersonPhone: landlordContactPhone,
          email: landlordContactEmail.toLowerCase(),
          address: landlordAddress || null,
          city: landlordCity || null,
          country: landlordCountry || null,
        });
        createdLandlords++;
      } else {
        reusedLandlords++;
      }

      // Check for duplicate property for this landlord (by address)
      const existingProperty = await Property.findOne({
        landlordId: landlord._id,
        address: propertyAddress,
      }).lean();

      if (existingProperty) {
        skippedRows++;
        rowResults.push({
          rowNumber: rawIndex,
          status: "SKIPPED",
          reason: "Duplicate property for this landlord (same address)",
        });
        continue;
      }

      // Use PropertyService to ensure currency is properly set
      const PropertyService = require("../../services/propertyService");
      await PropertyService.createProperty(
        {
          landlordId: landlord._id,
          type: "OTHER",
          title: propertyTitle,
          description: null,
          bedrooms: 0,
          bathrooms: 0,
          area,
          areaUnit: propertyAreaUnit === "SQ_M" ? "SQ_M" : "SQ_FT",
          furnished: false,
          isAvailable: true,
          rentAmount: rentAmount !== null ? rentAmount : undefined,
          rentalCycle: "MONTHLY",
          address: propertyAddress,
          city: propertyCity || null,
          state: propertyState || null,
          zipCode: propertyPostalCode || null,
          country: propertyCountry || landlordCountry || null,
        },
        landlord.agentId || agentId,
        agencyId || null,
        [], // utilities
        [] // media files
      );

      createdProperties++;
      rowResults.push({
        rowNumber: rawIndex,
        status: "CREATED",
      });
    } catch (err) {
      skippedRows++;
      rowResults.push({
        rowNumber: rawIndex,
        status: "ERROR",
        reason: err.message || "Failed to process row",
      });
    }
  }

  return apiResponse.successResponse(
    res,
    {
      stats: {
        totalRows: parsedRows.length,
        createdLandlords,
        reusedLandlords,
        createdProperties,
        skippedRows,
      },
      rows: rowResults,
    },
    "Import completed",
    success
  );
});

