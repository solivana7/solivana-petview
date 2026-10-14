import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import { env, hasDb } from "./lib/env";
import { checkAccess, recordScan } from "./queries/access";
import { getSession, checkAccountAccess, consumeOneCreditAtomic, refundOneCredit, recordAccountScan } from "./queries/auth";
import { resizeForVision } from "./lib/imageResize";

const MODEL = "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
const claudeLimit = pLimit(5);

const SCAN_AREAS = ["nose", "eye", "ear", "mouth"] as const;
type ScanArea = typeof SCAN_AREAS[number];

const AREA_GUIDE: Record<ScanArea, string> = {
  nose: "Close-up of the nose — pigmentation (color and any depigmentation), moisture, crusting, discharge, swelling, asymmetry",
  eye: "Close-up of the eyes — clarity of cornea, conjunctiva color, discharge, asymmetry, third-eyelid visibility, sclera color",
  ear: "Ears and the area around them — position, redness, debris, swelling, hair loss, odor cues from waxy buildup",
  mouth: "Close-up of mouth, lips, teeth, gums — gum color (pink/pale/red/blue), tartar accumulation, tooth fractures or discoloration, lip swelling",
};

const INNERVIEW_SYSTEM_PROMPT = `You are SoliVana AI — not a chatbot, not a clinician, but a perceptive, warm-hearted observer who has spent a lifetime learning to read animals. You write the way someone talks after they've been quietly watching a pet for ten minutes and finally turn to the owner with a small smile and say, "You know what I think?"

You are looking at four close-up photos of a pet: nose, eyes, ears, and mouth/gums.

Your job is to translate what you see into a short, captivating emotional portrait — the kind of note that makes an owner look at their pet and think, "Yes. That's exactly them."

---

HOW TO READ (frameworks to draw from, not recite):

EYES — Emotional Presence and Vitality
- Brightness vs dullness; softness vs tension; symmetry; clarity; gaze quality (engaged vs avoidant); blink rate; orbital tightening.
- TCM: Shen / spirit. Ayurveda: Prana / life force.

NOSE — Ease and Environmental Response
- Moisture, texture, symmetry, crusting, discharge.
- TCM: Lung energy / emotional processing. Ayurveda: Vata / sensitivity to change.

EARS — Comfort and Nervous System Ease
- Position, symmetry, redness, tissue tone. Flattened or asymmetrical ears can signal stress; ear adduction (brought together) can signal positive anticipation in dogs.
- TCM: Kidney energy / fear and resilience.

MOUTH AND GUMS — Joy and Life Force
- Gum color, moisture, jaw tension, lip licking, facial openness.
- TCM: Spleen / Heart meridian — nourishment and connection. Bioenergetics: stress held in the jaw.

OVERALL IMPRESSION
Read all four as one face. Is it open or contracted? Soft or guarded? Present or withdrawn? What is the dominant emotional tone?

---

OUTPUT FORMAT — USE THESE HEADINGS EXACTLY:

WHAT YOUR PET MAY BE COMMUNICATING

1-2 paragraphs. This is the heart of the reading. Do NOT start with "Your pet appears to be..." or "There are signs that..." Jump straight into the story.

Be specific. Name the exact detail you noticed and what it made you think.
Be warm, but not saccharine. Be witty if the moment calls for it. Be direct.
Vary your opening every time. Sometimes start with a single vivid sentence. Sometimes start by addressing the pet directly. Sometimes start with a contrast: "The left ear says vacation, the right ear says overtime."

BAD examples (never do this):
"Your pet appears to be in a place of quiet ease — the eyes are soft, the facial expression is relaxed, and the overall impression is of an animal who feels settled and safe."
"There are gentle signs that your pet may be carrying some low-level stress or fatigue."

GOOD examples:
"Someone is working an angle. That head tilt isn't confusion — it's negotiation. The eyes are bright, locked on the camera with the focused patience of a diplomat who knows the treat bag is within reach. This is a pet who has learned that charm is a currency, and they're spending it wisely."

"Oh, this one is tired. Not the dramatic, collapsed kind of tired — the quiet kind. The eyes are slightly filmy, the blink is slow, and the ears rest at half-mast like curtains drawn against a long day. The world feels a little loud to them right now. What they need isn't entertainment; it's someone to simply be nearby, doing nothing, asking nothing."

WHAT WE NOTICED

3-5 observations. You may use bullets OR a short flowing paragraph — mix it up.
Each observation should feel like a note jotted in the margin of a sketchbook, not a clinical finding.
Name the area, the specific visual cue, and the emotional echo it carries.
You do not need to hedge every sentence. Speak with gentle confidence.

BAD:
"Eyes — a softness and brightness that, in traditional wellness frameworks, is often associated with emotional ease and a settled inner state."

GOOD:
"Eyes — soft, steady, with a warm amber clarity. In TCM this brightness speaks to a settled Shen; in plain English, this pet is home in themselves right now."

WHAT YOUR PET MAY NEED RIGHT NOW

One paragraph of practical, grounded suggestions framed as invitations, not prescriptions.
Use language like: "They might love..." / "This could be a good week for..." / "Consider..."
Be specific and actionable. Not "more rest" but "a covered crate in a busy room, so they can watch without participating."

A NOTE ON THIS READING

A brief, natural closing disclaimer. Do NOT copy a template. Write it fresh each time in 1-2 sentences.
Remind the owner that this is an intuitive impression rooted in traditional wellness frameworks, not a veterinary assessment. Encourage them to trust their own knowledge of their pet.

Example shapes (vary these):
"This is an impression, not a diagnosis — just one way of listening. You know your companion better than any lens ever could."
"Traditional frameworks offer one vocabulary for what we see; your daily life together offers the real one. Trust that."

---

TONE RULES:

- NEVER use: diagnose, diagnosis, condition, disease, disorder, pathology, abnormal, trauma, abuse, detected, confirmed, indicates definitively.
- NEVER use generic openers: "Your pet appears to be," "There are signs that," "It seems that," "Based on the images."
- NEVER use the bad examples above, or any language that resembles them.
- Vary your sentence structure. No two readings should feel like they were written by the same template.
- If the animal looks happy and settled, celebrate it with genuine delight — not polite approval, but real joy.
- Speak to the owner as a peer who also loves this animal. No distance, no formality.
- This is an act of care disguised as a story. Tell a small, true one.
- NEVER use --- or horizontal rules anywhere in the text. No dividers, no separators, no dashes used as lines. Plain flowing paragraphs only.

Output plain text only — no JSON, no markdown code fences, no preamble. Start your response with the first heading.`;

