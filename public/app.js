const state = {
  sessionId: crypto.randomUUID(),
  products: [],
  visible: [],
  query: "",
  page: "listing",
  currentProduct: null,
  currentTab: "specs",
  highlighted: [],
  assistantOpen: false,
  cartOpen: false,
  mobileFilters: false,
  cart: [],
  messages: [
    { role: "ai", text: "Hello! I'm The Honest Agent. What's the situation that's making you shop today?", quickReplies: ["Replacing a broken one", "Upgrading my old one", "Gifting someone", "First time buying", "Other"] }
  ],
  typing: false,
  impulse: false,
  verdict: null,
  checkout: null,
  checkoutReady: false,
  wardrobeResult: null,
  otherPrompt: false,
  showSuggestions: false,
  filters: {
    category: "All Products",
    connectivity: "all",
    min: 0,
    max: 200000,
    rating: 0,
    lowRegret: false,
    highReviews: false,
    verifiedSeller: false,
    easyReturns: false,
    fastDelivery: false,
    sort: "relevance"
  }
};

const categories = ["All Products", "Audio & Earphones", "Laptops & Computers", "Smartphones", "Wearables & Smartwatches", "Fashion & Clothing", "Home & Furniture"];
const app = document.getElementById("app");
const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const riskText = (r) => r === "low" ? "✓ Low Regret Risk" : r === "medium" ? "⚠ Medium Regret Risk" : "✕ High Regret Risk";
const riskClass = (r) => `risk-${r || "medium"}`;
const stars = (rating) => "★★★★★".slice(0, Math.round(rating)).padEnd(5, "☆");

init();

async function init() {
  await loadProducts();
  render();
}

async function loadProducts(q = state.query) {
  const params = new URLSearchParams({ q, ...state.filters });
  const res = await fetch(`/api/products?${params}`);
  const data = await res.json();
  state.products = data.products;
  state.visible = data.products;
}

function render() {
  const activeName = document.activeElement?.name;
  const cursor = document.activeElement?.selectionStart;
  app.innerHTML = `
    ${header()}
    ${state.impulse ? impulseBanner() : ""}
    <div class="page-shell">
      ${sidebar()}
      <main class="content">
        ${state.verdict ? verdictCard(state.verdict) : state.page === "detail" && state.currentProduct ? productDetail(state.currentProduct) : listing()}
      </main>
    </div>
    ${assistant()}
    ${cartDrawer()}
    ${checkoutModal()}
  `;
  bind();
  document.querySelector(".chat-body")?.scrollTo(0, 999999);
  if (activeName) {
    const el = document.querySelector(`[name="${activeName}"]`);
    if (el) {
      el.focus();
      try { if (cursor !== undefined && cursor !== null) el.setSelectionRange(cursor, cursor); } catch (e) {}
    }
  }
}

function header() {
  const suggestions = (state.query && state.showSuggestions) ? state.products.slice(0, 5) : [];
  return `
    <header class="site-header">
      <button class="hamburger" data-action="toggle-filters">☰</button>
      <div class="logo" data-action="home"><strong>✦ The Honest Agent</strong><span>Shop with AI-powered honesty</span></div>
      <form class="search">
        <span>⌕</span>
        <input name="q" value="${escapeHtml(state.query)}" placeholder="Search for products, brands and more" autocomplete="off" />
        ${suggestions.length ? `<div class="suggestions">${suggestions.map((p) => `<button type="button" data-open="${p.id}">${p.name}<small>${p.brand}</small></button>`).join("")}</div>` : ""}
      </form>
      <button class="sign-in">Sign In</button>
      <button class="header-cart" data-action="toggle-cart">🛒 <b>${state.cart.length}</b></button>
      <button class="ai-toggle" data-action="toggle-ai">✦ AI Assistant</button>
    </header>
  `;
}

