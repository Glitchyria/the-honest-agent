import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const fetchImpl = await loadFetch();
const express = await loadExpress();
const cors = await loadCors();
const catalog = JSON.parse(await readFile(path.join(__dirname, "data", "catalog.json"), "utf8"));
const catalogBrands = [...new Set(catalog.products.map((product) => lc(product.brand)))].sort((a, b) => b.length - a.length);
const watchedExternalBrands = ["nike", "adidas", "puma", "lenovo", "samsung", "apple", "sony", "jbl", "boat", "hp", "dell", "asus", "acer", "oneplus", "redmi", "vivo", "oppo"];
const sessions = new Map();

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

function getSession(id = "demo") {
  if (!sessions.has(id)) {
    sessions.set(id, {
      history: [],
      highlighted: [],
      cart: [],
      concern: "avoiding a poor fit",
      urgencySignals: [],
      validationSignals: [],
      lastResponses: []
    });
  }
  return sessions.get(id);
}

function lc(text = "") {
  return String(text).toLowerCase();
}

function detectBrand(message) {
  const text = ` ${lc(message)} `;
  const brand = catalogBrands.find((name) => text.includes(` ${name} `) || text.includes(name.replace(/\s+/g, "")));
  if (brand) return { brand, inCatalog: true };
  const missing = watchedExternalBrands.find((name) => text.includes(` ${name} `));
  return missing ? { brand: missing, inCatalog: false } : { brand: null, inCatalog: false };
}

