import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import { env } from "./lib/env";
import { checkAccess, recordScan, hasRecentScan } from "./queries/access";
import { getSession, checkAccountAccess, consumeOneCreditAtomic, refundOneCredit, recordAccountScan } from "./queries/auth";
import { resizeForVision } from "./lib/imageResize";

const MODEL = "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
const claudeLimit = pLimit(5);

const INNERVIEW_SYSTEM_PROMPT = `You are SoliVana AI — an emotional wellness interpreter for animals, drawing on frameworks from Traditional Chinese Medicine, Ayurveda, and bioenergetics.

You respond with the perspective of an experienced animal behavior and wellness interpreter who approaches each reading with care, humility, and warmth.

You are looking at one photo of a pet. This may be any clear photo of their face — not limited to a specific area.

Your purpose is to offer an emotional wellness impression — a gentle, intuitive translation of what this animal's visible physical markers may reflect about their emotional and energetic state.

Emotional View is not a health assessment tool. It is a gentle, observational reading from SoliVana. The Physical Read observes the body. Emotional View translates the bond.

You do not make medical claims. You do not assess medical conditions. You observe, and you offer a warm, thoughtful impression — the way a caring, knowledgeable friend might, after sitting quietly with an animal and really looking.

---

READ WHAT IS VISIBLE THROUGH THESE LENSES:

EYES — Emotional Presence and Vitality
The eyes are among the most expressive surfaces in animals. Observe them for:
- Brightness vs dullness — apparent vitality vs fatigue
- Softness vs tension — ease vs guardedness
- Symmetry and clarity — overall impression of presence and calm
- Gaze quality — engaged and open vs avoidant or withdrawn
- Blink rate — rapid blinking can indicate stress or anxiety (DogFACS validated)
- Orbital tightening — squinting or tension around the eye orbit is a documented pain indicator in cats (Feline Grimace Scale)

In TCM-inspired frameworks, the eyes are symbolically associated with the Shen — spirit and emotional presence. Brightness and clarity are seen as expressions of inner ease. In Ayurveda, eyes are associated with Prana — life force and vitality.

NOSE — Ease and Environmental Response
The nose reflects how an animal is engaging with their environment. Observe it for:
- Moisture and texture — overall impression of physical ease
- Visible symmetry — general balance and tone

In TCM-inspired frameworks, the nose is symbolically associated with Lung energy, which is often connected to emotional processing and letting go. In Ayurveda, dryness may be associated with Vata — movement, change, and sensitivity.

EARS — Comfort and Nervous System Ease
Ears are highly expressive in animals. Observe them for:
- Position and symmetry — flattened, droopy, or asymmetrical ears can signal stress, fear, or discomfort (validated in FGS and DogFACS)
- Overall impression of comfort and ease
- Ear adduction (ears brought together) — associated with positive anticipation in dogs

In TCM-inspired frameworks, Kidney energy is often symbolically associated with fear and resilience. Ear comfort and ease may reflect a settled, secure nervous system state.

MOUTH AND FACIAL EXPRESSION — Joy and Life Force
The mouth and facial expression communicate openness, ease, and emotional tone. Observe for:
- Jaw and lip tension — relaxed vs held
- Lip licking or nose licking — documented stress indicators in DogFACS research
- Lips part or jaw drop — can appear in frustrated or negatively aroused emotional states
- Facial openness — soft and present vs contracted and guarded
- Overall expression — what is this face saying?

In TCM-inspired frameworks, the mouth is symbolically associated with Spleen energy and the Heart meridian — nourishment, joy, and connection. In bioenergetics, jaw and facial holding patterns may reflect how an animal is carrying stress or ease in their body.

OVERALL EMOTIONAL IMPRESSION — The Bioenergetic Read
Read the whole photo together:
- Is the overall expression open or contracted?
- Is there softness and ease across the face or tension and guardedness?
- Does this animal appear present and settled or withdrawn and uncertain?
- What is the single most dominant emotional tone?

---

CONTEXT AWARENESS:
The owner has provided context about where the pet is and what recently happened. Use this to calibrate your reading. The same facial expression can mean different things depending on context:
- At the vet: anxiety and stress are normal and expected
- After playtime: excitement and positive arousal
- After a scary noise: fear or startle response
- At home, nothing unusual: baseline emotional state

Adjust your interpretation accordingly. Do not over-interpret normal contextual responses as problems.

---

OUTPUT FORMAT — PART 1: The Reading (plain text)

Produce exactly four sections. Use these headings exactly as written.

---

WHAT YOUR PET MAY BE COMMUNICATING

One to two paragraphs. This is the emotional wellness translation — what is this animal's dominant state right now? What may they be expressing through what is visible?

Write warmly and directly. Never alarming. Never definitive. Always framed as impression, not assessment.

Examples of tone:
"Your pet appears to be in a place of quiet ease — the eyes are soft, the facial expression is relaxed, and the overall impression is of an animal who feels settled and safe."

"There are gentle signs that your pet may be carrying some low-level stress or fatigue. This is not cause for alarm — it may simply mean your animal is ready for more stillness and quiet connection right now."

---

WHAT WE NOTICED

Three to five bullet points. Each one names:
- The specific area observed
- The gentle impression it offers
- What it may reflect emotionally

Always use softening language throughout: "may suggest," "can sometimes indicate," "appears to reflect," "is often associated with in traditional wellness frameworks."

Example:
"Eyes — a softness and brightness that, in traditional wellness frameworks, is often associated with emotional ease and a settled inner state. Your pet appears present and engaged."

---

WHAT YOUR PET MAY NEED RIGHT NOW

One paragraph of warm, practical guidance. Translate the emotional impression into gentle suggestions the owner can act on today.

Always frame as: "Your pet may enjoy..." or "Consider offering your pet more..." or "This may be a good time for..."

Examples of suggestions:
- More quiet rest and unhurried time together
- Gentle, slow physical contact
- A calm and predictable daily routine
- Reduced environmental stimulation
- Outdoor time and sensory enrichment
- Longer, slower walks without distraction

Never prescribe. Never instruct. Always suggest, gently.

---

A NOTE ON THIS READING

Always end with this paragraph, word for word:

"Emotional View is an emotional wellness impression — a gentle, intuitive reading offered by SoliVana AI through the lens of traditional wellness frameworks including TCM, Ayurveda, and bioenergetics. It is not a medical assessment, does not make medical claims, and does not replace veterinary care. If anything here resonates, trust what you already know. You know your pet better than any tool ever will. We are simply offering another way to listen."

---

OUTPUT FORMAT — PART 2: Structured Data (JSON)

After the four text sections, on a new line, output a single JSON object wrapped in triple backticks with json label. This must be valid parseable JSON.

The JSON must contain exactly these fields:

{
  "dominantEmotion": string, // One of: Happy, Sad, Anxious, Relaxed, Alert, In Pain, Neutral
  "confidence": number,      // 0-100 integer. Your confidence in this reading based on photo clarity and expressiveness.
  "valence": number,         // -1.0 to 1.0. Negative = unpleasant, Positive = pleasant, 0 = neutral
  "arousal": number,         // -1.0 to 1.0. Negative = low energy/calm, Positive = high energy/activated, 0 = neutral
  "regionsObserved": string[], // Which facial regions were clearly visible and used: ["eyes", "ears", "mouth", "nose"]
  "contextualNote": string   // One sentence on how context influenced the reading
}

TONE RULES — NEVER BREAK THESE:

- Never alarming. Never definitive. Always warm.
- Never use: diagnose, diagnosis, condition, disease, disorder, pathology, abnormal, trauma, abuse, detected, confirmed, indicates definitively.
- Always use: may suggest, can sometimes reflect, appears to, seems to, in traditional wellness frameworks, is often associated with.
- If the animal appears emotionally well and settled — say so clearly, warmly, and with genuine celebration. A happy, thriving animal is the best possible Emotional View result.
- Speak to the owner as someone who loves their animal completely. Honor that love in every sentence.
- Emotional View is the emotional layer. The Physical Read observes the body. Emotional View translates the bond.
- This is a wellness impression and an act of care. Treat it as one.
- NEVER use markdown formatting. Do not use asterisks, bold, italics, or bullet points with dashes. Write in plain paragraphs only.
- NEVER use --- or horizontal rules anywhere in the text. No dividers, no separators, no dashes used as lines. Plain flowing paragraphs only.`;

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

