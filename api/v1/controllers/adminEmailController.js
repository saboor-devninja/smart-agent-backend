const EmailService = require("../services/emailService");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const apiResponse = require("../../../utils/apiResponse");
const AppError = require("../../../utils/appError");
const { success, badRequest } = require("../../../utils/statusCode").statusCode;

/**
 * Admin email controller
 * PLATFORM_ADMIN can send emails and view threads using the same EmailService as agents.
 */

exports.sendEmail = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can send emails", 403));
  }

  const { recipients, subject, body, htmlBody, attachments, isKyc, tenantId, landlordId, threadId } = req.body;

  if (!recipients || !subject || !body) {
    return next(new AppError("Recipients, subject, and body are required", badRequest));
  }

  const sentEmail = await EmailService.sendEmail(
    req.user._id,
    recipients,
    subject,
    body,
    htmlBody,
    attachments || [],
    {
      role: req.user.role,
      isKyc: isKyc || false,
      tenantId,
      landlordId,
      threadId,
    }
  );

  return apiResponse.successResponse(
    res,
    { email: sentEmail },
    "Email sent successfully",
    success
  );
});

exports.getSentEmails = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can access admin emails", 403));
  }

  const filters = {
    isKyc: req.query.isKyc === "true" ? true : req.query.isKyc === "false" ? false : undefined,
    tenantId: req.query.tenantId,
    landlordId: req.query.landlordId,
    status: req.query.status,
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    threadId: req.query.threadId,
  };

  const result = await EmailService.getSentEmails(req.user._id, filters);

  return apiResponse.successResponse(
    res,
    result,
    "Sent emails retrieved successfully",
    success
  );
});

exports.getEmailReplies = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can access admin emails", 403));
  }

  const { emailId } = req.params;

  if (!emailId) {
    return next(new AppError("Email ID is required", badRequest));
  }

  const replies = await EmailService.getEmailReplies(emailId);

  return apiResponse.successResponse(
    res,
    { replies },
    "Email replies retrieved successfully",
    success
  );
});

exports.getEmailThread = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can access admin emails", 403));
  }

  const { threadId } = req.params;

  if (!threadId) {
    return next(new AppError("Thread ID is required", badRequest));
  }

  const thread = await EmailService.getEmailThread(threadId);

  if (!thread) {
    return next(new AppError("Email thread not found", 404));
  }

  return apiResponse.successResponse(
    res,
    thread,
    "Email thread retrieved successfully",
    success
  );
});

exports.getThreadEmails = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can access admin emails", 403));
  }

  const { threadId } = req.params;

  if (!threadId) {
    return next(new AppError("Thread ID is required", badRequest));
  }

  const emails = await EmailService.getThreadEmails(threadId);

  return apiResponse.successResponse(
    res,
    { emails },
    "Thread emails retrieved successfully",
    success
  );
});

