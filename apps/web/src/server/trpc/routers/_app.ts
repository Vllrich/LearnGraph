import { createTRPCRouter } from "../init";
import { healthRouter } from "./health";
import { libraryRouter } from "./library";
import { mentorRouter } from "./mentor";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  library: libraryRouter,
  mentor: mentorRouter,
});

export type AppRouter = typeof appRouter;
