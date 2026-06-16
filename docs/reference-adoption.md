# Reference Adoption Guide

Reference projects are pattern libraries, not copy sources. Every borrowed pattern must state what is borrowed, what is not borrowed, and how it will be verified in this repository.

## Priority

1. `reference/upstream-docs/`
   - Use as the default fact source for Zotero, scaffold, toolkit, packaging, addon id, prefs prefix, update manifests, and hot reload behavior.
2. `reference/beaver-zotero/`
   - Use for Zotero-native Reader/sidebar orchestration, lifecycle cleanup, staged build/test scripts, and optional MCP boundary ideas.
   - Do not copy account, subscription, credits, Supabase, cloud orchestration, or SaaS product assumptions.
3. `reference/aidea-zotero/`
   - Use for architecture-map style and module navigation ideas.
   - Treat giant files and feature pile-up as anti-patterns.
4. `reference/llm-for-zotero/`
   - Use for agent safety ideas: tool mutability, confirmation, undo, request-scoped availability, prompt budget, import-cycle checks, and test density.
   - Do not copy the full agent platform, external runtime bridges, filesystem/scripting surface, MinerU subsystem, or skills portal into the current phase.

## Adoption Gate

Any spec or plan that borrows from a reference project must include:

- Reference source and exact files inspected
- Pattern borrowed
- Pattern explicitly not borrowed
- Local modules affected
- Privacy and persistence impact
- Automated tests to add or update
- Real Zotero smoke evidence needed
- Rollback or follow-up issue if the pattern proves unstable

## Current Useful Patterns

- Beaver: Reader selection to sidebar handoff, lifecycle cleanup, split `test`, `test:live`, `test:integration`, and dev/staging/release build scripts.
- AIdea: architecture documentation with module responsibilities and modification quick lookup.
- llm-for-zotero: import-cycle gate, prompt budget tests, agent tool safety contract, conversation integrity tests.
- Upstream docs/template: addon identity, prefs prefix, scaffold config, update manifests, and the distinction between hot reload and packaged XPI acceptance.

## Anti-Patterns

- Megafile controller modules.
- Styling or UI rewrites imported wholesale from another plugin.
- Feature expansion that bypasses host-first acceptance.
- Provider/platform expansion before install, Settings, Library, Reader, and restart gates are proven.
- Release claims that do not have packaged XPI and real Zotero evidence.
- Reference code entering the default test scope or being edited as part of product work.

## Suggested Follow-Up Issues

1. Add import-cycle health gate.
2. Add project architecture map.
3. Add agent tool safety contract before any write-capable agent tools.
4. Define MCP adoption boundary before implementing MCP.
5. Connect reference adoption gate to future specs and PR templates.
