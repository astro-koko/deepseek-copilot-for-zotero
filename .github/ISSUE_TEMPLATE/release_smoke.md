---
name: Release smoke
about: Verify a packaged XPI before public release
title: "[Release smoke] v"
labels: release-smoke
assignees: ""
---

## Artifact

- Version:
- XPI:
- XPI hash:
- Profile: dev / clean release
- Zotero data dir: daily / clean release

## Preflight

- [ ] `npm run check`
- [ ] Packaged archive verified
- [ ] No `.env`, profile, database, cookies, or local thread history in artifact

## Real Zotero Gates

- [ ] Add-ons entry appears
- [ ] Settings pane appears
- [ ] Settings save, reopen, and restart persistence pass
- [ ] Library host works on a regular item
- [ ] Library host works on a PDF attachment item
- [ ] Reader host works after switching between two PDF tabs
- [ ] Reader `Explain` reaches the sidebar flow
- [ ] Reader `Ask...` pre-fills without auto-send
- [ ] Manual send creates visible thread or reports actionable error
- [ ] Cold restart preserves the critical path
- [ ] No top-toolbar-only or truncated `D...` artifact

## Evidence

- Summary:
- Debug Output:
- Screenshots:
- Host smoke JSON:
- Failures and follow-up issues:
