const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const mongoSanitize = require("express-mongo-sanitize");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const useragent = require("express-useragent");
const config = require("./config/config");
const AppError = require("./utils/appError");
const appGlobalErrorHandler = require("./utils/appGlobalErrorHandler");
const v1Routes = require("./api/v1/routes/v1.routes");

const app = express();

// Trust proxy
app.set('trust proxy', 2);

// Morgan logging with custom format
morgan.token('client-ip', (req) => {
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
});

app.use(morgan(':client-ip - :method :url :status :response-time ms'));

// Body parser
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(helmet());

// XSS protection - but skip for email endpoints that need to send HTML
app.use((req, res, next) => {
  // Skip xss-clean for email send endpoints (we sanitize HTML manually in controller)
  // The xss-clean middleware escapes HTML tags, which breaks our HTML email content
  const emailSendPaths = [
    '/api/v1/agent/emails/send',
    '/api/v1/admin/emails/send',
  ];
  
  if (emailSendPaths.some(path => req.path.startsWith(path)) && req.method === 'POST') {
    return next();
  }
  return xss()(req, res, next);
});

app.use(mongoSanitize());

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      config.frontend.url,
      'http://localhost:3000',
      'http://localhost:5100',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5100',
    ];
    
    if (config.env === 'development') {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    } else {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
};

app.use(cors(corsOptions));

// Rate limiting
const rateLimitOptions = {
  max: 250,
  windowMs: 30 * 1000, // 30 seconds
  message: {
    message: 'Too many requests from this IP, please try again later',
    code: 429,
    status: 'Error',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
};

app.use(rateLimit(rateLimitOptions));

// User agent
app.use(useragent.express());

// Compression
app.use(
  compression({
    level: 6,
    threshold: 0,
  })
);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1', v1Routes);

// Webhook Routes (no auth required, uses HMAC verification)
const webhookRoutes = require('./api/webhooks/routes');
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Global error handler (must be last)
app.use(appGlobalErrorHandler);

module.exports = app;

