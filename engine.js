/* BuildBudget engine — requirement text -> structured inputs -> itemised BOQ range.
   Rates are INDICATIVE PLACEHOLDERS (Delhi NCR, residential new build) until replaced by a verified rate table. */

const TIERS = ['basic', 'standard', 'premium'];

const LOCATIONS = {
  'Delhi NCR': 1.0, 'Delhi': 1.0, 'Gurugram': 1.06, 'Noida': 1.0,
  'Greater Noida': 0.97, 'Ghaziabad': 0.95, 'Faridabad': 0.95,
};
const LOCATION_ALIASES = [
  [/gurgaon|gurugram/, 'Gurugram'], [/greater noida/, 'Greater Noida'], [/noida/, 'Noida'],
  [/ghaziabad|vaishali|indirapuram/, 'Ghaziabad'], [/faridabad/, 'Faridabad'],
  [/delhi|dwarka|rohini|saket|pitampura/, 'Delhi'],
];

const MARKUPS = { oh: [0.06, 0.10], cont: [0.03, 0.05], gst: 0.18 };

// qty helpers: p = {A (built-up sqft), F floors, BR, BA, K, plot, tier, loc, opts}
const foot = p => p.A / p.F;
const plotArea = p => (p.plot > 0 ? p.plot : foot(p) / 0.7);

