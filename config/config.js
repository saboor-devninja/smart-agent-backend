require("dotenv").config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  
  mongodb: {
    uri: process.env.MONGODB_URI || (() => {
      const host = process.env.MONGO_HOST;
      const user = process.env.MONGO_USER;
      const password = process.env.MONGO_PASSWORD;
      const dbName = process.env.MONGO_DBNAME;
      
      if (host && user && password && dbName) {
        return `mongodb+srv://${user}:${password}@${host}/${dbName}?retryWrites=true&w=majority`;
      }
      return null;
    })(),
    host: process.env.MONGO_HOST,
    user: process.env.MONGO_USER,
    password: process.env.MONGO_PASSWORD,
    dbName: process.env.MONGO_DBNAME,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  cron: {
    enabled: process.env.CRON_ENABLED !== 'false',
    rentGenerationTime: process.env.CRON_RENT_GENERATION_TIME || '00:01',
    timezone: process.env.CRON_TIMEZONE || 'America/New_York',
  },
  
  s3: {
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucketName: process.env.S3_BUCKET_NAME,
    cloudfrontUrl: process.env.S3_CLOUDFRONT_URL,
  },
  
  docusign: {
    basePath: process.env.DS_BASE_PATH || 'https://demo.docusign.net/restapi',
    accountId: process.env.DS_ACCOUNT_ID,
    integrationKey: process.env.DS_INTEGRATION_KEY,
    userId: process.env.DS_USER_ID,
    connectHmacKey: process.env.DS_CONNECT_HMAC_KEY,
    oauthBase: process.env.DS_OAUTH_BASE || 'https://account-d.docusign.com',
    privateKeyB64: process.env.DS_PRIVATE_KEY_B64,
    frontendUrl: process.env.DOCUSIGN_APP_URL || 'http://localhost:3000',
  },
  
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
  },
  
  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  },
};

module.exports = config;

