# Astaghfar Counter — أستغفر الله

A beautiful, mobile-first Istighfar (Astaghfar) counter with an Islamic green & gold theme.

## Features

- **Tap to count** — large dhikr button with `أستغفر الله`
- **Animated counter ring** — golden progress ring fills as you approach 33
- **Pop animation** on every count
- **Undo** — step back one count
- **Reset** — resets today's count, keeps the all-time total, and increments a session counter
- **Sound toggle** — soft tick on each count (mutable)
- **Haptic feedback** — gentle vibration on supported devices
- **Persistent stats** — today's count, all-time total, and sessions saved in `localStorage`
- **Keyboard support** — `Space` / `Enter` to count, `Backspace` to undo
- **Responsive & accessible** — ARIA live region, reduced-motion support, mobile-first layout

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup and layout |
| `style.css` | Islamic-themed styling (green/gold, geometric overlay) |
| `script.js` | Counter logic, persistence, sound, vibration |

## Usage

Open `index.html` in any modern browser. No build step required.

## Notes

- Sound uses the Web Audio API (no external files needed).
- Vibration requires a supported device/browser.
- To reset all stored data, clear `localStorage` for the page.