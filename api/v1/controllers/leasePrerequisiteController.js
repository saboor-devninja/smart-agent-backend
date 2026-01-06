const LeasePrerequisiteService = require("../services/leasePrerequisiteService");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const apiResponse = require("../../../utils/apiResponse");
const AppError = require("../../../utils/appError");
const { success, created, badRequest } = require("../../../utils/statusCode").statusCode;
const { uploadBufferToS3 } = require("../../../utils/s3");

exports.getForLease = tryCatchAsync(async (req, res, next) => {
  const leaseId = req.query.leaseId;

  if (!leaseId) {
    return next(new AppError("leaseId is required", badRequest));
  }

  const result = await LeasePrerequisiteService.getByLease(
    leaseId,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    {
      lease: result.lease,
      prerequisites: result.prerequisites,
    },
    "Lease prerequisites retrieved successfully",
    success
  );
});

exports.create = tryCatchAsync(async (req, res, next) => {
  const { leaseId, title, type, description, isRequired, amount, dueDate, priority, notes, documentUrl, customType } =
    req.body;

  if (!leaseId || !title) {
    return next(new AppError("leaseId and title are required", badRequest));
  }

  const prerequisite = await LeasePrerequisiteService.create(
    leaseId,
    {
      title,
      type,
      description,
      isRequired,
      amount,
      dueDate,
      priority,
      notes,
      documentUrl,
      customType,
    },
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { prerequisite },
    "Lease prerequisite created successfully",
    created
  );
});

exports.updateStatus = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { isCompleted } = req.body;

  if (typeof isCompleted !== "boolean") {
    return next(new AppError("isCompleted boolean is required", badRequest));
  }

  const prerequisite = await LeasePrerequisiteService.updateStatus(
    id,
    isCompleted,
    req.user._id
  );

  return apiResponse.successResponse(
    res,
    { prerequisite },
    "Lease prerequisite updated successfully",
    success
  );
});

exports.manualSign = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { notes } = req.body;

  if (!id) {
    return next(new AppError("Prerequisite id is required", badRequest));
  }

  const file = req.file;

  let documentUrl = null;
  if (file && file.buffer) {
    documentUrl = await uploadBufferToS3(
      file.buffer,
      `lease-manual-signed/${id}/${Date.now()}-${file.originalname}`,
      file.mimetype || "application/pdf"
    );
  }

  const updated = await LeasePrerequisiteService.updateStatus(id, true, req.user._id);

  if (documentUrl || notes) {
    updated.documentUrl = documentUrl || updated.documentUrl;
    updated.notes = notes || updated.notes;
  }

  return apiResponse.successResponse(
    res,
    { prerequisite: updated, documentUrl },
    "Lease documents marked as signed manually",
    success
  );
});



