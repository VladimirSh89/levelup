/**
 * Load `server/.env` regardless of the process' current working directory
 * (e.g. when started from the repo root, from `dist/`, or under a process
 * manager). `dist/index.js` → one level up = `server/`.
 */
import path from "node:path";
import { config } from "dotenv";

const envPath = path.resolve(__dirname, "..", ".env");
config({ path: envPath });
