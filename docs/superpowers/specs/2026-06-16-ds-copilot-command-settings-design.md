# Deepseek Copliot Command Settings Design

Status: Approved for implementation planning
Owner: AgentPaper
Related issue: Custom command settings usability and import flow
Target release: next settings-stability release

## Classification

Classification: `feature`

Affected Zotero surfaces:

- Settings pane
- Slash command catalog
- Sidebar home-panel command suggestions
- Local preferences persistence

## Problem

The current Settings pane exposes custom slash command configuration in a way
that is too developer-shaped for normal Zotero users. The visible controls for
`Add custom command` and `Restore built-in commands` can become ineffective, and
the advanced JSON area can appear as a blank/black field that users cannot edit
or use to recover. The current interaction also mixes read-only built-in command
cards and user-authored configuration in one DOM read/write path, which makes
restore, hide, and add behavior fragile.

The current user-visible state also shows a concrete UX regression: the custom
command area can present two JSON input boxes, which makes it unclear which one
is the real setting. For this release, broken buttons and duplicate JSON editors
are not acceptable rough edges; they are direct acceptance failures for the
Settings product experience.

Real GUI observations must be interpreted carefully: if Zotero has not first
imported and loaded the newest local dev XPI, button failures in this section
may reflect an older installed plugin rather than the latest source code. The
install-chain version/hash checkpoint is therefore part of this issue, not
optional setup.

Users need a simple way to create several reusable reading commands without
manually filling many fields one by one. At the same time, Deepseek Copliot
should not grow a complex command-management framework or a separate hidden
"stash" state that users cannot see.

## Product Critique

- Putting command customization under the existing web-verification controls
  risks making users think custom commands only work with web verification. The
  Settings pane should place the new section after web verification but title it
  independently as `Commands and Prompts`.
- A large JSON schema inside Zotero Settings would overwhelm the normal path.
  The plugin should provide a compact import box and link to GitHub for the full
  schema and examples.
- Two visible JSON textareas make the product feel like a developer console and
  leave users unsure which one is authoritative. The primary flow should expose
  visual command cards plus one batch-import textarea. This release should not
  expose a second raw storage JSON editor in Settings.
- AI-generated JSON is useful only if the plugin validates it before saving.
  The import path must preview the resulting command cards and require an
  explicit apply step.
- The command model should stay explainable: commands are either active and
  visible in the plugin, or they are only temporary import text that has not
  been applied yet. There should be no persisted "stash" commands hidden from
  the UI.
- Built-in commands should stay few and high quality. The home panel should
  remain capped to the current small set of high-frequency commands.

## Goals

- Move command customization into a new independent `Commands and Prompts`
  section below web verification settings.
- Make the default path visual: add, edit, delete, enable, disable, pin to home,
  hide built-ins, restore a built-in, and restore all built-ins.
- Add an AI-assisted batch import path:
  - copy a strong prompt that asks an AI model to produce valid command JSON
  - paste JSON into Zotero Settings
  - validate and preview imported command cards
  - apply the preview into the normal custom-command list
- Link to GitHub documentation for full JSON schema and examples instead of
  embedding long examples in the plugin.
- Replace the built-in command prompts with stronger research-reading prompts
  informed by current prompt-engineering guidance: clear task, explicit output
  shape, evidence separation, uncertainty handling, and concise structure.
- Ensure the copyable AI-generation prompt does not end with a period or Chinese
  full stop.
- Keep the implementation small and compatible with the current custom preset
  preference path.

## Non-goals

- Do not create a command marketplace.
- Do not add a separate persisted stash or draft command store.
- Do not make JSON the primary user experience.
- Do not redesign the Reader, Library sidebar, provider request path, or right
  pane host surfaces.
- Do not introduce remote telemetry or remote command syncing.
- Do not copy Beaver's implementation or React architecture.
- Do not change Deepseek Copliot branding or icons.
- Do not expose two parallel JSON editing surfaces in the primary Settings
  flow.

## User Workflow

### Manual Single-Command Path

1. User opens Zotero Settings.
2. User scrolls below web verification to `Commands and Prompts`.
3. User clicks `Add command`.
4. A new editable command card appears.
5. User enters label, slash id, prompt text, optional aliases, scope, evidence
   preference, enabled state, and home-panel pin state.
6. User saves or the pane persists through the existing settings save flow.
7. The command appears in the slash menu. If pinned and within the cap, it also
   appears on the sidebar home panel.

### AI Batch Import Path

1. User opens `Import from JSON`.
2. User clicks `Copy AI prompt`.
3. User pastes the copied prompt into an AI assistant and adds their own command
   ideas.
4. The AI returns a JSON array.
5. User pastes the JSON array into the import textarea.
6. User clicks `Validate and preview`.
7. If valid, Zotero Settings renders preview cards and shows how many commands
   will be added or updated.
8. User clicks `Apply import`.
9. Imported commands appear in `My commands` and are saved through the normal
   command preference path.

