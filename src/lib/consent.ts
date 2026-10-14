// Cookie consent helper — gates non-essential localStorage usage.
// Essential storage (session tokens, device IDs) is always allowed.
// Non-essential (drafts, timeline, preferences) is skipped if user declined.

const CONSENT_KEY = "petview_cookie_consent";

export type ConsentStatus = "accepted" | "declined" | null;

export function getConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(status: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CONSENT_KEY, status); } catch {}
}

/** Returns true if non-essential storage may be used. */
export function canUseStorage(): boolean {
  return getConsent() === "accepted";
}

/** Safe wrapper for non-essential localStorage.setItem. */
export function setStorageItem(key: string, value: string): void {
  if (!canUseStorage()) return;
  try { localStorage.setItem(key, value); } catch {}
}

/** Safe wrapper for non-essential localStorage.removeItem. */
export function removeStorageItem(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}
