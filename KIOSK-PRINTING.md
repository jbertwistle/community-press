# Community Press kiosk printing

Community Press v1.6 publishes each sheet to the existing Supabase archive and
then prints the same flattened image on an 11 × 17 inch portrait page.

## Printer setup

1. Install the Epson WF-7310 and make it the Windows default printer.
2. Set its default paper size to **11 × 17 / Tabloid** and orientation to
   **Portrait**.
3. Turn off browser print headers and footers the first time the print dialogue
   appears.
4. Use **Actual size / 100%**. The page itself has zero margins; select the
   WF-7310's borderless 11 × 17 option if the chosen paper feeds reliably in
   that mode.

## Testing before kiosk mode

Open Community Press normally in Chrome or Edge. Make a test sheet and press
**PUBLISH & PRINT**. The edition must appear in Latest Editions before the
normal print dialogue opens. Confirm the preview contains only the newspaper
sheet and reports 11 × 17 inch portrait paper.

## Automatic kiosk printing

After the normal print test succeeds, launch Chrome with kiosk printing:

```text
chrome.exe --kiosk --kiosk-printing https://jbertwistle.github.io/community-press/
```

In kiosk-printing mode, `window.print()` sends the job immediately to the
Windows default printer using its saved defaults. Test this with ordinary
11 × 17 paper before loading the final lightweight stock.

## Failure behaviour

- A sheet prints only after both the image upload and archive record succeed.
- The publish button stays disabled during the operation to prevent duplicate
  editions and print jobs.
- If printing fails after publication, the status reads
  `sheet published · print failed`; the archived edition remains available and
  can be opened and printed again.
