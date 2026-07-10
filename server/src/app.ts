import path from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import "express-async-errors";
import { Prisma } from "@prisma/client";
import { AppError } from "./lib/errors";
import authRouter from "./routes/auth";
import mastersRouter from "./routes/masters";
import bookingsRouter from "./routes/bookings";
import masterPanelRouter from "./routes/masterPanel";
import adminRouter from "./routes/admin";
import uploadRouter from "./routes/upload";
import publicRouter from "./routes/public";

function isDatabaseConnectivityError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientInitializationError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P1001" || err.code === "P1017"))
  );
}

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_URL?.split(",") ?? ["http://localhost:5173"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  // Served under /api so the Passenger sub-URI (/api) routes it to this app in
  // production. /uploads kept as an alias for the Vite dev proxy / legacy URLs.
  const uploadsStatic = express.static(path.resolve(__dirname, "..", "uploads"));
  app.use("/api/uploads", uploadsStatic);
  app.use("/uploads", uploadsStatic);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/masters", mastersRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/master-panel", masterPanelRouter);
  // Mount upload before the admin router so its own owner/admin gate applies
  // (the admin router's admin-only guard would otherwise 403 owner-masters).
  app.use("/api/admin/upload", uploadRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", publicRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
  });

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      // eslint-disable-next-line no-console
      console.error("[levelup] server error", err);

      if (err instanceof AppError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if (isDatabaseConnectivityError(err)) {
        res.status(503).json({
          error: "The site is temporarily unable to connect to the database. Please try again later.",
        });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}
