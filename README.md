# BuildBudget (Step 2 prototype)

Describe a construction project in plain words, get an itemised budget range, then collect real quotes from vendors that replace the estimates line by line.

## How it works
1. **Customer** types a requirement. The app reads size, floors, rooms, finish, city and extras, assumes the rest, and shows an itemised budget range.
2. **Get quotes from vendors** sends the itemised list (quantities frozen) as a request. Vendors see project details and the customer's first name only, not the phone number or the estimate.
3. **Vendors** register their trades, see matching requests, and enter a rate per unit for the items they do.
4. **Live budget**: each item with a quote becomes a real price (lowest quote wins), the rest stay estimated, so the range narrows as quotes arrive. A comparison table shows every vendor line by line.

## Files
- `index.html` - the working page (open it in a browser). Built from the files below.
- `engine.js` - requirement parser, rate table, budget calculation and `liveBudget()`.
- `store.js` - data layer. **Demo mode: data lives in this browser's localStorage**, so a customer tab and a vendor tab in the same browser update each other. Replace its internals with a real backend (e.g. Supabase) so different people on different devices share data.
- `app.js` - screens: budget, My quotes, vendor portal.
- `template.html` - page layout and styles.
- `build.py` - run `python3 build.py` after editing any file above to rebuild `index.html`.
- `test.js`, `test_step2.js` - run `node test.js && node test_step2.js`.

## Scope and limits
- New residential houses, Delhi NCR only. Other work types are refused politely for now.
- All rates are indicative placeholders until replaced with verified contractor and vendor rates (admin section on the first screen).
- No sign-in, payments or real notifications yet. "Demo: simulate vendor quotes" adds fake vendors for demonstration.
