import { Router } from "express";
import { z } from "zod";
import { AvailabilityOverrideType, BookingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { zodErrorMessage } from "../lib/errors";
import { parseLocale } from "../lib/locale";
import { serializeBooking } from "../lib/serialize";
import { BOOKING_INCLUDE } from "../services/booking";

const router = Router();

router.use(requireAuth, requireRole(Role.master));

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getOwnMasterProfile(userId: string) {
  return prisma.masterProfile.findUnique({ where: { userId } });
}

router.get("/availability", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }

  const [rules, overrides] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { masterId: master.id }, orderBy: [{ dayOfWeek: "asc" }] }),
    prisma.availabilityOverride.findMany({ where: { masterId: master.id }, orderBy: { date: "asc" } }),
  ]);

  res.json({ rules, overrides });
});

const ruleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(TIME_RE, "startTime must be HH:mm"),
  endTime: z.string().regex(TIME_RE, "endTime must be HH:mm"),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});

const overrideSchema = z.object({
  date: z.string().regex(DATE_RE, "date must be YYYY-MM-DD"),
  type: z.nativeEnum(AvailabilityOverrideType),
  startTime: z.string().regex(TIME_RE, "startTime must be HH:mm").optional(),
  endTime: z.string().regex(TIME_RE, "endTime must be HH:mm").optional(),
});

const putAvailabilitySchema = z.object({
  rules: z.array(ruleSchema).default([]),
  overrides: z.array(overrideSchema).default([]),
});

/** Replaces the master's full weekly-rule set and date overrides in one transaction. */
router.put("/availability", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }

  const parsed = putAvailabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { rules, overrides } = parsed.data;

  for (const o of overrides) {
    if (o.type === AvailabilityOverrideType.custom_hours && (!o.startTime || !o.endTime)) {
      res.status(400).json({ error: "custom_hours overrides require startTime and endTime" });
      return;
    }
  }

  const [savedRules, savedOverrides] = await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { masterId: master.id } });
    await tx.availabilityOverride.deleteMany({ where: { masterId: master.id } });

    if (rules.length) {
      await tx.availabilityRule.createMany({
        data: rules.map((r) => ({
          masterId: master.id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
          effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : undefined,
          effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
        })),
      });
    }
    if (overrides.length) {
      await tx.availabilityOverride.createMany({
        data: overrides.map((o) => ({
          masterId: master.id,
          date: new Date(`${o.date}T00:00:00.000Z`),
          type: o.type,
          startTime: o.startTime ?? null,
          endTime: o.endTime ?? null,
        })),
      });
    }

    return Promise.all([
      tx.availabilityRule.findMany({ where: { masterId: master.id }, orderBy: [{ dayOfWeek: "asc" }] }),
      tx.availabilityOverride.findMany({ where: { masterId: master.id }, orderBy: { date: "asc" } }),
    ]);
  });

  res.json({ rules: savedRules, overrides: savedOverrides });
});

router.get("/bookings", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }

  const { status, from, to } = req.query;
  const where: Prisma.BookingWhereInput = { masterId: master.id };
  if (typeof status === "string" && status in BookingStatus) {
    where.status = status as BookingStatus;
  }
  if (typeof from === "string" || typeof to === "string") {
    where.startAt = {
      ...(typeof from === "string" ? { gte: new Date(from) } : {}),
      ...(typeof to === "string" ? { lte: new Date(to) } : {}),
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: BOOKING_INCLUDE,
    orderBy: { startAt: "asc" },
  });

  const locale = parseLocale(req);
  res.json({ bookings: bookings.map((b) => serializeBooking(b, locale, { includeClient: true })) });
});

export default router;