function sidebar() {
  return `
    <aside class="filters ${state.mobileFilters ? "open" : ""}">
      <h2>Filters</h2>
      <section><h3>Categories</h3>${categories.map((c) => labelRadio("category", c, state.filters.category === c)).join("")}</section>
      <section><h3>Connectivity</h3>${[["all","All"],["wired","Wired Only"],["wireless","Wireless Only"]].map(([v,l]) => labelRadio("connectivity", l, state.filters.connectivity === v, v)).join("")}</section>
      <section>
        <h3>Price Range</h3>
        <input type="range" min="0" max="200000" value="${state.filters.max}" data-filter-range />
        <div class="price-inputs"><input data-filter-min value="${state.filters.min}" /><input data-filter-max value="${state.filters.max}" /></div>
      </section>
      <section><h3>Customer Rating</h3>${[[4,"4★ & above"],[3,"3★ & above"],[0,"Any rating"]].map(([v,l]) => labelRadio("rating", l, Number(state.filters.rating) === v, v)).join("")}</section>
      <section>
        <h3>Trust Filters</h3>
        ${check("lowRegret", "Low Regret Risk only")}
        ${check("highReviews", "High Review Count (50+)")}
        ${check("verifiedSeller", "Verified Seller only")}
        ${check("easyReturns", "Easy Returns (30 days+)")}
        ${check("fastDelivery", "Fast Delivery (2 days)")}
      </section>
      <button class="clear" data-action="clear-filters">Clear All Filters</button>
    </aside>
  `;
}

function labelRadio(name, label, checked, value = label) {
  return `<label class="filter-line"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} /> ${label}</label>`;
}

function check(key, label) {
  return `<label class="filter-line"><input type="checkbox" data-check="${key}" ${state.filters[key] ? "checked" : ""} /> ${label}</label>`;
}

function listing() {
  const q = state.query || "all products";
  return `
    <section class="listing-top">
      <h1>Showing ${state.visible.length} results for '${escapeHtml(q)}'</h1>
      <select class="sort">
        <option value="relevance">Relevance</option><option value="priceAsc">Price ↑</option><option value="priceDesc">Price ↓</option><option value="rating">Rating</option><option value="trust">Trust Score</option><option value="new">New Arrivals</option>
      </select>
    </section>
    <section class="product-list">
      ${state.visible.map(productCard).join("") || `<div class="empty">No products match these filters.</div>`}
    </section>
  `;
}

function productCard(p) {
  const honest = state.highlighted.includes(p.id) ? `<span class="badge honest">HONEST PICK</span>` : "";
  const fake = p.fake_review_risk !== "low" ? `<span style="color: var(--danger); font-weight: bold; margin-left: 8px; background: var(--badge-high); padding: 2px 6px; border-radius: 3px;">⚠ CHECK REVIEWS</span>` : "";
  return `
    <article class="product-card ${state.highlighted.includes(p.id) ? "highlight" : ""}">
      <div class="image-box" data-open="${p.id}">
        <img src="${p.images[0]}" alt="${p.name}" />
        <span class="brand-badge">${p.brand}</span>${honest}
      </div>
      <div class="product-info">
        <button class="name-link" data-open="${p.id}">${p.name}</button>
        <div class="tags"><span>${p.brand}</span><span>${p.category}</span><span>${p.subcategory}</span></div>
        <div class="rating-row"><b>${p.rating} ★</b> (${p.review_count} reviews) | ${p.answered_questions} answered questions ${fake}</div>
        <div class="price-row"><strong>${fmt(p.price_inr)}</strong> <del>${fmt(p.original_price_inr)}</del> <span>${p.discount_percent}% off</span></div>
        <p class="delivery">Free delivery by ${deliveryDate(p.delivery_days)}</p>
        <p class="summary">${p.honest_summary}</p>
        <div class="spec-pills">${Object.entries(p.specs).slice(0, 5).map(([, v]) => `<span>${v}</span>`).join("")}</div>
      </div>
      <div class="action-col">
        <button class="primary" data-cart="${p.id}">ADD TO CART</button>
        <button class="wishlist">♡ Wishlist</button>
        <span class="risk ${riskClass(p.regret_risk)}">${riskText(p.regret_risk)}</span>
        <div class="trust">Trust: ${p.trust_score}/100<div><i style="width:${p.trust_score}%"></i></div></div>
        <button class="details" data-open="${p.id}">View Details →</button>
      </div>
    </article>
  `;
}

