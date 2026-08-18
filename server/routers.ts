import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { assetsRouter } from "./routers/assets";
import { clientsRouter } from "./routers/clients";
import { astroConfigRouter } from "./routers/astroConfig";
import { funnelBuilderRouter } from "./routers/funnelBuilder";
import { paidFunnelRouter } from "./routers/paidFunnel";
import { simpleFormRouter } from "./routers/simpleForm";
import { workspaceRouter } from "./routers/workspace";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
  }),
  assets: assetsRouter,
  clients: clientsRouter,
  astroConfig: astroConfigRouter,
  funnelBuilder: funnelBuilderRouter,
  paidFunnel: paidFunnelRouter,
  simpleForm: simpleFormRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