const SYSTEM_PROMPT = `You are PetView, a photo-based observation tool for pet owners. The user has uploaded up to four photos of their dog or cat — each focused on a specific anatomical area: nose, eye, ear, mouth.

You are NOT a veterinary diagnostic device. You do NOT diagnose, treat, cure, or prevent any condition. You make observations only and always recommend a licensed veterinarian for diagnosis or care decisions.

For each photo provided, the user message will tell you which area it's meant to show. Read each photo on its own merits and against that area's guidance:

- nose: pigmentation (color, depigmentation), moisture, crusting, discharge, swelling, asymmetry
- eye: clarity of cornea, conjunctiva color, discharge, asymmetry, third-eyelid visibility, sclera color
- ear: position, redness, debris, swelling, hair loss, waxy buildup
- mouth: gum color (pink/pale/red/blue), tartar, tooth fractures or discoloration, lip swelling

RESEARCH-INFORMED OBSERVATION CUES — look for these validated signals:

PAIN & DISCOMFORT (Feline Grimace Scale / DogFACS):
- Cats: flattened ears, squinted eyes / orbital tightening, tense muzzle, whiskers forward or retracted, head below shoulders
- Dogs: droopy ears, arched eyebrows, darting / "worried" eyes, tension around eyes and muzzle

STRESS & ANXIETY INDICATORS:
- Rapid blinking, lip licking, nose licking
- Ear flattening or asymmetrical ear position
- Gaze aversion, withdrawn or avoidant eye contact
- Jaw tension, lips held tightly

EMOTIONAL STATE CUES (DogFACS-validated):
- Positive / anticipatory: ears adducted (brought together), bright engaged eyes, soft open mouth
- Negative / frustrated: ears flattener, blink, lips part, jaw drop, nose lick

DEHYDRATION & VITALITY MARKERS:
- Nose: excessive dryness, cracking, loss of normal moisture
- Eyes: sunken appearance, reduced brightness, dullness
- Gums: pale color, tacky/dry texture (vs normal moist pink)

For each photo:
- Use observational language ("the gums appear paler than typical pink", "the right eye shows mild discharge").
- Never say "your pet has X disease" or recommend medications/dosages.
- Always pair concerning findings with: "Share this photo with your veterinarian."

After observing each area, synthesize an overall reading.

RESPOND WITH STRICT JSON. No markdown, no prose outside the object. Schema:

{
  "species": "dog" | "cat" | "other" | "unclear",
  "overallStatus": "looking_healthy" | "worth_watching" | "share_with_vet" | "couldnt_see_clearly",
  "overallNote": "A TIGHT executive summary of the four photos — 3 short paragraphs separated by a single blank line (\\n\\n). Total length 120-180 words MAX. Do NOT describe each photo in detail (that detail belongs in the per-area observations below). NEVER medical / diagnostic / veterinary-prescriptive language. Observation only. Structure exactly:\n\nPARAGRAPH 1 — What you see (1-2 sentences max). The headline. Plain language: 'Bright eyes, healthy nose, but worth a closer look at the gums and ears.'\n\nPARAGRAPH 2 — What it might mean (1-2 sentences max). Name the 1-3 areas most worth attention and the common things that could be associated with what's visible.\n\nPARAGRAPH 3 — What to do (2-3 sentences max). The top 1-2 specific care actions the owner can take this week (hydration, grooming, food texture, dental wipes, environment). End with one clear line: 'If anything worsens or doesn't resolve in a few days, share these photos with your vet.'\n\nQuiet-luxury tone. Never prescribe medication, dose, or specific brand-name supplements.",
  "areas": [
    {
      "area": "nose" | "eye" | "ear" | "mouth",
      "visibility": "clear" | "partial" | "not_visible" | "not_provided",
      "observation": "what is visible. Empty string if not visible or not provided.",
      "concern": "low" | "moderate" | "share_with_vet" | "none"
    }
  ],
  "watchFor": ["3 short, specific things the owner can watch for over the coming days/weeks — never medical instructions"],
  "shareWithVetIf": ["3 specific signs that warrant a vet visit"],
  "photoQualityTips": ["1-3 tips ONLY if any photo is blurry/dark/too far. Empty array if all photos are fine. Mention which area's photo is unclear."]
}

Rules:
- Always include exactly four area objects: nose, eye, ear, mouth — in that order. If a photo wasn't provided for an area, set visibility "not_provided", observation "", concern "none".
- If all photos are unreadable, set overallStatus "couldnt_see_clearly" and populate photoQualityTips.
- Never invent findings on areas that aren't visible.
- Plain English. No "deficiency", "disease", "diagnosis".`;

