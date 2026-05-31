# Zotero 7 for Developers Snapshot

Source:
- https://www.zotero.org/support/dev/zotero_7_for_developers

Why this matters:
- Historical baseline for the modern bootstrap-style plugin model
- Canonical guidance for localization conflicts, plugin packaging, and host integration patterns still referenced by templates

Use this snapshot when:
- you need the original migration framing from old architectures
- a template or reference plugin points back to Zotero 7 docs
- you are checking localization, preferences, or packaging rules that still apply to current releases

Key topics to review in the live doc:
- plugin architecture and packaging expectations
- localization and Fluent naming collision avoidance
- startup/shutdown lifecycle expectations
- host API caveats carried over into later versions

Local companion references:
- [reference/upstream-docs/tooling/zotero-plugin-template-readme.md](/Users/Liang/project/agentpaper_zotero/reference/upstream-docs/tooling/zotero-plugin-template-readme.md)
- [addon/manifest.json](/Users/Liang/project/agentpaper_zotero/addon/manifest.json)
- [addon/bootstrap.js](/Users/Liang/project/agentpaper_zotero/addon/bootstrap.js)
