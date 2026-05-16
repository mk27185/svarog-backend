import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/** Migrace na serveru: vždy `DATABASE_URL` v prostředí (lokálně z `.env`). */
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error("Nastav DATABASE_URL pro drizzle-kit (migrate / generate).");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  verbose: true,
  strict: true,
});