const ITEMS = [
  // trade, item, unit, qty, rates per tier [low, high] in INR per unit
  { id: 'exc', trade: 'Site & foundation', item: 'Site clearing, excavation & backfilling', unit: 'sq ft footprint', qty: foot, rates: { basic: [35, 50], standard: [40, 55], premium: [45, 65] } },
  { id: 'fnd', trade: 'Site & foundation', item: 'Foundation: footings, PCC, plinth beam, DPC', unit: 'sq ft footprint', qty: foot, rates: { basic: [230, 290], standard: [250, 310], premium: [270, 340] } },
  { id: 'rcc', trade: 'RCC structure', item: 'RCC columns, beams & slabs (cement, steel, aggregate, labour)', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [640, 740], standard: [710, 810], premium: [790, 910] } },
  { id: 'stair', trade: 'RCC structure', item: 'Staircase (RCC, finish & railing)', unit: 'flight', qty: p => p.F, rates: { basic: [45000, 65000], standard: [70000, 110000], premium: [130000, 220000] } },
  { id: 'brick', trade: 'Masonry & plaster', item: 'Brick / block masonry (external & internal walls)', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [125, 150], standard: [140, 165], premium: [160, 190] } },
  { id: 'plaster', trade: 'Masonry & plaster', item: 'Internal & external plaster', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [85, 105], standard: [95, 120], premium: [110, 135] } },
  { id: 'wp_t', trade: 'Waterproofing', item: 'Terrace waterproofing & screed', unit: 'sq ft footprint', qty: foot, rates: { basic: [45, 60], standard: [60, 85], premium: [85, 125] } },
  { id: 'wp_b', trade: 'Waterproofing', item: 'Bathroom waterproofing', unit: 'bathroom', qty: p => p.BA, rates: { basic: [8000, 12000], standard: [10000, 15000], premium: [15000, 22000] } },
  { id: 'floor', trade: 'Flooring & tiling', item: 'Flooring (vitrified / stone) with skirting', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [90, 120], standard: [140, 200], premium: [260, 450] } },
  { id: 'bathtile', trade: 'Flooring & tiling', item: 'Bathroom wall & floor tiling', unit: 'bathroom', qty: p => p.BA, rates: { basic: [30000, 40000], standard: [40000, 60000], premium: [70000, 120000] } },
  { id: 'kitchen', trade: 'Kitchen', item: 'Kitchen platform, sink, wall tiling & cabinets', unit: 'kitchen', qty: p => p.K, rates: { basic: [60000, 90000], standard: [120000, 200000], premium: [350000, 700000] } },
  { id: 'doors', trade: 'Doors & windows', item: 'Doors, windows, grills & hardware', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [55, 70], standard: [80, 110], premium: [140, 220] } },
  { id: 'elec', trade: 'Electrical', item: 'Conduit, wiring, switches, DB & earthing', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [70, 90], standard: [90, 120], premium: [130, 190] } },
  { id: 'plumb', trade: 'Plumbing & sanitary', item: 'Water supply & drainage lines', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [45, 60], standard: [55, 75], premium: [70, 100] } },
  { id: 'sanit', trade: 'Plumbing & sanitary', item: 'Sanitary ware & CP fittings', unit: 'bathroom', qty: p => p.BA, rates: { basic: [28000, 40000], standard: [45000, 70000], premium: [90000, 180000] } },
  { id: 'water', trade: 'Plumbing & sanitary', item: 'Sump, overhead tank, borewell / rainwater pit', unit: 'lump sum', qty: () => 1, rates: { basic: [80000, 120000], standard: [120000, 200000], premium: [200000, 350000] } },
  { id: 'paint', trade: 'Painting & finishing', item: 'Putty, primer & paint (paintable area about 3x built-up)', unit: 'sq ft paintable', qty: p => p.A * 3, rates: { basic: [18, 24], standard: [26, 34], premium: [38, 55] } },
  { id: 'ext', trade: 'Painting & finishing', item: 'External elevation finish', unit: 'sq ft built-up', qty: p => p.A, rates: { basic: [20, 30], standard: [35, 60], premium: [70, 130] } },
  // optional extras (only when the customer asks for them)
  { id: 'boundary', trade: 'Extras', item: 'Boundary wall', unit: 'running ft', qty: p => 4 * Math.sqrt(plotArea(p)), on: p => p.opts.boundary, rates: { basic: [1100, 1400], standard: [1300, 1700], premium: [1700, 2600] } },
  { id: 'gate', trade: 'Extras', item: 'Main gate', unit: 'nos', qty: () => 1, on: p => p.opts.boundary, rates: { basic: [40000, 60000], standard: [60000, 100000], premium: [120000, 300000] } },
  { id: 'lift', trade: 'Extras', item: 'Passenger lift', unit: 'nos', qty: () => 1, on: p => p.opts.lift, rates: { basic: [700000, 900000], standard: [900000, 1300000], premium: [1300000, 2200000] } },
  { id: 'solar', trade: 'Extras', item: 'Rooftop solar (3 kW)', unit: 'kW', qty: () => 3, on: p => p.opts.solar, rates: { basic: [55000, 65000], standard: [58000, 70000], premium: [65000, 80000] } },
  { id: 'wardrobe', trade: 'Extras', item: 'Modular wardrobes', unit: 'bedroom', qty: p => p.BR, on: p => p.opts.wardrobes, rates: { basic: [60000, 90000], standard: [100000, 160000], premium: [200000, 400000] } },
  { id: 'ceiling', trade: 'Extras', item: 'False ceiling (about 60% of area)', unit: 'sq ft', qty: p => p.A * 0.6, on: p => p.opts.falseCeiling, rates: { basic: [65, 85], standard: [85, 120], premium: [130, 220] } },
];

function rateFor(it, tier, ov) {
  const o = ov && ov[it.id] && ov[it.id][tier];
  return o || it.rates[tier];
}

