import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Context } from "./context.js";
import { users } from "@db/schema.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { createSession, deleteSession } from "@redis/session.js";

const t = initTRPC.context<Context>().create();

const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vyžadováno přihlášení." });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

const protectedProcedure = t.procedure.use(isAuthenticated);

const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Vyžadováno přihlášení." });
  }
  const row = await ctx.db.select().from(users).where(eq(users.id, ctx.session.userId)).limit(1);
  const user = row[0];
  if (!user || user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Vyžadována administrátorská oprávnění." });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);

const publicUserFields = {
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
  lastSeenAt: users.lastSeenAt,
};

export const authRouter = t.router({
  register: t.procedure
    .input(
      z.object({
        username: z.string().min(1).max(255),
        email: z.union([z.string().email(), z.literal("")]).optional(),
        password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.select().from(users).where(eq(users.username, input.username)).limit(1);
      if (existing[0]) {
        return { success: false as const, error: "Uživatelské jméno již existuje." };
      }
      if (input.email && input.email.length > 0) {
        const byEmail = await ctx.db.select().from(users).where(eq(users.email, input.email)).limit(1);
        if (byEmail[0]) {
          return { success: false as const, error: "E-mail je již obsazený." };
        }
      }
      const passwordHash = await hashPassword(input.password);
      const inserted = await ctx.db
        .insert(users)
        .values({
          username: input.username,
          email: input.email && input.email.length > 0 ? input.email : null,
          passwordHash,
        })
        .returning();
      const user = inserted[0];
      if (!user) {
        return { success: false as const, error: "Uživatele se nepodařilo vytvořit." };
      }
      const sessionId = await createSession(user.id, user.username, user.role);
      return {
        success: true as const,
        sessionId,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          lastSeenAt: user.lastSeenAt,
        },
      };
    }),

  login: t.procedure
    .input(
      z.object({
        username: z.string().min(1).max(255),
        password: z.string().min(1, "Heslo je povinné"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const row = await ctx.db.select().from(users).where(eq(users.username, input.username)).limit(1);
      const user = row[0];
      if (!user?.passwordHash) {
        return { success: false as const, error: "Neplatné uživatelské jméno nebo heslo." };
      }
      const ok = await verifyPassword(input.password, user.passwordHash);
      if (!ok) {
        return { success: false as const, error: "Neplatné uživatelské jméno nebo heslo." };
      }
      await ctx.db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
      const sessionId = await createSession(user.id, user.username, user.role);
      return {
        success: true as const,
        sessionId,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          lastSeenAt: user.lastSeenAt,
        },
      };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) {
      await deleteSession(ctx.sessionId);
    }
    return { success: true as const };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db
      .select(publicUserFields)
      .from(users)
      .where(eq(users.id, ctx.session.userId))
      .limit(1);
    const user = row[0];
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Relace je neplatná." });
    }
    return user;
  }),
});

export const adminRouter = t.router({
  users: t.router({
    list: adminProcedure.query(async ({ ctx }) => {
      const rows = await ctx.db.select(publicUserFields).from(users);
      return rows.sort((a: { id: number }, b: { id: number }) => b.id - a.id);
    }),

    remove: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.session.userId) {
          return { success: false as const, error: "Nemůžete smazat vlastní účet." };
        }
        await ctx.db.delete(users).where(eq(users.id, input.id));
        return { success: true as const };
      }),
  }),
});

export const appRouter = t.router({
  auth: authRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
