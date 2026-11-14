# BuildBudget (Step 1 prototype)

Describe a construction project in plain words and get an itemised budget range.

- `index.html` - the working page (open it in a browser). Built from `template.html` + `engine.js`.
- `engine.js` - requirement text parser, quantity logic, rate table and budget calculation.
- `template.html` - page layout and UI code.
- `test.js` - run `node test.js` to check the estimator on sample requirements.
- `build.py` - run `python3 build.py` to rebuild `index.html` after editing `engine.js` or `template.html`.

Scope: new residential houses in Delhi NCR. All rates are indicative placeholders until replaced with verified contractor and vendor rates.