function productDetail(p) {
  return `
    <button class="back" data-action="back-results">← Back to results</button>
    <section class="pdp">
      <div class="gallery">
        <div class="main-image"><img id="mainImage" src="${p.images[0]}" alt="${p.name}" /><span>1 / ${p.images.length}</span></div>
        <div class="thumbs">${p.images.map((img, i) => `<button data-thumb="${img}" data-count="${i + 1}"><img src="${img}" alt="" /></button>`).join("")}</div>
      </div>
      <div class="pdp-info">
        <p class="muted">${p.brand}</p><h1>${p.name}</h1>
        <div class="pdp-rating">${stars(p.rating)} ${p.rating} | ${p.review_count} Ratings | ${Math.min(p.review_count, 89)} Reviews | ${p.answered_questions} Answered Questions</div>
        <div class="pdp-price">${fmt(p.price_inr)} <del>${fmt(p.original_price_inr)}</del> <span>${p.discount_percent}% off</span></div>
        <span class="low-price">Lowest price in 30 days</span><span class="cashback">₹500 cashback on HDFC card</span>
        <div class="offers"><h3>Available offers</h3><p>• 10% off on first order (code: HONEST10)</p><p>• Free delivery on orders above ₹499</p><p>• ${p.warranty_months} month brand warranty</p></div>
        ${comboBox(p)}
        <div class="services"><h3>Delivery & Services</h3><label>📍 Enter pincode: <input placeholder="560001" /> <button>Check</button></label><p>✓ Free Delivery by ${deliveryDate(p.delivery_days)}</p><p>✓ ${p.return_days}-day easy return</p><p>✓ ${p.warranty_months} month warranty</p><p>✓ Genuine product guarantee</p></div>
        <div class="spec-pills">${Object.entries(p.specs).slice(0, 6).map(([, v]) => `<span>${v}</span>`).join("")}</div>
        <div class="buy-row"><button data-cart="${p.id}" class="primary">ADD TO CART</button><button data-action="buy-now" class="primary dark">BUY NOW</button></div>
        <p class="stock">Only ${p.stock_count} left in stock.</p>
      </div>
    </section>
    <section class="tabs">
      ${tabButton("specs", "Specifications")}${tabButton("reviews", "Reviews & Ratings")}${tabButton("analysis", "AI Honest Analysis")}${tabButton("seller", "Seller Info")}${tabButton("qa", "Q&A")}
    </section>
    <section class="tab-panel">${tabContent(p)}</section>
  `;
}

function comboBox(p) {
  const combo = (p.combo_with || []).map(id => state.products.find(x => x.id === id)).filter(Boolean).slice(0, 2);
  if (!combo.length) return "";
  const total = [p, ...combo].reduce((s, x) => s + x.price_inr, 0);
  return `<div class="combo"><h3>🛍 Buy Together & Save More</h3><p>${[p, ...combo].map(x => x.name).join(" + ")}</p><strong>Buy all for ${fmt(total - 300)} — save ₹300 + free shipping unlocked.</strong><button data-combo="${p.id}">Add Combo to Cart</button></div>`;
}

function tabButton(id, label) {
  return `<button class="${state.currentTab === id ? "active" : ""}" data-tab="${id}">${label}</button>`;
}

function tabContent(p) {
  if (state.currentTab === "specs") return specsTab(p);
  if (state.currentTab === "reviews") return reviewsTab(p);
  if (state.currentTab === "analysis") return analysisTab(p);
  if (state.currentTab === "seller") return sellerTab(p);
  return qaTab(p);
}

