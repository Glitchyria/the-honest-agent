# Technical Document — The Honest Agent
**Team Niraya** | Ria Agrawal · Nishan Kashyap

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Client)                  │
│  React-style Vanilla JS + Tailwind CSS               │
│  public/app.js — state machine + render functions    │
│  public/styles.css — all UI styling                  │
│  public/index.html — single page shell               │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP (fetch API)
                   ▼
┌─────────────────────────────────────────────────────┐
│                 NODE.JS SERVER (Express)             │
│  server.js — all backend logic                       │
│                                                      │
│  Routes:                                             │
│  GET  /api/products        — filtered catalog query  │
│  GET  /api/products/:id    — single product detail   │
│  POST /api/chat            — AI conversation         │
│  POST /api/verdict         — generate verdict card   │
│  POST /api/checkout        — checkout guardian       │
│  POST /api/wardrobe-check  — outfit compatibility    │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────┐
│  data/catalog.json│   │     GEMINI API (Google)      │
│  84 products      │   │  gemini-2.0-flash model      │
│  ~15 reviews each │   │  Conversational AI layer     │
│  Full metadata    │   │  Intent extraction           │
└──────────────────┘   │  Review analysis             │
                        │  Verdict generation          │
                        └──────────────────────────────┘
```

---

## 2. Components and Data Flow

### Frontend (public/app.js)
Single-file vanilla JS application using a centralized `state` object. No framework, no build step — runs directly in the browser.

**State object holds:**
- `products` — full filtered product list from last API call
- `visible` — products currently shown in listing
- `messages` — full conversation history for AI context
- `filters` — all active sidebar filter values
- `cart` — items added to cart
- `impulse` — boolean flag for impulse guardian banner
- `sessionId` — UUID per browser session for server-side memory

**Render cycle:** Every state change calls `render()` which rebuilds the entire DOM. Simple and reliable for a hackathon scope.

### Backend (server.js)
Single-file Express server using ES modules (`import/export`).

**Key functions:**
- `parseIntent(text)` — extracts brand, budget, category, connectivity, use_case from natural language. Deterministic regex + keyword matching. Does NOT use AI.
- `filterProducts(intent, extra)` — applies all filters to catalog array. Fully deterministic.
- `scoreProduct(product, intent)` — ranks products by relevance score. Deterministic formula based on trust_score, rating, brand match, use_case match.
- `getSession(id)` — returns or creates in-memory session with conversation history and signal tracking.
- `updateSignals(session, message)` — scans message for urgency/validation keywords to power Impulse Guardian.

### AI / Deterministic Boundary

This is the most important architectural decision in the system:

| Task | Handled by | Reason |
|------|-----------|--------|
| Brand extraction from query | Deterministic (regex) | Needs to be 100% reliable |
| Budget extraction | Deterministic (regex) | Must never exceed stated budget |
| Category filtering | Deterministic | Accuracy critical |
| Product ranking | Deterministic (score formula) | Consistent, explainable |
| Conversation response | Gemini AI | Natural language needed |
| Review autopsy summary | Gemini AI | Synthesis task |
| Verdict card generation | Gemini AI | Reasoning task |
| Impulse signal detection | Deterministic (keyword list) | Speed critical, no latency |
| Provenance card content | Template + product data | Structured, not generative |

**Why this boundary matters:** Early versions let the AI handle filtering. It occasionally showed products above the stated budget or wrong categories. Moving filtering to deterministic code fixed this completely. The AI now only handles language — never data selection.

---

## 3. Key Implementation Decisions

### Session Memory
Each browser session gets a server-side session object containing:
```js
{
  history: [],           // last 6 message pairs sent to AI
  urgencySignals: [],    // detected urgency keywords
  validationSignals: [], // detected validation-seeking phrases
  concern: null,         // user's stated return concern
  lastResponses: []      // prevents repeated AI responses
}
```
No database. Sessions live in a `Map()` in server memory. Reset on server restart — acceptable for hackathon scope.

### Quick-Reply Chips
Chips are rendered as part of each AI message object. The message schema:
```js
{ role: "ai", text: "...", quickReplies: ["Option A", "Option B", "Other"] }
```
When a chip is clicked, it calls `sendMessage()` with the chip text — identical to the user typing it. The `quickRepliesAnswered` flag prevents chips from re-rendering after selection.

### Trust Provenance Engine Trigger
```js
// Triggers when review_count < 5
if (product.review_count < 5) {
  // Show provenance card instead of review autopsy
  renderProvenanceCard(product);
}
```
Provenance data (seller history, route, carrier, fabric) is stored directly in the product JSON for mock purposes. In production, this would call Shopify's merchant API and a shipping carrier API.

### Hinglish Support
Implemented entirely via system prompt instruction to Gemini:
```
You will receive messages in Hindi, English, or mixed Hinglish.
Always respond in the same language the user used.
Extract shopping intent regardless of language.
Never ask the user to rephrase in English.
```
No translation API. No NLP library. Zero additional cost or latency.

---

## 4. Failure Handling

### When Gemini API is down
- Server catches the error and returns a fallback deterministic response
- Products are still shown based on `parseIntent()` + `filterProducts()`
- User sees: "I'm having trouble connecting — here are my best picks based on what you told me." followed by top 3 scored products
- Cart and checkout still work fully without AI

### When AI returns malformed response
```js
try {
  const parsed = extractProductIds(aiResponse);
  if (!parsed.length) throw new Error("No product IDs");
  displayProducts(parsed);
} catch {
  // Fall back to top scored products from filterProducts()
  displayProducts(topScoredFallback);
}
```
We look for `PRODUCTS:[id1,id2,id3]` in AI responses. If absent or malformed, we fall back to the deterministic ranking. The user never sees an error — they see products.

### When user input is unexpected
- Gibberish input → `parseIntent()` returns empty intent → `filterProducts()` returns all products sorted by trust score
- Extremely long input → truncated to 500 chars before sending to AI
- Offensive input → Gemini's built-in safety filters handle it; server returns a neutral redirect message

### When catalog product is missing
```js
const product = productById(id);
if (!product) return res.status(404).json({ error: "Product not found" });
```
Frontend checks for null product before rendering detail page and redirects to listing if missing.

---

## 5. Known Limitations

**In-memory sessions** — Server restart clears all sessions. In production, sessions would be stored in Redis or a database.

**Mock catalog** — 84 products with realistic but fabricated data. Real deployment would connect to Shopify Storefront GraphQL API:
```js
// One-line swap in filterProducts():
// const products = await shopifyClient.query(PRODUCTS_QUERY);
```

**No real shipping data** — Delivery estimates and routes in the Provenance Engine are mock data. Production would integrate Delhivery/Shiprocket API.

**No image CDN** — Product images are placeholder URLs. Production would use Shopify's image CDN.

**Single-threaded session store** — The in-memory Map works for demo but would not scale horizontally. Production needs Redis.

---

## 6. What We Would Improve With More Time

1. Real Shopify Storefront API integration (already architected for it)
2. Persistent sessions with Redis
3. Real review scraping via web search API
4. Actual shipping carrier API for live delivery estimates
5. User accounts with purchase history for personalized recommendations
6. A/B testing framework to measure whether honest recommendations actually reduce returns

---

*Document prepared by Team Niraya — Ria Agrawal (Product & UX) and Nishan Kashyap (Engineering)*
