import { createTRPCRouter } from "../init";
import { healthRouter } from "./health";
import { libraryRouter } from "./library";
import { mentorRouter } from "./mentor";
import { reviewRouter } from "./review";
import { userRouter } from "./user";
import { goalsRouter } from "./goals";
import { exportRouter } from "./export";
import { gamificationRouter } from "./gamification";
import { analyticsRouter } from "./analytics";
import { gapsRouter } from "./gaps";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  library: libraryRouter,
  mentor: mentorRouter,
  review: reviewRouter,
  user: userRouter,
  goals: goalsRouter,
  export: exportRouter,
  gamification: gamificationRouter,
  analytics: analyticsRouter,
  gaps: gapsRouter,
});

export type AppRouter = typeof appRouter;
