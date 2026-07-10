import "./loadEnv";
import { createApp } from "./app";

const isProd = process.env.NODE_ENV === "production";

// IMPORTANT: on managed hosts (Passenger/CloudLinux) exiting the process on a
// transient error triggers an instant respawn. A recurring error then becomes a
// fork/restart storm that exhausts the account's process (NPROC) limit. In
// production we log and keep serving (DB errors already surface as HTTP 503);
// only in dev do we hard-exit for a fast feedback loop.
process.on("unhandledRejection", (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[levelup] unhandledRejection", reason);
  if (!isProd) {
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
  }
});

process.on("uncaughtException", (err: Error) => {
  // eslint-disable-next-line no-console
  console.error("[levelup] uncaughtException", err);
  if (!isProd) process.exit(1);
});

const app = createApp();
const port = Number(process.env.PORT ?? 3001);
const host = "0.0.0.0";

const server = app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[levelup] API listening on http://${host}:${port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `[levelup] Port ${port} is already in use. Stop the other process, e.g. \`lsof -ti :${port} | xargs kill\`, or set PORT in server/.env.`,
    );
    // Do not throw/respawn — another instance is already serving.
    return;
  }
  // eslint-disable-next-line no-console
  console.error("[levelup] server error", err);
});