function compute(p, ov) {
  const f = LOCATIONS[p.loc] || 1;
  const lines = [];
  for (const it of ITEMS) {
    if (it.on && !it.on(p)) continue;
    const qty = it.qty(p);
    if (!(qty > 0)) continue;
    const [rl, rh] = rateFor(it, p.tier, ov);
    lines.push({ id: it.id, trade: it.trade, item: it.item, unit: it.unit, qty, rateLo: rl * f, rateHi: rh * f, lo: qty * rl * f, hi: qty * rh * f });
  }
  const trades = [];
  for (const l of lines) {
    let t = trades.find(x => x.trade === l.trade);
    if (!t) { t = { trade: l.trade, lo: 0, hi: 0 }; trades.push(t); }
    t.lo += l.lo; t.hi += l.hi;
  }
  const subLo = lines.reduce((s, l) => s + l.lo, 0);
  const subHi = lines.reduce((s, l) => s + l.hi, 0);
  const ohLo = subLo * MARKUPS.oh[0], ohHi = subHi * MARKUPS.oh[1];
  const contLo = subLo * MARKUPS.cont[0], contHi = subHi * MARKUPS.cont[1];
  const preLo = subLo + ohLo + contLo, preHi = subHi + ohHi + contHi;
  const gstLo = p.gst ? preLo * MARKUPS.gst : 0, gstHi = p.gst ? preHi * MARKUPS.gst : 0;
  const totalLo = preLo + gstLo, totalHi = preHi + gstHi;
  return { lines, trades, subLo, subHi, ohLo, ohHi, contLo, contHi, gstLo, gstHi, totalLo, totalHi, perSqftLo: totalLo / p.A, perSqftHi: totalHi / p.A };
}

/* ---------- Requirement text -> inputs ---------- */

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const AREA_RE = '(\\d+(?:\\.\\d+)?)\\s*(sq\\.?\\s?ft|sqft|sft|square\\s?(?:feet|foot)|sq\\.?\\s?yards?|sq\\.?\\s?yd|sqyd|yards?|gaj|sq\\.?\\s?m(?:eters?|etres?)?|sqm|square\\s?met\\w+)';
const OTHER_WORK_RE = /renovat|remodel|repair|retrofit|commercial|factory|warehouse|showroom|shop\b|office building|hospital|school|\broad\b|bridge|treatment plant|\bstp\b|\bwtp\b|\betp\b/;

function toSqft(n, unit) {
  const u = unit.toLowerCase();
  if (/yard|yd|gaj/.test(u)) return n * 9;
  if (/m(eter|etre)?s?$|sqm|sq\.?\s?m/.test(u) && !/ft|feet|foot/.test(u)) return n * 10.7639;
  return n;
}

