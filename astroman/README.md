# Astroman Finance

The finance desk for Astroman: sales, expenses, profit and loss, products, imports, and monthly reports.

**Live:** https://rezimod.github.io/rezis-finances/astroman/

This folder holds only the app. It contains **no business data**. All records are stored in the owner's private Google account through a Google Apps Script backend, and the app only gets them with the owner's secret key, which is entered once on each device. The backend script is kept private and is not in this repository.

## Speed and safety

- Records are cached on each device, so the app opens instantly; afterwards it fetches only what changed.
- Every change sits in an outbox on the device until Google confirms it. Closing the page, losing the connection or a Google error does not lose it; it is retried until it is saved.
- New orders in the order sheet are pulled in automatically whenever the app is open (at most every 15 minutes).
- The backend keeps a permanent log of every change (sheet `log`) and copies the data sheet to the Drive folder "Astroman Finance backups" every night, keeping 90 days.

## Optimo control center

A separate page (Store → Optimo) for Optimo exports: sale history for any period and the stock items list. It shows top items, profit after cost and VAT, stock value, a shopping list sized to the months of stock you want, counts to fix, and money stuck in slow stock. It is stored in its own collection and does not change the profit and loss.
