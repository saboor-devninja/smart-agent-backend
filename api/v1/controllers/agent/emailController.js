const EmailService = require("../../services/emailService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { success, badRequest } = require("../../../../utils/statusCode").statusCode;

exports.sendEmail = tryCatchAsync(async (req, res, next) => {
  const { recipients, subject, body, htmlBody, attachments, isKyc, tenantId, landlordId } = req.body;

  if (!recipients || !subject || !body) {
    return next(new AppError("Recipients, subject, and body are required", badRequest));
  }

  // Sanitize HTML content to prevent XSS
  const xss = require("xss");
  const sanitizedHtmlBody = htmlBody ? xss(htmlBody, {
    whiteList: {
      p: [],
      br: [],
      strong: [],
      em: [],
      u: [],
      h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
      ul: [], ol: [], li: [],
      a: ["href", "title", "target"],
      blockquote: [],
      code: [],
      pre: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ["script"],
  }) : null;

  const sentEmail = await EmailService.sendEmail(
    req.user._id,
    recipients,
    subject,
    body,
    sanitizedHtmlBody,
    attachments || [],
    {
      role: req.user.role,
      isKyc: isKyc || false,
      tenantId,
      landlordId,
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
  const filters = {
    isKyc: req.query.isKyc === "true" ? true : req.query.isKyc === "false" ? false : undefined,
    tenantId: req.query.tenantId,
    landlordId: req.query.landlordId,
    status: req.query.status,
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
  };

  const result = await EmailService.getSentEmails(req.user._id, filters);

  return apiResponse.successResponse(
    res,
    result,
    "Sent emails retrieved successfully",
    success
  );
});

exports.getInbox = tryCatchAsync(async (req, res, next) => {
  const filters = {
    isKyc: req.query.isKyc === "true" ? true : req.query.isKyc === "false" ? false : undefined,
    tenantId: req.query.tenantId,
    landlordId: req.query.landlordId,
    status: req.query.status,
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
  };

  const result = await EmailService.getInbox(req.user._id, filters);

  return apiResponse.successResponse(
    res,
    result,
    "Inbox retrieved successfully",
    success
  );
});

exports.getEmailReplies = tryCatchAsync(async (req, res, next) => {
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
  const { threadId } = req.params;

  if (!threadId) {
    return next(new AppError("Thread ID is required", badRequest));
  }

  const thread = await EmailService.getEmailThread(threadId);

  if (!thread) {
    return next(new AppError("Thread not found", 404));
  }

  return apiResponse.successResponse(
    res,
    thread,
    "Email thread retrieved successfully",
    success
  );
});

exports.getThreadEmails = tryCatchAsync(async (req, res, next) => {
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

exports.markEmailAsKyc = tryCatchAsync(async (req, res, next) => {
  const { emailId } = req.params;
  const { tenantId } = req.body;

  if (!emailId || !tenantId) {
    return next(new AppError("Email ID and Tenant ID are required", badRequest));
  }

  const SentEmail = require("../../../../models/SentEmail");
  const Tenant = require("../../../../models/Tenant");
  const email = await SentEmail.findById(emailId);

  if (!email) {
    return next(new AppError("Email not found", 404));
  }

  // Verify the email belongs to the user or is an inbound email for this tenant
  if (email.senderId !== req.user._id && !email.isInbound) {
    return next(new AppError("Unauthorized", 403));
  }

  // Verify tenant belongs to the user/agency
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) {
    return next(new AppError("Tenant not found", 404));
  }

  // Check tenant ownership
  const isTenantOwner = 
    (req.user.agencyId && tenant.agencyId === req.user.agencyId) ||
    (!req.user.agencyId && tenant.agentId === req.user._id);

  if (!isTenantOwner) {
    return next(new AppError("Unauthorized: Tenant does not belong to you", 403));
  }

  email.isKyc = true;
  email.tenantId = tenantId;
  await email.save();

  return apiResponse.successResponse(
    res,
    { email },
    "Email marked as KYC successfully",
    success
  );
});

exports.getAvailableRecipients = tryCatchAsync(async (req, res, next) => {
  const Landlord = require("../../../../models/Landlord");
  const Tenant = require("../../../../models/Tenant");
  const User = require("../../../../models/User");
  const Agency = require("../../../../models/Agency");

  const userId = req.user._id;
  const userRole = req.user.role;
  const agencyId = req.user.agencyId;

  const recipients = {
    landlords: [],
    tenants: [],
    agents: [],
    agencies: [],
  };

  if (userRole === "PLATFORM_ADMIN") {
    // Platform admin can see all
    const [landlords, tenants, agents, agencies] = await Promise.all([
      Landlord.find({})
        .select("_id firstName lastName isOrganization organizationName contactPersonEmail contactPersonName")
        .sort({ isOrganization: -1, organizationName: 1, firstName: 1 })
        .lean(),
      Tenant.find({ email: { $exists: true, $ne: null } })
        .select("_id firstName lastName email")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      User.find({ role: { $in: ["AGENT", "AGENCY_ADMIN"] }, isActive: true })
        .select("_id firstName lastName email")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      Agency.find({ status: "ACTIVE" })
        .select("_id name")
        .sort({ name: 1 })
        .lean(),
    ]);

    recipients.landlords = landlords
      .filter((l) => l.contactPersonEmail)
      .map((l) => ({
        id: l._id,
        name: l.isOrganization
          ? l.organizationName || "Unknown"
          : `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
        email: l.contactPersonEmail,
      }));

    recipients.tenants = tenants
      .filter((t) => t.email)
      .map((t) => ({
        id: t._id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email,
      }));

    recipients.agents = agents.map((a) => ({
      id: a._id,
      name: `${a.firstName} ${a.lastName}`,
      email: a.email,
    }));

    recipients.agencies = agencies.map((a) => ({
      id: a._id,
      name: a.name,
      email: "", // Agencies don't have direct emails
    }));
  } else if (userRole === "AGENCY_ADMIN") {
    // Agency admin can see landlords, tenants, and agents in their agency
    const [landlords, tenants, agents] = await Promise.all([
      Landlord.find({ agencyId })
        .select("_id firstName lastName isOrganization organizationName contactPersonEmail contactPersonName agentId")
        .sort({ isOrganization: -1, organizationName: 1, firstName: 1 })
        .lean(),
      Tenant.find({ agencyId, email: { $exists: true, $ne: null } })
        .select("_id firstName lastName email")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      User.find({ agencyId, isActive: true, role: { $in: ["AGENT", "AGENCY_ADMIN"] } })
        .select("_id firstName lastName email")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
    ]);

    // Filter landlords that have an agentId (assigned to an agent)
    recipients.landlords = landlords
      .filter((l) => l.contactPersonEmail && l.agentId)
      .map((l) => ({
        id: l._id,
        name: l.isOrganization
          ? l.organizationName || "Unknown"
          : `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
        email: l.contactPersonEmail,
      }));

    recipients.tenants = tenants
      .filter((t) => t.email)
      .map((t) => ({
        id: t._id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email,
      }));

    recipients.agents = agents.map((a) => ({
      id: a._id,
      name: `${a.firstName} ${a.lastName}`,
      email: a.email,
    }));
  } else {
    // Regular agent can see their own landlords and tenants
    const [landlords, tenants] = await Promise.all([
      Landlord.find({ agentId: userId })
        .select("_id firstName lastName isOrganization organizationName contactPersonEmail contactPersonName")
        .sort({ isOrganization: -1, organizationName: 1, firstName: 1 })
        .lean(),
      Tenant.find({ agentId: userId, email: { $exists: true, $ne: null } })
        .select("_id firstName lastName email")
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
    ]);

    recipients.landlords = landlords
      .filter((l) => l.contactPersonEmail)
      .map((l) => ({
        id: l._id,
        name: l.isOrganization
          ? l.organizationName || "Unknown"
          : `${l.firstName || ""} ${l.lastName || ""}`.trim() || "Unknown",
        email: l.contactPersonEmail,
      }));

    recipients.tenants = tenants
      .filter((t) => t.email)
      .map((t) => ({
        id: t._id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email,
      }));
  }

  return apiResponse.successResponse(
    res,
    recipients,
    "Available recipients retrieved successfully",
    success
  );
});
