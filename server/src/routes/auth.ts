import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { Locale } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { signAuthToken, requireAuth, type AuthedRequest } from "../lib/auth";
import { zodErrorMessage } from "../lib/errors";
import { serializeUser } from "../lib/serialize";

const router = Router();

const BCRYPT_ROUNDS = 10;

async function serializeAuthUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { masterProfile: true },
  });
  if (!user) return null;
  return serializeUser(user, {
    isOwner: user.masterProfile?.isOwner ?? false,
    masterId: user.masterProfile?.id ?? null,
  });
}

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().min(1).optional(),
  locale: z.nativeEnum(Locale).optional(),
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { email, password, name, phone, locale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: phone ?? null,
      preferredLocale: locale ?? Locale.en,
    },
  });

  const token = signAuthToken({ sub: user.id, role: user.role, email: user.email });
  const payload = await serializeAuthUser(user.id);
  res.status(201).json({ token, user: payload });
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signAuthToken({ sub: user.id, role: user.role, email: user.email });
  const payload = await serializeAuthUser(user.id);
  res.json({ token, user: payload });
});

/** JWTs are stateless — logout is a client-side token discard. Kept for a consistent API surface. */
router.post("/logout", (_req, res) => {
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const payload = await serializeAuthUser(req.auth!.sub);
  if (!payload) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: payload });
});

export default router;
