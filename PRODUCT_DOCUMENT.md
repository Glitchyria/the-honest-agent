# Product Document — The Honest Agent
**Team Niraya** | Ria Agrawal · Nishan Kashyap
**Hackathon Track:** AI Shopping Agent (Track 1)

---

## 1. The Problem We Are Solving

Online shopping in India is broken in one specific way: **trust**.

Every day, millions of users land on a product page, see 1–3 reviews, a flashy discount badge, and a "Sale ends tonight" timer — and either buy something they'll regret, or abandon the cart entirely out of uncertainty.

The current experience forces users to:
- Open 6 tabs to compare products manually
- Read through hundreds of reviews looking for the one honest one
- Guess whether a new product with few reviews is actually good
- Make decisions under manufactured urgency

Existing AI shopping tools make this worse, not better. They are glorified search bars — they show you more products faster, but they don't help you decide. They are built to serve the store, not the buyer.

**The core insight:** People don't abandon carts because they can't find products. They abandon because they don't trust the recommendation.

---

## 2. Who We Built This For

**Primary user:** An Indian online shopper aged 18–35 who:
- Shops on mobile, often in Hinglish
- Has been burned by a bad purchase at least once
- Doesn't trust "Top Rated" badges or sponsored results
- Wants someone to just tell them honestly: *is this actually good for me?*

**Secondary user:** A Shopify merchant who wants to reduce returns and increase repeat purchases by building genuine buyer trust — not impulse conversions.

**Current experience:** The user searches, gets overwhelmed, applies filters that don't really help, reads reviews that feel fake, and either buys impulsively or leaves. Neither outcome builds loyalty.

---

## 3. What We Built

**The Honest Agent** is an AI shopping agent that acts as the buyer's advocate, not the store's salesperson. It replaces the browse → filter → compare → regret loop with a single honest conversation.

### Core User Journey

**Turn 1:** Agent asks "What's the situation that's making you shop today?" (with quick-reply chips — no typing needed)

**Turn 2:** Agent asks "What's the one thing that would make you return this within a week?" (category-specific chips)

**Turn 3:** Agent surfaces 2–3 products — not the most expensive, not the sponsored ones, but the best match — with full transparency about why.

**Turn 4+:** User can compare, ask follow-ups, check tradeoffs. Agent handles Hinglish naturally.

**Final:** Verdict Card → Cart → Checkout Guardian → Purchase

### Key Features

**Review Autopsy** — Every product card flips to show what people actually loved vs regretted, with hidden use-case mismatches surfaced explicitly. "This product is rated 4.8★ but 23% of complaints mention call quality issues in windy conditions."

**Regret Risk Score** — A traffic-light badge (Low/Medium/High) calculated from review patterns, need-fit, and decision speed. Shown on every product and in the cart.

**Trust Provenance Engine** — Activates automatically when a product has fewer than 5 reviews. Instead of leaving the user stranded, it interrogates seller history, shipping reliability, delivery route, fabric/material origin, and return policy — then delivers an honest verdict. "This dress has 1 review — but here's why I'd still recommend it."

**Impulse Guardian** — Silently tracks behavioral signals (urgency language, budget creep, validation-seeking). If 2+ signals fire, it gently slows the user down before they commit to a purchase they might regret.

**Hinglish Intent Engine** — The agent understands mixed Hindi-English input natively. A user can type "bestie ki shaadi ke liye kuch chahiye, budget tight hai" and the agent extracts occasion, category, budget constraint, and urgency — without asking them to rephrase in English.

**Checkout Guardian** — Before payment, Claude delivers a 10-second honest sign-off: "You told me your main concern was battery life. This product has a consistent weakness there — still want to proceed?" The "Wait, let me think" button is intentionally more prominent than "Proceed."

---

## 4. Key Product Decisions and Reasoning

**Decision: Lead with trust, not speed**
Most shopping agents optimize for showing products faster. We optimized for showing fewer, better products with full reasoning. This felt counterintuitive but matches how people actually make decisions they're happy with.

**Decision: Quick-reply chips over free-text input**
Early design had users typing answers to agent questions. This created friction, especially on mobile. Chips with category-specific options (e.g. "Bad battery / Feels cheap / Overheats" for electronics) reduced drop-off and made the conversation feel more like a poll than an interrogation.

**Decision: Hinglish support as a core feature, not an afterthought**
100 teams will build English-only agents. The Indian market speaks Hinglish. We made the agent respond in the same language the user writes in — no extra NLP library, just a well-crafted system prompt. This cost us nothing to build and gives us a massive differentiation in a demo.

**Decision: 84 products over 150**
We chose quality over quantity. Every product has 15+ human-feeling reviews with specific complaints, realistic Indian pricing, and accurate delivery metadata. Sparse, low-quality data would have undermined the entire "honest" brand of the product.

**Decision: Dual AI (Gemini + Claude)**
We used Google Gemini via AI Studio for the primary conversational layer and Claude for structured analysis tasks. This gave us the best balance of response speed and reasoning depth.

---

## 5. What We Chose NOT to Build (Scope Decisions)

**No user accounts or login** — Authentication would have added 2 days of work for zero demo value. Session state is held in memory per browser session.

**No real Shopify API connection** — We built a rich mock catalog of 84 products instead. The architecture is designed to swap mock data for a real Shopify Storefront API call in one line.

**No payment processing** — Checkout ends at an order confirmation mock. Real payment integration is out of scope for a hackathon.

**No image uploads** — Product images use placeholder URLs. A production version would pull from Shopify CDN.

---

## 6. Tradeoffs We Encountered

**Tradeoff: Honesty vs conversion**
An agent that talks users out of bad purchases might reduce short-term sales. We resolved this by framing honesty as a trust-builder — the agent always offers a better alternative when it flags a concern. Users who trust the agent convert at higher rates on the right product.

**Tradeoff: Feature depth vs demo clarity**
We built 6 features. During demo prep, we realized showing all 6 in 5 minutes is impossible. We prioritized: Trust Provenance Engine (most unique), Hinglish input (most memorable), and Checkout Guardian (most counterintuitive). Other features are visible in the UI but not the primary demo path.

**Tradeoff: Structured chips vs open conversation**
Quick-reply chips make onboarding smooth but limit expressiveness. We resolved this with an "Other — type your own" chip that reveals the text input. Best of both worlds.

---

*Document prepared by Team Niraya — Ria Agrawal (Product & UX) and Nishan Kashyap (Engineering)*