### Raw JSON Boundary

The normal user should not see two JSON editors. Raw command storage remains an
internal preference, while user recovery and batch creation go through the same
validated import flow plus the GitHub examples page. A future diagnostics-only
raw storage view would need its own issue and must not be introduced as part of
this settings simplification.

### Restore Built-ins Path

1. User opens `Built-in command management`.
2. User sees only built-ins that are customized or hidden.
3. User restores one built-in or restores all built-ins.
4. The plugin removes the corresponding user customization data and falls back
   to code-defined defaults.

## Scope And Boundaries

### In Scope

- Settings pane layout and copy for the command section.
- Command card rendering and event handling.
- JSON import validation, preview, and apply flow.
- GitHub documentation link from Settings.
- Built-in command prompt rewrites.
- Tests for command settings, parsing, persistence, and slash/sidebar catalog
  behavior.

### Out Of Scope

- Provider quality evaluation against live DeepSeek responses.
- Real-time command syncing.
- Public release packaging changes.
- Zotero 10 compatibility expansion.
- Any change that makes the right-side pane entry or Reader handoff behave
  differently.

## Design Decisions

### Section Placement

The command controls move below the web-verification settings and use the
heading `Commands and Prompts`. This keeps the page flow natural: API key,
web-verification behavior, then user-facing reusable prompts. The heading avoids
implying that commands are only for web verification.

### No Persisted Stash Model

Imported JSON is temporary textarea input until the user clicks
`Validate and preview`. Preview cards are still temporary until the user clicks
`Apply import`. After apply, the commands become ordinary user commands. If the
user closes Settings before applying, the import text may be lost; this is
acceptable because it avoids hidden command state.

### Minimal Data Model

For this implementation, keep the current custom preset storage strategy unless
tests prove a small compatibility helper is needed. Borrow Beaver's principle,
not its full storage framework:

- built-ins remain code-defined
- user-created commands are persisted
- built-in hides or overrides are persisted only when the user changes them
- default built-ins are not serialized into user preferences

If a later release needs a formal `{ version, overrides, custom }` preference,
that migration should be a separate issue.

### Import JSON Shape

The import accepts a JSON array of command objects. Each command may include:

- `id`
- `label`
- `description`
- `promptPrefix`
- `aliases`
- `scopeHint`
- `showInSidebar`
- `evidenceHint`

The parser may continue accepting legacy aliases such as `prompt` and `scopes`
where the current code already supports them. Validation must reject malformed
JSON and ignore or normalize unsupported optional fields.

### AI Prompt For Users

The copyable AI prompt should be short, strict, and end without punctuation. It
should tell the model:

- output JSON only
- output an array
- avoid Markdown fences
- keep ids lower-case and hyphenated
- use supported scope values
- keep home-panel pinned commands small
- produce prompts that separate paper evidence from external verification

The prompt text must not end with `.` or `。`.

### GitHub Documentation Link

The Settings pane should link to the repository documentation for command JSON
examples and schema details. The plugin should not embed long JSON examples.
The expected base repository is:

`https://github.com/astro-koko/deepseek-copilot-for-zotero`

The exact docs path may be created during implementation, for example:

`docs/custom-commands.md`

### Built-in Prompt Rewrite

Rewrite the built-in command `promptPrefix` values in `src/services/presets.ts`
to be stronger defaults for research reading. Prompts should:

- name the task clearly
- ask for structured, concise output
- distinguish claims made by the paper from assistant inference
- ask for uncertainty or limitations where relevant
- request external verification only when the command is evidence-oriented
- avoid unnecessary verbosity

The command set should remain small. Do not add many new built-ins as part of
this issue.

### Real Installed-Version Check

Before using GUI evidence for the command buttons, the smoke pass must import
the latest local dev XPI through Zotero's native Add-ons manager and verify the
installed version/hash. Do not use Add-on Market / 插件市场. Do not treat the
presence of the Deepseek Copliot Settings pane as proof that the newest code is
loaded.

## Files Expected To Change

- `addon/content/preferences.xhtml`
- `addon/locale/en-US/preferences.ftl`
- `addon/locale/zh-CN/preferences.ftl`
- `src/modules/preferencesPane.ts`
- `src/modules/preferencesPane.test.ts`
- `src/modules/preferencesPaneSource.test.ts`
- `src/modules/preferencesLocaleSource.test.ts`
- `src/services/settingsManager.ts`
- `src/services/settingsManager.test.ts`
- `src/services/presets.ts`
- `src/services/presets.test.ts`
- `README.md` or `docs/custom-commands.md`

## Acceptance Criteria

- Settings contains a new `Commands and Prompts` section below web verification.
- The command controls are not presented as part of web verification itself.
- `Add command` creates an editable command card.
- Valid manually created commands persist and appear in the slash catalog.
- `showInSidebar` pins eligible commands to the home panel while preserving the
  existing maximum number of home-panel commands.
