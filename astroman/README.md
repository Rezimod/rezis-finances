# Astroman Finance

The finance desk for Astroman: sales, expenses, profit and loss, products, imports, and monthly reports.

**Live:** https://rezimod.github.io/rezis-finances/astroman/

This folder holds only the app. It contains **no business data**. All records are stored in the owner's private Google account through a Google Apps Script backend, and the app only gets them with the owner's secret key, which is entered once on each device. The backend script is kept private and is not in this repository.

## Speed and safety

- Records are cached on each device, so the app opens instantly; afterwards it fetches only what changed.
- Every change sits in an outbox on the device until Google confirms it. Closing the page, losing the connection or a Google error does not lose it; it is retried until it is saved.
- Sales come from the order sheet. Each month is its tab in the sheet; the typed date only sets the day, so a mistyped month (14.11 in the October tab) still counts in October. New orders are pulled in automatically whenever the app is open (at most every 15 minutes), and “Sync now” makes every month of this year match the sheet in one press.
- The backend keeps a permanent log of every change (sheet `log`) and copies the data sheet to the Drive folder "Astroman Finance backups" every night, keeping 90 days.

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

