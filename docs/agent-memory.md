# Agent Memory

Last updated: 2026-08-06

This file is durable project context for future Codex windows. It records facts
that should survive a handoff without treating a visible Zotero panel as proof
that the newest package is installed.

## Working Baseline

- Branch: `codex/fix-library-sidebar-responsive-layout`
- Baseline commit: `fbdcda7 fix: keep Zotero sidebar visible and anchored on resize`
- Base branch: `main` at `9ef8e2a merge: prepare v1.0.0 release candidate`
- Target release: public `1.0.0`; the current branch is not merged or released.
- Daily host target: Zotero 9 release.

## User Operating Preference

The user authorizes Codex to install local development XPI packages through
Zotero's native Plugins Manager, restart Zotero, and perform real GUI smoke
autonomously. Do not hand those steps back to the user unless a genuine
system-level blocker prevents desktop control, such as a locked macOS session.

Future micro-features will be developed in new windows from this baseline. Keep
each feature's implementation, tests, package smoke, and Git commit separate.

## Resolved Host Regression

The Reader/Library native section was forced into a fixed-height flex chain.
Inside Zotero's auto-height collapsible section this made the body, mount, and
React root compute to zero height, leaving only the `Deepseek Copliot` header
visible while the conversation remained hidden in the DOM.

The fix in `fbdcda7`:

- uses auto-height section, mount, and React-root styles for `section-body`
  hosts;
- passes `hostMode="section"` so the Sidebar root does not request `height: 100%`
  in an auto-height section;
- preserves horizontal containment (`minWidth: 0`, bounded width, border-box);
- captures a persisted message anchor before width reflow and restores it after
  layout settles;
- follows new or streaming output only when the user was already near bottom.

## Evidence Already Collected

- Focused host/layout suite: 89 tests passed.
- Full Vitest suite: 315 tests passed.
- `npm run build:dev:xpi` and packaged artifact verification passed.
- Real Zotero: local dev XPI imported through the native Plugins Manager,
  Zotero cold-restarted, and the long Reader conversation became visibly
  reachable. Collapsing and reopening the native section restored the body.
- The Add-ons entry explicitly showed `Deepseek Copliot 1.0.0.262180718` during
  the first repaired-package proof. The same source was subsequently rebuilt,
  imported, and restarted as dev package `1.0.0-dev.262180748`.
- Latest generated dev artifact:
  `build/xpi/Deepseek.Copliot-1.0.0-dev.262180748.xpi`
- Latest generated dev artifact SHA-256:
  `ef54d312cd674251c069b89619b772e1f4695f174ca8dde5956521fd894ff0c4`

## Do Not Regress

- Prove the installed manifest version/hash before diagnosing Settings, Reader,
  or provider behavior.
- Use the native right-side section in both Library and Reader; do not add a
  top-toolbar-only discovery path.
- Keep install-chain, host-surface, and provider debugging separate.
- Do not edit Zotero profiles, `extensions.json`, installed extension files,
  `.env`, cookies, databases, or thread histories by hand.
- Do not preload API keys or evidence-provider settings into public release
  smoke or packaged assets.

## Next Verification

The core visibility regression is fixed, but the complete responsive matrix is
still a follow-up gate. The next host pass should run the long-answer sequence
in Library and Reader:

`wide -> 350 px -> 280 px -> 260 px -> wide -> narrow`

It should also repeat Reader `A -> B -> A` scope restoration and confirm that the
composer remains reachable. Do not send provider requests unless explicitly
authorized for that pass.
