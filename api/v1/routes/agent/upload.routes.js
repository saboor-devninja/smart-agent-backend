const express = require("express");
const multer = require("multer");
const { isLoggedIn } = require("../../middleware/auth");
const {
  uploadFile,
  deleteFile,
  generateLandlordProfilePath,
  generateUserProfilePath,
} = require("../../../../utils/s3");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(isLoggedIn);

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { uploadType, entityId } = req.body;

    if (!uploadType) {
      return res.status(400).json({ error: "Upload type is required" });
    }

    const maxSize = 10 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ error: "File size exceeds 10MB limit" });
    }

    let result;

    switch (uploadType) {
      case "landlord-profile":
        if (!entityId) {
          return res
            .status(400)
            .json({ error: "Landlord ID is required" });
        }

        const profileImageTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/jpg",
        ];
        if (!profileImageTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error:
              "Only JPEG, PNG, and WebP images are allowed for profile pictures",
          });
        }

        const profilePath = generateLandlordProfilePath(entityId);
        result = await uploadFile(req.file, profilePath);
        break;

      case "user-profile":
        if (!entityId) {
          return res.status(400).json({ error: "User ID is required" });
        }

        const userImageTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/jpg",
        ];
        if (!userImageTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            error:
              "Only JPEG, PNG, and WebP images are allowed for profile pictures",
          });
        }

        const userProfilePath = generateUserProfilePath(entityId);
        result = await uploadFile(req.file, userProfilePath);
        break;

      default:
        return res.status(400).json({ error: "Invalid upload type" });
    }

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ url: result.url });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Upload failed",
    });
  }
});

module.exports = router;

