/* BuildBudget data layer (Step 2: demo mode).
   Keeps vendors, quote requests (RFQs) and quotes in this browser's localStorage, so a customer tab and a vendor tab
   in the same browser update each other live. Replace the internals of this file with a real backend (for example
   Supabase) to let customers and vendors on different devices see the same data. The rest of the app only uses
   the functions returned at the bottom. */

const Store = (function () {
  const KEY = 'bb_db_v1', PREF = 'bb_pref_v1';
  let memDb = null, memPref = {};
  const subs = [];

  const empty = () => ({ vendors: [], rfqs: [], quotes: [] });
  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return memDb || empty();
  }
  function save(db) { memDb = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} emit(); }
  function emit() { subs.forEach(f => { try { f(); } catch (e) {} }); }
  try { window.addEventListener('storage', e => { if (e.key === KEY) emit(); }); } catch (e) {}

  const uid = p => p + Math.random().toString(36).slice(2, 8);

  // per-browser preferences: which vendor I am, which requests are mine
  function pref(k, v) {
    let all = memPref;
    try { all = JSON.parse(localStorage.getItem(PREF) || '{}') || {}; } catch (e) {}
    if (v === undefined) return all[k];
    all[k] = v; memPref = all;
    try { localStorage.setItem(PREF, JSON.stringify(all)); } catch (e) {}
    return v;
  }

  function registerVendor(v) {
    const db = load();
    const vendor = { id: uid('v_'), firm: v.firm.trim(), contact: (v.contact || '').trim(), phone: (v.phone || '').trim(), city: v.city, trades: v.trades.slice(), created: Date.now(), demo: !!v.demo };
    db.vendors.push(vendor); save(db);
    return vendor;
  }

  function createRfq(r) {
    const db = load();
    const rfq = { id: uid('r_'), name: r.name.trim(), phone: r.phone.trim(), city: r.city, text: r.text, p: r.p, lines: r.lines, status: 'open', created: Date.now() };
    db.rfqs.push(rfq); save(db);
    const mine = pref('mine') || []; mine.push(rfq.id); pref('mine', mine);
    return rfq;
  }

  function submitQuote(q) {
    const db = load();
    const rates = {};
    for (const k of Object.keys(q.rates)) { const n = parseFloat(q.rates[k]); if (n > 0) rates[k] = n; }
    db.quotes = db.quotes.filter(x => !(x.rfqId === q.rfqId && x.vendorId === q.vendorId));
    const quote = { id: uid('q_'), rfqId: q.rfqId, vendorId: q.vendorId, rates, note: (q.note || '').trim(), created: Date.now() };
    db.quotes.push(quote); save(db);
    return quote;
  }

  // RFQs a vendor can quote on: open, and at least one line in one of the vendor's trades
  function rfqsForVendor(vendor) {
    return load().rfqs.filter(r => r.status === 'open' && r.lines.some(l => vendor.trades.indexOf(l.trade) >= 0));
  }

  // Demo only: three specialist vendors and one all-round contractor quote a request, so the live budget can be shown.
  function seedDemoQuotes(rfqId) {
    const db0 = load(), rfq = db0.rfqs.find(r => r.id === rfqId);
    if (!rfq) return 0;
    const defs = [
      { firm: 'Sharma Civil Works', trades: ['Site & foundation', 'RCC structure', 'Masonry & plaster', 'Waterproofing', 'Extras'], bias: 0.97 },
      { firm: 'Delhi Finish Co.', trades: ['Flooring & tiling', 'Kitchen', 'Doors & windows', 'Painting & finishing'], bias: 1.02 },
      { firm: 'ElectroPlumb Services', trades: ['Electrical', 'Plumbing & sanitary'], bias: 0.95 },
      { firm: 'Metro Builders (turnkey)', trades: TRADES, bias: 1.06 },
    ];
    let made = 0;
    for (const d of defs) {
      let v = load().vendors.find(x => x.demo && x.firm === d.firm);
      if (!v) v = registerVendor({ firm: d.firm, contact: 'Demo', phone: '', city: rfq.city, trades: d.trades, demo: true });
      const rates = {};
      for (const l of rfq.lines) {
        if (d.trades.indexOf(l.trade) < 0) continue;
        let h = 0; const s = l.id + v.firm;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000;
        const jitter = 0.92 + (h / 1000) * 0.16; // 0.92 .. 1.08
        rates[l.id] = Math.round(((l.lo + l.hi) / 2 / l.qty) * d.bias * jitter);
      }
      submitQuote({ rfqId, vendorId: v.id, rates, note: 'Demo quote' });
      made++;
    }
    return made;
  }

  return {
    onChange: f => subs.push(f),
    pref,
    vendors: () => load().vendors,
    vendor: id => load().vendors.find(v => v.id === id),
    rfqs: () => load().rfqs,
    rfq: id => load().rfqs.find(r => r.id === id),
    quotesFor: rfqId => load().quotes.filter(q => q.rfqId === rfqId),
    registerVendor, createRfq, submitQuote, rfqsForVendor, seedDemoQuotes,
    _reset: () => { memDb = null; memPref = {}; try { localStorage.removeItem(KEY); localStorage.removeItem(PREF); } catch (e) {} },
  };
})();

if (typeof module !== 'undefined') module.exports = { Store };
