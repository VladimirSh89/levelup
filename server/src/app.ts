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

  app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/masters", mastersRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/master-panel", masterPanelRouter);
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
