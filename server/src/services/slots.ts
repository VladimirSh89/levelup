import { addMinutes } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { AvailabilityOverrideType, BookingStatus, type MasterService, type Service } from "@prisma/client";
import { prisma } from "../lib/prisma";

/** Single-location shop; hard-coded per spec. */
export const SHOP_TIME_ZONE = "America/New_York";
export const SLOT_INTERVAL_MINUTES = 15;

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];

function parseHHMM(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(":");
  return { hours: Number(h ?? 0), minutes: Number(m ?? 0) };
}

function parseDateStr(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

/** Converts an `HH:mm` wall-clock time on `dateStr` (YYYY-MM-DD), interpreted in the shop's
 * timezone, into the equivalent UTC instant. */
export function localTimeToUtc(dateStr: string, time: string): Date {
  const { year, month, day } = parseDateStr(dateStr);
  const { hours, minutes } = parseHHMM(time);
  return fromZonedTime(new Date(year, month - 1, day, hours, minutes, 0, 0), SHOP_TIME_ZONE);
}

/** Midnight (00:00 UTC) representation of a calendar date, matching Prisma's `@db.Date` columns. */
export function dateOnlyUtc(dateStr: string): Date {
  const { year, month, day } = parseDateStr(dateStr);
  return new Date(Date.UTC(year, month - 1, day));
}

/** JS day-of-week (0=Sunday…6=Saturday) for a calendar date, independent of any timezone conversion. */
export function dayOfWeekOf(dateStr: string): number {
  const { year, month, day } = parseDateStr(dateStr);
  return new Date(year, month - 1, day).getDay();
}

export function todayStrInShopTz(now: Date = new Date()): string {
  const zoned = toZonedTime(now, SHOP_TIME_ZONE);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, "0");
  const d = String(zoned.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface WorkingWindow {
  startUtc: Date;
  endUtc: Date;
}

/**
 * Resolves the working window (shop-local open/close, converted to UTC) for a master on a given
 * date, honoring holidays, per-day overrides (closed / custom hours), then the recurring weekly
 * `AvailabilityRule`. Returns `null` when the master does not work that day.
 */
export async function getWorkingWindowUtc(masterId: string, dateStr: string): Promise<WorkingWindow | null> {
  const master = await prisma.masterProfile.findUnique({ where: { id: masterId } });
  if (!master || !master.isActive) return null;

  const dateOnly = dateOnlyUtc(dateStr);

  const holiday = await prisma.holiday.findFirst({
    where: { locationId: master.locationId, date: dateOnly, closesShop: true },
  });
  if (holiday) return null;

  const override = await prisma.availabilityOverride.findUnique({
    where: { masterId_date: { masterId, date: dateOnly } },
  });
  if (override?.type === AvailabilityOverrideType.closed) return null;
  if (override?.type === AvailabilityOverrideType.custom_hours) {
    if (!override.startTime || !override.endTime) return null;
    const startUtc = localTimeToUtc(dateStr, override.startTime);
    const endUtc = localTimeToUtc(dateStr, override.endTime);
    if (endUtc <= startUtc) return null;
    return { startUtc, endUtc };
  }

  const dayStartUtc = localTimeToUtc(dateStr, "00:00");
  const dayEndUtc = addMinutes(dayStartUtc, 24 * 60 - 1);
  const dayOfWeek = dayOfWeekOf(dateStr);

  const rule = await prisma.availabilityRule.findFirst({
    where: {
      masterId,
      dayOfWeek,
      effectiveFrom: { lte: dayEndUtc },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: dayStartUtc } }],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rule) return null;

  const startUtc = localTimeToUtc(dateStr, rule.startTime);
  const endUtc = localTimeToUtc(dateStr, rule.endTime);
  if (endUtc <= startUtc) return null;
  return { startUtc, endUtc };
}

export type MasterServiceWithService = MasterService & { service: Service };

/** Fetches the master's offering rows for a set of service ids (missing ids are simply absent). */
export async function getMasterServiceLinks(
  masterId: string,
  serviceIds: string[],
): Promise<MasterServiceWithService[]> {
  if (!serviceIds.length) return [];
  return prisma.masterService.findMany({
    where: { masterId, serviceId: { in: serviceIds } },
    include: { service: true },
  });
}

/** Sums price + duration across a set of (master-specific-override-aware) service links. */
export function aggregatePriceAndDuration(
  masterServices: MasterServiceWithService[],
): { totalPriceCents: number; totalDurationMinutes: number } {
  return masterServices.reduce(
    (acc, ms) => ({
      totalPriceCents: acc.totalPriceCents + (ms.priceOverrideCents ?? ms.service.basePriceCents),
      totalDurationMinutes:
        acc.totalDurationMinutes + (ms.durationOverrideMinutes ?? ms.service.baseDurationMinutes),
    }),
    { totalPriceCents: 0, totalDurationMinutes: 0 },
  );
}

/**
 * Generates bookable start times (every `SLOT_INTERVAL_MINUTES`) for `masterId` on `dateStr` that
 * fit the combined duration of `serviceIds`, excluding times that overlap an existing
 * pending/confirmed booking or fall in the past. Returned as ISO-8601 UTC strings.
 */
export async function getAvailableSlots(
  masterId: string,
  dateStr: string,
  serviceIds: string[],
): Promise<string[]> {
  if (!serviceIds.length) return [];

  const window = await getWorkingWindowUtc(masterId, dateStr);
  if (!window) return [];

  const links = await getMasterServiceLinks(masterId, serviceIds);
  if (links.length !== new Set(serviceIds).size) return [];

  const { totalDurationMinutes } = aggregatePriceAndDuration(links);
  if (totalDurationMinutes <= 0) return [];

  const existingBookings = await prisma.booking.findMany({
    where: {
      masterId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      startAt: { lt: window.endUtc },
      endAt: { gt: window.startUtc },
    },
    select: { startAt: true, endAt: true },
  });

  return generateSlotsFromWindow({
    window,
    totalDurationMinutes,
    existingBookings,
    now: new Date(),
  });
}

/** Pure slot generator — unit-testable without Prisma. */
export function generateSlotsFromWindow(args: {
  window: WorkingWindow;
  totalDurationMinutes: number;
  existingBookings: Array<{ startAt: Date; endAt: Date }>;
  now?: Date;
  intervalMinutes?: number;
}): string[] {
  const {
    window,
    totalDurationMinutes,
    existingBookings,
    now = new Date(),
    intervalMinutes = SLOT_INTERVAL_MINUTES,
  } = args;
  if (totalDurationMinutes <= 0) return [];

  const nowMs = now.getTime();
  const slots: string[] = [];
  for (
    let slotStart = window.startUtc;
    addMinutes(slotStart, totalDurationMinutes).getTime() <= window.endUtc.getTime();
    slotStart = addMinutes(slotStart, intervalMinutes)
  ) {
    if (slotStart.getTime() <= nowMs) continue;
    const slotEnd = addMinutes(slotStart, totalDurationMinutes);
    const overlaps = existingBookings.some((b) => slotStart < b.endAt && slotEnd > b.startAt);
    if (!overlaps) slots.push(slotStart.toISOString());
  }
  return slots;
}

/**
 * Returns the list of `YYYY-MM-DD` dates within `month` (YYYY-MM) where the master has any open
 * working window left (holidays/overrides/rules applied). Service-agnostic — used to render an
 * enabled/disabled calendar before the client picks services.
 */
export async function getBookableDaysForMonth(masterId: string, month: string): Promise<string[]> {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const nowMs = Date.now();

  const dateStrs = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });

  const windows = await Promise.all(dateStrs.map((dateStr) => getWorkingWindowUtc(masterId, dateStr)));

  return dateStrs.filter((_, i) => {
    const window = windows[i];
    return window !== null && window !== undefined && window.endUtc.getTime() > nowMs;
  });
}

export interface CancellableBooking {
  status: BookingStatus;
  startAt: Date;
}

/** Whether a booking may still be cancelled/rescheduled given a cutoff (hours before start). */
export function canCancel(booking: CancellableBooking, cutoffHours: number, now: Date = new Date()): boolean {
  if (booking.status !== BookingStatus.pending && booking.status !== BookingStatus.confirmed) {
    return false;
  }
  const deadlineMs = booking.startAt.getTime() - cutoffHours * 60 * 60 * 1000;
  return now.getTime() < deadlineMs;
}
