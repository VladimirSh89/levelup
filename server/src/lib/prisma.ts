import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Always reuse a single client (incl. production) so we never spawn multiple
// Prisma query-engine sidecar processes within one Node instance.
export const prisma =
  global.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

global.prisma = prisma;
