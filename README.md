# Omit

Block YouTube channels from appearing in your feed.

## Features

- **One-click blocking** — Hover any channel name on YouTube, click `[Block]`
- **Right-click to block** — Right-click any YouTube channel link anywhere → "Block channel with Omit"
- **Channel page overlay** — Visiting a blocked channel's page shows a friendly overlay
- **Undo toast** — Accidental block? Click `[Undo]` within 4 seconds
- **Badge counter** — Extension icon shows how many channels are blocked on the current page
- **Cross-device sync** — Blocklist syncs via Chrome Sync to all your signed-in devices
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

The blocklist is stored in `chrome.storage.sync` — it never leaves your device.

## Privacy

See [PRIVACY.md](PRIVACY.md)

## License

MIT