function specsTab(p) {
  const rows = { Brand: p.brand, Model: p.name, Category: p.category, Subcategory: p.subcategory, Warranty: `${p.warranty_months} months`, "Country of Origin": p.specs.origin || "India", ...p.specs };
  if (p.fabric_composition) rows["Fabric Composition"] = p.fabric_composition;
  if (p.sizing_standard) rows["Sizing Standard"] = p.sizing_standard;
  return `<table class="spec-table">${Object.entries(rows).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;
}

function reviewsTab(p) {
  const spread = [45, 30, 14, 7, 4];
  return `<div class="reviews-layout"><div class="rating-summary"><strong>${p.rating}★</strong>${spread.map((v, i) => `<p>${5 - i}★ <span><i style="width:${v}%"></i></span> ${v}%</p>`).join("")}<em>${p.review_count} verified purchases</em></div><div class="review-list">${p.reviews.slice(0, Math.min(5, p.review_count)).map(r => review(r)).join("")}<button class="load-more">Load more reviews</button></div></div>`;
}

function review(r) {
  const cleanBody = r.body.replace(/I bought .*? after comparing a few options\./, "").trim();
  return `<article class="review"><div><strong>${r.username}</strong> <span>${r.stars}★</span> <em>${r.verified ? "Verified Purchase" : "Buyer"}</em></div><h4>${r.title}</h4><p>${cleanBody}</p><small>${r.date} • ${r.helpful_count} people found this helpful</small>${r.has_photo ? `<div class="photo-review"></div>` : ""}<button>👍 Helpful</button></article>`;
}

function analysisTab(p) {
  return `
    <div class="analysis">
      <section><h2>🔬 Review Autopsy — What buyers really say</h2><p>AI-analyzed from ${p.review_count} verified reviews</p><div class="analysis-grid">${p.loved.map(x => patternCard("good", x)).join("")}${p.regretted.map(x => patternCard("bad", x)).join("")}</div><div class="mismatch">⚠ This product is rated ${p.rating}★ overall, but complaints cluster around: ${p.avoid_if[0]}. Read the negative reviews if this matches your use case.</div></section>
      <section><h2>🕵️ Fake Review Analysis</h2><div class="scorebar"><span style="width:${100 - fakeScore(p)}%"></span></div><h3>Review Authenticity Score: ${100 - fakeScore(p)}/100</h3><p>✓ Review spread is natural. ✓ Reviews span multiple months. ${p.fake_review_risk === "medium" ? "⚠ Some short reviews may be padding." : "✓ Reviewer profiles look genuine."}</p><p>This product's reviews appear ${p.fake_review_risk === "low" ? "mostly genuine with no major red flags." : "usable, but worth checking for short generic reviews."}</p></section>
      <section><h2>Regret Risk Score</h2><span class="risk big ${riskClass(p.regret_risk)}">Regret Risk: ${p.regret_risk.toUpperCase()}</span><h3>${p.regret_probability}/100 regret probability</h3>${riskBreakdown(p)}<p>Based on review patterns and product specs, the main concern is ${p.regretted[0]}. If that matters to you, consider ${altName(p)}.</p></section>
      ${p.category === "Fashion & Clothing" ? fitAndWardrobe(p) : ""}
      <section><h2>↩️ Return Risk Assessment</h2><p>Return probability for this product: ${p.return_risk === "low" ? "12%" : p.return_risk === "medium" ? "21%" : "34%"} (Industry avg: 18%)</p><div class="mini-bars">${p.return_reasons.map((x, i) => `<p>${x}<span><i style="width:${[40,30,30][i] || 20}%"></i></span></p>`).join("")}</div><p>Our assessment: ${p.return_risk} return risk. Check the top return reasons before buying.</p></section>
      <section><h2>🔄 Honest Alternatives</h2><div class="mini-products">${(p.alternatives || []).map(id => miniProduct(state.products.find(x => x.id === id))).join("")}</div></section>
      <section><h2>🛍 Maximize Your Value</h2><div class="mini-products">${(p.combo_with || []).map(id => miniProduct(state.products.find(x => x.id === id), "Complements this product")).join("")}</div></section>
      <button class="primary verdict-btn" data-verdict="${p.id}">Get Honest Verdict</button>
    </div>
  `;
}

function patternCard(type, text) {
  return `<div class="pattern ${type}">${type === "good" ? "✅" : "❌"} ${text}</div>`;
}

function fakeScore(p) {
  return p.fake_review_risk === "low" ? 14 : p.fake_review_risk === "medium" ? 28 : 48;
}

function riskBreakdown(p) {
  return `<table class="risk-table"><tr><td>Product-needs match</td><td><span><i style="width:${p.trust_score}%"></i></span> Good</td></tr><tr><td>Review complaint rate</td><td><span><i style="width:${p.regret_probability}%"></i></span> ${p.regret_risk}</td></tr><tr><td>Decision speed risk</td><td><span><i style="width:0%"></i></span> N/A yet</td></tr><tr><td>Budget compromise</td><td><span><i style="width:0%"></i></span> N/A yet</td></tr></table>`;
}

function fitAndWardrobe(p) {
  return `<section><h2>📏 Fit Predictor</h2><p>Recommended for you: <b>${p.fit_info?.recommended_size || "M"}</b></p><div class="size-chart">${Object.entries(p.fit_info?.size_chart || {}).map(([k, v]) => `<span class="${k === (p.fit_info?.recommended_size || "M") ? "selected" : ""}">${k}: ${v}</span>`).join("")}</div><p>${p.fit_info?.common_feedback || "Runs true to size."}</p><div class="fit-meter"><span style="left:${p.fit_info?.runs === "small" ? "28%" : p.fit_info?.runs === "large" ? "72%" : "50%"}"></span></div></section><section><h2>👗 Wardrobe Compatibility</h2><p>Tell us what you own and we will check if this fits your style.</p><form class="wardrobe-form"><input name="wardrobe" placeholder="Describe your wardrobe style or colors you wear often..." /><button>Check Compatibility</button></form>${state.wardrobeResult ? `<div class="wardrobe-result"><h3>${state.wardrobeResult.compatibility_score}% compatible</h3><p>${state.wardrobeResult.verdict}</p>${state.wardrobeResult.outfit_suggestions.map(x => `<div>${x}</div>`).join("")}</div>` : ""}</section>`;
}

function miniProduct(p, label = "Better for your concern") {
  if (!p) return "";
  return `<article class="mini-product"><img src="${p.images[0]}" alt="${p.name}" /><div><b>${p.name}</b><p>${label}</p><span>${fmt(p.price_inr)} • ${p.rating}★</span><button data-open="${p.id}">View Full Details</button></div></article>`;
}

function sellerTab(p) {
  const low = p.review_count < 15;
  return `<div class="seller-tab"><section class="seller-card"><h2>${p.seller_name} ✓</h2><p>Active since ${new Date().getFullYear() - p.seller_years_active}</p><p>Overall seller rating: ${p.seller_rating}★ from ${p.seller_transactions} transactions</p><p>Fulfillment rate: ${p.fulfillment_rate}%</p><p>On-time delivery: ${p.on_time_delivery}%</p><p>Return handling: Excellent</p></section>${low && p.provenance ? provenance(p) : `<section><h2>⚡ Provenance Verified</h2><p>This product has enough review depth and a verified seller profile.</p></section>`}</div>`;
}

function provenance(p) {
  return `<section class="provenance"><h2>⚠ Low Reviews — See Analysis</h2><p>This product only has ${p.review_count} reviews, so we went deeper.</p><div class="route">${p.provenance.route.map(x => `<span>${x}</span>`).join("<i></i>")}</div><h3>Shipping Reliability</h3><p>Carrier: ${p.provenance.carrier}</p><div class="scorebar"><span style="width:${p.provenance.delivery_confidence === "High" ? 88 : 58}%"></span></div><p>This seller ships from ${p.provenance.origin_city}. Delivery confidence is ${p.provenance.delivery_confidence}.</p><h3>Material & Quality Intel</h3><p>${p.provenance.material_notes}</p><h3>Honest Low-Review Verdict</h3><p>This product has limited social proof. However, the seller history, ${p.return_days}-day return policy, and shipping reliability make it a defensible low-risk pick.</p></section>`;
}

function qaTab(p) {
  return `<section class="qa"><h2>${p.answered_questions} questions answered by buyers and sellers</h2>${p.qa.map(x => `<article><b>Q: ${x.q}</b><p>A: ${x.a}</p></article>`).join("")}<form class="qa-form"><input placeholder="Ask a question" /><button>Ask</button></form></section>`;
}

function verdictCard(v) {
  return `<section class="verdict-card"><button class="back" data-action="close-verdict">← Back to results</button><img src="${v.image}" alt="${v.product_name}" /><div><h1>${v.product_name}</h1><p>${v.brand} • ${fmt(v.price_inr)}</p><div class="verdict-score"><svg viewBox="0 0 120 120" style="--score:${v.match_score}"><circle cx="60" cy="60" r="52"></circle><circle cx="60" cy="60" r="52"></circle><text x="60" y="67">${v.match_score}%</text></svg><h2>${v.match_copy}</h2></div><div class="verdict-grid"><div><h3>✅ 3 Reasons to Buy</h3>${v.reasons_to_buy.map(x=>`<p>${x}</p>`).join("")}</div><div><h3>❌ 2 Honest Concerns</h3>${v.concerns.map(x=>`<p>${x}</p>`).join("")}</div><div><h3>👤 Perfect For</h3>${v.perfect_for.map(x=>`<p>${x}</p>`).join("")}</div><div><h3>🚫 Avoid If</h3>${v.avoid_if.map(x=>`<p>${x}</p>`).join("")}</div></div><span class="risk big ${riskClass(v.regret_risk)}">${riskText(v.regret_risk)}</span><p>${v.regret_text}</p><p>${v.return_probability}% return probability — ${v.return_probability < 18 ? "lower than average" : "above average"}</p>${v.alternative ? `<button class="alt-link" data-open="${v.alternative.id}">If ${v.alternative.concern} matters, consider ${v.alternative.name} →</button>` : ""}<div class="verdict-actions"><button class="primary" data-cart="${v.product_id}">Add to Cart</button>${v.alternative ? `<button data-open="${v.alternative.id}">See Alternative</button>` : ""}</div></div></section>`;
}

function assistant() {
  return `<aside class="assistant ${state.assistantOpen ? "open" : ""}"><header><div><h2>✦ Honest Agent</h2><p>Ask me anything about this product or what you're looking for</p></div><span><i></i> Online</span><button data-action="toggle-ai">×</button></header><div class="chat-body">${state.messages.map((m, index) => chatMessage(m, index)).join("")}${state.typing ? `<div class="msg ai dots"><b></b><b></b><b></b></div>` : ""}</div><form class="chat-form"><textarea name="message" placeholder="${state.otherPrompt ? "Tell me more..." : "Ask anything about this product..."}"></textarea><button>Send</button><div>${["Find wired earphones","Best under ₹2000","Compare options","Is this worth it?"].map(x => `<button type="button" data-chip="${x}">${x}</button>`).join("")}</div></form></aside>`;
}

