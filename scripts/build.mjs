// Generates the animated blueprint SVGs used by README.md (light + dark variants).
// Fonts are subset to the glyphs each image uses and embedded, so GitHub renders them exactly.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "assets");
const font = (pkg, file) => fs.readFileSync(path.join(root, "node_modules/@fontsource", pkg, "files", file));
const FONTS = {
  serif: { name: "IS", data: font("instrument-serif", "instrument-serif-latin-400-normal.woff2") },
  mono: { name: "PM", data: font("ibm-plex-mono", "ibm-plex-mono-latin-400-normal.woff2") },
  sans: { name: "PS", data: font("ibm-plex-sans", "ibm-plex-sans-latin-400-normal.woff2") },
};

const THEMES = {
  light: {
    paper: "#fbfbf8", ink: "#15171c", ink2: "#4a5160", ink3: "#656c7a", rule: "#d9dde3",
    bp7: "#1d47b8", bp5: "#3a6be0", bp3: "#9db5ee", bp1: "#e6edfc",
    gridMinor: "rgba(29,71,184,0.05)", gridMajor: "rgba(29,71,184,0.11)",
  },
  dark: {
    paper: "#0d1117", ink: "#e6edf3", ink2: "#a3adba", ink3: "#7d8590", rule: "#30363d",
    bp7: "#8cb0ff", bp5: "#5b8cff", bp3: "#2f4f99", bp1: "#16233f",
    gridMinor: "rgba(91,140,255,0.06)", gridMajor: "rgba(91,140,255,0.13)",
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function context() {
  const used = { serif: new Set(), mono: new Set(), sans: new Set() };
  const take = (fam) => (s) => {
    for (const ch of s) used[fam].add(ch);
    return esc(s);
  };
  return { used, serif: take("serif"), mono: take("mono"), sans: take("sans") };
}

const css = (t) => `
.bg{fill:${t.paper}} .ink{fill:${t.ink}} .ink2{fill:${t.ink2}} .ink3{fill:${t.ink3}} .bp{fill:${t.bp7}} .bpfill{fill:${t.bp1}}
.s-rule{stroke:${t.rule}} .s-bp{stroke:${t.bp5}} .s-bp7{stroke:${t.bp7}} .s-bp3{stroke:${t.bp3}} .s-ink3{stroke:${t.ink3}} .s-ink{stroke:${t.ink}}
.serif{font-family:IS,Georgia,'Times New Roman',serif} .mono{font-family:PM,ui-monospace,Consolas,monospace;letter-spacing:.08em}
.sans{font-family:PS,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif}
.d{fill:none;stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1.5s cubic-bezier(.65,0,.35,1) forwards}
.f{opacity:0;animation:fade .9s ease forwards}
@keyframes draw{to{stroke-dashoffset:0}} @keyframes fade{to{opacity:1}}
@media (prefers-reduced-motion:reduce){.d{animation:none;stroke-dashoffset:0}.f{animation:none;opacity:1}}`;

async function finalize(ctx, theme, w, h, body, title) {
  const faces = [];
  for (const [fam, chars] of Object.entries(ctx.used)) {
    if (!chars.size) continue;
    const sub = await subsetFont(FONTS[fam].data, [...chars].join("") + " ", { targetFormat: "woff2" });
    faces.push(`@font-face{font-family:${FONTS[fam].name};src:url(data:font/woff2;base64,${sub.toString("base64")}) format("woff2")}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${faces.join("")}${css(theme)}</style>
${body}
</svg>
`;
}

const delay = (s) => `style="animation-delay:${s}s"`;
const line = (d, cls, s = 0, w = 1) => `<path d="${d}" pathLength="1" class="d ${cls}" stroke-width="${w}" ${delay(s)}/>`;
const rectD = (x, y, w, h) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
const grid = (t, w, h, mask = true) => `
<defs>
  <pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="${t.gridMinor}"/></pattern>
  <pattern id="G" width="96" height="96" patternUnits="userSpaceOnUse"><rect width="96" height="96" fill="url(#g)"/><path d="M96 0H0V96" fill="none" stroke="${t.gridMajor}"/></pattern>
  <radialGradient id="fade" cx="58%" cy="42%" r="75%"><stop offset="35%" stop-color="#fff"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="m"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask>
</defs>
<rect class="bg" width="${w}" height="${h}"/>
<rect width="${w}" height="${h}" fill="url(#G)" ${mask ? 'mask="url(#m)"' : ""}/>`;

const cross = (x, y, cls = "s-bp", s = 0, r = 9) =>
  `<g class="f" ${delay(s)}><circle cx="${x}" cy="${y}" r="4.5" fill="none" class="${cls}"/><path d="M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}" class="${cls}"/></g>`;

const brackets = (x, y, w, h, cls = "s-bp", s = 0, b = 9) =>
  `<g class="f" ${delay(s)} fill="none">${[
    `M${x} ${y + b}V${y}H${x + b}`,
    `M${x + w - b} ${y}H${x + w}V${y + b}`,
    `M${x} ${y + h - b}V${y + h}H${x + b}`,
    `M${x + w - b} ${y + h}H${x + w}V${y + h - b}`,
  ]
    .map((d) => `<path d="${d}" class="${cls}" stroke-width="1.4"/>`)
    .join("")}</g>`;

/* ------------------------------------------------------------------ header */

async function header(theme) {
  const t = THEMES[theme];
  const c = context();
  const W = 1200;
  const H = 430;
  const block = [
    ["CURRENT", ["Software Design Engineer II", "Newgen · NumberTheory AI"]],
    ["PREVIOUSLY", ["Sony Research India", "IIT Bombay (FOSSEE)"]],
    ["EDUCATION", ["B.Tech CSE, minor AI & ML", "VIT · 2026"]],
    ["LOCATION", ["Gurugram, India", ""]],
  ];
  const bx = 752;
  const by = 262;
  const cw = 196;
  const ch = 56;
  const body = `${grid(t, W, H)}
${line(`M0 70H${W}`, "s-rule", 0)}
${line(`M0 352H${W}`, "s-rule", 0.1)}
${line(`M56 0V${H}`, "s-rule", 0.15)}
${line(`M980 0V${H}`, "s-rule", 0.2)}
${line("M980 44A146 146 0 1 1 834 190", "s-bp3", 0.35)}
${line("M834 190A146 146 0 0 1 980 44", "s-bp3", 1.4)}
${line("M980 146A44 44 0 1 1 936 190", "s-bp3", 0.6)}
${line("M980 190L1083 87", "s-bp3", 0.75)}
${cross(56, 70, "s-bp", 0.9)}${cross(980, 70, "s-bp", 1.0)}${cross(980, 190, "s-bp", 1.1)}${cross(56, 352, "s-bp", 1.2)}
<g class="f mono" font-size="11" ${delay(1.2)}>
  <text x="992" y="62" class="ink3">${c.mono("A-2")}</text>
  <text x="992" y="182" class="ink3">${c.mono("C · R146")}</text>
  <text x="1040" y="132" class="ink3" transform="rotate(-45 1040 132)">${c.mono("R 146")}</text>
</g>
<g class="f mono" font-size="12" ${delay(0.1)}>
  <text x="72" y="58" class="bp">${c.mono("SHEET 01 / PROFILE")}</text>
  <text x="258" y="58" class="ink3">${c.mono("28.4595° N, 77.0266° E")}</text>
</g>
${line("M72 104V116M72 110H246M500 110H676M676 104V116", "s-bp", 0.25)}
<text x="373" y="114" text-anchor="middle" font-size="11" class="f mono bp" ${delay(0.4)}>${c.mono("S. SOJAN · GENERAL ARRANGEMENT")}</text>
<text x="66" y="206" font-size="104" class="f serif ink" ${delay(0.2)} letter-spacing="-1.5">${c.serif("Steve Sojan")}<tspan class="bp">${c.serif(".")}</tspan></text>
<text x="72" y="248" font-size="14.5" class="f mono ink2" ${delay(0.45)}>${c.mono("SOFTWARE ENGINEER / AI · MACHINE LEARNING · RESEARCH")}</text>
<g class="f sans ink" font-size="21" ${delay(0.6)}>
  <text x="72" y="296">${c.sans("I build machine-learning systems and the software")}</text>
  <text x="72" y="324">${c.sans("around them, from fine-tuning foundation models")}</text>
  <text x="72" y="352">${c.sans("to low-latency engines.")}</text>
</g>
<g class="f" ${delay(1.0)}>
  <rect x="${bx}" y="${by}" width="${cw * 2}" height="${ch * 2 + 30}" class="bg"/>
  ${block
    .map(([label, lines], i) => {
      const x = bx + (i % 2) * cw;
      const y = by + Math.floor(i / 2) * ch;
      return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" class="s-ink" stroke-opacity=".75"/>
  <text x="${x + 10}" y="${y + 16}" font-size="9" class="mono ink3">${c.mono(label)}</text>
  ${lines
    .filter(Boolean)
    .map((l, k) => `<text x="${x + 10}" y="${y + 33 + k * 15}" font-size="12" class="sans ink">${c.sans(l)}</text>`)
    .join("")}`;
    })
    .join("\n  ")}
  <rect x="${bx}" y="${by + ch * 2}" width="${cw * 2}" height="30" fill="none" class="s-ink" stroke-opacity=".75"/>
  <text x="${bx + 10}" y="${by + ch * 2 + 19}" font-size="9" class="mono ink3">${c.mono("DRAWN BY")}</text>
  <text x="${bx + cw * 2 - 10}" y="${by + ch * 2 + 19}" font-size="9" text-anchor="end" class="mono bp">${c.mono("S. SOJAN · SHEET 01 OF 01")}</text>
</g>
${line(`M56 404H1140`, "s-bp", 0.5)}
${line(`M56 404V24`, "s-bp", 0.55)}
<g class="f" ${delay(1.5)}>${Array.from({ length: 19 }, (_, i) => `<path d="M${56 + i * 60} 398V410" class="s-bp"/>`).join("")}</g>
<text x="1150" y="408" font-size="10" class="f mono bp" ${delay(1.6)}>${c.mono("X")}</text>`;
  return finalize(c, t, W, H, body, "Steve Sojan: Software Engineer, AI / Machine Learning / Research");
}

/* ------------------------------------------------------------------ cards */

const CARDS = [
  {
    id: "alphalab",
    kicker: "04.1 · RUST · PYTHON · QUANT",
    name: "AlphaLab-NSE",
    lines: ["NSE alpha research with walk-forward,", "deflated Sharpe and a hold-out, plus", "a Rust market-making simulator."],
    metric: "Bit-identical · 1.63× numba",
    stack: "Rust · PyO3 · Polars · MATLAB",
    glyph: (s) => {
      // in-sample equity climbs, then flattens after the dashed hold-out line
      const is = [[276, 172], [288, 160], [298, 164], [310, 146], [322, 138], [334, 124], [344, 128], [356, 104], [368, 92]];
      const ho = [[368, 92], [380, 100], [392, 90], [404, 102], [418, 96]];
      const path = (pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join("L")}`;
      const ticks = [0, 1, 2, 3, 4].map((k) => `M272 ${60 + k * 28}H276`).join("");
      return `${line("M272 48V182H422", "s-ink3", s)}
${line(ticks, "s-rule", s + 0.1)}
${line(path(is), "s-bp", s + 0.3)}
${line("M368 44V182", "s-bp3", s + 0.6)}
${line(path(ho), "s-bp7", s + 0.9, 1.4)}
${line(rectD(376, 140, 40, 34), "s-bp3", s + 1.0)}
${line("M380 151H412M380 157H404M380 163H408", "s-bp", s + 1.1)}`;
    },
  },
  {
    id: "lob",
    kicker: "04.2 · RUST · SYSTEMS",
    name: "Limit Order Book",
    lines: ["Low-latency matching engine with strict", "price-time priority, event sourcing", "and deterministic replay."],
    metric: "O(1) routing · O(log P) levels",
    stack: "Rust · SQLx · PostgreSQL · Criterion",
    glyph: (s) => {
      const axis = 352;
      const asks = [60, 80, 100];
      const bids = [130, 150, 170];
      const cells = [
        ...asks.flatMap((y, i) => Array.from({ length: [2, 3, 4][i] }, (_, k) => rectD(axis + 9 + k * 16, y - 6, 12, 12))),
        ...bids.flatMap((y, i) => Array.from({ length: [4, 3, 2][i] }, (_, k) => rectD(axis - 9 - (k + 1) * 16 + 4, y - 6, 12, 12))),
      ].join("");
      return `${line([...asks, ...bids].map((y) => `M272 ${y}H418`).join(""), "s-rule", s)}
${line(`M${axis} 46V186`, "s-ink3", s + 0.1)}
${line(cells, "s-bp", s + 0.3)}
${line(`M${axis} 46V186`, "s-bp7", s + 0.9)}`;
    },
  },
  {
    id: "lora",
    kicker: "05.2 · PYTORCH · FOUNDATION MODELS",
    name: "TabPFN-LoRA",
    lines: ["LoRA adapters on the attention QKV", "projections of a tabular foundation", "model, with the backbone frozen."],
    metric: "W′ = W + (α/r) · BA",
    stack: "PyTorch · LoRA · TabPFN",
    glyph: (s) => `${line(rectD(286, 52, 74, 74), "s-ink3", s)}
${line([0, 1, 2, 3].map((k) => `M${286 + (k + 1) * 14.8} 52V126M286 ${52 + (k + 1) * 14.8}H360`).join(""), "s-rule", s + 0.15)}
${line("M286 146L322 152V164L286 170Z", "s-bp", s + 0.45)}
${line("M330 152L366 146V170L330 164Z", "s-bp", s + 0.55)}
${line("M322 158H330", "s-bp", s + 0.7)}
${line("M360 89H390M366 158H398V102", "s-bp7", s + 0.8)}
${line("M398 98A9 9 0 1 1 397.9 98M391 89H405M398 82V96", "s-bp7", s + 1.0)}`,
  },
  {
    id: "kan",
    kicker: "05.1 · PYTORCH · RESEARCH",
    name: "Transformer-KAN",
    lines: ["Feed-forward layers replaced by", "Kolmogorov–Arnold Networks with", "learnable spline edges."],
    metric: "99.38% vs 99.16% (MLP)",
    stack: "PyTorch · KAN · Transformers",
    glyph: (s) => {
      const L = [70, 110, 150].map((y) => [284, y]);
      const M = [58, 92, 128, 162].map((y) => [345, y]);
      const R = [94, 128].map((y) => [406, y]);
      const edges = [];
      let i = 0;
      for (const [a, b] of [...L.flatMap((a) => M.map((b) => [a, b])), ...M.flatMap((a) => R.map((b) => [a, b]))]) {
        const o = (i++ % 2 ? 1 : -1) * 9;
        const dx = b[0] - a[0];
        edges.push(`M${a[0]} ${a[1]}C${a[0] + dx / 3} ${a[1] + o} ${a[0] + (2 * dx) / 3} ${b[1] - o} ${b[0]} ${b[1]}`);
      }
      return `${line(edges.join(""), "s-bp", s)}
<g class="f" ${delay(s + 0.6)}>${[...L, ...M, ...R].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" class="bg s-bp7" stroke-width="1.2"/>`).join("")}</g>`;
    },
  },
  {
    id: "workhorse",
    kicker: "04.3 · RAG · LLM",
    name: "WorkHorse AI",
    lines: ["Agro-financial advisor: retrieval over", "NCDEX crop futures with a 4-bit", "Mistral-7B served by llama.cpp."],
    metric: "Q4_K_M · hardware-agnostic",
    stack: "LlamaIndex · ChromaDB · llama.cpp",
    glyph: (s) => `${line("M276 70A26 7 0 0 0 328 70A26 7 0 0 0 276 70M276 70V104A26 7 0 0 0 328 104V70", "s-bp", s)}
