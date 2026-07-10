import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { AppError, zodErrorMessage } from "../lib/errors";
import { parseLocale } from "../lib/locale";
import { serializeBooking } from "../lib/serialize";
import { getCancellationCutoffHours } from "../lib/shopSettings";
import { BOOKING_INCLUDE, cancelBooking, createBooking, rescheduleBooking } from "../services/booking";
import { sendBookingConfirmationEmail } from "../services/email";

const router = Router();

router.use(requireAuth);

const createBookingSchema = z.object({
  masterId: z.string().min(1, "masterId is required"),
  serviceIds: z.array(z.string().min(1)).min(1, "At least one service is required"),
  startAt: z.string().min(1, "startAt is required"),
});

router.post("/", async (req: AuthedRequest, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }
  const { masterId, serviceIds, startAt } = parsed.data;
  const locale = parseLocale(req);

  const master = await prisma.masterProfile.findUnique({
    where: { id: masterId },
    include: { user: true, location: { include: { settings: true } } },
  });
  if (!master || !master.isActive) {
    res.status(404).json({ error: "Master not found" });
    return;
  }

  const cutoffHours = master.location.settings?.cancellationCutoffHours ?? 24;

  try {
    const booking = await createBooking({
      clientUserId: req.auth!.sub,
      masterId,
      serviceIds,
      startAt: new Date(startAt),
      cancellationCutoffHours: cutoffHours,
    });

    const client = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (client) {
      void sendBookingConfirmationEmail({
        toEmail: client.email,
        toName: client.name,
        masterName: master.user.name,
        services: booking.services.map((s) => ({
          name: locale === "ru" ? s.service.nameRu : s.service.nameEn,
          durationMinutes: s.durationAtBookingMinutes,
          priceCents: s.priceAtBookingCents,
        })),
        startAt: booking.startAt,
        businessName: master.location.settings?.businessName ?? master.location.name,
        address: master.location.settings?.address ?? master.location.address,
        bookingId: booking.id,
        locale,
      });
    }

    res.status(201).json({ booking: serializeBooking(booking, locale) });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/me", async (req: AuthedRequest, res) => {
  const locale = parseLocale(req);
  const bookings = await prisma.booking.findMany({
    where: { clientUserId: req.auth!.sub },
    include: BOOKING_INCLUDE,
    orderBy: { startAt: "desc" },
  });
  res.json({ bookings: bookings.map((b) => serializeBooking(b, locale)) });
});

router.patch("/:id/cancel", async (req: AuthedRequest, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { master: true },
  });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const cutoffHours = await getCancellationCutoffHours(booking.master.locationId);

  try {
    const updated = await cancelBooking({
      bookingId: req.params.id,
      clientUserId: req.auth!.sub,
      cutoffHours,
    });
    res.json({ booking: serializeBooking(updated, parseLocale(req)) });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

const rescheduleSchema = z.object({
  startAt: z.string().min(1, "startAt is required"),
});

router.patch("/:id/reschedule", async (req: AuthedRequest, res) => {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: zodErrorMessage(parsed.error) });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { master: true },
  });
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const cutoffHours = await getCancellationCutoffHours(booking.master.locationId);

  try {
    const updated = await rescheduleBooking({
      bookingId: req.params.id,
      clientUserId: req.auth!.sub,
      newStartAt: new Date(parsed.data.startAt),
      cutoffHours,
    });
    res.json({ booking: serializeBooking(updated, parseLocale(req)) });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
