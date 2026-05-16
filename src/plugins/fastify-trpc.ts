import { appRouter } from "@trpc/root.js";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { createContext } from "@trpc/context.js";
import type { FastifyPluginCallback } from "fastify";
import type { FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";

export const trpcPlugin: FastifyPluginCallback<FastifyTRPCPluginOptions<typeof appRouter>> = (
  fastify,
  opts,
  done
) => {
  fastifyTRPCPlugin(fastify, opts, done);
};

export const trpcOptions: FastifyTRPCPluginOptions<typeof appRouter> = {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext: async (opts) =>
      createContext({
        req: opts.req,
        res: opts.res,
      }),
  },
};