function chatMessage(message, index) {
  return `<div class="msg-wrap"><div class="msg ${message.role}">${escapeHtml(message.text)}</div>${quickReplies(message, index)}</div>`;
}

function quickReplies(message, index) {
  if (message.role !== "ai" || !message.quickReplies?.length) return "";
  return `<div class="quick-replies">${message.quickReplies.map((reply) => `<button type="button" class="${message.selectedReply === reply ? "selected" : ""}" ${message.quickRepliesAnswered ? "disabled" : ""} data-quick-reply="${index}" data-reply="${escapeHtml(reply)}">${escapeHtml(reply === "Other" ? "Other (type your own)" : reply)}</button>`).join("")}</div>`;
}

function cartDrawer() {
  const subtotal = state.cart.reduce((s, p) => s + p.price_inr, 0);
  const dup = state.cart.some((p, i) => state.cart.findIndex(x => x.subcategory === p.subcategory) !== i);
  return `<aside class="cart ${state.cartOpen ? "open" : ""}"><header><h2>Your Cart</h2><button data-action="toggle-cart">×</button></header>${dup ? `<div class="cart-warning">You've added two similar audio products. One is probably enough — which would you like to keep?</div>` : ""}<div class="cart-lines">${state.cart.map((p, i) => `<article><img src="${p.images[0]}" /><div><b>${p.name}</b><p>${Object.values(p.specs).slice(0,2).join(" • ")}</p><strong>${fmt(p.price_inr)}</strong><button class="remove-btn" data-remove="${i}">Remove</button></div><span class="risk ${riskClass(p.regret_risk)}">${riskText(p.regret_risk)}</span></article>`).join("") || "<p>Your cart is empty.</p>"}</div><footer><p>Subtotal <b>${fmt(subtotal)}</b></p><p class="deal">Add a complementary item to unlock extra value where available.</p><button class="primary" data-action="checkout" ${state.cart.length ? "" : "disabled"}>Proceed to Checkout</button></footer></aside>`;
}

