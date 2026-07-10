import { BookingStatus, Prisma, type Booking } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError, conflict, forbidden, notFound } from "../lib/errors";
import { aggregatePriceAndDuration, canCancel } from "./slots";

export const BOOKING_INCLUDE = {
  services: { include: { service: true } },
  master: { include: { user: true, location: true } },
  client: true,
} satisfies Prisma.BookingInclude;

export type BookingWithDetails = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

const ACTIVE_STATUSES: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];

/**
 * Creates a booking inside a single serializable transaction:
 * 1. validates the requested services belong to the master,
 * 2. computes `endAt` from the aggregated duration,
 * 3. re-checks the slot is still free (overlap query) to close the race window between the
 *    client fetching slots and submitting the booking,
 * 4. inserts the booking (`pending` → `confirmed`) with a snapshot of each `BookingService`.
 */
export async function createBooking(params: {
  clientUserId: string;
  masterId: string;
  serviceIds: string[];
  startAt: Date;
  cancellationCutoffHours: number;
}): Promise<BookingWithDetails> {
  const { clientUserId, masterId, serviceIds, startAt, cancellationCutoffHours } = params;

  if (Number.isNaN(startAt.getTime())) {
    throw new AppError("Invalid start time", 400);
  }
  if (startAt.getTime() <= Date.now()) {
    throw new AppError("Cannot book a time in the past", 400);
  }
  if (!serviceIds.length) {
    throw new AppError("At least one service is required", 400);
  }

  return prisma.$transaction(
    async (tx) => {
      const master = await tx.masterProfile.findUnique({ where: { id: masterId } });
      if (!master || !master.isActive) throw notFound("Master not found");

      const uniqueServiceIds = Array.from(new Set(serviceIds));
      const links = await tx.masterService.findMany({
        where: { masterId, serviceId: { in: uniqueServiceIds } },
        include: { service: true },
      });
      if (links.length !== uniqueServiceIds.length) {
        throw new AppError("One or more services are not offered by this master", 400);
      }
      if (links.some((l) => !l.service.isActive)) {
        throw new AppError("One or more services are no longer available", 400);
      }

      const { totalPriceCents, totalDurationMinutes } = aggregatePriceAndDuration(links);
      if (totalDurationMinutes <= 0) throw new AppError("Invalid service duration", 400);

      const endAt = new Date(startAt.getTime() + totalDurationMinutes * 60 * 1000);

      const overlap = await tx.booking.findFirst({
        where: {
          masterId,
          status: { in: ACTIVE_STATUSES },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        select: { id: true },
      });
      if (overlap) throw conflict("This time slot is no longer available");

      const cancellationDeadlineAt = new Date(
        startAt.getTime() - cancellationCutoffHours * 60 * 60 * 1000,
      );

      const booking = await tx.booking.create({
        data: {
          clientUserId,
          masterId,
          status: BookingStatus.pending,
          startAt,
          endAt,
          totalPriceCents,
          cancellationDeadlineAt,
          services: {
            create: links.map((link) => ({
              serviceId: link.serviceId,
              priceAtBookingCents: link.priceOverrideCents ?? link.service.basePriceCents,
              durationAtBookingMinutes: link.durationOverrideMinutes ?? link.service.baseDurationMinutes,
            })),
          },
        },
      });

      return tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.confirmed },
        include: BOOKING_INCLUDE,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function assertOwnedByClient(booking: Pick<Booking, "clientUserId">, clientUserId: string): Promise<void> {
  if (booking.clientUserId !== clientUserId) throw forbidden("You do not have access to this booking");
}

export async function cancelBooking(params: {
  bookingId: string;
  clientUserId: string;
  cutoffHours: number;
}): Promise<BookingWithDetails> {
  const { bookingId, clientUserId, cutoffHours } = params;

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw notFound("Booking not found");
    await assertOwnedByClient(booking, clientUserId);

    if (!ACTIVE_STATUSES.includes(booking.status)) {
      throw new AppError("Booking cannot be cancelled", 400);
    }
    if (!canCancel(booking, cutoffHours)) {
      throw new AppError("The cancellation window for this booking has passed", 400);
    }

    return tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.cancelled, cancelledAt: new Date() },
      include: BOOKING_INCLUDE,
    });
  });
}

export async function rescheduleBooking(params: {
  bookingId: string;
  clientUserId: string;
  newStartAt: Date;
  cutoffHours: number;
}): Promise<BookingWithDetails> {
  const { bookingId, clientUserId, newStartAt, cutoffHours } = params;

  if (Number.isNaN(newStartAt.getTime())) {
    throw new AppError("Invalid start time", 400);
  }
  if (newStartAt.getTime() <= Date.now()) {
    throw new AppError("Cannot reschedule to a time in the past", 400);
  }

  return prisma.$transaction(
    async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw notFound("Booking not found");
      await assertOwnedByClient(booking, clientUserId);

      if (!ACTIVE_STATUSES.includes(booking.status)) {
        throw new AppError("Booking cannot be rescheduled", 400);
      }
      if (!canCancel(booking, cutoffHours)) {
        throw new AppError("The reschedule window for this booking has passed", 400);
      }

      const durationMs = booking.endAt.getTime() - booking.startAt.getTime();
      const newEndAt = new Date(newStartAt.getTime() + durationMs);

      const overlap = await tx.booking.findFirst({
        where: {
          id: { not: booking.id },
          masterId: booking.masterId,
          status: { in: ACTIVE_STATUSES },
          startAt: { lt: newEndAt },
          endAt: { gt: newStartAt },
        },
        select: { id: true },
      });
      if (overlap) throw conflict("This time slot is no longer available");

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          startAt: newStartAt,
          endAt: newEndAt,
          status: BookingStatus.confirmed,
          cancellationDeadlineAt: new Date(newStartAt.getTime() - cutoffHours * 60 * 60 * 1000),
        },
        include: BOOKING_INCLUDE,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
