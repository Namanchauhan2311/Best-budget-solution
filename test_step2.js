// Step 2 tests: live budget + data layer
const assert = require('assert');
const eng = require('./engine.js');
global.TRADES = eng.TRADES;
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const { Store } = require('./store.js');

const parsed = eng.parseRequirement('3 BHK house, 1800 sq ft, G+1, standard finish in Noida with boundary wall');
const res = eng.compute(parsed.p);
const lines = res.lines.map(l => ({ id: l.id, trade: l.trade, item: l.item, unit: l.unit, qty: l.qty, lo: l.lo, hi: l.hi }));

// 1. no quotes -> live budget equals the plain estimate
const rfq0 = { p: parsed.p, lines };
const lb0 = eng.liveBudget(rfq0, []);
assert(Math.abs(lb0.totalLo - res.totalLo) < 1, 'no quotes should equal estimate (lo)');
assert(Math.abs(lb0.totalHi - res.totalHi) < 1, 'no quotes should equal estimate (hi)');
assert.strictEqual(lb0.quoted, 0);

// 2. create a request, register a vendor, quote two lines
Store._reset();
const rfq = Store.createRfq({ name: 'Rahul', phone: '9999999999', city: 'Noida', text: 'x', p: parsed.p, lines });
assert.strictEqual(Store.rfqs().length, 1);
assert.deepStrictEqual(Store.pref('mine'), [rfq.id]);
const v = Store.registerVendor({ firm: 'Test Civil', trades: ['RCC structure'], city: 'Noida' });
assert.strictEqual(Store.rfqsForVendor(v).length, 1);
const vOther = Store.registerVendor({ firm: 'Painters', trades: ['Nonexistent'], city: 'Noida' });
assert.strictEqual(Store.rfqsForVendor(vOther).length, 0, 'vendor with no matching trade sees nothing');

const rcc = lines.find(l => l.id === 'rcc');
Store.submitQuote({ rfqId: rfq.id, vendorId: v.id, rates: { rcc: 700, junk: -5, brick: '' } });
let qs = Store.quotesFor(rfq.id);
assert.strictEqual(qs.length, 1);
assert.deepStrictEqual(qs[0].rates, { rcc: 700 }, 'invalid rates dropped');
// re-quote replaces
Store.submitQuote({ rfqId: rfq.id, vendorId: v.id, rates: { rcc: 690 } });
assert.strictEqual(Store.quotesFor(rfq.id).length, 1, 'same vendor re-quote replaces');

// 3. live budget with a firm line
const lb1 = eng.liveBudget(Store.rfq(rfq.id), Store.quotesFor(rfq.id));
assert.strictEqual(lb1.quoted, 1);
assert(Math.abs(lb1.firm - 690 * rcc.qty) < 1e-6);
assert(lb1.totalHi - lb1.totalLo < lb0.totalHi - lb0.totalLo, 'range narrows once a line is firm');

// 4. lowest of two vendors wins
const v2 = Store.registerVendor({ firm: 'Cheaper Civil', trades: ['RCC structure'], city: 'Noida' });
Store.submitQuote({ rfqId: rfq.id, vendorId: v2.id, rates: { rcc: 650 } });
const lb2 = eng.liveBudget(Store.rfq(rfq.id), Store.quotesFor(rfq.id));
assert.strictEqual(lb2.per.find(x => x.line.id === 'rcc').best.vendorId, v2.id);
assert(Math.abs(lb2.firm - 650 * rcc.qty) < 1e-6);
assert.strictEqual(lb2.vendorTotals[v.id].covered, 1);

// 5. demo seeding covers every line and produces a tight range around the estimate
Store.seedDemoQuotes(rfq.id);
const lb3 = eng.liveBudget(Store.rfq(rfq.id), Store.quotesFor(rfq.id));
assert.strictEqual(lb3.quoted, lb3.totalLines, 'all lines quoted after demo vendors');
assert(lb3.totalLo > res.totalLo * 0.7 && lb3.totalHi < res.totalHi * 1.2, 'demo total near estimate');
assert(lb3.totalHi / lb3.totalLo < 1.1, 'fully quoted range is tight (only contingency spread)');
// seeding twice must not duplicate demo vendors
const nBefore = Store.vendors().length; Store.seedDemoQuotes(rfq.id);
assert.strictEqual(Store.vendors().length, nBefore, 'demo vendors reused');

// 6. GST flag applies
const pg = Object.assign({}, parsed.p, { gst: true });
const lbg = eng.liveBudget({ p: pg, lines }, []);
assert(Math.abs(lbg.totalLo / lb0.totalLo - 1.18) < 1e-9);

console.log('estimate        :', (res.totalLo / 1e5).toFixed(1), '-', (res.totalHi / 1e5).toFixed(1), 'L');
console.log('after 1 quote   :', (lb1.totalLo / 1e5).toFixed(1), '-', (lb1.totalHi / 1e5).toFixed(1), 'L');
console.log('after all quotes:', (lb3.totalLo / 1e5).toFixed(1), '-', (lb3.totalHi / 1e5).toFixed(1), 'L');
console.log('STEP 2 TESTS PASSED');
