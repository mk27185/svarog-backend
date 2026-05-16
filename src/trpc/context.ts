import { redis } from "@redis/client.js";
import { db } from "@db/client.js";
import { getSession, type SessionData } from "@redis/session.js";
import { URL } from "node:url";

export type Context = {
  redis: typeof redis;
  db: typeof db;
  session: SessionData | null;
  sessionId: string | null;
};

type ContextOpts = {
  req: { headers?: Record<string, unknown>; url?: string; cookies?: Record<string, string> };
  res: unknown;
};

export async function createContext(opts: ContextOpts): Promise<Context> {
  const headers = opts.req.headers ?? {};
  const cookies = opts.req.cookies ?? {};

  const headerSessionId =
    (headers["x-session-id"] as string | undefined) ||
    (headers["X-Session-Id"] as string | undefined) ||
    null;

  let querySessionId: string | null = null;
  try {
    if (opts.req.url) {
      const url = new URL(opts.req.url, "http://localhost");
      querySessionId = url.searchParams.get("sessionId");
    }
  } catch {
    querySessionId = null;
  }

  const cookieSessionId = cookies.sessionId ?? null;

  const sessionId = headerSessionId ?? querySessionId ?? cookieSessionId ?? null;

  let session: SessionData | null = null;
  if (sessionId) {
    session = await getSession(sessionId);
    if (session && !session.role) {
      session = { ...session, role: "user" };
    }
  }

  return {
    redis,
    db,
    session,
    sessionId,
  };
}
