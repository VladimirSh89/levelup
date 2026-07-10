import { prisma } from "./prisma";

const DEFAULT_CANCELLATION_CUTOFF_HOURS = 24;

/** Cancellation cutoff (hours before start) configured for a location's shop settings. */
export async function getCancellationCutoffHours(locationId: string): Promise<number> {
  const settings = await prisma.shopSettings.findUnique({ where: { locationId } });
  return settings?.cancellationCutoffHours ?? DEFAULT_CANCELLATION_CUTOFF_HOURS;
}
