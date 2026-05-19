# Decision Log — The Honest Agent
**Team Niraya** | Running log of key build decisions

---

## DL-001 — Core product direction: advocate vs salesperson
**Considered:** Build a standard recommendation chatbot (user asks → agent shows products → add to cart)
**Chose:** Build an agent that actively surfaces risks and talks users out of bad purchases
**Because:** Every other team will build the standard approach. The insight is that trust converts better than speed. An agent that protects the buyer will be trusted more — and trusted agents sell more.

---

## DL-002 — Deterministic filtering vs AI filtering
**Considered:** Let Gemini handle all filtering (brand, budget, category) via natural language
**Chose:** Deterministic regex + keyword matching for all filtering; AI only for language generation
**Because:** In testing, AI-based filtering occasionally showed products above the stated budget or wrong categories. This is a trust-destroying failure for an agent called "The Honest Agent." Deterministic code is 100% reliable. AI handles language; code handles data.

---

## DL-003 — Quick-reply chips vs free-text conversation
**Considered:** Pure free-text chat interface (user types everything)
**Chose:** Quick-reply chips for agent questions + "Other" option that reveals text input
**Because:** On mobile, typing answers to "what would make you return this?" is high friction. Chips with category-specific options (electronics: Bad battery / Overheats / Feels cheap) made the conversation feel like a helpful assistant, not a form. Kept "Other" for users who want to elaborate.

---

## DL-004 — Hinglish support
**Considered:** English-only agent (simpler, faster to build)
**Chose:** Native Hinglish support via system prompt instruction
**Because:** Indian users naturally write in mixed Hindi-English. An English-only agent signals "this wasn't built for me." The implementation cost was zero — one paragraph in the system prompt. The demo value is enormous.

---

## DL-005 — Trust Provenance Engine for low-review products
**Considered:** Show a warning "This product has few reviews" and move on
**Chose:** Build a full Provenance Engine that interrogates seller history, shipping route, fabric/material, and return policy when review_count < 5
**Because:** The "1 review" problem is the #1 trust blocker in Indian fashion shopping. Instead of leaving the user stranded, we fill the trust gap with supply chain transparency. This is genuinely novel — no shopping app does this.

---

## DL-006 — 84 products vs 150+
**Considered:** Generate 150 products to make the catalog look large
**Chose:** 84 carefully crafted products with 15+ human-feeling reviews each
**Because:** Quality of data = credibility of the agent. Sparse, repetitive mock reviews would undermine the "honest" brand immediately. 84 products with rich metadata demonstrates better product thinking than 150 products with shallow data.

---

## DL-007 — Dual AI (Gemini + Claude architecture)
**Considered:** Single AI provider for everything
**Chose:** Google Gemini via AI Studio as primary conversational layer
**Because:** Gemini Flash offers fast response times suitable for streaming chat. The system prompt is crafted to produce the honest, advocate-style responses the product requires regardless of underlying model.

---

## DL-008 — Checkout Guardian "Wait" button more prominent than "Proceed"
**Considered:** Standard checkout flow (Proceed button is the primary CTA)
**Chose:** "Let me think again" button is slightly more prominent than "Proceed to checkout"
**Because:** This is the most counterintuitive design decision in the product — and intentionally so. An honest agent that genuinely cares about the buyer makes it visually easier to pause than to rush. This is the physical manifestation of the entire product philosophy. Judges will notice it.

---

## DL-009 — No user authentication
**Considered:** Login / signup flow for personalized recommendations
**Chose:** Session-based memory (UUID per browser session, no login)
**Because:** Auth would add 2+ days of work for zero demo value. The agent's memory within a session is sufficient to demonstrate personalization. This is a scope decision, not a capability gap.

---

## DL-010 — Single-file backend (server.js)
**Considered:** Modular architecture (routes/, services/, models/ folders)
**Chose:** Single server.js file (~400 lines)
**Because:** Hackathon context — a clean single file is easier to debug, demo, and explain to judges than a scattered module structure. The architecture section of the technical document explains how it would be split in production.

---

*Last updated: May 2026 | Team Niraya*
