import { createTRPCRouter } from "../init";
import { healthRouter } from "./health";
import { libraryRouter } from "./library";
import { mentorRouter } from "./mentor";
import { reviewRouter } from "./review";
import { userRouter } from "./user";
import { goalsRouter } from "./goals";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  library: libraryRouter,
  mentor: mentorRouter,
  review: reviewRouter,
  user: userRouter,
  goals: goalsRouter,
});

export type AppRouter = typeof appRouter;