function checkoutModal() {
  if (!state.checkout) return "";
  return `<div class="modal"><section><h2>${state.checkoutReady ? "Before you pay" : "Final check"}</h2><div class="summary-flash">${state.checkout.summary}</div>${state.checkoutReady ? `<p>${state.checkout.signoff}</p>` : `<div class="loader"></div>`}<div class="modal-actions"><button class="wait" data-action="wait-checkout">Wait, let me think</button><button data-action="confirm-order">Yes, place order</button></div></section></div>`;
}

function bind() {
  document.querySelector(".search")?.addEventListener("submit", async e => { e.preventDefault(); state.query = e.currentTarget.q.value.trim(); state.showSuggestions = false; await loadProducts(); state.page = "listing"; state.verdict = null; render(); });
  document.querySelector(".search input")?.addEventListener("input", e => { state.query = e.target.value; state.showSuggestions = true; render(); });
  document.addEventListener("click", e => { if (!e.target.closest('.search') && state.showSuggestions) { state.showSuggestions = false; render(); } });
  document.querySelector(".sort")?.addEventListener("change", async e => { state.filters.sort = e.target.value; await loadProducts(); render(); });
  document.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openProduct(el.dataset.open)));
  document.querySelectorAll("[data-cart]").forEach(el => el.addEventListener("click", () => addToCart(el.dataset.cart)));
  document.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", () => action(el.dataset.action)));
  document.querySelectorAll("[data-tab]").forEach(el => el.addEventListener("click", () => { state.currentTab = el.dataset.tab; render(); }));
  document.querySelectorAll(".filters input").forEach(input => input.addEventListener("change", applyFiltersFromDom));
  document.querySelector("[data-filter-range]")?.addEventListener("input", e => { state.filters.max = e.target.value; loadProducts().then(render); });
  document.querySelector("[data-filter-min]")?.addEventListener("change", e => { state.filters.min = e.target.value; loadProducts().then(render); });
  document.querySelector("[data-filter-max]")?.addEventListener("change", e => { state.filters.max = e.target.value; loadProducts().then(render); });
  document.querySelectorAll("[data-thumb]").forEach(btn => btn.addEventListener("click", () => { document.getElementById("mainImage").src = btn.dataset.thumb; document.querySelector(".main-image span").textContent = `${btn.dataset.count} / ${state.currentProduct.images.length}`; }));
  document.querySelector(".chat-form")?.addEventListener("submit", e => { e.preventDefault(); const msg = e.currentTarget.message.value.trim(); if (msg) { e.currentTarget.message.value = ""; sendChat(msg); } });
  document.querySelectorAll("[data-chip]").forEach(btn => btn.addEventListener("click", () => sendChat(btn.dataset.chip)));
  document.querySelectorAll("[data-quick-reply]").forEach(btn => btn.addEventListener("click", () => answerQuickReply(Number(btn.dataset.quickReply), btn.dataset.reply)));
  document.querySelector(".wardrobe-form")?.addEventListener("submit", wardrobeCheck);
  document.querySelectorAll("[data-verdict]").forEach(btn => btn.addEventListener("click", () => getVerdict(btn.dataset.verdict)));
  document.querySelectorAll("[data-combo]").forEach(btn => btn.addEventListener("click", () => addCombo(btn.dataset.combo)));
  document.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => { state.cart.splice(Number(btn.dataset.remove), 1); render(); }));
}

