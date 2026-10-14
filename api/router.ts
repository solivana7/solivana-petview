import { createRouter, publicQuery } from "./middleware";
import { scanRouter } from "./scanRouter";
import { accessRouter } from "./access";
import { authRouter } from "./auth";
import { adminRouter } from "./admin";
import { innerviewRouter } from "./innerview";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  scan: scanRouter,
  innerview: innerviewRouter,
  access: accessRouter,
  auth: authRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
