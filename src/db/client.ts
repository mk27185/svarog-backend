import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getDatabaseUrl, getDatabaseUrlRedacted } from "../config/connection.js";
import * as schema from "./schema.js";

const connectionString = getDatabaseUrl();
console.log("Connecting to PostgreSQL:", getDatabaseUrlRedacted());

const client = new pg.Client({ connectionString });

export async function connectDB(): Promise<void> {
  await client.connect();
  console.log("Connected to PostgreSQL");
}

export const db = drizzle(client, { schema });