async function applyFiltersFromDom() {
  const f = document.querySelector(".filters");
  state.filters.category = f.querySelector("input[name='category']:checked")?.value || "All Products";
  state.filters.connectivity = f.querySelector("input[name='connectivity']:checked")?.value || "all";
  state.filters.rating = Number(f.querySelector("input[name='rating']:checked")?.value || 0);
  document.querySelectorAll("[data-check]").forEach(c => state.filters[c.dataset.check] = c.checked);
  await loadProducts();
  render();
}

async function openProduct(id) {
  const res = await fetch(`/api/products/${id}`);
  const data = await res.json();
  state.currentProduct = data.product;
  state.currentTab = "specs";
  state.page = "detail";
  state.verdict = null;
  state.wardrobeResult = null;
  window.scrollTo(0, 0);
  render();
}

function action(name) {
  if (name === "home" || name === "back-results" || name === "close-verdict") { state.page = "listing"; state.verdict = null; }
  if (name === "toggle-ai") state.assistantOpen = !state.assistantOpen;
  if (name === "toggle-cart") state.cartOpen = !state.cartOpen;
  if (name === "toggle-filters") state.mobileFilters = !state.mobileFilters;
  if (name === "clear-filters") { state.filters = { category: "All Products", connectivity: "all", min: 0, max: 200000, rating: 0, lowRegret: false, highReviews: false, verifiedSeller: false, easyReturns: false, fastDelivery: false, sort: "relevance" }; loadProducts().then(render); return; }
  if (name === "buy-now") { addToCart(state.currentProduct.id); startCheckout(); return; }
  if (name === "checkout") { startCheckout(); return; }
  if (name === "wait-checkout") { state.assistantOpen = true; state.checkout = null; state.messages.push({ role: "ai", text: "What's your concern? I can help." }); }
  if (name === "confirm-order") window.location.href = state.checkout.confirmation_url;
  render();
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id) || state.currentProduct;
  if (p && !state.cart.some(x => x.id === p.id)) state.cart.push(p);
  state.cartOpen = true;
  render();
}

