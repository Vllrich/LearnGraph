import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";

export const healthRouter = createTRPCRouter({
  check: publicProcedure
    .input(z.void())
    .query(() => {
      return {
        status: "ok" as const,
        timestamp: new Date().toISOString(),
      };
    }),
});
