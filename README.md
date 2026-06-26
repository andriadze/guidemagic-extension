# GuideMagic Chrome Extension

<p align="center">
  Capture workflows in Chrome and turn them into clear, shareable step-by-step guides.
</p>

<p align="center">
  <a href="https://guidemagic.ai">GuideMagic.ai</a> ·
  <a href="https://chromewebstore.google.com/detail/guidemagic-step-by-step-i/ellbjnfhakennbepbfdcflmccgnghgmn">Chrome Web Store</a>
</p>

GuideMagic is an AI-powered guide maker for documenting product workflows, onboarding, support processes, and internal how-tos. This repository contains the browser extension used to capture the clicks and screenshots that become a GuideMagic guide.

## What it can do

- Record clicks and screenshots as you complete a workflow.
- Create a new GuideMagic guide from a recording.
- Add recorded steps at a specific point in an existing guide.
- Capture the clicked element, page URL, viewport details, and screenshot needed to explain each step.
- Work with GuideMagic teams and respect editor, admin, and owner permissions.
- Return to the guide after recording so you can review, edit, share, export, or generate a narrated video at [guidemagic.ai](https://guidemagic.ai).

## How it works

1. Sign in to GuideMagic in Chrome.
2. Open the extension from the toolbar on the page you want to document.
3. Start recording and click through the workflow.
4. Stop recording when you are done.
5. GuideMagic turns the capture into an editable step-by-step guide.

To add to an existing guide, use **Add step → Record new steps** in the GuideMagic editor. Choose the tab you want to record, reopen the extension there, and start recording. New steps are inserted at the selected position.

## Development

### Prerequisites

- Node.js 18+
- pnpm or npm
- A local GuideMagic API, web app, and authentication endpoint

### Configure the extension

Copy the example environment file and update the local service URLs:

```bash
cp .env.example .env.local
```

```env
PLASMO_PUBLIC_API_ROUTE=http://localhost:3000
PLASMO_PUBLIC_APP_ROUTE=http://localhost:5173
PLASMO_PUBLIC_AUTH_ROUTE=http://localhost:5173
```

### Run in development

```bash
pnpm install
pnpm dev
```

Then load `build/chrome-mv3-dev` from `chrome://extensions` with **Developer mode** enabled. Reload the extension after changing manifest-level configuration.

### Build for production

```bash
pnpm build
```

The Chrome Manifest V3 production bundle is written to `build/chrome-mv3-prod`.

## Project structure

| Path | Purpose |
| --- | --- |
| `popup/` | Extension toolbar UI and recording controls |
| `contents/` | Page-level recording overlay and GuideMagic web-app bridge |
| `background/` | Screenshot capture, popup requests, and extension messaging |
| `api/` | Authenticated GuideMagic API clients |
| `ts/` | Shared extension types |

## Permissions

The extension needs access to the active tab and page scripting so it can display the recording overlay, capture screenshots, and record the user’s chosen workflow. It connects to GuideMagic only after the user signs in through the GuideMagic web app.

## Contributing

Issues and pull requests are welcome. Please keep changes focused, run the TypeScript check and production build, and avoid committing credentials or local `.env` files.
