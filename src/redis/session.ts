import { redis } from "./client.js";
import { randomBytes } from "node:crypto";

export interface SessionData {
  userId: number;
  username: string;
  role: string;
  createdAt: number;
  lastActivity: number;
}

const SESSION_PREFIX = "session:";
const SESSION_TTL = 7 * 24 * 60 * 60;

export async function createSession(userId: number, username: string, role: string): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const sessionKey = `${SESSION_PREFIX}${sessionId}`;
  const sessionData: SessionData = {
    userId,
    username,
    role,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(sessionData));
  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionData | null> {
  const sessionKey = `${SESSION_PREFIX}${sessionId}`;
  const data = await redis.get(sessionKey);
  if (!data) return null;
  const sessionData = JSON.parse(data) as SessionData;
  sessionData.lastActivity = Date.now();
  await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(sessionData));
  return sessionData;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}