function parseBudget(text) {
  const t = lc(text).replace(/,/g, "");
  const within = t.match(/(?:within|under|below|less than|up to|upto|max|maximum)\s*(?:₹|rs\.?|inr)?\s*(\d{3,7})/);
  if (within) return Number(within[1]);
  const k = t.match(/(?:under|below|less than|budget|upto|up to|₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(Number(k[1]) * 1000);
  const direct = t.match(/(?:under|below|less than|budget|upto|up to|₹|rs\.?|inr)\s*(\d{3,7})/);
  if (direct) return Number(direct[1]);
  const suffix = t.match(/(\d{3,7})\s*(?:budget|se kam|tak|or less|under|below)/);
  return suffix ? Number(suffix[1]) : null;
}

function parseIntent(message) {
  const t = lc(message);
  const includes = (items) => items.some((item) => t.includes(item));
  const brandIntent = detectBrand(message);
  const intent = { connectivity: null, budget: parseBudget(t), category: null, use_case: [], query: message, brand: brandIntent.inCatalog ? brandIntent.brand : null, missingBrand: brandIntent.inCatalog ? null : brandIntent.brand };

  if (includes(["wired", "3.5mm", "wire ", "wire-", "cable", "taar"])) intent.connectivity = "wired";
  if (includes(["wireless", "bluetooth", "tws", "airpods", "buds"])) intent.connectivity = "wireless";

  if (includes(["earphone", "earphones", "earbud", "earbuds", "headphone", "headphones", "airpods", "airdopes", "buds"])) intent.category = "Audio & Earphones";
  else if (includes(["laptop", "computer", "coding", "developer", "macbook"])) intent.category = "Laptops & Computers";
  else if (includes(["smartphone", "iphone", "samsung", "oneplus", "pixel", "mobile"]) || /\bphone\b/.test(t)) intent.category = "Smartphones";
  else if (includes(["watch", "wearable", "smartwatch"])) intent.category = "Wearables & Smartwatches";
  else if (includes(["dress", "shirt", "chinos", "tee", "kurti", "blazer", "jacket", "lehenga", "outfit", "wardrobe", "bangles", "necklace", "jewelry"])) intent.category = "Fashion & Clothing";
  else if (includes(["chair", "desk", "home", "furniture", "lights", "purifier", "kettle", "air fryer"])) intent.category = "Home & Furniture";

  const useMap = {
    outdoor: ["outdoor", "traffic", "walking"],
    studio: ["studio", "mixing", "editing"],
    gym: ["gym", "workout", "running"],
    commute: ["commute", "travel", "metro", "daily"],
    gaming: ["gaming", "game"],
    office: ["office", "work", "coding"],
    gifting: ["gift", "gifting"],
    college: ["college", "student", "classes"],
    parents: ["parents", "elderly"],
    kids: ["kids", "children"]
  };
  for (const [name, words] of Object.entries(useMap)) if (includes(words)) intent.use_case.push(name);
  return intent;
}

function updateSignals(session, message) {
  const t = lc(message);
  const add = (key, words) => {
    for (const word of words) if (t.includes(word) && !session[key].includes(word)) session[key].push(word);
  };
  add("urgencySignals", ["today", "tonight", "sale", "last day", "urgent", "quick"]);
  add("validationSignals", ["good right", "should i", "just get it", "is it worth"]);
  if (/return|concern|worried|bad|durability|battery|size|fit|quality|calls/.test(t)) session.concern = message;
}

function filterProducts(intent, extra = {}) {
  let products = [...catalog.products];
  if (intent.brand) products = products.filter((p) => lc(p.brand) === intent.brand);
  if (intent.missingBrand) products = [];
  if (intent.category) products = products.filter((p) => p.category === intent.category);
  if (intent.connectivity) products = products.filter((p) => p.connectivity === intent.connectivity);
  if (intent.budget) products = products.filter((p) => p.price_inr <= intent.budget);
  if (extra.category && extra.category !== "All Products") products = products.filter((p) => p.category === extra.category);
  if (extra.connectivity && extra.connectivity !== "all") products = products.filter((p) => p.connectivity === extra.connectivity);
  if (extra.min != null) products = products.filter((p) => p.price_inr >= Number(extra.min));
  if (extra.max != null) products = products.filter((p) => p.price_inr <= Number(extra.max));
  if (extra.rating) products = products.filter((p) => p.rating >= Number(extra.rating));
  if (extra.lowRegret === "true" || extra.lowRegret === true) products = products.filter((p) => p.regret_risk === "low");
  if (extra.highReviews === "true" || extra.highReviews === true) products = products.filter((p) => p.review_count >= 50);
  if (extra.verifiedSeller === "true" || extra.verifiedSeller === true) products = products.filter((p) => p.seller_rating >= 4.3);
  if (extra.easyReturns === "true" || extra.easyReturns === true) products = products.filter((p) => p.return_days >= 30);
  if (extra.fastDelivery === "true" || extra.fastDelivery === true) products = products.filter((p) => p.delivery_days <= 2);

  products.sort((a, b) => scoreProduct(b, intent) - scoreProduct(a, intent));
  if (extra.sort === "priceAsc") products.sort((a, b) => a.price_inr - b.price_inr);
  if (extra.sort === "priceDesc") products.sort((a, b) => b.price_inr - a.price_inr);
  if (extra.sort === "rating") products.sort((a, b) => b.rating - a.rating);
  if (extra.sort === "trust") products.sort((a, b) => b.trust_score - a.trust_score);
  if (extra.sort === "new") products.sort((a, b) => b.id.localeCompare(a.id));
  return products;
}

function scoreProduct(product, intent) {
  let score = product.trust_score + product.rating * 8;
  if (intent.brand && lc(product.brand) === intent.brand) score += 90;
  if (intent.category && product.category === intent.category) score += 40;
  if (intent.connectivity && product.connectivity === intent.connectivity) score += 60;
  if (intent.budget && product.price_inr <= intent.budget) score += 25;
  for (const useCase of intent.use_case) if (product.use_cases.includes(useCase)) score += 28;
  if (product.regret_risk === "low") score += 8;
  return score;
}

function productById(id) {
  return catalog.products.find((p) => p.id === id);
}

function alternativesFor(product) {
  return (product.alternatives || []).map(productById).filter(Boolean);
}

function comboFor(product) {
  return (product.combo_with || []).map(productById).filter(Boolean);
}

function makeVerdict(product, needs = "") {
  const match = Math.max(62, Math.min(97, Math.round(product.trust_score * 0.72 + product.rating * 7 + (product.regret_risk === "low" ? 8 : -4))));
  const alt = alternativesFor(product)[0];
  return {
    product_id: product.id,
    product_name: product.name,
    brand: product.brand,
    image: product.images[0],
    price_inr: product.price_inr,
    match_score: match,
    match_copy: match >= 86 ? "Strong match for your stated needs" : "Good match with some caveats",
    reasons_to_buy: product.loved,
    concerns: product.regretted.slice(0, 2),
    perfect_for: product.perfect_for,
    avoid_if: product.avoid_if,
    regret_risk: product.regret_risk,
    regret_text: `Main risk pattern: ${product.regretted[0]}. ${product.honest_summary}`,
    return_probability: product.return_risk === "low" ? 12 : product.return_risk === "medium" ? 21 : 34,
    alternative: alt ? { id: alt.id, name: alt.name, concern: product.avoid_if[0] || "your main concern" } : null,
    needs
  };
}

async function gemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
    })
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

