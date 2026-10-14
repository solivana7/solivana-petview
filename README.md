# PetView by SoliVana

**AI instruments that measure wellness — for the pets you love.**

Live at [petview.solivana.io](https://petview.solivana.io)

## The problem

Pet owners lack early wellness signals. A dog who seems unusually low-energy or a cat hiding pain (cats are evolutionarily wired to mask it) rarely shows dramatic symptoms until something is advanced. Annual vet visits leave long gaps where subtle changes in eyes, nose, mouth, ears, and coat go unnoticed — and most owners don't know which observations are worth acting on.

## The approach

PetView reads what is visible in four smartphone photos — eyes, nose, mouth, and ears — and returns plain-English observations grounded in peer-reviewed veterinary frameworks (Feline Grimace Scale, DogFACS, validated pain-assessment research).

- **4-photo intake** — one guided photo per anatomical area, with capture tips and reference images.
- **Claude Vision observations** — per-area readings of what is visible, plus "worth watching" and "see a vet" indicators, written to be shared with a veterinarian.
- **Emotional View** — an additional AI reading of the pet's visible emotional state and energy, using the same photo set.
- **AI Pet Coach** — a follow-up chat grounded in the completed reading, so owners can ask "what does this mean?" in plain language.

## Engineering highlights

- **Stripe checkout + subscriptions** — one-time scan packs and recurring plans via Stripe Checkout/Portal, with **webhook signature verification** (`constructEvent`) driving entitlement fulfillment.
- **Atomic credit consumption with refund-on-failure** — a credit is consumed in a single atomic operation; if the AI call or persistence fails downstream, the credit is refunded (`consumeOneCreditAtomic` / `refundOneCredit`).
- **CSP + security headers** — strict Content-Security-Policy, HSTS, referrer, and permissions policies via `hono/secure-headers`.
- **IP rate limiting** — sliding-window per-IP buckets with automatic cleanup, applied to sensitive endpoints including magic-link requests.
- **Passwordless auth** — magic-link sign-in tokens generated with `randomBytes(24)`, single-use, 24-hour expiry, path-based (robust against email-client query-string stripping).

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend  | Hono + tRPC 11 + Node.js 20 (Docker) |
| AI       | Claude Vision (Anthropic SDK) |
| Payments | Stripe (Checkout, Portal, webhooks) |
| Email    | Resend (magic links, ops alerts) |
| Database | Postgres + Drizzle ORM |

## Disclaimer

PetView is a photo-based wellness observation tool. **It is not a veterinary diagnostic device, does not diagnose any condition, and is not a substitute for licensed veterinary care.** Always consult your veterinarian for diagnosis and treatment decisions. Emotional View is an AI-generated reading of visible cues — not a medical or behavioral diagnosis.

---

Portfolio — code shared for review, not licensed for reuse.
