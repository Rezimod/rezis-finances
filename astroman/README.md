# Astroman Finance

The finance desk for Astroman: sales, expenses, profit and loss, products, imports, and monthly reports.

**Live:** https://rezimod.github.io/rezis-finances/astroman/

This folder holds only the app. It contains **no business data**. All records are stored in the owner's private Google account through a Google Apps Script backend, and the app only gets them with the owner's secret key, which is entered once on each device. The backend script is kept private and is not in this repository.

## Speed and safety

- Records are cached on each device, so the app opens instantly; afterwards it fetches only what changed.
- Every change sits in an outbox on the device until Google confirms it. Closing the page, losing the connection or a Google error does not lose it; it is retried until it is saved.
- Sales come from the order sheet. Each month is its tab in the sheet; the typed date only sets the day, so a mistyped month (14.11 in the October tab) still counts in October. New orders are pulled in automatically whenever the app is open (at most every 15 minutes), and “Sync now” makes every month of this year match the sheet in one press.
- The backend keeps a permanent log of every change (sheet `log`) and copies the data sheet to the Drive folder "Astroman Finance backups" every night, keeping 90 days.

## Delivery and online orders (from December 2026)

Every sale goes into the register — shop, Wolt/Glovo and delivery orders alike — and the order sheet is no longer typed.

- **On the register**: pick the products → გადახდა → switch on **🛵 მიწოდება**. Paste the customer's message and the phone, name and address fill in by themselves; a phone that bought before fills the name and last address. The delivery fee (0 / 7 / 10 / 15 ₾ or typed) is added to the total and kept apart as `ship`. Courier cash (`cod`) and transfers still to come (`pending`) are saved as unpaid and never count as cash in the drawer.
- **🛵 შეკვეთები** (header): open orders with their status — ახალი → გამზადებული → კურიერთან → ჩაბარებული — “თანხა მივიღეთ” when the money arrives, a one-tap copy for the courier, and cancel with a reason. Orders not delivered after 2 days or unpaid after 5 turn red.
- A delivery order is an ordinary `pos` record with `dl: {name, phone, addr, fee, st, log[]}`, `paid` and `ship`; status and payment changes overwrite the same record (like a void), so the backend needed no change.
- **Mars**: from `cfg.regFrom` (default `2026-12`) each month's sales are built live from the register instead of the sheet; earlier months still come from the sheet. Open and unpaid delivery orders show under *Needs attention*. The sheet-vs-register check now compares every sheet order of the day, not only “ფილიალი”.
- **Shifts**: a shift left open from an earlier day is closed at 20:30 of that day when the consultant next logs in (cash counted then), and Mars counts old overnight shifts only to 20:30.
- Tests: `node astroman/tools/check-delivery.mjs` (fake backend, needs Playwright).

## Optimo control center

A separate page (Store → Optimo) for Optimo exports: sale history for any period and the stock items list. It shows top items, profit after cost and VAT, stock value, a shopping list sized to the months of stock you want, counts to fix, and money stuck in slow stock. It is stored in its own collection and does not change the profit and loss.

## Imports

Follows the real flow: supplier orders → a forwarder's warehouse → one shipment → Tbilisi.

- **Invoice upload**: drop a supplier invoice (text PDF or Excel) and it becomes one order: every position is a product line with its quantity and price, and the supplier, invoice no., date, currency, platform fee and shipping fill in. The lines are checked against the invoice total. Scanned PDFs have no text, so their products are typed.
- **Merge**: older records that hold one product each (and orders) from the same invoice can be ticked on the Orders tab and merged into one order; their payments move with them and freight/customs stay on the shipment.
- **Orders**: one per supplier invoice (Alibaba, 1688, Bresser…), with every product, quantity, price and optional weight, the platform fee and any delivery to the agent, in USD, EUR, CNY or GEL. Products can be linked to Optimo by barcode.
- **Shipments**: tick the orders that travel together and put them in one shipment with its forwarder (land, air or sea). Track it from *At the agent* → *On the way* → *In customs* → *Arrived*; each step records its date.
- **Costs**: freight (any currency), customs duty, import VAT, transport to the store and other costs. Freight and transport are split by weight (or value or pieces), customs and VAT by customs value, giving the **landed cost of each product**, compared with the Optimo cost.
- **Payments**: drop a receipt (a bank or Alibaba PDF is read automatically) or link a payment already imported from the bank. Each payment is an expense; the rate actually paid becomes the order's rate. A receipt payment is not imported again from the bank statement.
- Orders are stored in the `ships` collection with `kind: "order"`; older shipments with goods entered directly keep working.


## Store register (astroman/store/)

A point-of-sale page for the shop, in Georgian, modelled on Optimo: the consultant picks their name and PIN, taps products (with the pictures from astroman.ge), takes cash or a card terminal, prints a non-fiscal receipt, opens and closes shifts, and voids mistakes. Every sale is saved to the same Google backend within seconds and shows up on the owner's **Store sales** page here (live, history, best sellers, shifts, cash in the drawer).

- The register connects with its **own key** (`POS_KEY` in the backend script). With that key the backend only answers `pos_since` (catalog without costs, recent sales and shifts, consultants) and `pos_write` (new sales and shifts, never deletes). Costs, expenses and the books never reach the shop computer.
- The catalog (`catalog` collection) is built from the Optimo stock list plus website pictures; manage it under Store sales → Catalog ("Update from Optimo list", "Pick pictures", "Add product").
- Consultants, PINs, the receipt header and the device link live under Store sales → Register setup.
- Works offline: the app shell and pictures are cached on the device, sales wait in an outbox until Google confirms them.
- Installing on the shop's Windows PC: see [store/README.md](store/README.md).
