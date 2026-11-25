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

## Orders, customers and the payment check (Mars → Orders)

- **New order**: the order sheet's columns as a form — type (🏪 Shop, 🛵 Delivery, Wolt, Glovo, Extra.ge), date, phone, name, address (paste the customer's message to fill them), products from the catalog with quantity and price, delivery fee, payment and status. Saved as a `pos` record with `src:'mars'`, so it shows on the register's 🛵 შეკვეთები board and moves stock like a register sale.
- **Orders**: every order of the month — register, Mars and imported — with type, customer, address, payment, amount and status; filters for type, open, unpaid and cancelled; click to change the status, payment, address or to cancel.
- **Customers**: one record per phone, built from every order sheet (the main sheet with its hidden tabs, the 2021–22 sheets and the courier's monthly sheets; the schools list is left out; courier rows of other shops are skipped) and topped up live from the orders. Stored as `shift` records of kind `custdb` (250 customers each) because that collection is the one the register can read — so a phone typed on the register fills the name and last address too. “↻ Rebuild from the sheets” reads them again.
- **Import from sheet**: brings a month in from the order sheet. Rows already rung on the register (same amount, same or next day; several rows that add up to one sale count too) are not added again — they only give the register sale its phone and address. Rows cancelled in the sheet but sold on the register are listed to check. Importing twice adds nothing. Ticking the box moves the sales book for that month onto the register (`cfg.regFrom`).
- **Payment check**: bank imports now keep the incoming payments (`bankin`, never counted as income). Orders paid by card terminal, BOG/TBC transfer, installments and transfers still to come are matched to them by amount and date (terminal payments net of the bank's fee); Wolt, Glovo, Extra.ge, courier cash, cash and the personal account are left out. Shows orders whose money never arrived, bank money with no order, and platform/courier payouts apart.
- **Register**: the payment screen starts with an explicit choice of what kind of sale it is, in a coloured bar (blue shop, orange delivery…); only that kind's payment methods are offered and only delivery/Extra ask for an address. The kind of sale shows on the done screen, today's history, the receipt and the orders board.

## Manager profile on the register

People on the register (Mars → Store sales → Register setup) are Consultants or Managers. A manager logs in with their PIN and rings up sales without being asked to start a shift: if a consultant's shift is open on that computer the sale joins it (so cash still counts in the drawer), otherwise it is saved without a shift and the pay screen warns that cash taken then is outside the drawer count. Manager sales carry `mgr: true`; managers are labelled in the staff table, can fix product prices and counts, and can close a forgotten shift or leave it for later. Test: `node astroman/tools/check-manager.mjs`.

## New online orders on the register

An online order typed in Mars (or on another computer) puts a card over the register that cannot be closed or clicked past: the customer, phone, address, products, payment and total, with three answers — 👀 ვნახე (seen), 📦 გამზადებულია (packed), 🛵 კურიერმა წაიღო (picked up). The answer is saved on the order (`dl.seen {at, by}` and the status), so every register clears and Mars shows who saw it. Several new orders come one after another. Orders made on the register itself, and orders imported from the sheet, count as seen. On the 🛵 board any status can be tapped (also back), “ყველა” lists every order of the last 90 days with search, and a manager can edit customer, address, quantities, prices, delivery fee and payment.

In Mars, Orders opens with a dashboard (totals, orders per day by type, money by type, the delivery pipeline — tap a step to list those orders — best sellers and best customers) above the list, and any order — register, Mars or sheet — can be edited in full: products, quantities, prices, added products, discount, delivery fee, date, type, payment, paid, status, customer; cancelled orders can be restored. Order-type colours are the validated categorical slots 1–5 for dark and light.

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
