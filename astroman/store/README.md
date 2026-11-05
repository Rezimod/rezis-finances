# Astroman register (სალარო) — install guide

The register is a web app at **https://rezimod.github.io/rezis-finances/astroman/store/**. It installs on Windows like a normal program (its own window, taskbar icon, works offline) through Chrome or Edge. Consultants ring up sales on it; the owner sees them live on the finance desk under **Store sales**.

## Part 1 — one-time setup by the owner (10 minutes)

1. **Update the backend script.** Open the Apps Script project "Astroman Finance" (script.google.com), replace the whole `Code.gs` with the new version (kept on the Mac at `~/Documents/astroman-finance/Code.gs`), press Save, then **Deploy → Manage deployments → ✎ (edit) → Version: New version → Deploy**. The web-app URL stays the same, so nothing else changes.
2. **Save the register key.** In the finance desk open **Store sales → Register setup**, paste the `POS_KEY` value from `Code.gs` into "Register key" and press **Save key**. Press **Check the backend**: it must say the backend is updated and the key works.
3. **Add the consultants.** Same page: name + 4-digit PIN for each person, **Save consultants**.
4. **Receipt header.** Same page: shop name, address, phone, tax ID, footer. **Save receipt**.
5. **Pictures.** Store sales → Catalog → **Pick pictures**: for each product without a picture pick the matching astroman.ge product (or "Leave without picture"). About 70 items need this once.
6. **Copy the device link** (Register setup → Copy device link). It contains the register key — send it to the shop computer privately (e.g. open the finance desk there yourself), never post it in a group chat.

## Part 2 — install on the Windows PC (5 minutes)

Chrome or Edge, either one. Windows 10 or 11.

### With Microsoft Edge (already on every Windows PC)

1. Open Edge, paste the device link in the address bar, press Enter. The register opens and says it is connected ("შენახულია" with a green dot, top right).
2. Click the **⋯** menu (top right) → **Apps** → **Install this site as an app** → name it `ასტრომანი სალარო` → **Install**.
3. In the dialog that follows tick **Pin to taskbar**, **Pin to Start** and **Auto-start on device login**, then **Allow**.
4. Close Edge. From now on open the register from the taskbar icon; it runs in its own window without an address bar.

### With Google Chrome

1. Open Chrome, paste the device link, press Enter, wait for the green dot.
2. Click **⋮** (top right) → **Cast, save and share** → **Install page as app…** (older Chrome: **Save and share → Install page as app…**, or the small install icon at the right end of the address bar) → **Install**.
3. Right-click the new window's taskbar icon → **Pin to taskbar**.
4. To start it with Windows: press **Win + R**, type `shell:startup`, Enter; drag the app's shortcut from the Start menu into that folder.

### Full screen / kiosk feel (optional)

- Press **F11** inside the register window for full screen (F11 again to leave).
- To lock the PC to the register only, create a shortcut whose target is  
  `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --app=https://rezimod.github.io/rezis-finances/astroman/store/`  
  (or `msedge.exe --kiosk … --edge-kiosk-type=fullscreen`). Open the device link once normally before using kiosk mode, so the connection is saved.

## Part 3 — hardware

**Barcode scanner.** Any USB scanner in "keyboard wedge" mode (the default) works: plug it in, no driver. On the sale screen scan a barcode and the product is added; the barcode must match the Optimo barcode shown under each product. Scanning works even when nothing is focused.

**Receipt printer (80 mm).**
1. Install the printer with its Windows driver and set it as the **default printer** (Settings → Bluetooth & devices → Printers & scanners).
2. In the register, keep "ქვითრის ამობეჭდვა" on at payment. The first print opens the Windows print dialog: choose the receipt printer, paper 80 mm, margins none, untick headers and footers, print. Chrome remembers these choices.
3. For silent printing without the dialog, start the app with `--kiosk-printing` added to the shortcut above (the default printer is used).
The receipt is **non-fiscal** ("არაფისკალური ქვითარი"); fiscal receipts still come from the cash register / Optimo if the law requires them.

**Cash drawer.** Drawers that plug into the receipt printer open on each print. Nothing to configure in the app.

**Customer display / tablet.** Any tablet or phone can run a second register: on the finance desk show the QR code (Register setup) and scan it with the tablet camera; then "Add to Home screen". Both devices write to the same backend; each one keeps its own shift.

## Daily use (for the consultants)

- **შესვლა** — tap your name, type the PIN. If the shift is closed the app asks how much cash is in the drawer (ხურდა) and opens a shift.
- **გაყიდვა** — tap products or scan barcodes. Tap a line and use the keypad: რაოდენობა (quantity), ფასდაკლება (discount in ₾, on the line; with no line selected it applies to the whole order), ფასი (price override). "გასუფთავება" empties the order.
- **გადახდა** — type the cash given (or ზუსტი თანხა for exact), or pick BOG / TBC terminal, განვადება, გადარიცხვა. "დადასტურება" saves the sale and prints the receipt if the switch is on.
- **≡ ფუნქციები** — ცვლის დახურვა / დღის დახურვა (count the cash, Z report prints), ცვლის ნავაჭრი (shift totals), თანხის მიღება / გაცემა (cash in/out of the drawer), გაყიდვების ისტორია (today's sales; open one to reprint or void it with a reason), სინქრონიზაცია, გასვლა.
- The top-right dot: green "შენახულია" = everything is saved in Google; amber "ინახება…" = a sale is still being sent (keep the app open, it retries by itself, also after the internet comes back).

## When something goes wrong

- **"ბექენდი ძველია"** — Part 1 step 1 was not done: the Apps Script still runs the old code.
- **"არასწორი გასაღები"** — the key in the device link is not the `POS_KEY` of the deployed script. Re-copy the device link after saving the right key.
- **No products / "კატალოგი იტვირთება…" for long** — no internet on the PC, or the catalog is empty: on the finance desk, Store sales → Catalog → "Update from Optimo list".
- **Pictures missing** — the shop's internet blocks astroman.ge, or the product has no picture picked yet (Catalog → Pick pictures).
- **Wrong stock number on a product** — the number is the Optimo count minus what the register sold since that count. Upload a fresh Optimo stock list on the Products page and press "Update from Optimo list".
- **To move the register to another PC** — ≡ → გათიშვა on the old one (only when everything is saved), then open the device link on the new one.
