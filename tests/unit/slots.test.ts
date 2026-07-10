import { describe, expect, it } from "vitest";
import { BookingStatus } from "@prisma/client";
import {
  aggregatePriceAndDuration,
  canCancel,
  generateSlotsFromWindow,
  localTimeToUtc,
  type MasterServiceWithService,
} from "../../server/src/services/slots";

function fakeLink(
  price: number,
  duration: number,
  overrides?: { price?: number | null; duration?: number | null },
): MasterServiceWithService {
  return {
    id: "ms1",
    masterId: "m1",
    serviceId: "s1",
    priceOverrideCents: overrides?.price ?? null,
    durationOverrideMinutes: overrides?.duration ?? null,
    service: {
      id: "s1",
      nameEn: "Cut",
      nameRu: "Стрижка",
      descriptionEn: "",
      descriptionRu: "",
      basePriceCents: price,
      baseDurationMinutes: duration,
      category: "general",
      icon: null,
      isActive: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

describe("aggregatePriceAndDuration", () => {
  it("sums base price and duration", () => {
    const result = aggregatePriceAndDuration([fakeLink(4500, 45), fakeLink(3000, 30)]);
    expect(result).toEqual({ totalPriceCents: 7500, totalDurationMinutes: 75 });
  });

  it("applies per-master overrides", () => {
    const result = aggregatePriceAndDuration([
      fakeLink(4500, 45, { price: 4000, duration: 40 }),
      fakeLink(3000, 30),
    ]);
    expect(result).toEqual({ totalPriceCents: 7000, totalDurationMinutes: 70 });
  });
});

describe("canCancel", () => {
  const startAt = new Date("2026-07-15T18:00:00.000Z");

  it("allows cancel before cutoff", () => {
    const now = new Date("2026-07-14T17:00:00.000Z"); // 25h before
    expect(canCancel({ status: BookingStatus.confirmed, startAt }, 24, now)).toBe(true);
  });

  it("blocks cancel inside cutoff window", () => {
    const now = new Date("2026-07-15T00:00:00.000Z"); // 18h before
    expect(canCancel({ status: BookingStatus.confirmed, startAt }, 24, now)).toBe(false);
  });

  it("blocks cancel for completed bookings", () => {
    const now = new Date("2026-07-01T00:00:00.000Z");
    expect(canCancel({ status: BookingStatus.completed, startAt }, 24, now)).toBe(false);
  });
});

describe("generateSlotsFromWindow", () => {
  it("emits 15-min slots that fit duration and skip overlaps", () => {
    // 10:00–12:00 America/New_York on a fixed date → use UTC window directly
    const window = {
      startUtc: new Date("2026-07-15T14:00:00.000Z"), // 10:00 EDT
      endUtc: new Date("2026-07-15T16:00:00.000Z"), // 12:00 EDT
    };
    const existing = [
      {
        startAt: new Date("2026-07-15T14:30:00.000Z"),
        endAt: new Date("2026-07-15T15:15:00.000Z"),
      },
    ];
    const now = new Date("2026-07-01T00:00:00.000Z");
    const slots = generateSlotsFromWindow({
      window,
      totalDurationMinutes: 45,
      existingBookings: existing,
      now,
    });

    // 45-min slot at 10:00 ends 10:45 and overlaps booking 10:30–11:15 → excluded.
    // First free slot is 11:15 (ends exactly at window close 12:00).
    expect(slots[0]).toBe("2026-07-15T15:15:00.000Z");
    expect(slots).not.toContain("2026-07-15T14:00:00.000Z");
    expect(slots).not.toContain("2026-07-15T14:30:00.000Z");
    expect(slots).toContain("2026-07-15T15:15:00.000Z");
  });

  it("skips past slots relative to now", () => {
    const window = {
      startUtc: new Date("2026-07-15T14:00:00.000Z"),
      endUtc: new Date("2026-07-15T15:00:00.000Z"),
    };
    const slots = generateSlotsFromWindow({
      window,
      totalDurationMinutes: 30,
      existingBookings: [],
      now: new Date("2026-07-15T14:20:00.000Z"),
    });
    expect(slots.every((s) => new Date(s).getTime() > Date.parse("2026-07-15T14:20:00.000Z"))).toBe(
      true,
    );
  });
});

describe("localTimeToUtc", () => {
  it("converts America/New_York wall time to UTC (EDT)", () => {
    // July is EDT (UTC-4)
    const utc = localTimeToUtc("2026-07-15", "10:00");
    expect(utc.toISOString()).toBe("2026-07-15T14:00:00.000Z");
  });
});
