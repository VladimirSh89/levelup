import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { Role } from "@prisma/client";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { prisma } from "../lib/prisma";

// sharp/libvips defaults to a thread pool sized to the host CPU count. On
// CloudLinux/cPanel the NPROC limit counts threads, so an unbounded pool can
// blow past the process cap. Pin it to a single worker and disable the cache.
sharp.concurrency(1);
sharp.cache(false);

const router = Router();

const UPLOAD_DIR = path.resolve(__dirname, "..", "..", "uploads", "masters");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;
const SIZE_OPTIONS = new Set([256, 512, 800, 1200]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});

async function canUpload(req: AuthedRequest): Promise<boolean> {
  if (!req.auth) return false;
  if (req.auth.role === Role.admin) return true;
  if (req.auth.role === Role.master) {
    const master = await prisma.masterProfile.findUnique({ where: { userId: req.auth.sub } });
    return Boolean(master?.isOwner);
  }
  return false;
}

router.use(requireAuth);

router.post("/photo", async (req: AuthedRequest, res, next) => {
  if (!(await canUpload(req))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}, (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Image must be 8MB or smaller" });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message || "Upload failed" });
      return;
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No photo file provided" });
    return;
  }

  const rawSize = Number(req.body?.size ?? req.query.size ?? 512);
  const size = SIZE_OPTIONS.has(rawSize) ? rawSize : 512;

  const filename = `${randomUUID()}.webp`;
  const absPath = path.join(UPLOAD_DIR, filename);

  await sharp(req.file.buffer)
    .rotate()
    .resize(size, size, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toFile(absPath);

  res.status(201).json({
    url: `/api/uploads/masters/${filename}`,
    size,
    width: size,
    height: size,
  });
});

export default router;
