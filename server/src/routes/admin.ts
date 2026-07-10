import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { AvailabilityOverrideType, BookingStatus, Locale, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { AppError, zodErrorMessage } from "../lib/errors";
import { parseLocale } from "../lib/locale";
import { serializeBooking, serializeMasterAdmin, serializeServiceAdmin } from "../lib/serialize";
import { BOOKING_INCLUDE } from "../services/booking";
import { dateOnlyUtc, dayOfWeekOf } from "../services/slots";

const router = Router();
const BCRYPT_ROUNDS = 10;

router.use(requireAuth, requireRole(Role.admin));

async function syncMasterServices(
  tx: Prisma.TransactionClient,
  masterId: string,
  serviceIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(serviceIds)];
  if (uniqueIds.length) {
    const found = await tx.service.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length) {
      throw new AppError("One or more serviceIds are invalid", 400);
    }
  }

  await tx.masterService.deleteMany({
    where: {
      masterId,
      ...(uniqueIds.length ? { serviceId: { notIn: uniqueIds } } : {}),
    },
  });

  for (const serviceId of uniqueIds) {
    await tx.masterService.upsert({
      where: { masterId_serviceId: { masterId, serviceId } },
      update: {},
      create: { masterId, serviceId },
    });
  }
}

const masterInclude = {
  user: true,
  location: true,
  masterServices: { select: { serviceId: true } },
} as const;

/* ───────────────────────── Masters ───────────────────────── */

router.get("/masters", async (_req, res) => {
  const masters = await prisma.masterProfile.findMany({
    include: masterInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ masters: masters.map(serializeMasterAdmin) });
});

const createMasterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1),
  nameRu: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  locationId: z.string().min(1).optional(),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
  specialtyTags: z.array(z.string()).optional(),
  instagramHandle: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.post("/masters", async (req, res) => {
  const parsed = createMasterSchema.safeParse(req.body);
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
  const location = data.locationId
    ? await prisma.location.findUnique({ where: { id: data.locationId } })
    : await prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!location) {
    res.status(400).json({ error: "No active location available" });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const master = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, passwordHash, name: data.name, phone: data.phone ?? null, role: Role.master },
    });
    const profile = await tx.masterProfile.create({
      data: {
        userId: user.id,
        locationId: location.id,
        nameRu: data.nameRu ?? null,
        bio: data.bio ?? null,
        photoUrl: data.photoUrl ?? null,
        specialtyTags: data.specialtyTags ?? [],
        instagramHandle: data.instagramHandle ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    if (data.serviceIds) {
      await syncMasterServices(tx, profile.id, data.serviceIds);
    }
    return tx.masterProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: masterInclude,
    });
  });

  res.status(201).json({ master: serializeMasterAdmin(master) });
});

const updateMasterSchema = z.object({
  name: z.string().trim().min(1).optional(),
  nameRu: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
  specialtyTags: z.array(z.string()).optional(),
  instagramHandle: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  locationId: z.string().min(1).optional(),
});

router.patch("/masters/:id", async (req, res) => {
  const parsed = updateMasterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const { name, phone, serviceIds, ...profileFields } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined || phone !== undefined) {
      await tx.user.update({
        where: { id: master.userId },
        data: { ...(name !== undefined ? { name } : {}), ...(phone !== undefined ? { phone } : {}) },
      });
    }
    await tx.masterProfile.update({
      where: { id: master.id },
      data: profileFields,
    });
    if (serviceIds !== undefined) {
      await syncMasterServices(tx, master.id, serviceIds);
    }
    return tx.masterProfile.findUniqueOrThrow({
      where: { id: master.id },
      include: masterInclude,
    });
  });

  res.json({ master: serializeMasterAdmin(updated) });
});

router.delete("/masters/:id", async (req, res) => {
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const bookings = await tx.booking.findMany({ where: { masterId: master.id }, select: { id: true } });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length) {
      await tx.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    await tx.masterProfile.delete({ where: { id: master.id } });
    await tx.user.delete({ where: { id: master.userId } });
  });

  res.status(204).send();
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function serializeAvailability(
  rules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  overrides: Array<{ date: Date; type: AvailabilityOverrideType; startTime: string | null; endTime: string | null }>,
) {
  return {
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
  };
}

router.get("/masters/:id/availability", async (req, res) => {
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }
  const [rules, overrides] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { masterId: master.id }, orderBy: [{ dayOfWeek: "asc" }] }),
    prisma.availabilityOverride.findMany({ where: { masterId: master.id }, orderBy: { date: "asc" } }),
  ]);
  res.json(serializeAvailability(rules, overrides));
});

