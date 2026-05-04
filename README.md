# Omit

Block YouTube channels and keywords from appearing in your feed.

## Features

- **Channel blocking** — Hover any channel name on YouTube, click `[Block]`
- **Keyword blocking** — Block videos whose titles contain specific keywords (case-insensitive)
- **Right-click to block** — Right-click any YouTube channel link anywhere → "Block channel with Omit"
- **Channel page overlay** — Visiting a blocked channel's page shows an overlay with "View Anyway" and "Go Back"
- **Undo toast** — Accidental block? Click `[Undo]` within 4 seconds
- **Badge counter** — Extension icon shows how many videos are hidden on the current page
- **Local storage** — Blocklist stored locally on your device; no account required
- **Export/Import** — Backup or share your blocklist as JSON
- **Zero data collection** — No analytics, no tracking, no network requests

## Installation

### Chrome Web Store
*(Coming soon)*

### Manual (Developer Mode)
1. Download or clone this repo
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `Omit` folder
5. Open YouTube — hover a channel name to see the `[Block]` button

## How It Works

Omit injects a lightweight content script into YouTube pages that:
1. Watches for video elements in search, homepage, sidebar, and Shorts
2. Compares each video's channel ID against your blocklist
3. Hides matching videos with `display: none`
4. Uses `MutationObserver` to handle YouTube's dynamic loading

The blocklist is stored in `chrome.storage.local` — it never leaves your device.

## Privacy

See [PRIVACY.md](PRIVACY.md)

## License

MIT
