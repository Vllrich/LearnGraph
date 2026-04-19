import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTRPCContext } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/routers/_app";

// Most tRPC calls return in well under a second. A higher ceiling exists only
// to cover `after()` background work scheduled by specific procedures (e.g.
// `goals.getLessonBlocks` warming a lesson's pending blocks). The runtime only
// bills for actual wall-clock time, so fast calls are unaffected.
export const maxDuration = 60;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError: ({ error, path }) => {
      console.error(`[tRPC] ${path}:`, error.code, error.message, error.cause ?? error.stack);
    },
  });

export { handler as GET, handler as POST };