const putMasterAvailabilitySchema = z.object({
  rules: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(TIME_RE),
      endTime: z.string().regex(TIME_RE),
    }),
  ),
});

router.put("/masters/:id/availability", async (req, res) => {
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
    return;
  }
  const parsed = putMasterAvailabilitySchema.safeParse(req.body);
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
  res.json(serializeAvailability(rules, overrides));
});

const dayOverrideSchema = z.object({
  date: z.string().regex(DATE_RE),
  action: z.enum(["closed", "open", "clear"]),
  startTime: z.string().regex(TIME_RE).optional(),
  endTime: z.string().regex(TIME_RE).optional(),
});

router.put("/masters/:id/availability/day", async (req, res) => {
  const master = await prisma.masterProfile.findUnique({ where: { id: req.params.id } });
  if (!master) {
    res.status(404).json({ error: "Master not found" });
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
    await prisma.availabilityOverride.deleteMany({ where: { masterId: master.id, date: dateKey } });
  } else if (action === "closed") {
    await prisma.availabilityOverride.upsert({
      where: { masterId_date: { masterId: master.id, date: dateKey } },
      update: { type: AvailabilityOverrideType.closed, startTime: null, endTime: null },
      create: { masterId: master.id, date: dateKey, type: AvailabilityOverrideType.closed },
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

/* ───────────────────────── Services ───────────────────────── */

router.get("/services", async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  res.json({ services: services.map(serializeServiceAdmin) });
});

const createServiceSchema = z.object({
  nameEn: z.string().trim().min(1),
  nameRu: z.string().trim().min(1),
  descriptionEn: z.string().trim().min(1),
  descriptionRu: z.string().trim().min(1),
  basePriceCents: z.number().int().nonnegative(),
  baseDurationMinutes: z.number().int().positive(),
  category: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

router.post("/services", async (req, res) => {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const service = await prisma.service.create({
    data: {
      ...parsed.data,
      category: parsed.data.category ?? "general",
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  res.status(201).json({ service: serializeServiceAdmin(service) });
});

const updateServiceSchema = createServiceSchema.partial();

router.patch("/services/:id", async (req, res) => {
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const service = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  const updated = await prisma.service.update({ where: { id: service.id }, data: parsed.data });
  res.json({ service: serializeServiceAdmin(updated) });
});

router.delete("/services/:id", async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: req.params.id } });
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  const updated = await prisma.service.update({ where: { id: service.id }, data: { isActive: false } });
  res.json({ service: serializeServiceAdmin(updated) });
});

/* ───────────────────────── Master ↔ Service assignments ───────────────────────── */

router.get("/master-services", async (req, res) => {
  const masterId = typeof req.query.masterId === "string" ? req.query.masterId : undefined;
  const links = await prisma.masterService.findMany({
    where: masterId ? { masterId } : undefined,
    include: { service: true },
  });
  res.json({
    masterServices: links.map((l) => ({
      id: l.id,
      masterId: l.masterId,
      serviceId: l.serviceId,
      priceOverrideCents: l.priceOverrideCents,
      durationOverrideMinutes: l.durationOverrideMinutes,
      service: serializeServiceAdmin(l.service),
    })),
  });
});

const createMasterServiceSchema = z.object({
  masterId: z.string().min(1),
  serviceId: z.string().min(1),
  priceOverrideCents: z.number().int().nonnegative().nullable().optional(),
  durationOverrideMinutes: z.number().int().positive().nullable().optional(),
});

router.post("/master-services", async (req, res) => {
  const parsed = createMasterServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { masterId, serviceId } = parsed.data;
  const [master, service] = await Promise.all([
    prisma.masterProfile.findUnique({ where: { id: masterId } }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);
  if (!master) {
    res.status(400).json({ error: "masterId does not exist" });
    return;
  }
  if (!service) {
    res.status(400).json({ error: "serviceId does not exist" });
    return;
  }

  try {
    const link = await prisma.masterService.create({
      data: parsed.data,
      include: { service: true },
    });
    res.status(201).json({
      masterService: {
        id: link.id,
        masterId: link.masterId,
        serviceId: link.serviceId,
        priceOverrideCents: link.priceOverrideCents,
        durationOverrideMinutes: link.durationOverrideMinutes,
        service: serializeServiceAdmin(link.service),
      },
    });
  } catch {
    res.status(409).json({ error: "This service is already assigned to this master" });
  }
});

const updateMasterServiceSchema = z.object({
  priceOverrideCents: z.number().int().nonnegative().nullable().optional(),
  durationOverrideMinutes: z.number().int().positive().nullable().optional(),
});

router.patch("/master-services/:id", async (req, res) => {
  const parsed = updateMasterServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const link = await prisma.masterService.findUnique({ where: { id: req.params.id } });
  if (!link) {
    res.status(404).json({ error: "Master/service assignment not found" });
    return;
  }
  const updated = await prisma.masterService.update({
    where: { id: link.id },
    data: parsed.data,
    include: { service: true },
  });
  res.json({
    masterService: {
      id: updated.id,
      masterId: updated.masterId,
      serviceId: updated.serviceId,
      priceOverrideCents: updated.priceOverrideCents,
      durationOverrideMinutes: updated.durationOverrideMinutes,
      service: serializeServiceAdmin(updated.service),
    },
  });
});

router.delete("/master-services/:id", async (req, res) => {
  const link = await prisma.masterService.findUnique({ where: { id: req.params.id } });
  if (!link) {
    res.status(404).json({ error: "Master/service assignment not found" });
    return;
  }
  await prisma.masterService.delete({ where: { id: link.id } });
  res.json({ ok: true });
});

/* ───────────────────────── Bookings ───────────────────────── */

router.get("/bookings", async (req: AuthedRequest, res) => {
  const { status, masterId, from, to, clientEmail } = req.query;
  const where: Prisma.BookingWhereInput = {};

  if (typeof status === "string" && status in BookingStatus) {
    where.status = status as BookingStatus;
  }
  if (typeof masterId === "string") {
    where.masterId = masterId;
  }
  if (typeof from === "string" || typeof to === "string") {
    where.startAt = {
      ...(typeof from === "string" ? { gte: new Date(from) } : {}),
      ...(typeof to === "string" ? { lte: new Date(to) } : {}),
    };
  }
  if (typeof clientEmail === "string" && clientEmail.trim()) {
    where.client = { email: { contains: clientEmail.trim().toLowerCase() } };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: BOOKING_INCLUDE,
    orderBy: { startAt: "desc" },
  });

  const locale = parseLocale(req);
  res.json({ bookings: bookings.map((b) => serializeBooking(b, locale, { includeClient: true })) });
});

const updateBookingSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  startAt: z.string().datetime({ offset: true }).or(z.string().min(1)).optional(),
});

router.patch("/bookings/:id", async (req: AuthedRequest, res) => {
  const parsed = updateBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  if (parsed.data.status === undefined && parsed.data.startAt === undefined) {
    res.status(400).json({ error: "Provide status and/or startAt" });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { master: { include: { location: { include: { settings: true } } } } },
  });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const locale = parseLocale(req);
  const cutoffHours = booking.master.location.settings?.cancellationCutoffHours ?? 24;

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const data: Prisma.BookingUpdateInput = {};

        if (parsed.data.status !== undefined) {
          data.status = parsed.data.status;
          data.cancelledAt = parsed.data.status === BookingStatus.cancelled ? new Date() : null;
        }

        if (parsed.data.startAt !== undefined) {
          const newStartAt = new Date(parsed.data.startAt);
          if (Number.isNaN(newStartAt.getTime())) {
            throw new AppError("Invalid start time", 400);
          }
          const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
          const newEndAt = new Date(newStartAt.getTime() + durationMs);

          if (
            parsed.data.status === undefined ||
            parsed.data.status === BookingStatus.pending ||
            parsed.data.status === BookingStatus.confirmed
          ) {
            const overlap = await tx.booking.findFirst({
              where: {
                id: { not: booking.id },
                masterId: booking.masterId,
                status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
                startAt: { lt: newEndAt },
                endAt: { gt: newStartAt },
              },
              select: { id: true },
            });
            if (overlap) throw new AppError("This time slot is no longer available", 409);
          }

          data.startAt = newStartAt;
          data.endAt = newEndAt;
          data.cancellationDeadlineAt = new Date(newStartAt.getTime() - cutoffHours * 60 * 60 * 1000);
        }

        return tx.booking.update({
          where: { id: booking.id },
          data,
          include: BOOKING_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    res.json({ booking: serializeBooking(updated, locale, { includeClient: true }) });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/bookings/:id", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookingService.deleteMany({ where: { bookingId: booking.id } });
    await tx.booking.delete({ where: { id: booking.id } });
  });

  res.status(204).send();
});

/* ───────────────────────── Shop settings ───────────────────────── */

const shopSettingsSchema = z.object({
  locationId: z.string().min(1).optional(),
  businessName: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
  cancellationCutoffHours: z.number().int().nonnegative().optional(),
  contactPhone: z.string().trim().nullable().optional(),
  contactEmail: z.string().trim().nullable().optional(),
  defaultLocale: z.nativeEnum(Locale).optional(),
});

router.put("/shop-settings", async (req, res) => {
  const parsed = shopSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { locationId, ...fields } = parsed.data;

  const existing = locationId
    ? await prisma.shopSettings.findUnique({ where: { locationId } })
    : await prisma.shopSettings.findFirst();
  if (!existing) {
    res.status(404).json({ error: "Shop settings have not been configured yet" });
    return;
  }

  const updated = await prisma.shopSettings.update({
    where: { id: existing.id },
    data: fields,
    include: { location: true },
  });

  res.json({
    shopSettings: {
      id: updated.id,
      locationId: updated.locationId,
      businessName: updated.businessName,
      address: updated.address,
      timezone: updated.timezone,
      cancellationCutoffHours: updated.cancellationCutoffHours,
      contactPhone: updated.contactPhone,
      contactEmail: updated.contactEmail,
      defaultLocale: updated.defaultLocale,
    },
  });
});

/* ───────────────────────── Holidays ───────────────────────── */

router.get("/holidays", async (req, res) => {
  const locationId = typeof req.query.locationId === "string" ? req.query.locationId : undefined;
  const holidays = await prisma.holiday.findMany({
    where: locationId ? { locationId } : undefined,
    orderBy: { date: "asc" },
  });
  res.json({ holidays });
});

const createHolidaySchema = z.object({
  locationId: z.string().min(1),
  date: z.string().regex(DATE_RE, "date must be YYYY-MM-DD"),
  label: z.string().trim().min(1),
  closesShop: z.boolean().optional(),
});

router.post("/holidays", async (req, res) => {
  const parsed = createHolidaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  try {
    const holiday = await prisma.holiday.create({
      data: {
        locationId: parsed.data.locationId,
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        label: parsed.data.label,
        closesShop: parsed.data.closesShop ?? true,
      },
    });
    res.status(201).json({ holiday });
  } catch {
    res.status(409).json({ error: "A holiday already exists for this location and date" });
  }
});

const updateHolidaySchema = z.object({
  date: z.string().regex(DATE_RE, "date must be YYYY-MM-DD").optional(),
  label: z.string().trim().min(1).optional(),
  closesShop: z.boolean().optional(),
});

router.patch("/holidays/:id", async (req, res) => {
  const parsed = updateHolidaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const holiday = await prisma.holiday.findUnique({ where: { id: req.params.id } });
  if (!holiday) {
    res.status(404).json({ error: "Holiday not found" });
    return;
  }
  const { date, ...rest } = parsed.data;
  const updated = await prisma.holiday.update({
    where: { id: holiday.id },
    data: { ...rest, ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}) },
  });
  res.json({ holiday: updated });
});

router.delete("/holidays/:id", async (req, res) => {
  const holiday = await prisma.holiday.findUnique({ where: { id: req.params.id } });
  if (!holiday) {
    res.status(404).json({ error: "Holiday not found" });
    return;
  }
  await prisma.holiday.delete({ where: { id: holiday.id } });
  res.json({ ok: true });
});

/* ───────────────────────── Stats ───────────────────────── */

router.get("/stats", async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalMasters,
    totalServices,
    totalClients,
    totalBookings,
    upcomingBookings,
    bookingsThisMonth,
    bookingsByStatus,
    revenue,
  ] = await Promise.all([
    prisma.masterProfile.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: Role.client } }),
    prisma.booking.count(),
    prisma.booking.count({
      where: { status: { in: [BookingStatus.pending, BookingStatus.confirmed] }, startAt: { gt: now } },
    }),
    prisma.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.aggregate({
      where: { status: { in: [BookingStatus.confirmed, BookingStatus.completed] } },
      _sum: { totalPriceCents: true },
    }),
  ]);

  res.json({
    stats: {
      totalMasters,
      totalServices,
      totalClients,
      totalBookings,
      upcomingBookings,
      bookingsThisMonth,
      bookingsByStatus: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count._all])),
      totalRevenueCents: revenue._sum.totalPriceCents ?? 0,
    },
  });
});

export default router;
