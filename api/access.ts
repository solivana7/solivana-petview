import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { checkAccess, lookupUnlockBySession } from "./queries/access";
import { getSession, checkAccountAccess, getAccountStatus, registerPendingPurchase, claimPendingPurchase, createSessionForEmail } from "./queries/auth";
import { env, hasDb, hasStripe } from "./lib/env";

function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type Decision =
  | { allowed: true; reason: string; remaining?: number | null; signedIn?: boolean }
  | { allowed: false; reason: "needs_signin" | "paywall"; signedIn: boolean; email?: string; paymentLinks?: { starter: string; pro: string; unlimited: string; unlimitedAnnual: string }; couponCode?: string }
  | { allowed: false; reason: "global_quota_exhausted"; signedIn: boolean; servedToday: number; cap: number; paymentLinks?: { starter: string; pro: string; unlimited: string; unlimitedAnnual: string } };

export const accessRouter = createRouter({
  // Pre-flight gate. Returns whether the caller may begin a scan.
  // Order of checks:
  //   1. Signed-in account with unlimited subscription -> allow (unlimited)
  //   2. Signed-in account with credits -> allow (credit)
  //   3. Signed-in account with no credits -> paywall
  //   4. Anonymous device with free scan available -> allow (free)
  //   5. Anonymous device past quota -> needs_signin (then paywall)
  check: publicQuery
    .input(z.object({
      deviceId: z.string().min(8).max(64),
      sessionToken: z.string().optional(),
      // Legacy unlock_token still accepted so devices that bought BEFORE
      // accounts shipped don't lose access. Will be deprecated.
      unlockToken: z.string().optional(),
      // Optional. When supplied, gates against the per-type free counter
      // (1 InnerView + 1 Full Scan per device). When omitted, allows if
      // EITHER type still has a free slot — used by header status badges.
      scanMode: z.enum(["innerview", "full"]).optional(),
    }))
    .query(async ({ ctx, input }): Promise<Decision> => {
      if (!hasDb) {
        return { allowed: true, reason: "free_first" };
      }

      const sess = await getSession(input.sessionToken);
      if (sess) {
        const acct = await checkAccountAccess(sess.email);
        if (acct.allowed) {
          return { allowed: true, reason: acct.reason, remaining: acct.remaining, signedIn: true };
        }
        return {
          allowed: false,
          reason: "paywall",
          signedIn: true,
          email: sess.email,
          paymentLinks: { starter: env.stripeLinkStarter, pro: env.stripeLinkPro, unlimited: env.stripeLinkUnlimited, unlimitedAnnual: env.stripeLinkUnlimitedAnnual },
          couponCode: env.stripeCouponRestock,
        };
      }

      // Anonymous user
      const decision = await checkAccess({
        deviceId: input.deviceId,
        ip: getClientIp(ctx.req),
        unlockToken: input.unlockToken,
        scanMode: input.scanMode,
      });
      if (decision.allowed) {
        return { allowed: true, reason: decision.reason, remaining: decision.remaining, signedIn: false };
      }
      if (decision.reason === "global_quota_exhausted") {
        return {
          allowed: false,
          reason: "global_quota_exhausted",
          signedIn: false,
          servedToday: decision.servedToday,
          cap: decision.cap,
          paymentLinks: { starter: env.stripeLinkStarter, pro: env.stripeLinkPro, unlimited: env.stripeLinkUnlimited, unlimitedAnnual: env.stripeLinkUnlimitedAnnual },
        };
      }
      // Anonymous user out of free scans -> must sign in before paywall
      return {
        allowed: false,
        reason: "needs_signin",
        signedIn: false,
      };
    }),

  // Stripe-session lookup for the legacy /unlock?session_id flow.
  // Also auto-creates a login session so the buyer is immediately signed in.
  unlock: publicQuery
    .input(z.object({ sessionId: z.string().min(1) }))
    .query(async ({ input }): Promise<{ found: false } | { found: true; unlockToken: string; sessionToken: string; tier: string; credits: number }> => {
      if (!hasDb) return { found: false };
      const u = await lookupUnlockBySession(input.sessionId);
      if (!u) return { found: false };
      const sessionToken = await createSessionForEmail(u.email);
      return { found: true, unlockToken: u.unlockToken, sessionToken, tier: u.tier, credits: u.credits };
    }),

  paymentLinks: publicQuery.query(() => ({
    starter: env.stripeLinkStarter,
    pro: env.stripeLinkPro,
    unlimited: env.stripeLinkUnlimited,
    unlimitedAnnual: env.stripeLinkUnlimitedAnnual,
    couponCode: env.stripeCouponRestock,
    enabled: hasStripe && Boolean(env.stripeLinkStarter),
  })),

  // Lightweight status query for the header badge — call frequently
  myStatus: publicQuery
    .input(z.object({ sessionToken: z.string().optional() }))
    .query(async ({ input }) => {
      const sess = await getSession(input.sessionToken);
      if (!sess) return { signedIn: false as const };
      const status = await getAccountStatus(sess.email);
      return {
        signedIn: true as const,
        email: status.email,
        totalCredits: status.totalCredits,
        hasUnlimited: status.hasUnlimited,
        unlimitedUntil: status.unlimitedUntil,
        scanCount: status.scanCount,
        subscriptionStatus: status.subscriptionStatus,
      };
    }),

  // Register intent before redirecting to Stripe Payment Link.
  // The webhook will store a session token keyed by this deviceId.
  registerPurchaseIntent: publicQuery
    .input(z.object({ deviceId: z.string().min(8).max(64) }))
    .mutation(async ({ input }) => {
      if (!hasDb) return { ok: true as const };
      // Just ensure the deviceId is known; the webhook will overwrite with
      // the real session token after payment.
      await registerPendingPurchase({
        deviceId: input.deviceId,
        email: "pending",
        sessionToken: "pending",
      });
      return { ok: true as const };
    }),

  // Claim a session token after returning from Stripe.
  // Called by the frontend on app load when a pending purchase is detected.
  claimPurchase: publicQuery
    .input(z.object({ deviceId: z.string().min(8).max(64) }))
    .query(async ({ input }): Promise<
      { found: false } | { found: true; sessionToken: string; email: string }
    > => {
      if (!hasDb) return { found: false };
      return claimPendingPurchase(input.deviceId);
    }),

  // ─── ADMIN ───
  adminMe: publicQuery
    .input(z.object({ sessionToken: z.string().optional() }))
    .query(async ({ input }) => {
      if (!hasDb) return { isAdmin: false as const, email: null as string | null };
      const sess = await getSession(input.sessionToken);
      if (!sess) return { isAdmin: false as const, email: null as string | null };
      const { isAdmin: admin } = await import("./queries/auth").then((m) => ({ isAdmin: m.isAdmin(sess.email) }));
      return { isAdmin: admin, email: sess.email };
    }),

  adminGetUser: publicQuery
    .input(z.object({ sessionToken: z.string().min(1), email: z.string().email() }))
    .query(async ({ input }) => {
      if (!hasDb) return { error: "no_db" as const };
      const sess = await getSession(input.sessionToken);
      if (!sess) return { error: "unauthorized" as const };
      const { isAdmin: adminCheck, getAccountStatus: getStatus } = await import("./queries/auth");
      if (!adminCheck(sess.email)) return { error: "unauthorized" as const };
      const status = await getStatus(input.email);
      return { error: null as string | null, user: status };
    }),

  adminGrantCredits: publicQuery
    .input(z.object({ sessionToken: z.string().min(1), email: z.string().email(), credits: z.number().int().min(1).max(1000), note: z.string().max(200).optional() }))
    .mutation(async ({ input }) => {
      if (!hasDb) return { error: "no_db" as const };
      const sess = await getSession(input.sessionToken);
      if (!sess) return { error: "unauthorized" as const };
      const { isAdmin: adminCheck, adminGrantCredits: doGrant } = await import("./queries/auth");
      if (!adminCheck(sess.email)) return { error: "unauthorized" as const };
      const result = await doGrant({ email: input.email, credits: input.credits, note: input.note, grantedBy: sess.email });
      if (result.ok === false) return { error: result.reason };
      return { error: null as string | null, remaining: result.remaining };
    }),
});