const analysisSchema = z.object({
  species: z.enum(["dog", "cat", "other", "unclear"]),
  overallStatus: z.enum(["looking_healthy", "worth_watching", "share_with_vet", "couldnt_see_clearly"]),
  overallNote: z.string().min(120),
  areas: z.array(z.object({
    area: z.enum(SCAN_AREAS),
    visibility: z.enum(["clear", "partial", "not_visible", "not_provided"]),
    observation: z.string(),
    concern: z.enum(["low", "moderate", "share_with_vet", "none"]),
  })),
  watchFor: z.array(z.string()),
  shareWithVetIf: z.array(z.string()),
  photoQualityTips: z.array(z.string()),
});

export type ScanAnalysis = z.infer<typeof analysisSchema> & {
  // Emotional-layer reading (the "Emotional View" prompt). Present when the scan
  // tier includes Emotional View (anonymous first-free scan or unlimited
  // subscriber). Absent on 5-pack credit scans — those see an upgrade prompt
  // in the ResultScreen instead.
  innerview?: { text: string } | null;
  // True when this scan was the user's first free anonymous scan, so the
  // frontend can show the post-results conversion card exactly once.
  firstFreeScan?: boolean;
};
export type { ScanArea };
export { SCAN_AREAS };

type ScanResult =
  | { success: true; analysis: ScanAnalysis }
  | { success: false; code: "no_api_key" | "validation_failed" | "upstream_timeout" | "upstream_error" | "rate_limited"; message: string }
  | { success: false; code: "needs_signin" | "paywall"; message: string; signedIn: boolean; paymentLinks?: { starter: string; pro: string; unlimited: string; unlimitedAnnual: string }; couponCode?: string };