function fallbackChat(message, products, session, intent, closest = []) {
  if (intent.missingBrand) {
    const fallback = closest.slice(0, 5);
    return `I don't have ${titleBrand(intent.missingBrand)} in stock right now. Based on what you need, the closest honest match is ${fallback.map((p) => `${p.name} (${p.brand}, ${p.regret_risk} regret risk; watch for ${p.regretted[0]})`).join("; ")}. PRODUCTS:[${fallback.map((p) => p.id).join(",")}]`;
  }
  if (intent.brand && !products.length) return `I found ${titleBrand(intent.brand)} in the catalog, but nothing from that brand matches your budget or filters. I will not show products above your stated budget.`;
  if (session.history.length === 0) return "Hello! I'm The Honest Agent. What's the situation that's making you shop today?";
  if (session.history.length === 2) return "Got it. What's the ONE thing that would make you return this within a week?";
  if (session.urgencySignals.length + session.validationSignals.length >= 2) return "I am sensing some time pressure here. Before we go further, what will you use this for every day?";
  if (products.length) {
    const budgetLine = intent.budget ? ` I kept every option within ?${intent.budget.toLocaleString("en-IN")}.` : "";
    const brandLine = intent.brand ? ` I only included ${titleBrand(intent.brand)} products.` : "";
    return `Based on what you told me, here are my honest picks.${budgetLine}${brandLine}\n\n${products.slice(0, 5).map((p) => `- **${p.name}** (${Math.round(scoreProduct(p, intent))}% fit, ${p.regret_risk} regret risk; watch for ${p.regretted[0]})`).join("\n")}\n\nPRODUCTS:[${products.slice(0, 5).map((p) => p.id).join(",")}]`;
  }
  return "I could not find a clean match in the catalog for that exact request. I can still help if you relax the brand, budget, or category.";
}

