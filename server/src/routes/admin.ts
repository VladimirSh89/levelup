import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { BookingStatus, Locale, Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../lib/auth";
import { AppError, zodErrorMessage } from "../lib/errors";
import { parseLocale } from "../lib/locale";
import { serializeBooking, serializeMasterAdmin, serializeServiceAdmin } from "../lib/serialize";
import { BOOKING_INCLUDE } from "../services/booking";

const router = Router();
const BCRYPT_ROUNDS = 10;

router.use(requireAuth, requireRole(Role.admin));

/* ───────────────────────── Masters ───────────────────────── */

router.get("/masters", async (_req, res) => {
  const masters = await prisma.masterProfile.findMany({
    include: { user: true, location: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ masters: masters.map(serializeMasterAdmin) });
});

const createMasterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1).optional(),
  locationId: z.string().min(1),
  bio: z.string().optional(),
  photoUrl: z.string().optional(),
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
  const location = await prisma.location.findUnique({ where: { id: data.locationId } });
  if (!location) {
    res.status(400).json({ error: "locationId does not exist" });
    return;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const master = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, passwordHash, name: data.name, phone: data.phone ?? null, role: Role.master },
    });
    return tx.masterProfile.create({
      data: {
        userId: user.id,
        locationId: data.locationId,
        bio: data.bio ?? null,
        photoUrl: data.photoUrl ?? null,
        specialtyTags: data.specialtyTags ?? [],
        instagramHandle: data.instagramHandle ?? null,
        sortOrder: data.sortOrder ?? 0,
      },
      include: { user: true, location: true },
    });
  });

  res.status(201).json({ master: serializeMasterAdmin(master) });
});

const updateMasterSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  bio: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
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

  const { name, phone, ...profileFields } = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined || phone !== undefined) {
      await tx.user.update({
        where: { id: master.userId },
        data: { ...(name !== undefined ? { name } : {}), ...(phone !== undefined ? { phone } : {}) },
      });
    }
    return tx.masterProfile.update({
      where: { id: master.id },
      data: profileFields,
      include: { user: true, location: true },
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
  const updated = await prisma.masterProfile.update({
    where: { id: master.id },
    data: { isActive: false },
    include: { user: true, location: true },
  });
  res.json({ master: serializeMasterAdmin(updated) });
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
