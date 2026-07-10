import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { AvailabilityOverrideType, BookingStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { AppError, zodErrorMessage } from "../lib/errors";
import { parseLocale } from "../lib/locale";
import { serializeBooking, serializeMasterAdmin, serializeService, serializeServiceAdmin } from "../lib/serialize";
import { getCancellationCutoffHours } from "../lib/shopSettings";
import { BOOKING_INCLUDE, createBooking } from "../services/booking";
import { dateOnlyUtc, dayOfWeekOf, getAvailableSlots } from "../services/slots";

const router = Router();
const BCRYPT_ROUNDS = 10;

router.use(requireAuth, requireRole(Role.master));

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function getOwnMasterProfile(userId: string) {
  return prisma.masterProfile.findUnique({
    where: { userId },
    include: { user: true, location: true },
  });
}

router.get("/me", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }
  res.json({
    master: {
      id: master.id,
      name: master.user.name,
      nameRu: master.nameRu,
      photoUrl: master.photoUrl,
      locationId: master.locationId,
      timezone: master.location.timezone,
    },
  });
});

router.get("/services", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }
  const locale = parseLocale(req);
  const links = await prisma.masterService.findMany({
    where: { masterId: master.id, service: { isActive: true } },
    include: { service: true },
    orderBy: { service: { sortOrder: "asc" } },
  });
  res.json({
    services: links.map((link) => ({
      ...serializeService(link.service, locale),
      nameEn: link.service.nameEn,
      nameRu: link.service.nameRu,
      priceCents: link.priceOverrideCents ?? link.service.basePriceCents,
      durationMinutes: link.durationOverrideMinutes ?? link.service.baseDurationMinutes,
      icon: link.service.icon,
    })),
  });
});

router.get("/slots", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }
  const date = typeof req.query.date === "string" ? req.query.date : "";
  if (!DATE_RE.test(date)) {
    res.status(400).json({ error: "Query param `date` is required in YYYY-MM-DD format" });
    return;
  }
  const serviceIdsRaw = typeof req.query.serviceIds === "string" ? req.query.serviceIds : "";
  const serviceIds = serviceIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!serviceIds.length) {
    res.status(400).json({ error: "Query param `serviceIds` (comma-separated) is required" });
    return;
  }

  const slots = await getAvailableSlots(master.id, date, serviceIds);
  res.json({ slots });
});

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

  res.json({
    rules: rules.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    overrides: overrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
  });
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
  overrides: z.array(overrideSchema).optional(),
});

/** Replaces weekly rules. Overrides are replaced only when `overrides` is provided. */
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

  if (overrides) {
    for (const o of overrides) {
      if (o.type === AvailabilityOverrideType.custom_hours && (!o.startTime || !o.endTime)) {
        res.status(400).json({ error: "custom_hours overrides require startTime and endTime" });
        return;
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { masterId: master.id } });
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

    if (overrides) {
      await tx.availabilityOverride.deleteMany({ where: { masterId: master.id } });
      if (overrides.length) {
        await tx.availabilityOverride.createMany({
          data: overrides.map((o) => ({
            masterId: master.id,
            date: dateOnlyUtc(o.date),
            type: o.type,
            startTime: o.startTime ?? null,
            endTime: o.endTime ?? null,
          })),
        });
      }
    }
  });

  const [savedRules, savedOverrides] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { masterId: master.id }, orderBy: [{ dayOfWeek: "asc" }] }),
    prisma.availabilityOverride.findMany({ where: { masterId: master.id }, orderBy: { date: "asc" } }),
  ]);

  res.json({
    rules: savedRules.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    overrides: savedOverrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
  });
});

const dayOverrideSchema = z.object({
  date: z.string().regex(DATE_RE, "date must be YYYY-MM-DD"),
  action: z.enum(["closed", "open", "clear"]),
  startTime: z.string().regex(TIME_RE).optional(),
  endTime: z.string().regex(TIME_RE).optional(),
});

/** Set a single calendar day: closed (day off), open (force available), or clear override. */
router.put("/availability/day", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }

  const parsed = dayOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { date, action } = parsed.data;
  const dateKey = dateOnlyUtc(date);

  if (action === "clear") {
    await prisma.availabilityOverride.deleteMany({
      where: { masterId: master.id, date: dateKey },
    });
  } else if (action === "closed") {
    await prisma.availabilityOverride.upsert({
      where: { masterId_date: { masterId: master.id, date: dateKey } },
      update: { type: AvailabilityOverrideType.closed, startTime: null, endTime: null },
      create: {
        masterId: master.id,
        date: dateKey,
        type: AvailabilityOverrideType.closed,
      },
    });
  } else {
    const dow = dayOfWeekOf(date);
    const rule = await prisma.availabilityRule.findFirst({
      where: { masterId: master.id, dayOfWeek: dow },
    });
    const startTime = parsed.data.startTime ?? rule?.startTime ?? "10:00";
    const endTime = parsed.data.endTime ?? rule?.endTime ?? "18:30";
    await prisma.availabilityOverride.upsert({
      where: { masterId_date: { masterId: master.id, date: dateKey } },
      update: { type: AvailabilityOverrideType.custom_hours, startTime, endTime },
      create: {
        masterId: master.id,
        date: dateKey,
        type: AvailabilityOverrideType.custom_hours,
        startTime,
        endTime,
      },
    });
  }

  const overrides = await prisma.availabilityOverride.findMany({
    where: { masterId: master.id },
    orderBy: { date: "asc" },
  });
  res.json({
    overrides: overrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
  });
});

const manualBookingSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required"),
  clientPhone: z.string().trim().min(7, "Client phone is required"),
  clientEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
  serviceIds: z.array(z.string().min(1)).min(1, "At least one service is required"),
  startAt: z.string().min(1, "startAt is required"),
});

router.post("/bookings", async (req: AuthedRequest, res) => {
  const master = await getOwnMasterProfile(req.auth!.sub);
  if (!master) {
    res.status(404).json({ error: "Master profile not found for this account" });
    return;
  }

  const parsed = manualBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }

  const { clientName, clientPhone, serviceIds, startAt } = parsed.data;
  const clientEmail = parsed.data.clientEmail?.trim().toLowerCase() || "";
  const digits = clientPhone.replace(/\D/g, "");
  const email = clientEmail || `phone.${digits || randomUUID().slice(0, 8)}@clients.levelup.local`;

  const clientUserId = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          name: clientName,
          phone: clientPhone,
          role: existing.role === Role.admin || existing.role === Role.master ? existing.role : Role.client,
        },
      });
      return existing.id;
    }
    const created = await tx.user.create({
      data: {
        email,
        name: clientName,
        phone: clientPhone,
        passwordHash: await bcrypt.hash(randomUUID(), BCRYPT_ROUNDS),
        role: Role.client,
      },
    });
    return created.id;
  });

  const cutoffHours = await getCancellationCutoffHours(master.locationId);
  const locale = parseLocale(req);

  try {
    const booking = await createBooking({
      clientUserId,
      masterId: master.id,
      serviceIds,
      startAt: new Date(startAt),
      cancellationCutoffHours: cutoffHours,
    });
    res.status(201).json({ booking: serializeBooking(booking, locale, { includeClient: true }) });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
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

/* ───────────────────────── Owner: manage team ───────────────────────── */

async function requireOwnerMaster(userId: string) {
  const master = await prisma.masterProfile.findUnique({
    where: { userId },
    include: { user: true, location: true },
  });
  if (!master) throw new AppError("Master profile not found for this account", 404);
  if (!master.isOwner) throw new AppError("Only the shop owner can manage masters", 403);
  return master;
}

const teamMasterInclude = {
  user: true,
  location: true,
  masterServices: { select: { serviceId: true } },
} as const;

router.get("/team", async (req: AuthedRequest, res) => {
  try {
    await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  const masters = await prisma.masterProfile.findMany({
    include: teamMasterInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ masters: masters.map(serializeMasterAdmin) });
});

router.get("/team/services", async (req: AuthedRequest, res) => {
  try {
    await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ services: services.map(serializeServiceAdmin) });
});

router.get("/team/:id/availability", async (req: AuthedRequest, res) => {
  try {
    await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }
  const [rules, overrides] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { masterId: master.id }, orderBy: [{ dayOfWeek: "asc" }] }),
    prisma.availabilityOverride.findMany({ where: { masterId: master.id }, orderBy: { date: "asc" } }),
  ]);
  res.json({
    rules: rules.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime })),
    overrides: overrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
  });
});

router.put("/team/:id/availability", async (req: AuthedRequest, res) => {
  try {
    await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }
  const parsed = z
    .object({
      rules: z.array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: z.string().regex(TIME_RE),
          endTime: z.string().regex(TIME_RE),
        }),
      ),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { masterId: master.id } });
    if (parsed.data.rules.length) {
      await tx.availabilityRule.createMany({
        data: parsed.data.rules.map((r) => ({
          masterId: master.id,
          dayOfWeek: r.dayOfWeek,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
      });
    }
  });
  const [rules, overrides] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { masterId: master.id }, orderBy: [{ dayOfWeek: "asc" }] }),
    prisma.availabilityOverride.findMany({ where: { masterId: master.id }, orderBy: { date: "asc" } }),
  ]);
  res.json({
    rules: rules.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime })),
    overrides: overrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
  });
});

