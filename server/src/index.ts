import "./loadEnv";
import { createApp } from "./app";

process.on("unhandledRejection", (reason: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[levelup] unhandledRejection — process will exit", reason);
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
});

process.on("uncaughtException", (err: Error) => {
  // eslint-disable-next-line no-console
  console.error("[levelup] uncaughtException — process will exit", err);
  process.exit(1);
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
  }
  throw err;
});
