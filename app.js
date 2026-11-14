/* BuildBudget UI: customer budget, quotes view, vendor portal. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = n => Math.round(n).toLocaleString('en-IN');
  const money = n => n >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + ' Cr' : n >= 1e5 ? '₹' + (n / 1e5).toFixed(1) + ' L' : '₹' + inr(n);
  const qtyFmt = q => q >= 100 ? inr(q) : (Math.round(q * 10) / 10).toLocaleString('en-IN');
  const dateFmt = t => { try { return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } };

  const req = $('#req'), out = $('#out');
  const EXAMPLES = [
    '3 BHK house, 1800 sq ft, G+1, standard finish in Noida',
    'Villa on a 300 sq yard plot in Gurugram, premium finish, lift and solar',
    '2 BHK home 1100 sq ft, budget finish, Ghaziabad',
  ];

  let overrides = {};
  try { overrides = JSON.parse(localStorage.getItem('bb_rates') || '{}') || {}; } catch (e) { overrides = {}; }
  const saveOv = () => { try { localStorage.setItem('bb_rates', JSON.stringify(overrides)); } catch (e) {} };

  let last = null;          // last successful customer estimate {p,res,parsed}
  let compareOpen = {};     // rfqId -> comparison table open
  let vendorMsg = {};       // rfqId -> message after sending a quote

  /* ================= Customer: budget ================= */
  function render() {
    const text = req.value;
    if (!text.trim()) { last = null; out.innerHTML = '<div class="empty">Your budget will appear here as you type.</div>'; renderRates(); return; }
    const parsed = parseRequirement(text);

    if (parsed.blocked) {
      last = null;
      out.innerHTML = '<div class="card"><p class="eyebrow">Not covered yet</p><h2 style="margin:0 0 6px">This looks like a different type of work.</h2><p class="persq">This version prices <b>new residential houses</b> only. Renovation, commercial and industrial work are planned for later steps. If you also want a new house priced, describe just that part.</p></div>';
      renderRates(); return;
    }
    if (!parsed.p) {
      last = null;
      out.innerHTML = '<div class="card"><p class="eyebrow">One more detail</p><h2 style="margin:0 0 6px">How big is it?</h2><p class="persq">Add the size, for example <b>1800 sq ft</b> built-up, or a plot such as <b>200 sq yard plot</b>. The number of bedrooms (like <b>3 BHK</b>) also works.</p></div>';
      renderRates(); return;
    }

    const p = parsed.p, res = compute(p, overrides);
    last = { p, res, parsed };

    const chips = parsed.understood.map(x => '<span class="chip">' + esc(x) + '</span>').join('') +
      parsed.assumed.map(x => '<span class="chip a">assumed: ' + esc(x) + '</span>').join('');
    const warn = parsed.warnings.map(w => '<div class="note">' + esc(w) + '</div>').join('');

    const maxHi = Math.max.apply(null, res.trades.map(t => t.hi));
    const tradeRows = res.trades.map(t => {
      const share = Math.round(((t.lo + t.hi) / 2) / ((res.subLo + res.subHi) / 2) * 100);
      return '<div class="trade"><div>' + esc(t.trade) + '<br><span class="hint">' + share + '% of works</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(t.hi / maxHi * 100) + '%"></i></div>' +
        '<div class="amt">' + money(t.lo) + ' – ' + money(t.hi) + '</div></div>';
    }).join('');

    let rows = '', cur = '';
    for (const l of res.lines) {
      if (l.trade !== cur) { cur = l.trade; rows += '<tr class="g"><td colspan="5">' + esc(cur) + '</td></tr>'; }
      rows += '<tr><td>' + esc(l.item) + '</td><td>' + qtyFmt(l.qty) + ' ' + esc(l.unit) + '</td><td>₹' + inr(l.rateLo) + ' – ' + inr(l.rateHi) + '</td><td>₹' + inr(l.lo) + '</td><td>₹' + inr(l.hi) + '</td></tr>';
    }
    const ex = (label, lo, hi) => '<tr><td colspan="3">' + label + '</td><td>₹' + inr(lo) + '</td><td>₹' + inr(hi) + '</td></tr>';
    rows += '<tr class="g"><td colspan="5">Add-ons</td></tr>' +
      ex('Site supervision, scaffolding &amp; contractor margin (' + Math.round(MARKUPS.oh[0] * 100) + '–' + Math.round(MARKUPS.oh[1] * 100) + '%)', res.ohLo, res.ohHi) +
      ex('Contingency (' + Math.round(MARKUPS.cont[0] * 100) + '–' + Math.round(MARKUPS.cont[1] * 100) + '%)', res.contLo, res.contHi) +
      (p.gst ? ex('GST (' + Math.round(MARKUPS.gst * 100) + '%, indicative)', res.gstLo, res.gstHi) : '') +
      '<tr class="tot"><td colspan="3">Total</td><td>₹' + inr(res.totalLo) + '</td><td>₹' + inr(res.totalHi) + '</td></tr>';

    out.innerHTML =
      warn +
      '<div class="card"><p class="eyebrow">Estimated budget</p>' +
      '<p class="range">' + money(res.totalLo) + '<span>to</span>' + money(res.totalHi) + '</p>' +
      '<p class="persq">About ₹' + inr(res.perSqftLo) + ' – ' + inr(res.perSqftHi) + ' per sq ft on ' + inr(p.A) + ' sq ft built-up' + (p.gst ? ' (GST included)' : '') + '</p>' +
      '<div class="chips">' + chips + '</div>' +
      '<p class="lbl">Not right? Edit your description above and the budget updates.</p></div>' +

      '<div class="card"><h2>Where the money goes</h2>' + tradeRows + '</div>' +

      '<div class="card"><details class="boq"><summary>Full itemised budget (' + res.lines.length + ' items)</summary>' +
      '<div class="tbl"><table><thead><tr><th>Item</th><th>Quantity</th><th>Rate (₹)</th><th>Low</th><th>High</th></tr></thead><tbody>' + rows + '</tbody></table></div></details></div>' +

      '<div class="card"><h2>Not included</h2><ul class="excl">' +
      '<li>Land, registry and stamp duty</li><li>Architect, structural engineer and sanction / approval fees</li>' +
      '<li>Electricity, water and sewer connection charges</li><li>Furniture, curtains, appliances and interior work' + (p.opts.wardrobes || p.opts.falseCeiling ? ' (other than the extras listed)' : '') + '</li>' +
      '<li>Landscaping, and any soil or site problems found later</li></ul></div>' +

      '<div class="actions"><button class="btn" id="rfqBtn">Get quotes from vendors</button>' +
      '<button class="ghost" id="copy">Copy itemised budget</button></div><div id="copyslot"></div><div id="rfqSlot"></div>';

    $('#copy').onclick = copyBoq;
    $('#rfqBtn').onclick = openRfqForm;
    renderRates();
  }

  function openRfqForm() {
    if (!last) return;
    $('#rfqSlot').innerHTML =
      '<div class="card" style="margin-top:16px"><h2>Send your budget to vendors</h2>' +
      '<p class="hint">Vendors see your project details and first name only. Your phone number is not shown to them in this version.</p>' +
      '<div class="fgrid"><label class="f">Your name<input id="cName" autocomplete="name"></label>' +
      '<label class="f">Phone<input id="cPhone" inputmode="tel" autocomplete="tel"></label></div>' +
      '<div id="rfqErr"></div><button class="btn" id="rfqSend">Send for quotes</button></div>';
    $('#cName').focus();
    $('#rfqSend').onclick = sendRfq;
  }
  function sendRfq() {
    const name = $('#cName').value.trim(), phone = $('#cPhone').value.trim();
    const err = m => { $('#rfqErr').innerHTML = '<p class="err">' + esc(m) + '</p>'; };
    if (!name) return err('Please enter your name.');
    if (phone.replace(/\D/g, '').length < 10) return err('Please enter a valid 10-digit phone number.');
    const { p, res } = last;
    const lines = res.lines.map(l => ({ id: l.id, trade: l.trade, item: l.item, unit: l.unit, qty: l.qty, lo: l.lo, hi: l.hi }));
    const rfq = Store.createRfq({ name, phone, city: p.loc, text: req.value, p, lines });
    compareOpen[rfq.id] = false;
    location.hash = 'quotes';
  }

  function boqText() {
    const { p, res } = last;
    const L = ['BUILDBUDGET ESTIMATE (indicative)', 'Area: ' + inr(p.A) + ' sq ft | Floors: ' + p.F + ' | Finish: ' + p.tier + ' | ' + p.loc, ''];
    let cur = '';
    for (const l of res.lines) {
      if (l.trade !== cur) { cur = l.trade; L.push(cur.toUpperCase()); }
      L.push('- ' + l.item + ': ' + qtyFmt(l.qty) + ' ' + l.unit + ' @ Rs ' + inr(l.rateLo) + '-' + inr(l.rateHi) + ' = Rs ' + inr(l.lo) + ' to ' + inr(l.hi));
    }
    L.push('', 'Total: Rs ' + inr(res.totalLo) + ' to Rs ' + inr(res.totalHi));
    return L.join('\n');
  }
  function copyBoq() {
    if (!last) return;
    const t = boqText(), slot = $('#copyslot');
    const showBox = () => { slot.innerHTML = '<textarea id="copybox" readonly></textarea>'; const b = $('#copybox'); b.value = t; b.focus(); b.select(); };
    try { navigator.clipboard.writeText(t).then(() => { slot.innerHTML = '<p class="hint">Copied.</p>'; }, showBox); } catch (e) { showBox(); }
  }

  function renderRates() {
    const tier = last ? last.p.tier : 'standard';
    let h = '<thead><tr><th>Item (' + tier + ' finish)</th><th>Unit</th><th>Low ₹</th><th>High ₹</th></tr></thead><tbody>';
    for (const it of ITEMS) {
      const r = rateFor(it, tier, overrides);
      h += '<tr><td>' + esc(it.item) + '</td><td>' + esc(it.unit) + '</td>' +
        '<td><input class="vin" type="number" min="0" data-id="' + it.id + '" data-k="0" value="' + r[0] + '"></td>' +
        '<td><input class="vin" type="number" min="0" data-id="' + it.id + '" data-k="1" value="' + r[1] + '"></td></tr>';
    }
    $('#rates').innerHTML = h + '</tbody>';
  }
  $('#rates').addEventListener('change', e => {
    const i = e.target; if (!i.dataset.id) return;
    const tier = last ? last.p.tier : 'standard';
    const it = ITEMS.find(x => x.id === i.dataset.id), cur = rateFor(it, tier, overrides).slice();
    const v = parseFloat(i.value); if (!(v >= 0)) return;
    cur[parseInt(i.dataset.k)] = v;
    if (cur[0] > cur[1]) cur.sort((a, b) => a - b);
    overrides[it.id] = overrides[it.id] || {}; overrides[it.id][tier] = cur;
    saveOv(); render();
  });
  $('#resetRates').onclick = () => { overrides = {}; saveOv(); render(); };

  $('#examples').innerHTML = EXAMPLES.map((x, i) => '<button class="ex" data-i="' + i + '">' + esc(x) + '</button>').join('');
  $('#examples').addEventListener('click', e => { const b = e.target.closest('.ex'); if (!b) return; req.value = EXAMPLES[+b.dataset.i]; render(); req.focus(); });
  let tm; req.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(render, 250); });
  $('#go').onclick = () => { render(); try { out.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} };

  /* ================= Customer: quotes ================= */
  function myRfqs() { return (Store.pref('mine') || []).map(id => Store.rfq(id)).filter(Boolean).reverse(); }

  function renderQuotes() {
    const mine = myRfqs();
    $('#qcount').textContent = mine.length ? String(mine.length) : '';
    const box = $('#quotesOut');
    if (!mine.length) {
      box.innerHTML = '<div class="card"><p class="eyebrow">Nothing yet</p><h2 style="margin:0 0 6px">You have not asked for quotes.</h2><p class="persq">Describe your project, then press <b>Get quotes from vendors</b>.</p><p><a class="btn" style="text-decoration:none;display:inline-block" href="#home">Get a budget</a></p></div>';
      return;
    }
    box.innerHTML = mine.map(rfqCard).join('');
  }

  function rfqCard(r) {
    const qs = Store.quotesFor(r.id), lb = liveBudget(r, qs);
    const nv = Object.keys(lb.vendorTotals).length;
    const pct = Math.round(lb.quoted / lb.totalLines * 100);
    const status = lb.quoted === 0
      ? 'Waiting for vendor quotes. This is still an estimate.'
      : lb.quoted === lb.totalLines
        ? 'All ' + lb.totalLines + ' items now have real prices from ' + nv + ' vendor' + (nv > 1 ? 's' : '') + '.'
        : lb.quoted + ' of ' + lb.totalLines + ' items now have real prices from ' + nv + ' vendor' + (nv > 1 ? 's' : '') + '. The rest are still estimates.';
    const p = r.p;
    let h = '<div class="card"><div class="reqhead"><h2 style="margin:0">' + inr(p.A) + ' sq ft · ' + p.F + ' floor' + (p.F > 1 ? 's' : '') + ' · ' + esc(p.tier) + ' · ' + esc(p.loc) + '</h2><span class="pill">Sent ' + dateFmt(r.created) + '</span></div>' +
      '<p class="eyebrow" style="margin-top:14px">' + (lb.quoted === lb.totalLines ? 'Budget from vendor quotes' : 'Budget now') + '</p>' +
      '<p class="range">' + money(lb.totalLo) + '<span>to</span>' + money(lb.totalHi) + '</p>' +
      '<div class="progress"><i style="width:' + pct + '%"></i></div><p class="persq" style="margin-top:2px">' + esc(status) + '</p>' +
      '<div class="actions" style="margin-top:14px">' +
      (lb.quoted ? '<button class="ghost" data-act="compare" data-rfq="' + r.id + '">' + (compareOpen[r.id] ? 'Hide' : 'Compare') + ' line by line</button>' : '') +
      '<button class="link demo" data-act="demo" data-rfq="' + r.id + '">Demo: simulate vendor quotes</button></div>';
    if (compareOpen[r.id] && lb.quoted) h += comparison(r, lb);
    return h + '</div>';
  }

  function comparison(r, lb) {
    const vids = Object.keys(lb.vendorTotals);
    const vs = vids.map(id => Store.vendor(id)).filter(Boolean).sort((a, b) => a.firm.localeCompare(b.firm));
    let h = '<div class="tbl"><table><thead><tr><th>Item</th><th>Estimate</th>' + vs.map(v => '<th class="vh">' + esc(v.firm) + '</th>').join('') + '</tr></thead><tbody>';
    let cur = '';
    for (const x of lb.per) {
      if (x.line.trade !== cur) { cur = x.line.trade; h += '<tr class="g"><td colspan="' + (2 + vs.length) + '">' + esc(cur) + '</td></tr>'; }
      h += '<tr><td>' + esc(x.line.item) + '<small>' + qtyFmt(x.line.qty) + ' ' + esc(x.line.unit) + '</small></td><td>₹' + inr(x.line.lo) + ' – ' + inr(x.line.hi) + '</td>';
      for (const v of vs) {
        const q = x.quotes.find(y => y.vendorId === v.id);
        if (!q) { h += '<td class="na">–</td>'; continue; }
        h += '<td class="' + (x.best && x.best.vendorId === v.id ? 'best' : '') + '">₹' + inr(q.amount) + '<small>₹' + inr(q.rate) + ' / ' + esc(x.line.unit) + '</small></td>';
      }
      h += '</tr>';
    }
    h += '<tr class="tot"><td>Their total</td><td></td>' + vs.map(v => { const t = lb.vendorTotals[v.id]; return '<td>₹' + inr(t.amount) + '<small>' + t.covered + ' of ' + lb.totalLines + ' items</small></td>'; }).join('') + '</tr>';
    h += '</tbody></table></div><p class="hint">Green = lowest price for that item. The budget above uses the lowest quote for each item and keeps estimating the rest. Check that vendors quote the same scope and quality before choosing.</p>';
    return h;
  }

  /* ================= Vendor portal ================= */
  function renderVendor() {
    const box = $('#vendorOut');
    const vid = Store.pref('vendorId'), v = vid && Store.vendor(vid);
    if (!v) { box.innerHTML = vendorForm(); return; }
    const rfqs = Store.rfqsForVendor(v).slice().reverse();
    let h = '<div class="card"><div class="reqhead"><h2 style="margin:0">' + esc(v.firm) + '</h2><button class="link" data-act="vsignout">Not you? Switch vendor</button></div>' +
      '<div class="chips">' + v.trades.map(t => '<span class="chip">' + esc(t) + '</span>').join('') + '</div></div>';
    if (!rfqs.length) h += '<div class="card"><p class="eyebrow">No open requests</p><p class="persq">No customer request matches your trades yet. New requests appear here automatically.</p></div>';
    for (const r of rfqs) h += vendorRfq(r, v);
    box.innerHTML = h;
  }

  function vendorForm() {
    return '<div class="card"><h2>Register your firm</h2>' +
      '<div class="fgrid"><label class="f">Firm name<input id="vFirm"></label><label class="f">Contact person<input id="vContact"></label>' +
      '<label class="f">Phone<input id="vPhone" inputmode="tel"></label>' +
      '<label class="f">City<select id="vCity">' + Object.keys(LOCATIONS).map(c => '<option>' + esc(c) + '</option>').join('') + '</select></label></div>' +
      '<p class="eyebrow" style="margin:0">Trades you cover</p>' +
      '<div class="tradepick">' + TRADES.map(t => '<label><input type="checkbox" name="vTrade" value="' + esc(t) + '">' + esc(t) + '</label>').join('') + '</div>' +
      '<div id="vErr"></div><button class="btn" data-act="vregister">Register and see requests</button></div>';
  }

  function vendorRfq(r, v) {
    const p = r.p, mineLines = r.lines.filter(l => v.trades.indexOf(l.trade) >= 0);
    const existing = Store.quotesFor(r.id).find(q => q.vendorId === v.id);
    const rates = existing ? existing.rates : {};
    let rows = '', cur = '';
    for (const l of mineLines) {
      if (l.trade !== cur) { cur = l.trade; rows += '<tr class="g"><td colspan="4">' + esc(cur) + '</td></tr>'; }
      const val = rates[l.id] != null ? rates[l.id] : '';
      rows += '<tr><td>' + esc(l.item) + '</td><td>' + qtyFmt(l.qty) + ' ' + esc(l.unit) + '</td>' +
        '<td><input class="vin" type="number" min="0" inputmode="decimal" data-rfq="' + r.id + '" data-line="' + l.id + '" data-qty="' + l.qty + '" value="' + val + '" placeholder="₹ / ' + esc(l.unit) + '"></td>' +
        '<td class="amtcell" data-amt="' + l.id + '">' + (val !== '' ? '₹' + inr(val * l.qty) : '') + '</td></tr>';
    }
    const total = mineLines.reduce((s, l) => s + (rates[l.id] > 0 ? rates[l.id] * l.qty : 0), 0);
    return '<div class="card" data-card="' + r.id + '"><div class="reqhead"><h2 style="margin:0">' + inr(p.A) + ' sq ft house · ' + p.F + ' floor' + (p.F > 1 ? 's' : '') + ' · ' + esc(p.tier) + ' finish</h2>' +
      '<span class="pill">' + esc(r.city) + ' · ' + esc(r.name.split(' ')[0]) + '</span></div>' +
      '<p class="hint">Quote your rate per unit for the items you do. Leave an item blank if you do not do it. Your rate should include materials and labour as per the scope.</p>' +
      '<div class="tbl"><table><thead><tr><th>Item</th><th>Quantity</th><th>Your rate</th><th>Amount</th></tr></thead><tbody>' + rows +
      '<tr class="tot"><td colspan="3">Total of your quote</td><td data-vtotal="' + r.id + '">₹' + inr(total) + '</td></tr></tbody></table></div>' +
      '<label class="f" style="margin-top:12px">Note to customer (optional)<textarea rows="2" data-note="' + r.id + '">' + esc(existing ? existing.note : '') + '</textarea></label>' +
      '<div class="actions" style="margin-top:12px"><button class="btn" data-act="vquote" data-rfq="' + r.id + '">' + (existing ? 'Update my quote' : 'Send my quote') + '</button></div>' +
      (vendorMsg[r.id] ? '<p class="ok">' + esc(vendorMsg[r.id]) + '</p>' : '') + '</div>';
  }

  /* ================= Events ================= */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, id = b.dataset.rfq;
    if (act === 'compare') { compareOpen[id] = !compareOpen[id]; renderQuotes(); }
    else if (act === 'demo') { compareOpen[id] = true; Store.seedDemoQuotes(id); renderQuotes(); }
    else if (act === 'vsignout') { Store.pref('vendorId', ''); renderVendor(); }
    else if (act === 'vregister') {
      const firm = $('#vFirm').value.trim(), trades = Array.prototype.map.call(document.querySelectorAll('input[name=vTrade]:checked'), x => x.value);
      const err = m => { $('#vErr').innerHTML = '<p class="err">' + esc(m) + '</p>'; };
      if (!firm) return err('Please enter your firm name.');
      if (!trades.length) return err('Pick at least one trade you cover.');
      const v = Store.registerVendor({ firm, contact: $('#vContact').value, phone: $('#vPhone').value, city: $('#vCity').value, trades });
      Store.pref('vendorId', v.id); renderVendor();
    }
    else if (act === 'vquote') {
      const vid = Store.pref('vendorId'); if (!vid) return;
      const rates = {};
      document.querySelectorAll('input[data-rfq="' + id + '"][data-line]').forEach(i => { if (i.value !== '') rates[i.dataset.line] = i.value; });
      const note = document.querySelector('[data-note="' + id + '"]');
      Store.submitQuote({ rfqId: id, vendorId: vid, rates, note: note ? note.value : '' });
      const n = Object.keys(Store.quotesFor(id).find(q => q.vendorId === vid).rates).length;
      vendorMsg[id] = n ? 'Quote sent for ' + n + ' item' + (n > 1 ? 's' : '') + '. The customer\'s budget has updated.' : 'Nothing to send yet. Enter a rate for at least one item.';
      renderVendor();
    }
  });
  // live amount while a vendor types a rate
  document.addEventListener('input', e => {
    const i = e.target; if (!i.dataset || !i.dataset.line) return;
    const rfq = i.dataset.rfq, qty = parseFloat(i.dataset.qty), r = parseFloat(i.value);
    const cell = document.querySelector('[data-card="' + rfq + '"] [data-amt="' + i.dataset.line + '"]');
    if (cell) cell.textContent = r > 0 ? '₹' + inr(r * qty) : '';
    let t = 0;
    document.querySelectorAll('input[data-rfq="' + rfq + '"][data-line]').forEach(x => { const v = parseFloat(x.value); if (v > 0) t += v * parseFloat(x.dataset.qty); });
    const tot = document.querySelector('[data-vtotal="' + rfq + '"]'); if (tot) tot.textContent = '₹' + inr(t);
  });

  /* ================= Routing ================= */
  let current = 'home';
  function route() {
    const h = (location.hash || '#home').slice(1);
    current = ['home', 'quotes', 'vendor'].indexOf(h) >= 0 ? h : 'home';
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + current));
    document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === current));
    if (current === 'quotes') renderQuotes();
    if (current === 'vendor') renderVendor();
    renderQuotesBadge();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function renderQuotesBadge() { const n = myRfqs().length; $('#qcount').textContent = n ? String(n) : ''; }
  window.addEventListener('hashchange', route);

  // live updates: when data changes (this tab or another tab), refresh the visible view
  Store.onChange(() => {
    renderQuotesBadge();
    if (current === 'quotes') renderQuotes();
    if (current === 'vendor') {
      const a = document.activeElement;
      if (!(a && a.closest && a.closest('#vendorOut') && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) renderVendor();
    }
  });

  render();
  route();
})();
