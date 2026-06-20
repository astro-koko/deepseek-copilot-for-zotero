# Changelog

## v0.9.7

- Fixed the Reader text-selection popup so Deepseek Copliot action buttons inherit Zotero host theming instead of forcing a light button style in dark mode.
- Updated the popup label styling to inherit host text color, keeping the Reader selection UI readable across Zotero themes.

## v0.9.6

- Reworked `Commands and Prompts` into a card-based settings flow with clearer built-in vs. custom command editing.
- Expanded the sidebar home suggestions to 8 built-in actions in a compact two-column layout and kept built-in title overrides in sync.
- Updated the empty-state guidance so paper and PDF conversations surface shorter action labels and a clearer `/` shortcut hint.

## v0.9.5

- Unified the public plugin name to `Deepseek Copliot` across Zotero surfaces, release assets, and generated update feeds.
- Switched the packaged XPI artifact name to `Deepseek.Copliot-<version>.xpi`.
- Removed remaining public-facing `DS Copilot` branding from settings, reader actions, validation dialogs, and release documentation.

## v0.9.4

- Fixed the sidebar chat layout so the composer stays usable while recent chats now render below it instead of above it.
- Hid the empty-state welcome copy and suggested actions once a thread already has visible messages.
- Fixed Zotero host send reliability by preloading `paper` attachments more safely and adding a host-compatible provider request path.

## v0.9.3

- Added GitHub Actions release automation so future Zotero XPI releases publish consistently from version tags.
- Polished the GitHub landing page with install-first release badges and community launch copy.
- Prepared the scraper submission and forum launch materials for wider Zotero community discovery.

## v0.9.2

- Refined sidebar typography to inherit Zotero host sizing more naturally and kept Deepseek Copliot branding visible on plugin-owned icon surfaces.
- Fixed single-paper full-text delivery so `pdf` scope and eligible single-`paper` scope send the full PDF text instead of an internal page-window truncation.
- Added explicit user-facing errors when PDF full text is unavailable or the selected scope does not support full-text mode.
- Tightened `paper` scope rules to require exactly one PDF attachment; multi-PDF papers now block instead of guessing.
- Added provider diagnostics for system-prompt length, full-text length, and full-text source to support real Zotero smoke verification.
- Verified the packaged `0.9.2` XPI in a real Zotero profile, including a restart re-check against a live “last page” question.

## v0.9.0

- First public GitHub release of Deepseek Copliot.
