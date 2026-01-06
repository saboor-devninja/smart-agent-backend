const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const config = require("../config/config");

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    if (
      !config.s3.region ||
      !config.s3.accessKeyId ||
      !config.s3.secretAccessKey ||
      !config.s3.bucketName
    ) {
      throw new Error(
        "Missing required S3 environment variables: S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME"
      );
    }

    s3Client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }
  return s3Client;
}

function getBucketName() {
  if (!config.s3.bucketName) {
    throw new Error("S3_BUCKET_NAME environment variable is required");
  }
  return config.s3.bucketName;
}

function getCDNUrl() {
  const cdnUrl = config.s3.cloudfrontUrl;
  if (
    cdnUrl &&
    !cdnUrl.includes("your-cdn-url") &&
    !cdnUrl.includes("your-cloudfront-distribution")
  ) {
    return cdnUrl;
  }
  return undefined;
}

function sanitizeMetadataValue(value) {
  return value
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\r\n\t]/g, "_")
    .substring(0, 1024);
}

async function uploadFile(file, path, bucket) {
  try {
    const s3 = getS3Client();
    const bucketName = bucket || getBucketName();
    const cdnUrl = getCDNUrl();

    const fileExt = file.originalname.split(".").pop();
    const fileName = `${path}.${fileExt}`;

    const sanitizedFileName = sanitizeMetadataValue(file.originalname);

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=3600",
      Metadata: {
        originalName: sanitizedFileName,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3.send(uploadCommand);

    const publicUrl = cdnUrl
      ? `${cdnUrl}/${fileName}`
      : `https://${bucketName}.s3.${config.s3.region}.amazonaws.com/${fileName}`;

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error("S3 upload error:", error);
    return {
      url: null,
      error: error instanceof Error ? error.message : "Failed to upload file",
    };
  }
}

async function deleteFile(path, bucket) {
  try {
    const s3 = getS3Client();
    const bucketName = bucket || getBucketName();

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    await s3.send(deleteCommand);

    return { success: true, error: null };
  } catch (error) {
    console.error("S3 delete error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete file",
    };
  }
}

function generateLandlordProfilePath(landlordId) {
  return `landlords/${landlordId}/profile/profile-pic`;
}

function generateUserProfilePath(userId) {
  return `users/${userId}/profile/profile-pic`;
}

function generatePropertyMediaPath(propertyId, fileName) {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `properties/${propertyId}/media/${timestamp}-${sanitizedFileName}`;
}

function generateTenantProfilePath(tenantId) {
  return `tenants/${tenantId}/profile/profile-pic`;
}

async function uploadBufferToS3(buffer, key, contentType, bucket) {
  try {
    const s3 = getS3Client();
    const bucketName = bucket || getBucketName();
    const cdnUrl = getCDNUrl();

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/pdf",
      CacheControl: "public, max-age=3600",
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3.send(uploadCommand);

    const publicUrl = cdnUrl
      ? `${cdnUrl}/${key}`
      : `https://${bucketName}.s3.${config.s3.region}.amazonaws.com/${key}`;

    return publicUrl;
  } catch (error) {
    console.error("S3 buffer upload error:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload buffer to S3");
  }
}

module.exports = {
  uploadFile,
  deleteFile,
  generateLandlordProfilePath,
  generateUserProfilePath,
  generateTenantProfilePath,
  generatePropertyMediaPath,
  uploadBufferToS3,
};

