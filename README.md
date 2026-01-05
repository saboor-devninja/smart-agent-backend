# Rental Genie Backend

Node.js + Express + MongoDB backend for Rental Genie.

## 🚀 Getting Started

### Install Dependencies

```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Update `.env` with your configuration:
   - MongoDB URI
   - JWT Secret (use a strong secret!)
   - Frontend URL

### Run Development Server

```bash
npm run dev
```

Server will run on `http://localhost:5000`

### Run Production Server

```bash
npm start
```

## 📁 Project Structure

```
backend/
├── api/
│   ├── v1/
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Business logic
│   │   └── middleware/      # Custom middleware
│   └── webhooks/            # Webhook handlers
├── config/                   # Configuration
├── models/                   # Mongoose models
├── services/                 # Services (cron, notifications, etc.)
├── utils/                    # Utility functions
├── validators/               # Input validators
├── app.js                    # Express app
└── server.js                 # Server entry point
```

## 🔧 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## 📝 API Endpoints

### Health Check
- `GET /health` - Server health check

### Authentication (Coming Soon)
- `POST /api/v1/auth/signup` - User signup
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user

## 🔒 Security Features

- Helmet.js for security headers
- CORS enabled
- XSS protection
- MongoDB injection protection
- Rate limiting
- Request sanitization

## 📚 Next Steps

1. Implement authentication (Day 2)
2. Create database models (Day 3)
3. Implement CRUD operations (Days 4-6)
4. Add financial module (Day 7)
5. Setup cron jobs (Day 8)
6. Add notifications (Days 9-10)