${line(`${rectD(352, 60, 40, 30)}${rectD(356, 64, 40, 30)}`, "s-bp", s + 0.25)}
${line(rectD(330, 132, 84, 40), "s-bp7", s + 0.45, 1.4)}
${line(rectD(334, 136, 76, 32), "s-bp3", s + 0.55)}
${line("M328 87H350M394 94V128M302 112V152H326", "s-bp7", s + 0.7)}
<g class="f" ${delay(s + 0.5)}>${[[290, 50], [300, 42], [312, 48], [284, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" class="bp"/>`).join("")}</g>`,
  },
  {
    id: "foursight",
    kicker: "04.4 · VISION · MARKETS",
    name: "4-Sight",
    lines: ["A ViT-16 reads annotated candlestick", "charts alongside OHLCV, TA-Lib and", "microstructure features."],
    metric: "+14.3% prediction accuracy",
    stack: "PyTorch · ViT · TA-Lib · mplfinance",
    glyph: (s) => {
      const candles = Array.from({ length: 12 }, (_, i) => {
        const mid = 112 + 30 * Math.sin(i / 1.9) - i * 1.5;
        const half = 5 + 5 * Math.abs(Math.sin(i * 2.3));
        return { x: 282 + i * 11.5, top: mid - half, bottom: mid + half, hi: mid - half - 6, lo: mid + half + 6, mid };
      });
      const r = (n) => Math.round(n * 10) / 10;
      const bodies = candles.map((c) => rectD(r(c.x - 3.5), r(c.top), 7, r(c.bottom - c.top))).join("");
      const wicks = candles.map((c) => `M${r(c.x)} ${r(c.hi)}V${r(c.lo)}`).join("");
      const p = candles[7];
      const patch = [1, 2, 3, 4, 5].map((k) => `M${272 + k * 25} 48V182`).join("") + [1, 2, 3].map((k) => `M272 ${48 + k * 33.5}H422`).join("");
      return `${line(patch, "s-bp3", s + 0.9)}
${line("M272 48V182H422", "s-ink3", s)}
${line(wicks, "s-ink3", s + 0.2)}
${line(bodies, "s-bp", s + 0.35)}
${line(rectD(r(p.x - 8), r(p.hi - 4), 28, r(p.lo - p.hi + 8)), "s-ink", s + 0.8, 1.3)}
${line(`M${r(p.x + 20)} ${r(p.mid)}L${r(candles[9].x)} ${r(p.mid + 10)}L${r(candles[11].x)} ${r(p.mid + 26)}`, "s-bp7", s + 1.0)}`;
    },
  },
  {
    id: "zelestra",
    kicker: "04.5 · ENSEMBLES · COMPETITION",
    name: "Zelestra × AWS",
    lines: ["8-model stacked ensemble, boosting", "and neural learners, under a Ridge", "meta-learner for solar efficiency."],
    metric: "Top 9% · rank 61 of ~700",
    stack: "XGBoost · CatBoost · TabNet · DCN",
    glyph: (s) => {
      const xs = Array.from({ length: 8 }, (_, i) => 280 + i * 19);
      return `${line(xs.map((x) => rectD(x - 7, 52, 14, 18)).join(""), "s-bp", s)}
${line(xs.map((x) => `M${x} 70C${x} 108 346 102 346 132`).join(""), "s-bp3", s + 0.4)}
${line(rectD(312, 132, 68, 24), "s-bp7", s + 0.8, 1.4)}
${line("M346 156V176", "s-bp7", s + 1.0)}
${line(rectD(322, 176, 48, 14), "s-bp", s + 1.1)}`;
    },
  },
];

async function card(theme, cd) {
  const t = THEMES[theme];
  const c = context();
  const W = 440;
  const H = 240;
  const body = `<rect class="bg" width="${W}" height="${H}"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" class="s-rule"/>
${brackets(6, 6, W - 12, H - 12, "s-bp", 0.15, 10)}
${line(rectD(266, 34, 160, 166), "s-rule", 0.1)}
<text x="26" y="40" font-size="10" class="f mono bp" ${delay(0.1)}>${c.mono(cd.kicker)}</text>
<text x="24" y="84" font-size="36" letter-spacing="-.5" class="f serif ink" ${delay(0.2)}>${c.serif(cd.name)}</text>
<g class="f sans ink2" font-size="13" ${delay(0.35)}>
${cd.lines.map((l, i) => `<text x="26" y="${114 + i * 18}">${c.sans(l)}</text>`).join("\n")}
</g>
<text x="26" y="192" font-size="11" class="f mono bp" ${delay(0.55)}>${c.mono(cd.metric)}</text>
<text x="26" y="216" font-size="10" class="f mono ink3" ${delay(0.65)}>${c.mono(cd.stack)}</text>
<text x="${W - 22}" y="216" font-size="10" text-anchor="end" class="f mono bp" ${delay(0.9)}>${c.mono("OPEN ↗")}</text>
${cd.glyph(0.3)}`;
  return finalize(c, t, W, H, body, `${cd.name}: ${cd.lines.join(" ")}`);
}

/* ------------------------------------------------------------------ buttons */

const BUTTONS = [
  { id: "portfolio", label: "PORTFOLIO ↗", solid: true },
  { id: "resume", label: "RÉSUMÉ ↗" },
  { id: "linkedin", label: "LINKEDIN ↗" },
  { id: "email", label: "EMAIL" },
  { id: "kaggle", label: "KAGGLE ↗" },
  { id: "gitlab", label: "GITLAB ↗" },
];

async function button(theme, b) {
  const t = THEMES[theme];
  const c = context();
  const W = 152;
  const H = 42;
  const solid = b.solid;
  const body = `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" ${solid ? `fill="${t.ink}"` : `class="bg s-rule"`} ${solid ? "" : 'stroke-width="1"'}/>
${brackets(0.5, 0.5, W - 1, H - 1, "s-bp", 0, 7)}
<text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" font-size="11.5" class="mono" fill="${solid ? t.paper : t.ink}">${c.mono(b.label)}</text>`;
  return finalize(c, t, W, H, body, b.label.replace(" ↗", ""));
}

/* ------------------------------------------------------------------ toolkit */

const TOOLKIT = [
  ["LANGUAGES", ["Python", "Rust", "SQL", "LaTeX", "MATLAB"]],
  ["AI / ML FRAMEWORKS", ["PyTorch", "NumPy · Pandas · Polars", "XGBoost · LightGBM · CatBoost", "LlamaIndex", "llama.cpp", "TA-Lib"]],
  ["ML METHODS", ["Transformers", "LoRA / PEFT", "Kolmogorov–Arnold Networks", "RAG systems · LLMs", "Ensemble methods", "Tabular foundation models"]],
  ["DATA & STORAGE", ["PostgreSQL", "ChromaDB", "Tableau", "MS Excel"]],
  ["INFRA & TOOLS", ["Git · GitHub Actions", "Linux", "Docker", "AWS", "Streamlit"]],
];

async function toolkit(theme) {
  const t = THEMES[theme];
  const c = context();
  const W = 1200;
  const H = 280;
  const col = 232;
  const body = `${grid(t, W, H, false)}
<text x="24" y="34" font-size="11" class="f mono bp">${c.mono("TOOLKIT · GROUPED BY WHAT IT DOES")}</text>
${line(`M24 54H${W - 24}`, "s-bp", 0.1)}
${TOOLKIT.map(([title, items], i) => {
  const x = 24 + i * col + 8;
  return `${line(`M${x} 54V78`, "s-bp", 0.3 + i * 0.08)}
${cross(x, 54, "s-bp", 0.35 + i * 0.08, 7)}
<text x="${x + 14}" y="92" font-size="10.5" class="f mono bp" ${delay(0.5 + i * 0.08)}>${c.mono(title)}</text>
${items
  .map(
    (it, k) => `<g class="f" ${delay(0.65 + i * 0.08 + k * 0.05)}><rect x="${x + 14}" y="${112 + k * 26}" width="7" height="7" fill="none" class="s-bp"/><text x="${x + 30}" y="${120 + k * 26}" font-size="14" class="sans ink">${c.sans(it)}</text></g>`,
  )
  .join("\n")}`;
}).join("\n")}`;
  return finalize(c, t, W, H, body, `Toolkit: ${TOOLKIT.map(([g, it]) => `${g.toLowerCase()}: ${it.join(", ")}`).join("; ")}`);
}

/* ------------------------------------------------------------------ build */

fs.mkdirSync(out, { recursive: true });
const write = (name, svg) => {
  fs.writeFileSync(path.join(out, name), svg);
  return Buffer.byteLength(svg);
};

let total = 0;
for (const theme of Object.keys(THEMES)) {
  total += write(`header-${theme}.svg`, await header(theme));
  total += write(`toolkit-${theme}.svg`, await toolkit(theme));
  for (const cd of CARDS) total += write(`card-${cd.id}-${theme}.svg`, await card(theme, cd));
  for (const b of BUTTONS) total += write(`btn-${b.id}-${theme}.svg`, await button(theme, b));
}
console.log(`wrote ${fs.readdirSync(out).length} SVGs, ${(total / 1024).toFixed(0)} KB total`);
