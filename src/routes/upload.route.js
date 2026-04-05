import express from "express";
import path from "path";
import { protect } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import ApiResponseUtil from "../utils/apiResponse.js";

const router = express.Router();

router.use(protect);

// Single file upload — returns Cloudinary URL + meta
router.post("/", (req, res) => {
  upload.any()(req, res, (error) => {
    if (error) {
      const isClientError =
        error.code === "LIMIT_FILE_SIZE" ||
        error.message?.startsWith("File type not allowed");

      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File too large (max 20MB)"
          : error.message || "Upload failed";

      if (isClientError) {
        return ApiResponseUtil.badRequest(res, message);
      }

      console.error("Upload middleware error:", error);
      return ApiResponseUtil.serverError(
        res,
        "Media upload failed. Check Cloudinary configuration and try again.",
      );
    }

    try {
      const uploaded = req.file || req.files?.[0];
      if (!uploaded) {
        return ApiResponseUtil.badRequest(res, "No file uploaded");
      }

      const {
        path: storedPath,
        secure_url: secureUrl,
        url: directUrl,
        filename,
        mimetype,
        size,
        originalname,
      } = uploaded;

      // Prefer Cloudinary URL fields; only use local URL for disk fallback in dev.
      const cloudUrl =
        (typeof secureUrl === "string" && secureUrl) ||
        (typeof directUrl === "string" && directUrl.startsWith("http")
          ? directUrl
          : null) ||
        (typeof storedPath === "string" && storedPath.startsWith("http")
          ? storedPath
          : null) ||
        (typeof filename === "string" && filename.startsWith("http")
          ? filename
          : null);

      const localUrl = `${req.protocol}://${req.get("host")}/uploads/${filename || path.basename(storedPath || "")}`;
      const url = cloudUrl || localUrl;

      let type = "file";
      if (mimetype.startsWith("image/")) type = "image";
      else if (mimetype.startsWith("audio/")) type = "voice";

      return ApiResponseUtil.success(
        res,
        {
          url,
          type,
          mediaMeta: {
            filename: originalname,
            size,
            mimeType: mimetype,
          },
        },
        "File uploaded",
      );
    } catch (err) {
      console.error("Upload error:", err);
      return ApiResponseUtil.serverError(res, err.message || "Upload failed");
    }
  });
});

export default router;