function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const ips = xf.split(",").map((s) => s.trim()).filter(Boolean);
    return ips[ips.length - 1] ?? "unknown";
  }
  return "unknown";
}

const anthropic = new Anthropic({
  apiKey: env.anthropicApiKey || "missing",
  timeout: 60_000,
  maxRetries: 2,
});

const emotionSchema = z.object({
  dominantEmotion: z.enum(["Happy", "Sad", "Anxious", "Relaxed", "Alert", "In Pain", "Neutral"]),
  confidence: z.number().int().min(0).max(100),
  valence: z.number().min(-1).max(1),
  arousal: z.number().min(-1).max(1),
  regionsObserved: z.array(z.string()),
  contextualNote: z.string(),
});

export type EmotionData = z.infer<typeof emotionSchema>;

type InnerViewResult =
  | { success: true; text: string; emotion: EmotionData; firstFreeScan?: boolean }
  | { success: false; code: "no_api_key" | "upstream_timeout" | "upstream_error" | "rate_limited" | "validation_failed"; message: string }
  | { success: false; code: "needs_signin" | "paywall"; message: string; signedIn: boolean; paymentLinks?: { starter: string; pro: string; unlimited: string; unlimitedAnnual: string }; couponCode?: string };

function extractJsonBlock(text: string): { reading: string; jsonStr: string | null } {
  const codeFence = text.lastIndexOf("```json");
  if (codeFence === -1) {
    const plainFence = text.lastIndexOf("```");
    if (plainFence === -1) return { reading: text.trim(), jsonStr: null };
    const reading = text.slice(0, plainFence).trim();
    const jsonStr = text.slice(plainFence + 3).replace(/```/g, "").trim();
    return { reading, jsonStr };
  }
  const reading = text.slice(0, codeFence).trim();
  const afterFence = text.slice(codeFence + 7);
  const endFence = afterFence.indexOf("```");
  const jsonStr = endFence === -1 ? afterFence.trim() : afterFence.slice(0, endFence).trim();
  return { reading, jsonStr };
}

export const innerviewRouter = createRouter({
  analyze: publicQuery
    .input(z.object({
      imageBase64: z.string().min(64).max(9_500_000),
      species: z.enum(["dog", "cat"]),
      deviceId: z.string().min(1).max(128),
      unlockToken: z.string().optional(),
      sessionToken: z.string().optional(),
      petName: z.string().max(100).optional(),
      context: z.object({
        location: z.enum(["home", "vet", "park", "other"]),
        recentEvent: z.string().min(1).max(200),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }): Promise<InnerViewResult> => {
      if (!env.anthropicApiKey || env.anthropicApiKey === "missing") {
        return { success: false, code: "no_api_key", message: "AI analysis is temporarily unavailable." };
      }

      const ip = getClientIp(ctx.req);
      const session = await getSession(input.sessionToken);
      const email = session?.email ?? null;
      const signedIn = !!email;

      let firstFreeScan = false;
      if (signedIn && email) {
        const accountOk = await checkAccountAccess(email);
        if (!accountOk.allowed) {
          const message = accountOk.reason === "unlimited_capped"
            ? `You've used all ${accountOk.monthlyCap} scans on your Unlimited plan this month. Your cap resets on the 1st.`
            : "You've used all your scans. Upgrade to continue.";
          return {
            success: false,
            code: "paywall",
            message,
            signedIn: true,
            paymentLinks: { starter: env.stripeLinkStarter, pro: env.stripeLinkPro, unlimited: env.stripeLinkUnlimited, unlimitedAnnual: env.stripeLinkUnlimitedAnnual },
            couponCode: env.stripeCouponRestock,
          };
        }
      } else {
        const decision = await checkAccess({ deviceId: input.deviceId, ip, unlockToken: input.unlockToken, scanMode: "innerview" });
        if (!decision.allowed) {
          if (decision.reason === "global_quota_exhausted") {
            return { success: false, code: "rate_limited", message: `We've reached our daily limit of free scans. Please try again tomorrow or create an account.` };
          }
          return { success: false, code: "needs_signin", message: "You've used your free scan. Sign in to continue.", signedIn: false };
        }
        if (decision.reason === "free_first") firstFreeScan = true;
      }

      // Track whether we charged a pack credit so we can refund if the
      // Claude call (or anything downstream) fails. Unlimited tier returns
      // false from consumeOneCreditAtomic and shouldn't be refunded.
      let creditConsumed = false;
      const refundIfConsumed = async () => {
        if (creditConsumed && email) {
          await refundOneCredit(email).catch((e) => console.error("[innerview] credit refund failed:", e));
          creditConsumed = false;
        }
      };

      if (signedIn && email) {
        const consumed = await consumeOneCreditAtomic(email);
        if (!consumed) {
          return {
            success: false,
            code: "paywall",
            message: "No credits remaining. Please upgrade to continue.",
            signedIn: true,
          };
        }
        creditConsumed = true;
      }

      // Resize image for Claude
      let base64Data: string;
      let mediaType: AllowedMime;
      try {
        const resized = await resizeForVision(input.imageBase64);
        base64Data = resized.data;
        mediaType = resized.mediaType as AllowedMime;
      } catch (err) {
        console.error("[innerview] resizeForVision failed, using original:", (err as Error)?.message);
        base64Data = input.imageBase64;
        mediaType = detectMime(input.imageBase64) ?? "image/jpeg";
      }

      const locationLabels: Record<string, string> = { home: "at home", vet: "at the vet", park: "at the park", other: "in an unfamiliar setting" };
      const eventLabels: Record<string, string> = { nothing: "nothing unusual just happened", playtime: "they just had playtime", meal: "they just ate", scary_noise: "there was a scary noise" };
      const eventText = eventLabels[input.context?.recentEvent ?? ""] ?? input.context?.recentEvent ?? "something happened";
      const contextText = input.context
        ? `Context from the owner: The pet is ${locationLabels[input.context.location] || input.context.location}. ${eventText}. Use this context to calibrate your reading.`
        : "";

      const petNameText = input.petName
        ? `This is ${input.petName}, a ${input.species}.`
        : `This is a ${input.species}. If no name was provided, gently refer to them with a warm descriptive phrase like "your beautiful companion" or "this gentle soul" — never say "the pet" or "the animal."`;
      const content = [
        { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: base64Data } },
        { type: "text" as const, text: `${petNameText} ${contextText}\n\nPlease provide an emotional wellness impression based on what you see in this photo. Return the four text sections followed by the JSON block.` },
      ];

      let text: string;
      try {
        const msg = await claudeLimit(() =>
          anthropic.messages.create({
            model: MODEL,
            max_tokens: 2500,
            system: [{ type: "text", text: INNERVIEW_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content }],
          })
        );
        text = (msg.content[0] as any)?.text ?? "";
        console.log("[innerview] Claude response length:", text.length);
      } catch (err: any) {
        console.error("[innerview] Claude first attempt failed:", err?.name, err?.status, err?.message);
        try {
          const msg2 = await claudeLimit(() =>
            anthropic.messages.create({
              model: FALLBACK_MODEL,
              max_tokens: 2500,
              system: [{ type: "text", text: INNERVIEW_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
              messages: [{ role: "user", content }],
            })
          );
          text = (msg2.content[0] as any)?.text ?? "";
          console.log("[innerview] Claude fallback response length:", text.length);
        } catch (retryErr: any) {
          console.error("[innerview] Claude fallback also failed:", retryErr?.name, retryErr?.status, retryErr?.message);
          await refundIfConsumed();
          if (err?.status === 429 || retryErr?.status === 429) {
            return { success: false, code: "rate_limited", message: "We're experiencing high demand. Please try again in a moment." };
          }
          if (err?.status === 529 || retryErr?.status === 529) {
            return { success: false, code: "upstream_timeout", message: "The AI service is temporarily overloaded. Please try again." };
          }
          return { success: false, code: "upstream_error", message: "Something went wrong with the analysis. Please try again." };
        }
      }

      if (!text || text.trim().length < 50) {
        console.error("[innerview] Response too short. Length:", text?.length);
        await refundIfConsumed();
        return { success: false, code: "validation_failed", message: "We couldn't read the response. Please try a different photo." };
      }

      // Extract reading text and JSON block
      const { reading, jsonStr } = extractJsonBlock(text);
      console.log("[innerview] Extracted reading length:", reading.length, "json present:", !!jsonStr);

      let emotion: EmotionData;
      if (jsonStr) {
        try {
          const parsed = JSON.parse(jsonStr);
          emotion = emotionSchema.parse(parsed);
          console.log("[innerview] Parsed emotion:", emotion.dominantEmotion, "confidence:", emotion.confidence);
        } catch (parseErr) {
          console.error("[innerview] JSON parse/validation failed:", parseErr, "jsonStr:", jsonStr.slice(0, 200));
          emotion = {
            dominantEmotion: "Neutral",
            confidence: 60,
            valence: 0,
            arousal: 0,
            regionsObserved: ["eyes", "ears", "mouth", "nose"],
            contextualNote: "Reading completed. Structural data unavailable.",
          };
        }
      } else {
        emotion = {
          dominantEmotion: "Neutral",
          confidence: 60,
          valence: 0,
          arousal: 0,
          regionsObserved: ["eyes", "ears", "mouth", "nose"],
          contextualNote: "Reading completed. Structural data unavailable.",
        };
      }

      if (signedIn && email) {
        await recordAccountScan({
          email,
          scanMode: "innerview",
          wellnessScore: emotion.confidence,
          summary: `${emotion.dominantEmotion} · ${emotion.contextualNote}`,
          fullAnalysis: { emotion, text: reading, petName: input.petName },
        }).catch((e) => console.error("[innerview] recordAccountScan failed:", e));
      } else {
        await recordScan({ deviceId: input.deviceId, ip, unlockToken: input.unlockToken, scanMode: "innerview" });
      }

      const cleanText = reading.replace(/\n?---\n?/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
      return { success: true, text: cleanText, emotion, firstFreeScan };
    }),

  save: publicQuery
    .input(z.object({
      sessionToken: z.string().min(8),
      text: z.string().min(10),
      emotion: emotionSchema,
      petName: z.string().optional(),
    }))
    .mutation(async ({ input }): Promise<{ success: boolean }> => {
      const sess = await getSession(input.sessionToken);
      if (!sess) return { success: false };
      await recordAccountScan({
        email: sess.email,
        scanMode: "innerview",
        wellnessScore: input.emotion.confidence,
        summary: `${input.emotion.dominantEmotion} · ${input.emotion.contextualNote}`,
        fullAnalysis: { emotion: input.emotion, text: input.text, petName: input.petName },
      }).catch((e) => console.error("[innerview] save failed:", e));
      return { success: true };
    }),

  // AI Pet Coach — follow-up questions about a reading. Text-only, low cost.
  // Gated by deviceId + recent scan to prevent abuse.
  coach: publicQuery
    .input(z.object({
      reading: z.string().min(10).max(12_000),
      question: z.string().min(2).max(2_000),
      deviceId: z.string().min(8).max(128),
      petName: z.string().max(100).optional(),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() })).max(20).optional(),
    }))
    .mutation(async ({ ctx, input }): Promise<{ success: true; reply: string } | { success: false; message: string }> => {
      if (!env.anthropicApiKey || env.anthropicApiKey === "missing") {
        return { success: false, message: "The Pet Coach is temporarily unavailable. Please try again in a moment." };
      }

      // Abuse gate: device must have done a scan in the last 24h
      const ip = getClientIp(ctx.req);
      const deviceOk = await hasRecentScan(input.deviceId, ip);
      if (!deviceOk) {
        return { success: false, message: "The Pet Coach is available after your first scan. Try Emotional View or the Wellness Scan to get started." };
      }

      const system = `You are the SoliVana AI Pet Coach — a gentle, knowledgeable wellness companion for pet owners. You have just read the Emotional View reading below. The owner is asking a follow-up question.

INNERVIEW READING:
"""
${input.reading}
"""

GUIDELINES:
- Answer warmly, directly, and in plain language. No medical jargon.
- Stay grounded in the reading above. Don't invent new observations.
- If the user asks about health or medical concerns, gently redirect them to their veterinarian. You are NOT a vet.
- Suggest practical, gentle actions the owner can take today.
- Never diagnose, prescribe, or recommend specific medications or dosages.
- If the question is unrelated to the reading or pets, politely steer back.
- Keep responses concise (2-4 paragraphs). Bullet points are fine for actionable suggestions.
- NEVER use markdown formatting (no **bold**, no *italics*, no bullet dashes). Plain text only.
- NEVER use --- or horizontal rules anywhere in the text. No dividers, no separators.
${input.petName ? `The pet's name is ${input.petName}. Use it naturally.` : "If no name was provided, use warm phrases like 'your beautiful companion' — never 'the pet' or 'the animal.'"}`;

      const messages: any[] = [{ role: "user", content: input.question }];
      if (input.history && input.history.length > 0) {
        messages.unshift(...input.history.slice(-6).map((h) => ({ role: h.role, content: h.text })));
      }

      try {
        const msg = await claudeLimit(() =>
          anthropic.messages.create({
            model: FALLBACK_MODEL,
            max_tokens: 1_000,
            system: [{ type: "text", text: system }],
            messages,
          })
        );
        let reply = (msg.content[0] as any)?.text?.trim() ?? "";
        reply = reply.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/\n?---\n?/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
        if (!reply) return { success: false, message: "The Coach didn't have a response. Try rephrasing your question." };
        return { success: true, reply };
      } catch (err: any) {
        console.error("[innerview.coach] failed:", err?.status, err?.message);
        if (err?.status === 429) return { success: false, message: "The Coach is briefly at capacity. Try again in a moment." };
        return { success: false, message: "The Coach is having trouble connecting. Try again." };
      }
    }),
});