function addCombo(id) {
  const p = state.products.find(x => x.id === id) || state.currentProduct;
  [p, ...(p.combo_with || []).map(x => state.products.find(p => p.id === x)).filter(Boolean)].forEach(item => {
    if (!state.cart.some(x => x.id === item.id)) state.cart.push(item);
  });
  state.cartOpen = true;
  render();
}

async function sendChat(message) {
  state.assistantOpen = true;
  state.otherPrompt = false;
  state.messages.push({ role: "user", text: message }, { role: "ai", text: "" });
  state.typing = true;
  render();
  const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, session_id: state.sessionId, current_product_id: state.currentProduct?.id, conversation_history: state.messages, cart: state.cart }) });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop();
    for (const part of parts) {
      const event = part.match(/^event: (.+)$/m)?.[1];
      const data = JSON.parse(part.match(/^data: (.+)$/m)?.[1] || "{}");
      if (event === "token") { state.typing = false; state.messages[state.messages.length - 1].text += data.token; }
      if (event === "meta") {
        state.messages[state.messages.length - 1].text = data.text;
        state.messages[state.messages.length - 1].quickReplies = data.quick_replies || [];
        state.highlighted = data.products_to_highlight || [];
        state.impulse = data.impulse_detected;
        if (data.products?.length) state.visible = data.products;
        if (data.verdict) state.verdict = data.verdict;
      }
      render();
    }
  }
  state.typing = false;
  render();
}

function answerQuickReply(index, reply) {
  const message = state.messages[index];
  if (!message || message.quickRepliesAnswered) return;
  message.selectedReply = reply;
  if (reply === "Other") {
    state.otherPrompt = true;
    render();
    setTimeout(() => document.querySelector(".chat-form textarea")?.focus(), 0);
    return;
  }
  message.quickRepliesAnswered = true;
  render();
  sendChat(reply);
}

async function wardrobeCheck(e) {
  e.preventDefault();
  const wardrobe = e.currentTarget.wardrobe.value.trim();
  const res = await fetch("/api/wardrobe-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: state.currentProduct.id, wardrobe_description: wardrobe }) });
  state.wardrobeResult = await res.json();
  render();
}

async function getVerdict(id) {
  const res = await fetch("/api/verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: id, user_needs: state.query }) });
  state.verdict = await res.json();
  window.scrollTo(0, 0);
  render();
}

async function startCheckout() {
  const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart: state.cart, session_id: state.sessionId }) });
  state.checkout = await res.json();
  state.checkoutReady = false;
  state.cartOpen = false;
  render();
  setTimeout(() => { state.checkoutReady = true; render(); }, 2000);
}

function deliveryDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 3));
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function altName(p) {
  const alt = state.products.find(x => x.id === p.alternatives?.[0]);
  return alt?.name || "an alternative";
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
