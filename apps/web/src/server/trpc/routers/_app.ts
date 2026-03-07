import { createTRPCRouter } from "../init";
import { healthRouter } from "./health";
import { libraryRouter } from "./library";
import { mentorRouter } from "./mentor";
import { reviewRouter } from "./review";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  library: libraryRouter,
  mentor: mentorRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;
