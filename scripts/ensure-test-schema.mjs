import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, "server", ".env") });

const testUrl =
  process.env.DATABASE_URL_TEST ||
  "mysql://levelup:levelup@127.0.0.1:3307/levelup_test";

const result = spawnSync(
  "npx",
  ["prisma", "db", "push", "--schema", path.join(root, "prisma", "schema.prisma"), "--skip-generate"],
  {
    cwd: path.join(root, "server"),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  },
);

process.exit(result.status === 0 ? 0 : 1);