function parseRequirement(raw) {
  const text = (raw || '').toLowerCase().replace(/(\d),(\d)/g, '$1$2').replace(/\b(one|two|three|four|five|six)\b/g, (_, w) => NUM_WORDS[w]);
  const out = { understood: [], assumed: [], warnings: [], blocked: null, p: null };
  if (!text.trim()) return out;

  const other = text.match(OTHER_WORK_RE);
  if (other) { out.blocked = other[0].trim(); return out; }

  const v = { opts: {} };

  // areas: plot vs built-up
  const re = new RegExp(AREA_RE, 'g');
  let m;
  while ((m = re.exec(text))) {
    const sqft = toSqft(parseFloat(m[1]), m[2]);
    const after = text.slice(re.lastIndex, re.lastIndex + 14);
    const before = text.slice(Math.max(0, m.index - 20), m.index);
    if (/^\s*(of\s*)?plot/.test(after) || /plot\s*(of|size|area)?\s*:?\s*$/.test(before)) { if (!v.plot) v.plot = sqft; }
    else if (!v.A) v.A = sqft;
  }

  // floors
  let mm;
  if ((mm = text.match(/g\s*\+\s*(\d)/))) v.F = 1 + parseInt(mm[1]);
  else if ((mm = text.match(/(\d)\s*(?:floors?|storey\w*|story|stories)/))) v.F = parseInt(mm[1]);
  else if (/duplex/.test(text)) v.F = 2;
  else if (/triplex/.test(text)) v.F = 3;
  else if (/single\s*(floor|storey|story)|ground floor only|bungalow/.test(text)) v.F = 1;

  // rooms
  if ((mm = text.match(/(\d)\s*bhk/))) { v.BR = parseInt(mm[1]); v.bhk = true; }
  else if ((mm = text.match(/(\d)\s*(?:bed\s?rooms?|\bbr\b|beds?\b)/))) v.BR = parseInt(mm[1]);
  if ((mm = text.match(/(\d)\s*(?:bath\s?rooms?|toilets?|washrooms?|baths?\b)/))) v.BA = parseInt(mm[1]);
  if ((mm = text.match(/(\d)\s*kitchens?/))) v.K = parseInt(mm[1]);

  // finish
  if (/premium|luxury|luxurious|high[- ]end|italian|imported|marble/.test(text)) v.tier = 'premium';
  else if (/basic|economy|economical|budget|low[- ]cost|simple|affordable/.test(text)) v.tier = 'basic';
  else if (/standard|mid[- ]?range|medium|normal/.test(text)) v.tier = 'standard';

  // location
  for (const [re2, name] of LOCATION_ALIASES) if (re2.test(text)) { v.loc = name; break; }

  // extras
  if (/boundary|compound wall|gate/.test(text)) v.opts.boundary = true;
  if (/\blift\b|elevator/.test(text)) v.opts.lift = true;
  if (/solar/.test(text)) v.opts.solar = true;
  if (/wardrobe/.test(text)) v.opts.wardrobes = true;
  if (/false ceiling|pop ceiling|gypsum ceiling/.test(text)) v.opts.falseCeiling = true;
  if (/\bgst\b/.test(text)) v.gst = true;

  // ---- defaults & assumptions ----
  const u = out.understood, a = out.assumed;
  const fmt = n => Math.round(n).toLocaleString('en-IN');

  const F = v.F || 1;
  if (v.F) u.push(`${F} floor${F > 1 ? 's' : ''}`); else a.push('1 floor (ground only)');

  let A = v.A;
  if (A) u.push(`${fmt(A)} sq ft built-up`);
  else if (v.plot) {
    A = Math.round(v.plot * 0.7 * F);
    u.push(`${fmt(v.plot)} sq ft plot`);
    a.push(`${fmt(A)} sq ft built-up (70% of the plot on each floor)`);
  } else if (v.BR) {
    A = v.BR * 600 * (v.bhk ? 1 : 1);
    a.push(`${fmt(A)} sq ft built-up (about 600 sq ft per bedroom)`);
  }
  if (v.plot && v.A) u.push(`${fmt(v.plot)} sq ft plot`);
  if (!A) { out.warnings.push('size'); return out; }

  const BR = v.BR || Math.max(1, Math.round(A / 600));
  if (v.BR) u.push(`${BR} bedroom${BR > 1 ? 's' : ''}`); else a.push(`${BR} bedroom${BR > 1 ? 's' : ''}`);
  const BA = v.BA || BR;
  if (v.BA) u.push(`${BA} bathroom${BA > 1 ? 's' : ''}`); else a.push(`${BA} bathroom${BA > 1 ? 's' : ''}`);
  const K = v.K || 1;
  if (v.K) u.push(`${K} kitchen${K > 1 ? 's' : ''}`); else a.push('1 kitchen');

  const tier = v.tier || 'standard';
  if (v.tier) u.push(`${tier} finish`); else a.push('standard finish');
  const loc = v.loc || 'Delhi NCR';
  if (v.loc) u.push(loc); else a.push('Delhi NCR average rates');

  const extras = { boundary: 'boundary wall & gate', lift: 'lift', solar: 'solar', wardrobes: 'wardrobes', falseCeiling: 'false ceiling' };
  for (const k of Object.keys(extras)) if (v.opts[k]) u.push(extras[k]);
  if (v.gst) u.push('GST included');

  if (A < 200 || A > 50000) out.warnings.push('Size looks unusual. Please check it.');
  if (A / F < 150) out.warnings.push('That is very little area per floor. Please check the size and floors.');

  out.p = { A, F, BR, BA, K, plot: v.plot || 0, tier, loc, opts: v.opts, gst: !!v.gst };
  return out;
}

if (typeof module !== 'undefined') module.exports = { ITEMS, TIERS, LOCATIONS, MARKUPS, compute, parseRequirement };