function titleBrand(brand) {
  return String(brand || "").split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function avoidRepeatedResponse(text, session) {
  if (!session.lastResponses.includes(text)) return text;
  return `${text} A different way to frame it: I am applying your latest constraint first, then ranking by use-case fit, trust score, and regret risk.`;
}

function rememberResponse(text, session) {
  session.lastResponses.push(text);
  session.lastResponses = session.lastResponses.slice(-6);
}

function quickRepliesFor(text, products, intent) {
  const lower = lc(text);
  if (lower.includes("what's the situation that's making you shop today")) {
    return ["Replacing a broken one", "Upgrading my old one", "Gifting someone", "First time buying", "Other"];
  }
  if (lower.includes("what's the one thing that would make you return this within a week")) {
    const category = intent.category || products[0]?.category || "";
    if (category === "Fashion & Clothing") return ["Wrong size", "Color looks different", "Bad fabric quality", "Late delivery", "Other"];
    if (category === "Audio & Earphones") return ["Poor sound quality", "Uncomfortable to wear", "Disconnects often", "Mic doesn't work", "Other"];
    return ["Bad battery", "Feels cheap/fragile", "Too slow", "Overheats", "Other"];
  }
  if (lower.includes("what matters most to you")) return ["Price", "Quality", "Brand name", "Fast delivery", "Other"];
  if (lower.includes("who is this for")) return ["Myself", "As a gift", "For my kids", "For parents", "Other"];
  return [];
}
function extractProductIds(text) {
  const tag = text.match(/PRODUCTS:\s*\[([^\]]+)\]/i);
  if (!tag) return [];
  return tag[1].split(",").map((id) => id.trim().replace(/['"]/g, "")).filter(Boolean);
}

function stream(res, payload) {
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const words = payload.text.split(/(\s+)/).filter(Boolean);
  let index = 0;
  const timer = setInterval(() => {
    if (index < words.length) {
      res.write(`event: token\ndata: ${JSON.stringify({ token: words[index++] })}\n\n`);
      return;
    }
    clearInterval(timer);
    res.write(`event: meta\ndata: ${JSON.stringify(payload)}\n\n`);
    res.end();
  }, 14);
}

app.get("/api/products", (req, res) => {
  const intent = parseIntent(req.query.q || "");
  res.json({ products: filterProducts(intent, req.query), intent });
});

app.get("/api/products/:id", (req, res) => {
  const product = productById(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json({ product, alternatives: alternativesFor(product), combo: comboFor(product) });
});

app.post("/api/chat", async (req, res) => {
  const { message = "", session_id = "demo", current_product_id = null, conversation_history = [], cart = [] } = req.body || {};
  const session = getSession(session_id);
  updateSignals(session, message);
  const intent = parseIntent(message);
  const products = filterProducts(intent).slice(0, 30);
  const closestProducts = intent.missingBrand ? filterProducts({ ...intent, brand: null, missingBrand: null }).slice(0, 30) : [];
  const currentProduct = current_product_id ? productById(current_product_id) : null;
  const prompt = `You are The Honest Agent — a brutally honest AI shopping assistant.
You are NOT a salesperson. You are the user's advocate.
Rules:
1. If user says wired/3.5mm/cable, ONLY recommend wired products. Non-negotiable.
2. Extract budget and never exceed it in recommendations.
3. Always mention the top regret pattern for any product you recommend.
4. Give a confidence percentage when recommending.
5. If urgency or impulse signals exist, slow them down with one grounding question.
6. Language: English only. Professional but warm tone.
7. When recommending products, return their IDs as PRODUCTS:[id1,id2,id3]. Format recommendations as a clear, concise bulleted list.
8. If user asks about outfit/wardrobe, suggest combinations from the catalog.
9. Do NOT repeat the exact same response or product recommendations you previously gave.
CONVERSATION HISTORY: ${JSON.stringify(conversation_history || session.history)}
CURRENT PRODUCT: ${JSON.stringify(currentProduct)}
ELIGIBLE PRODUCTS AFTER STRICT BACKEND FILTERING: ${JSON.stringify(products)}
MISSING BRAND FALLBACK PRODUCTS: ${JSON.stringify(closestProducts)}
USER MESSAGE: ${message}`;
  let text = (await gemini(prompt)) || fallbackChat(message, products, session, intent, closestProducts);
  let highlighted = extractProductIds(text);
  const displayProducts = products.length ? products : closestProducts;
  if (!highlighted.length) highlighted = displayProducts.slice(0, 5).map((p) => p.id);
  if (intent.connectivity) highlighted = highlighted.filter((id) => productById(id)?.connectivity === intent.connectivity);
  if (intent.brand) highlighted = highlighted.filter((id) => lc(productById(id)?.brand) === intent.brand);
  const impulse = session.urgencySignals.length + session.validationSignals.length >= 2;
  const wantsVerdict = /verdict|final|worth it|should i buy|recommend/i.test(message);
  const verdictProduct = productById(highlighted[0]) || currentProduct || displayProducts[0];
  const cleanedText = avoidRepeatedResponse(text.replace(/PRODUCTS:\s*\[[^\]]+\]/gi, "").trim(), session);
  const payload = {
    text: cleanedText,
    products_to_highlight: highlighted,
    impulse_detected: impulse,
    show_verdict: wantsVerdict && !!verdictProduct,
    verdict: wantsVerdict && verdictProduct ? makeVerdict(verdictProduct, message) : null,
    products: displayProducts,
    quick_replies: quickRepliesFor(cleanedText, displayProducts, intent)
  };
  session.highlighted = highlighted;
  rememberResponse(payload.text, session);
  session.history.push({ role: "user", text: message }, { role: "assistant", text: payload.text });
  stream(res, payload);
});

app.post("/api/wardrobe-check", async (req, res) => {
  const { product_id, wardrobe_description = "" } = req.body || {};
  const product = productById(product_id);
  const fallback = {
    compatibility_score: product?.category === "Fashion & Clothing" ? 86 : 64,
    outfit_suggestions: [
      "Pair it with white sneakers and a neutral tote for daytime casual wear.",
      "Use beige sandals and minimal gold accessories for a polished brunch outfit.",
      "Add a denim jacket for a relaxed evening layer."
    ],
    verdict: "This fits a neutral, casual wardrobe well. It works best when paired with solid colors so the product remains the focal point."
  };
  if (!product) return res.status(404).json({ error: "Product not found" });
  const prompt = `User owns: ${wardrobe_description}. Product: ${JSON.stringify(product)}. Does this fit their style? What would they pair it with? Suggest 3 specific outfit combinations. Be specific. Return ONLY valid JSON with compatibility_score (number), outfit_suggestions (array of strings), verdict (string). Do not include markdown formatting or backticks. English only.`;
  const answer = await gemini(prompt);
  if (!answer) return res.json(fallback);
  try {
    const jsonStr = answer.replace(/```json/gi, "").replace(/```/g, "").trim();
    res.json(JSON.parse(jsonStr));
  } catch {
    res.json({ ...fallback, verdict: answer });
  }
});

app.post("/api/verdict", (req, res) => {
  const { product_id, user_needs = "" } = req.body || {};
  const product = productById(product_id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(makeVerdict(product, user_needs));
});

app.post("/api/checkout", (req, res) => {
  const { cart = [], session_id = "demo" } = req.body || {};
  const session = getSession(session_id);
  const item = productById(cart[0]?.id) || catalog.products[0];
  res.json({
    item,
    summary: `${item.name} | ₹${item.price_inr.toLocaleString("en-IN")} | Delivery in ${item.delivery_days} days | ${item.return_days}-day returns`,
    signoff: `Before you pay — ${item.name} at ₹${item.price_inr.toLocaleString("en-IN")}. You mentioned ${session.concern}. This product ${item.checkout_assessment}. Still want to proceed?`,
    confirmation_url: `/confirmation.html?product=${encodeURIComponent(item.name)}&price=${item.price_inr}`
  });
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`The Honest Agent running at http://localhost:${PORT}`));

async function loadFetch() {
  try { return (await import("node-fetch")).default; } catch { return globalThis.fetch; }
}

async function loadCors() {
  try { return (await import("cors")).default; } catch {
    return () => (_req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      next();
    };
  }
}

async function loadExpress() {
  try { return (await import("express")).default; } catch { return createMiniExpress(); }
}

function createMiniExpress() {
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
  function mini() {
    const middlewares = [];
    const routes = [];
    const appFn = async (req, res) => {
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => { res.writeHead(res.statusCode || 200, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(data)); };
      res.sendFile = (filePath) => {
        if (!existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
        res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
        createReadStream(filePath).pipe(res);
      };
      let i = 0;
      const next = async () => {
        const layer = [...middlewares, routeLayer][i++];
        if (!layer) { res.writeHead(404); res.end("Not found"); return; }
        await layer(req, res, next);
      };
      const routeLayer = async (request, response, fallback) => {
        const url = new URL(request.url, "http://localhost");
        request.query = Object.fromEntries(url.searchParams.entries());
        request.params = {};
        const route = routes.find((r) => {
          if (r.method !== request.method) return false;
          if (r.path === "*" || r.path === url.pathname) return true;
          const match = r.path.match(/^\/api\/products\/:id$/);
          if (match && url.pathname.startsWith("/api/products/")) {
            request.params.id = decodeURIComponent(url.pathname.split("/").pop());
            return true;
          }
          return false;
        });
        if (!route) return fallback();
        await route.handler(request, response);
      };
      await next();
    };
    appFn.use = (mw) => middlewares.push(mw);
    appFn.get = (p, h) => routes.push({ method: "GET", path: p, handler: h });
    appFn.post = (p, h) => routes.push({ method: "POST", path: p, handler: h });
    appFn.listen = (p, cb) => createServer(appFn).listen(p, cb);
    return appFn;
  }
  mini.json = () => async (req, _res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
    let raw = "";
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    await next();
  };
  mini.static = (dir) => async (req, res, next) => {
    if (req.method !== "GET") return next();
    const url = new URL(req.url, "http://localhost");
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(dir, requested);
    if (!filePath.startsWith(dir) || !existsSync(filePath)) return next();
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  };
  return mini;
}
