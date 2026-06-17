# Deepseek Copliot v0.7 Web Verification Design

## Scope

This v0.7 pass closes three user-facing gaps that are currently coupled in the sidebar flow:

1. Recent-thread action buttons can clip or truncate in narrow sidebars, especially the delete action in Chinese.
2. The evidence-search path still exposes `OpenAlex` in visible frontend copy even though the intended product surface is generic web verification.
3. The settings page has Tavily-specific controls, but the runtime contract still treats the default provider as `builtin-search` instead of a stable MCP/default web-verification path, and the dev loop does not preload Tavily config from `.env`.

## Assumption

Proceed with the recommended `A` contract because the user asked not to stop and explicitly said the frontend does not need to show `OpenAlex`:

- frontend toggle copy should be source-agnostic: `联网查证` / `Web Verification`
- settings should expose `默认联网查证（推荐）` / `Default web verification (recommended)` plus `Tavily`
- the internal default provider should be renamed from `builtin-search` to an MCP/default web-verification identifier while remaining backward-compatible with older saved prefs

## Approach

Keep the existing evidence-search feature shape, but split user-facing terminology from transport implementation. The runtime will normalize legacy `builtin-search` prefs into a new default provider mode, continue using the current academic-search request path for the default provider, and remove `OpenAlex` from visible labels, audit copy, and fallback source strings.

The settings pane should become a complete decision surface for evidence search: choose provider, persist immediately, show Tavily fields only when Tavily is selected, and validate Tavily against the live API. The dev loop should preload DeepSeek and Tavily prefs into the dedicated Zotero profile through scaffold `server.prefs` so `npm start` can exercise the settings flow with real credentials already present.

For the sidebar layout bug, keep the existing conversation-management actions in place but make the action row width-stable in narrow panes by switching to a two-column action layout that does not depend on content width.

## Boundaries

- No new external MCP server process in this tranche.
- No change to the core DeepSeek provider contract.
- No redesign of thread history information architecture beyond fixing action-row stability.
- No change to stored thread schema.

## Verification

- Unit-test default provider normalization and user-facing label behavior.
- Unit-test the new dev-pref preload helper so `.env`-backed Tavily settings reach the dev profile.
- Unit-test preferences-pane behavior for the renamed default provider and Tavily validation.
- Unit-test chat-engine evidence audit copy so no visible `OpenAlex` label remains.
- Run the targeted Vitest suite plus `npm run build`.
- Use the real Tavily key from `.env` to verify the Tavily validation request succeeds from a live network call.
