# Zotero Beta Builds Snapshot

Source:
- https://www.zotero.org/support/beta_builds

Why this matters:
- Defines the moving compatibility edge for plugin smoke tests
- Explains which major line is in beta versus which line is the current stable release

Current interpretation used by this repo:
- Zotero 9 is the stable daily target
- Zotero 10 is the beta compatibility target

Use this snapshot when:
- deciding whether to widen `strict_max_version`
- planning compatibility regression checks
- comparing a host regression against a plugin regression

Local companion references:
- [addon/manifest.json](/Users/Liang/project/agentpaper_zotero/addon/manifest.json)
- [docs/zotero-dev-workbench.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-workbench.md)
- [docs/zotero-dev-smoke-checklist.md](/Users/Liang/project/agentpaper_zotero/docs/zotero-dev-smoke-checklist.md)
