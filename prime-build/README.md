# Prime Build · deals

Deal and profit tracker for შპს „პრაიმ ბილდი 2020“ (construction materials bought and resold).
Live at https://rezimod.github.io/rezis-finances/prime-build/ — a single `index.html`, same look as Mars.

- Uses the same private Google Apps Script backend as Mars (the saved connection on this origin is reused),
  in collections `pb_deal`, `pb_money`, `pb_cfg`. Mars never reads them.
- Settings → "Import from the sheet" pulls the `გარიგებები` tab of the Google Sheet tracker through the backend's
  `orders` action; a line already imported is updated, a line edited in the app is kept.
- Profit = sale − purchase − extra cost, per line; a purchase without a sale is stock, not cost.
- Money page: every payment in/out; books balance = opening balance + entries since the opening date; the real
  bank balance is typed and compared. Checks page lists everything that looks wrong.
