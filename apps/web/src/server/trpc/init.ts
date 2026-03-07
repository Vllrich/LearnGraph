import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { db } from "@repo/db";

export type TRPCContext = {
  db: typeof db;
  userId: string | null;
};

export const createTRPCContext = cache(async (): Promise<TRPCContext> => {
  // TODO: Extract user session from Supabase Auth cookies once 1.1 Auth is implemented
  return { db, userId: null };
});

const t = initTRPC.context<TRPCContext>().create();

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts;
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({ ctx: { ...ctx, userId: ctx.userId } });
});