router.put("/team/:id/availability/day", async (req: AuthedRequest, res) => {
  try {
    await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }
  const parsed = z
    .object({
      date: z.string().regex(DATE_RE),
      action: z.enum(["closed", "open", "clear"]),
      startTime: z.string().regex(TIME_RE).optional(),
      endTime: z.string().regex(TIME_RE).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { date, action } = parsed.data;
  const dateKey = dateOnlyUtc(date);
  if (action === "clear") {
    await prisma.availabilityOverride.deleteMany({ where: { masterId: master.id, date: dateKey } });
  } else if (action === "closed") {
    await prisma.availabilityOverride.upsert({
      where: { masterId_date: { masterId: master.id, date: dateKey } },
      update: { type: AvailabilityOverrideType.closed, startTime: null, endTime: null },
      create: { masterId: master.id, date: dateKey, type: AvailabilityOverrideType.closed },
    });
  } else {
    const dow = dayOfWeekOf(date);
    const rule = await prisma.availabilityRule.findFirst({ where: { masterId: master.id, dayOfWeek: dow } });
    const startTime = parsed.data.startTime ?? rule?.startTime ?? "10:00";
    const endTime = parsed.data.endTime ?? rule?.endTime ?? "18:30";
    await prisma.availabilityOverride.upsert({
      where: { masterId_date: { masterId: master.id, date: dateKey } },
      update: { type: AvailabilityOverrideType.custom_hours, startTime, endTime },
      create: {
        masterId: master.id,
        date: dateKey,
        type: AvailabilityOverrideType.custom_hours,
        startTime,
        endTime,
      },
    });
  }
  const overrides = await prisma.availabilityOverride.findMany({
    where: { masterId: master.id },
    orderBy: { date: "asc" },
  });
  res.json({
    overrides: overrides.map((o) => ({
      date: o.date.toISOString().slice(0, 10),
      type: o.type,
      startTime: o.startTime,
      endTime: o.endTime,
    })),
  });
});

const createTeamMasterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
  nameRu: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
  instagramHandle: z.string().optional(),
});

router.post("/team", async (req: AuthedRequest, res) => {
  let owner;
  try {
    owner = await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  const parsed = createTeamMasterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const master = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone ?? null,
        role: Role.master,
      },
    });
    const profile = await tx.masterProfile.create({
      data: {
        userId: user.id,
        locationId: owner.locationId,
        nameRu: data.nameRu ?? null,
        bio: data.bio ?? null,
        photoUrl: data.photoUrl ?? null,
        instagramHandle: data.instagramHandle ?? null,
        isOwner: false,
      },
    });
    if (data.serviceIds?.length) {
      for (const serviceId of data.serviceIds) {
        await tx.masterService.create({ data: { masterId: profile.id, serviceId } });
      }
    }
    return tx.masterProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: teamMasterInclude,
    });
  });

  res.status(201).json({ master: serializeMasterAdmin(master) });
});

const updateTeamMasterSchema = z.object({
  name: z.string().trim().min(1).optional(),
  nameRu: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
  instagramHandle: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.patch("/team/:id", async (req: AuthedRequest, res) => {
  let owner;
  try {
    owner = await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  const parsed = updateTeamMasterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }

  const target = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const { name, phone, serviceIds, ...profileFields } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined || phone !== undefined) {
      await tx.user.update({
        where: { id: target.userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(phone !== undefined ? { phone } : {}),
        },
      });
    }
    await tx.masterProfile.update({
      where: { id: target.id },
      data: profileFields,
    });
    if (serviceIds !== undefined) {
      await tx.masterService.deleteMany({
        where: {
          masterId: target.id,
          ...(serviceIds.length ? { serviceId: { notIn: serviceIds } } : {}),
        },
      });
      for (const serviceId of serviceIds) {
        await tx.masterService.upsert({
          where: { masterId_serviceId: { masterId: target.id, serviceId } },
          update: {},
          create: { masterId: target.id, serviceId },
        });
      }
    }
    return tx.masterProfile.findUniqueOrThrow({
      where: { id: target.id },
      include: teamMasterInclude,
    });
  });

  // silence unused — owner used for auth only
  void owner;
  res.json({ master: serializeMasterAdmin(updated) });
});

router.delete("/team/:id", async (req: AuthedRequest, res) => {
  let owner;
  try {
    owner = await requireOwnerMaster(req.auth!.sub);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }

  const target = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "Master not found" });
    return;
  }
  if (target.id === owner.id) {
    res.status(400).json({ error: "You cannot delete your own owner account" });
    return;
  }
  if (target.isOwner) {
    res.status(400).json({ error: "Cannot delete the shop owner" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const bookings = await tx.booking.findMany({ where: { masterId: target.id }, select: { id: true } });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length) {
      await tx.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await tx.masterProfile.delete({ where: { id: target.id } });
    await tx.user.delete({ where: { id: target.userId } });
  });

  res.status(204).send();
});

export default router;