- Hidden built-ins disappear from slash and home-panel catalogs.
- Restoring a built-in removes only that built-in customization.
- Restoring all built-ins does not delete user-created commands.
- Import JSON validates before saving.
- Valid import JSON renders preview command cards before apply.
- Applying preview converts imported commands into normal user commands.
- Invalid import JSON does not overwrite saved settings and shows an inline
  error.
- The primary Settings flow shows only one JSON input for batch import.
- No second raw storage JSON editor is visible in the primary Settings flow.
- The Settings pane links to GitHub documentation for full examples.
- The copyable AI-generation prompt does not end with `.` or `。`.
- Built-in prompts are rewritten with clearer research-reading defaults.
- No Reader, provider, right-pane host, branding, or release metadata changes are
  included.

## Verification Plan

Run the focused settings and command tests first:

```bash
npm test -- src/modules/preferencesPane.test.ts src/modules/preferencesPaneSource.test.ts src/modules/preferencesLocaleSource.test.ts src/services/settingsManager.test.ts src/services/presets.test.ts
```

Then run the broader logic gate:

```bash
npm test
```

For user-visible Settings changes, build a dev XPI:

```bash
npm run build:dev:xpi
```

If the implementation changes packaged settings resources, inspect the packaged
artifact through the existing verify path:

```bash
npm run verify:xpi
```

`npm run check` may be run as a final preflight, but it can fail locally if a
private `.env` exists. Do not delete `.env` to make the check pass.

## Real Zotero Smoke

Packaged `.xpi` smoke is required before calling this user-visible Settings
change complete.

Minimum real Zotero evidence:

- The latest local dev XPI was imported through Zotero's native Add-ons manager,
  not Add-on Market / 插件市场.
- The Add-ons entry or installed XPI manifest version/hash matches the built dev
  XPI before Settings behavior is tested.
- If the installed version/hash is stale or cannot be proven, stop at the
  install-chain layer and do not interpret visible Settings behavior as the
  latest build.
- Settings pane opens.
- `Commands and Prompts` appears below web verification.
- `Add custom command`, restore built-ins, JSON validate/preview/apply, copy AI
  prompt, and save controls are clickable and produce visible state changes.
- Add a command manually, save, reopen Settings, and confirm it persists.
- Paste valid JSON, validate and preview, apply import, save, reopen Settings,
  and confirm imported commands persist.
- Paste invalid JSON and confirm saved commands are not overwritten.
- Hide and restore one built-in command.
- Confirm the command section does not present two competing JSON editors.
- Restart Zotero and confirm manual/imported/restored command state persists.
- Confirm the Library and Reader right-side pane discovery surfaces are not
  changed by this settings work.

Use the guardrails in `docs/zotero-real-smoke-guardrails.md`: one control plane
per micro-task, frontmost app/window checks before mutating actions, and the
two-strike stop rule.

## Reference Adoption

Reference source inspected:

- `reference/beaver-zotero/react/components/preferences/ActionsPreferenceSection.tsx`
- `reference/beaver-zotero/react/components/preferences/ActionCard.tsx`
- `reference/beaver-zotero/react/atoms/actions.ts`
- `reference/beaver-zotero/react/types/actionStorage.ts`
- `reference/beaver-zotero/addon/prefs.js`

Pattern borrowed:

- Separate code-defined built-ins from user-created commands and built-in
  customizations.
- Restore hidden built-ins by removing the customization rather than rewriting
  all defaults.
- Keep action cards simple and user-facing.

Pattern explicitly not borrowed:

- Beaver's React/Jotai settings architecture.
- Beaver's full action target taxonomy.
- Beaver's account, sync, cloud, billing, or SaaS assumptions.
- Beaver's migration machinery for old custom prompts.

Local verification:

- Settings pane unit tests for manual commands, import preview/apply, hidden
  built-ins, and restore behavior.
- Preset catalog tests for slash and home-panel output.
- Real Zotero packaged Settings smoke after dev XPI build.

## Risks And Mitigations

### Risk: The section still feels too advanced

Mitigation: Default to visual command cards. Keep JSON behind an import/details
area and link to GitHub for full examples.

### Risk: Import JSON creates hidden or confusing state

Mitigation: Imported commands are temporary until applied. Applied imports become
normal visible command cards.

### Risk: Restore all built-ins deletes user work

Mitigation: Restore built-ins must only remove built-in overrides or hidden
tombstones. Tests must prove user-created commands remain.

### Risk: Built-in prompt rewrite changes command expectations

Mitigation: Keep command ids, labels, aliases, scope hints, and home-panel cap
stable. Only improve prompt text and descriptions where needed.

### Risk: Full Beaver-style storage migration expands scope

Mitigation: Treat Beaver as a design reference only. Keep the current preference
shape unless tests reveal a small helper is necessary.

## Open Questions

- The GitHub documentation path should default to `docs/custom-commands.md`
  unless the implementation phase finds an existing better public docs page.
