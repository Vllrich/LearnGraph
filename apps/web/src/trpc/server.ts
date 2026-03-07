import "server-only";

import { createHydrationHelpers } from "@trpc/react-query/rsc";
import { cache } from "react";
import { createCallerFactory, createTRPCContext } from "@/server/trpc/init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "@/server/trpc/routers/_app";
import type { AppRouter } from "@/server/trpc/routers/_app";

export const getQueryClient = cache(makeQueryClient);
const caller = createCallerFactory(appRouter)(createTRPCContext);

export const { trpc, HydrateClient } = createHydrationHelpers<AppRouter>(
  caller,
  getQueryClient,
);
