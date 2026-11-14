const assert = require('assert');
const { compute, parseRequirement } = require('./engine.js');

const cases = [
  '3 BHK house, 1800 sq ft built-up, G+1, premium finish in Noida with boundary wall and solar',
  'I want to build a house on a 200 sq yard plot in Ghaziabad, two floors, 4 bedrooms, budget finish',
  '2BHK home about 1,100 sqft',
  'Duplex villa 3000 sq ft, 5 bathrooms, lift, false ceiling, modular wardrobes, luxury, Gurgaon, with GST',
  'renovate my kitchen',
  'build something',
  '150 sq m house in Delhi',
];

for (const c of cases) {
  const r = parseRequirement(c);
  console.log('\n> ' + c);
  if (r.blocked) { console.log('  BLOCKED:', r.blocked); continue; }
  if (!r.p) { console.log('  needs size', r.warnings); continue; }
  const res = compute(r.p);
  const sum = res.lines.reduce((s, l) => s + l.lo, 0);
  assert(Math.abs(sum - res.subLo) < 1e-6, 'line sum mismatch');
  assert(Math.abs(res.trades.reduce((s, t) => s + t.hi, 0) - res.subHi) < 1e-6, 'trade sum mismatch');
  assert(res.totalLo < res.totalHi);
  console.log('  inputs :', JSON.stringify(r.p));
  console.log('  said   :', r.understood.join(' | '));
  console.log('  assumed:', r.assumed.join(' | '));
  console.log('  total  : Rs', (res.totalLo / 1e5).toFixed(1), 'L -', (res.totalHi / 1e5).toFixed(1), 'L ; per sqft', Math.round(res.perSqftLo), '-', Math.round(res.perSqftHi));
}

// tier sanity: same house, per-sqft by finish
for (const t of ['basic', 'standard', 'premium']) {
  const r = parseRequirement(`3 bhk 1800 sq ft g+1 ${t} finish`);
  const res = compute(r.p);
  console.log(t.padEnd(9), Math.round(res.perSqftLo), '-', Math.round(res.perSqftHi), 'Rs/sqft');
}
console.log('\nALL ASSERTIONS PASSED');