function getClientIp(req: Request): string {
  // Take RIGHTMOST IP (closest to our trusted edge) — leftmost is
  // attacker-spoofable via prepended X-Forwarded-For headers.
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const ips = xf.split(",").map((s) => s.trim()).filter(Boolean);
    return ips[ips.length - 1] ?? "unknown";
  }
  return "unknown";
}

// 4 photos in one Vision call → 60s per attempt + 2 retries = 180s budget,
// with backoff for transient 529 ("overloaded_error") from Anthropic.
const anthropic = new Anthropic({
  apiKey: env.anthropicApiKey || "missing",
  timeout: 60_000,
  maxRetries: 2,
});

const allowedMimes = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMime = typeof allowedMimes[number];

function detectMime(base64: string): AllowedMime | null {
  try {
    const head = Buffer.from(base64.slice(0, 24), "base64");
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
    if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return "image/webp";
    return null;
  } catch {
    return null;
  }
}

const photoSchema = z.object({
  area: z.enum(SCAN_AREAS),
  imageBase64: z.string().min(64).max(9_500_000),
});

// Second Claude call layered on top of the same four photos. Produces the
// emotional/bioenergetic reading. Sonnet-then-Haiku fallback mirrors the
// physical call. Soft-fails: the caller swallows errors so a successful
// physical reading is still returned.
type InnerViewContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: AllowedMime; data: string } };

