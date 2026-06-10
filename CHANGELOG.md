# Changelog

## v0.9.2

- Refined sidebar typography to inherit Zotero host sizing more naturally and kept DS Copilot branding visible on plugin-owned icon surfaces.
- Fixed single-paper full-text delivery so `pdf` scope and eligible single-`paper` scope send the full PDF text instead of an internal page-window truncation.
- Added explicit user-facing errors when PDF full text is unavailable or the selected scope does not support full-text mode.
- Tightened `paper` scope rules to require exactly one PDF attachment; multi-PDF papers now block instead of guessing.
- Added provider diagnostics for system-prompt length, full-text length, and full-text source to support real Zotero smoke verification.
- Verified the packaged `0.9.2` XPI in a real Zotero profile, including a restart re-check against a live “last page” question.

## v0.9.0

- First public GitHub release of DeepSeek Copilot for Zotero.
