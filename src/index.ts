import "dotenv/config";
import { sql } from "drizzle-orm";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { trpcPlugin, trpcOptions } from "./plugins/fastify-trpc.js";
import { connectDB, db } from "@db/client.js";
import { redis } from "@redis/client.js";

const app = Fastify();

await app.register(cors, {
  origin: true,
  credentials: true,
  // Neomezovat allowedHeaders — tRPC klient posílá mimo jiné „trpc-accept“; pevný seznam
  // bez ní způsobí neúspěšný preflight a v prohlížeči „CORS Failed“.
});

app.get("/health", async () => {
  let redisOk = false;
  let postgresOk = false;
  try {
    const pong = await redis.ping();
    redisOk = pong === "PONG";
  } catch {
    redisOk = false;
  }
  try {
    await db.execute(sql`SELECT 1`);
    postgresOk = true;
  } catch {
    postgresOk = false;
  }
  const ok = redisOk && postgresOk;
  return {
    status: ok ? "ok" : "degraded",
    redis: redisOk,
    postgres: postgresOk,
  };
});

await app.register(trpcPlugin, trpcOptions);

const port = Number(process.env.PORT || 3000);

try {
  await connectDB();
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error("Redis neodpověděl na PING.");
  }
  console.log("Connected to Redis");
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`svarog-backend listening on http://0.0.0.0:${port}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
