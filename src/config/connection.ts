import "dotenv/config";
import { Redis } from "ioredis";

/** Jednoznačná URL nebo sada POSTGRES_* — žádné skryté výchozí heslo. */
export function getDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;

  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD ?? "";
  const host = process.env.POSTGRES_HOST?.trim();
  const port = process.env.POSTGRES_PORT?.trim();
  const database = process.env.POSTGRES_DB?.trim();

  if (!user || !host || !port || !database || password === "") {
    throw new Error(
      "Chybí databáze: nastav DATABASE_URL nebo všechny POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB."
    );
  }

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export function getDatabaseUrlRedacted(): string {
  return getDatabaseUrl().replace(/:([^:@/]+)@/, ":****@");
}

export function createRedis(): Redis {
  const url = process.env.REDIS_URL?.trim();
  if (url) return new Redis(url);

  const host = process.env.REDIS_HOST?.trim();
  const portRaw = process.env.REDIS_PORT?.trim();
  if (!host || !portRaw) {
    throw new Error("Chybí Redis: nastav REDIS_URL nebo REDIS_HOST a REDIS_PORT.");
  }
  const port = parseInt(portRaw, 10);
  if (Number.isNaN(port)) {
    throw new Error("REDIS_PORT musí být číslo.");
  }
  const password = process.env.REDIS_PASSWORD?.trim();
  return new Redis({ host, port, ...(password ? { password } : {}) });
}
