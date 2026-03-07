import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { db } from "@repo/db";
import { createClient } from "@/lib/supabase/server";

export type TRPCContext = {
  db: typeof db;
  userId: string | null;
};

export const createTRPCContext = cache(async (): Promise<TRPCContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { db, userId: user?.id ?? null };
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