async function callInnerViewClaude(content: InnerViewContentBlock[]): Promise<string> {
  const callOnce = (model: string) =>
    claudeLimit(() =>
      anthropic.messages.create({
        model,
        max_tokens: 1500,
        system: [{ type: "text", text: INNERVIEW_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      })
    );
  let response;
  try {
    response = await callOnce(MODEL);
  } catch (err: unknown) {
    const e = err as { status?: number };
    if (e?.status === 529 || e?.status === 503) {
      response = await callOnce(FALLBACK_MODEL);
    } else {
      throw err;
    }
  }
  let text = response.content
    .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
  text = text.replace(/\n?---\n?/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("empty Emotional View response");
  return text;
}

export const scanRouter = createRouter({
  analyze: publicQuery
    .input(z.object({
      species: z.enum(["dog", "cat"]).optional(),
      // 1 to 4 photos, each tagged with an area. Total payload capped at ~25MB
      // of base64 across all photos by Hono's body limit (8MB hard, but
      // multipart is unlikely here so this is the practical ceiling).
      photos: z.array(photoSchema).min(1).max(4),
      deviceId: z.string().min(8).max(64).optional(),
      sessionToken: z.string().optional(),
      unlockToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }): Promise<ScanResult> => {
      if (!env.anthropicApiKey) {
        return { success: false, code: "no_api_key", message: "Analysis is temporarily unavailable. Please try again later." };
      }

      // ─── Gate ───
      const ip = getClientIp(ctx.req);
      let authorizedAccountEmail: string | null = null;
      // Tracks whether the gated user is consuming from a credit pack
      // (vs unlimited subscription). Used to decide whether to atomically
      // decrement a credit BEFORE the Claude call (TOCTOU fix).
      let onCreditPath = false;
      // Tracks whether we charged a pack credit so we can refund if the
      // scan fails downstream. Unlimited tier skips consume so this stays
      // false there.
      let creditConsumed = false;
      const refundIfConsumed = async () => {
        if (creditConsumed && authorizedAccountEmail) {
          await refundOneCredit(authorizedAccountEmail).catch((e) => console.error("[scan] credit refund failed:", e));
          creditConsumed = false;
        }
      };
      if (hasDb) {
        const sess = await getSession(input.sessionToken);
        if (sess) {
          const acct = await checkAccountAccess(sess.email);
          if (!acct.allowed) {
            const message = acct.reason === "unlimited_capped"
              ? `You've used all ${acct.monthlyCap} scans on your Unlimited plan this month. Your cap resets on the 1st.`
              : "You're out of scans. Add a pack or go unlimited.";
            return {
              success: false,
              code: "paywall",
              message,
              signedIn: true,
              paymentLinks: { starter: env.stripeLinkStarter, pro: env.stripeLinkPro, unlimited: env.stripeLinkUnlimited, unlimitedAnnual: env.stripeLinkUnlimitedAnnual },
              couponCode: env.stripeCouponRestock,
            };
          }
          authorizedAccountEmail = sess.email;
          onCreditPath = acct.reason === "credit";

          // Atomic credit consumption BEFORE the Claude call.
          if (onCreditPath) {
            const consumed = await consumeOneCreditAtomic(sess.email);
            if (!consumed) {
              return {
                success: false,
                code: "paywall",
                message: "You're out of scans. Add a pack or go unlimited.",
                signedIn: true,
                paymentLinks: { starter: env.stripeLinkStarter, pro: env.stripeLinkPro, unlimited: env.stripeLinkUnlimited, unlimitedAnnual: env.stripeLinkUnlimitedAnnual },
                couponCode: env.stripeCouponRestock,
              };
            }
            creditConsumed = true;
          }
        } else if (input.deviceId) {
          const decision = await checkAccess({ deviceId: input.deviceId, ip, unlockToken: input.unlockToken, scanMode: "full" });
          if (!decision.allowed) {
            return {
              success: false,
              code: "needs_signin",
              message: "You've used your free scan. Create an account to continue.",
              signedIn: false,
            };
          }
        }
      }

      // Validate every photo's MIME via magic bytes, then resize to ≤1024px
      // WebP. With 4 photos per scan the cost amplifier from 6MB phone uploads
      // is even worse than Emotional View — ~$0.04 unresized → ~$0.013 resized.
      type PreparedPhoto = { area: ScanArea; mediaType: "image/webp"; data: string };
      const prepared: PreparedPhoto[] = [];
      for (const p of input.photos) {
        const raw = p.imageBase64.includes(",") ? p.imageBase64.split(",")[1]! : p.imageBase64;
        if (!detectMime(raw)) {
          await refundIfConsumed();
          return { success: false, code: "validation_failed", message: `Image format for ${p.area} is not supported. Use JPEG, PNG, or WebP.` };
        }
        try {
          const resized = await resizeForVision(raw);
          prepared.push({ area: p.area, mediaType: resized.mediaType, data: resized.data });
        } catch (err) {
          console.error("[scan] resize failed for", p.area, err);
          await refundIfConsumed();
          return { success: false, code: "validation_failed", message: `We couldn't read the ${p.area} photo. Try a different one.` };
        }
      }

      const speciesHint = input.species
        ? `The owner has identified this as a ${input.species}.`
        : "Identify the species from the photos (dog or cat).";

      // Build the user content: one image block + one text label per photo
      type ContentBlock = { type: "image"; source: { type: "base64"; media_type: AllowedMime; data: string } } | { type: "text"; text: string };
      const content: ContentBlock[] = [
        { type: "text", text: `${speciesHint}\n\nThere are ${prepared.length} photo${prepared.length === 1 ? "" : "s"} below. Each is preceded by a label saying which area it shows. Use the per-area guidance from the system prompt.` },
      ];
      for (const p of prepared) {
        content.push({ type: "text", text: `--- ${p.area.toUpperCase()} ---\n${AREA_GUIDE[p.area]}` });
        content.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } });
      }
      content.push({ type: "text", text: "Return only the JSON object, no surrounding text. Include exactly four area objects (nose, eye, ear, mouth) — set visibility 'not_provided' for any area without a photo." });

      const callClaude = (model: string) =>
        claudeLimit(() =>
          anthropic.messages.create({
            model,
            max_tokens: 2000,
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content }],
          })
        );

      try {
        let response;
        try {
          response = await callClaude(MODEL);
        } catch (primaryErr: unknown) {
          const pe = primaryErr as { status?: number };
          // Sonnet overloaded — fall back to Haiku 4.5 so the user gets a reading.
          if (pe?.status === 529 || pe?.status === 503) {
            console.warn("[scan] Sonnet overloaded, falling back to Haiku 4.5");
            response = await callClaude(FALLBACK_MODEL);
          } else {
            throw primaryErr;
          }
        }

        const text = response.content
          .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
          .map((c) => c.text)
          .join("");
        const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (!match) {
            await refundIfConsumed();
            return { success: false, code: "validation_failed", message: "We couldn't read the response. Please try clearer photos." };
          }
          try { parsed = JSON.parse(match[0]); } catch {
            await refundIfConsumed();
            return { success: false, code: "validation_failed", message: "We couldn't read the response. Please try again." };
          }
        }

        const result = analysisSchema.safeParse(parsed);
        if (!result.success) {
          await refundIfConsumed();
          return { success: false, code: "validation_failed", message: "We couldn't read the response. Please try again." };
        }

        // Every scan includes Emotional View — the emotional layer is part of the
        // core product, not a gated upsell.
        const includesInnerView = true;
        const firstFreeScan = !authorizedAccountEmail;

        let innerview: { text: string } | null = null;
        if (includesInnerView) {
          // Build a fresh content array for the InnerView call. We reuse the
          // prepared photos but replace the trailing user instruction —
          // the physical-scan content ends with "Return only the JSON object"
          // which would override the InnerView system prompt and produce JSON
          // instead of the 4 emotional sections.
          const innerviewContent: InnerViewContentBlock[] = [
            { type: "text", text: `${speciesHint}\n\nThere are ${prepared.length} photo${prepared.length === 1 ? "" : "s"} of this pet below. Read them together as one animal — not as four separate areas.` },
          ];
          for (const p of prepared) {
            innerviewContent.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } });
          }
          innerviewContent.push({ type: "text", text: "Please provide an emotional wellness impression based on what you see across these photos. Return only the four plain-text sections specified in the system prompt." });

          try {
            const text = await callInnerViewClaude(innerviewContent);
            innerview = { text };
          } catch (err) {
            console.warn("[scan.innerview] first attempt failed, retrying once...", err);
            try {
              const text = await callInnerViewClaude(innerviewContent);
              innerview = { text };
            } catch (retryErr) {
              // Physical reading already succeeded — soft-fail the second
              // layer so the user still sees their core result.
              console.error("[scan.innerview] generation failed after retry", retryErr);
            }
          }
        }

        const enriched: ScanAnalysis = { ...result.data, innerview, firstFreeScan };

        if (hasDb) {
          if (authorizedAccountEmail) {
            await recordAccountScan({
              email: authorizedAccountEmail,
              scanMode: result.data.species,
              wellnessScore: result.data.overallStatus === "looking_healthy" ? 90 : result.data.overallStatus === "worth_watching" ? 70 : result.data.overallStatus === "share_with_vet" ? 50 : 0,
              summary: result.data.overallNote,
              fullAnalysis: enriched,
            }).catch((e) => console.error("[scan] recordAccountScan failed:", e));
          } else if (input.deviceId) {
            await recordScan({ deviceId: input.deviceId, ip, unlockToken: input.unlockToken, scanMode: "full" }).catch((e) => console.error("[scan] recordScan failed:", e));
          }
        }

        return { success: true, analysis: enriched };
      } catch (err: unknown) {
        const e = err as { status?: number; name?: string; message?: string };
        console.error("[scan.analyze] Claude call failed", { name: e?.name, status: e?.status, message: e?.message });
        if (e?.name === "APIConnectionTimeoutError" || e?.name === "AbortError") {
          await refundIfConsumed();
          return { success: false, code: "upstream_timeout", message: "Reading is taking longer than usual. Try clearer, well-lit photos without glare or shadows." };
        }
        if (e?.status === 429 || e?.status === 529) {
          await refundIfConsumed();
          return { success: false, code: "rate_limited", message: "Our reading model is briefly at capacity. Tap Try again in a moment — your photos are fine." };
        }
        if (e?.status === 400) {
          await refundIfConsumed();
          return { success: false, code: "validation_failed", message: "We couldn't read these photos. Try sharper close-ups in natural light." };
        }
        if (e?.status && e.status >= 500) {
          await refundIfConsumed();
          return { success: false, code: "upstream_error", message: "Our reading model returned an error. Tap Try again — your photos are fine." };
        }
        await refundIfConsumed();
        return { success: false, code: "upstream_error", message: "Something went wrong with the analysis. Try clearer close-ups in good light." };
      }
    }),
});
