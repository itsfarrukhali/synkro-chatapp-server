import "dotenv/config";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");
const isProduction = process.env.NODE_ENV === "production";

const hasExplicitCloudinaryConfig =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;
const hasCloudinaryUrl = !!process.env.CLOUDINARY_URL;
const hasCloudinaryConfig = hasExplicitCloudinaryConfig || hasCloudinaryUrl;

if (isProduction && !hasCloudinaryConfig) {
  throw new Error(
    "Cloudinary configuration is required in production. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.",
  );
}

if (hasCloudinaryConfig) {
  if (hasExplicitCloudinaryConfig) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  } else {
    // CLOUDINARY_URL is read directly from process.env by the SDK.
    cloudinary.config({ secure: true });
  }
}

// Dynamic folder based on file type
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    let folder = "synkro/files";
    let resource_type = "raw";

    if (file.mimetype.startsWith("image/")) {
      folder = "synkro/images";
      resource_type = "image";
    } else if (file.mimetype.startsWith("audio/")) {
      folder = "synkro/voice";
      resource_type = "video"; // Cloudinary uses "video" for audio too
    }

    return {
      folder,
      resource_type,
      allowed_formats: [
        "jpg",
        "jpeg",
        "png",
        "gif",
        "webp",
        "mp3",
        "wav",
        "ogg",
        "pdf",
        "doc",
        "docx",
        "txt",
      ],
      transformation: file.mimetype.startsWith("image/")
        ? [{ width: 1200, crop: "limit", quality: "auto" }]
        : undefined,
    };
  },
});

if (!hasCloudinaryConfig && !fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || "";
    const base = path
      .basename(file.originalname || "file", ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 50);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const isImage = file.mimetype.startsWith("image/");
  const isAudio = file.mimetype.startsWith("audio/");
  const isDoc = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ].includes(file.mimetype);

  if (isImage || isAudio || isDoc) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`), false);
  }
};

export const upload = multer({
  storage: hasCloudinaryConfig ? cloudinaryStorage : localDiskStorage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// Helper to delete from Cloudinary (for message delete)
export const deleteFromCloudinary = async (url) => {
  try {
    if (!url) return;
    // Extract public_id from URL
    const parts = url.split("/");
    const filename = parts[parts.length - 1].split(".")[0];
    const folder = parts[parts.length - 2];
    await cloudinary.uploader.destroy(`${folder}/${filename}`);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};
