import { getDb } from "./connection";
import { deviceUsage, accountCredits } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { initDb } from "./initDb";

// One free of each scan type per device. Lets users try both readings
// (the 1-photo InnerView and the 4-photo Full Scan) before paying.
const FREE_PER_TYPE = 1;

// Cost-amplification ceiling. Each anonymous Full Scan runs the 4-photo
// physical pass PLUS InnerView on the same photos (~$0.084), and each
// anonymous InnerView runs the 1-photo emotional pass (~$0.012). With two
// free types per device, worst-case anonymous spend per device is ~$0.096.
// The 250/scans-per-day global ceiling caps daily anonymous cost at ~$24/day.
const GLOBAL_FREE_SCANS_PER_DAY = 250;

export type ScanMode = "innerview" | "full";

export type AccessDecision =
  | { allowed: true; reason: "free_first" | "free_remaining"; remaining?: number }
  | { allowed: false; reason: "paywall"; usedToday: number }
  | { allowed: false; reason: "global_quota_exhausted"; servedToday: number; cap: number };

async function freeScansServedLast24h(): Promise<number> {
  const db = getDb();
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM device_usage WHERE first_seen > NOW() - INTERVAL '24 hours';
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: Array<{ n: number }> }).rows) ?? [];
  return Number((rows[0] as { n?: number } | undefined)?.n ?? 0);
}

// Free-tier check (anonymous, device-tied). Account-tied checks live in
// queries/auth.ts via checkAccountAccess.
//
// scanMode is optional only because the front-door /access.check endpoint
// is called before the user has picked a type (header status badge). When
// omitted, returns "allowed" if EITHER type still has a free slot — the
// per-type check fires again when the user actually begins a scan.
export async function checkAccess(input: { deviceId: string; ip: string; unlockToken?: string; scanMode?: ScanMode }): Promise<AccessDecision> {
  await initDb();
  const db = getDb();

  const deviceRows = await db.select().from(deviceUsage).where(eq(deviceUsage.deviceId, input.deviceId)).limit(1);
  const row = deviceRows[0];
  const innerviewUsed = row?.freeInnerviewUsed ?? 0;
  const fullUsed = row?.freeFullUsed ?? 0;

  const used =
    input.scanMode === "innerview" ? innerviewUsed :
    input.scanMode === "full"      ? fullUsed :
    Math.min(innerviewUsed, fullUsed);

  if (used < FREE_PER_TYPE) {
    const servedToday = await freeScansServedLast24h();
    if (servedToday >= GLOBAL_FREE_SCANS_PER_DAY) {
      return { allowed: false, reason: "global_quota_exhausted", servedToday, cap: GLOBAL_FREE_SCANS_PER_DAY };
    }
    return {
      allowed: true,
      reason: used === 0 ? "free_first" : "free_remaining",
      remaining: FREE_PER_TYPE - used,
    };
  }
  return { allowed: false, reason: "paywall", usedToday: used };
}

export async function recordScan(input: { deviceId: string; ip: string; unlockToken?: string; scanMode: ScanMode }): Promise<void> {
  await initDb();
  const db = getDb();
  const innerviewInc = input.scanMode === "innerview" ? 1 : 0;
  const fullInc = input.scanMode === "full" ? 1 : 0;
  await db.execute(sql`
    INSERT INTO device_usage (device_id, ip, free_scans_used, free_innerview_used, free_full_used, first_seen, last_seen)
    VALUES (${input.deviceId}, ${input.ip}, 1, ${innerviewInc}, ${fullInc}, NOW(), NOW())
    ON CONFLICT (device_id) DO UPDATE
    SET free_scans_used = device_usage.free_scans_used + 1,
        free_innerview_used = device_usage.free_innerview_used + ${innerviewInc},
        free_full_used = device_usage.free_full_used + ${fullInc},
        ip = ${input.ip},
        last_seen = NOW();
  `);
  await db.execute(sql`
    INSERT INTO ip_usage (ip, free_scans_used, last_scan_at)
    VALUES (${input.ip}, 1, NOW())
    ON CONFLICT (ip) DO UPDATE
    SET free_scans_used = ip_usage.free_scans_used + 1,
        last_scan_at = NOW();
  `);
}

// Abuse gate for AI Pet Coach: device must have scanned in last 24h.
export async function hasRecentScan(deviceId: string, ip: string): Promise<boolean> {
  await initDb();
  const db = getDb();
  const rows = await db.execute(sql`
    SELECT 1 FROM device_usage
    WHERE device_id = ${deviceId}
       OR (ip = ${ip} AND last_seen > NOW() - INTERVAL '24 hours')
    LIMIT 1;
  `);
  const len = Array.isArray(rows) ? rows.length : (rows as { rows?: Array<unknown> }).rows?.length ?? 0;
  return len > 0;
}

// Legacy lookup for the /unlock?session_id=cs_xxx redirect URL. Now backed
// by account_credits (the new schema replaces paid_users). Returns the
// email + remaining credits if a row exists for that session.
export async function lookupUnlockBySession(sessionId: string): Promise<{ unlockToken: string; email: string; tier: string; credits: number } | null> {
  await initDb();
  const db = getDb();
  const rows = await db.select().from(accountCredits).where(eq(accountCredits.stripeSessionId, sessionId)).limit(1);
  const u = rows[0];
  if (!u) return null;
  const credits = u.creditsTotal != null ? Math.max(0, u.creditsTotal - u.creditsUsed) : 0;
  // unlockToken slot is now the session id itself for backwards compat
  return { unlockToken: sessionId, email: u.email, tier: u.source, credits };
}
