# Deepseek Copliot Beaver-Style Source Composer Design

Date: 2026-06-01
Status: Approved for implementation
Scope: Researcher-first conversation composer for Zotero Library and Reader surfaces

## Goal

Make Deepseek Copliot as immediate as Beaver for paper reading while preserving a
simple mental model:

- open a paper and ask immediately
- add supporting evidence only when needed
- choose a DeepSeek model where the next request is composed
- keep every active source visible before sending

The target is Beaver's source-composition interaction language, implemented
with Deepseek Copliot-owned state and services. This is not a direct component port.

## Product Principles

### Automatic First

The common reading flow must require no setup. When the user opens a PDF or
selects one paper, Deepseek Copliot automatically attaches the relevant current
context and shows it as a non-removable chip such as `Current File`.

### Complexity On Demand

The default composer stays compact. Additional papers, notes, annotations,
collections, libraries, and tags appear only when the user opens the `+`
source menu, types `@`, or drags a supported Zotero object into the composer.

### Visible Evidence

Every source that can affect the next answer must be visible in or immediately
above the composer. The assistant must not silently use an invisible global
scope.

### Request-Local Expansion

Automatically derived context persists while it remains relevant. Manually
added sources and filters form a temporary evidence basket for the next
request. They clear after a successful send so stale evidence does not
silently leak into later questions.

### Model Choice Near Send

The DeepSeek model selector belongs in the composer footer because it changes
the next request. `DeepSeek Flash` is the default for normal reading flow.
`DeepSeek Pro` is available for deeper synthesis.

## Researcher Workflows

### Ask About The Current PDF

1. The researcher opens a PDF in Zotero Reader.
2. The composer shows `Current File`.
3. The researcher asks a question and sends immediately.

No source menu interaction is required.

### Add Supporting Papers

1. The researcher opens the `+` menu or types `@`.
2. The menu shows recent and current items first, then search.
3. The researcher adds one or more papers.
4. Each paper appears as a removable chip.
5. After send succeeds, the added papers clear while `Current File` remains.

### Ask With Notes Or Annotations

1. The researcher adds a note or annotation through the source menu or drag
   and drop.
2. The composer shows a removable chip with a recognizable Zotero-native
   label.
3. The assembled request includes the note or annotation text alongside the
   stable paper context.

### Compare A Collection

1. The researcher adds a collection or uses collection and tag filters.
2. The composer shows compact filter chips.
3. The request assembler includes a bounded collection context with explicit
   truncation behavior.
4. The filters clear after a successful send.

### Switch Reasoning Depth

1. The composer footer shows the current model.
2. The researcher opens the model selector.
3. The menu offers:
   - `DeepSeek Flash` - fast default for reading and follow-up questions
   - `DeepSeek Pro` - deeper reasoning for synthesis and comparison
4. The selection persists in plugin settings and applies to the next send.

## Interaction Design

### Composer Layout

The composer is a single quiet container with three vertical regions:

1. source chip row
2. auto-growing text input
3. footer action row

The source row begins with a compact `+` button. Stable context chips follow,
then temporary source and filter chips. The footer places the model selector
on the left and `Send` or `Stop` on the right.

Placeholder copy follows Beaver's concise pattern:

- Library: `@ to add a source, / for actions`
- Reader: `@ to add a source, / for actions, drag to add annotations`

### Source Chips

Stable chips:

- `Current File`
- `Current Paper`
- `Current Note`
- selected text or annotation context

Stable chips are visible but not removable while the corresponding Zotero
surface remains active.

Temporary chips:

- paper
- PDF attachment
- note
- annotation
- collection
- library filter
- tag filter

Temporary chips are removable. When the row becomes crowded, show the first
four temporary chips and a `+N` overflow chip with a preview.

### Add Sources Menu

The `+` button and `@` trigger open the same menu. The first level prioritizes
the researcher's likely next action:

1. recent items
2. current Zotero selection
3. search by author, year, and title
4. filter by library
5. filter by collection
6. filter by tag
7. add note

The menu supports keyboard navigation, selection, escape-to-close, and
backspace-to-return from nested filter views.

### Drag And Drop

The composer accepts Zotero drag payloads for:

- items
- annotations
- collections

Dragging over the composer reveals a lightweight drop affordance. Unsupported
objects produce a short inline error and do not modify composition state.

### Slash Presets

Existing `/` preset behavior remains. Source composition and slash presets
share the text input without competing:

- `@` opens source search
- `/` opens action presets
- `Escape` closes the active menu
- `Enter` selects an active menu item or sends when no menu is active
- `Shift+Enter` inserts a newline

## Architecture

### State Model

Keep automatic context and request-local evidence separate.

```ts
interface ScopeContext {
  type: ScopeType;
  id: string;
  label: string;
  itemIds: number[];
  readerAttachmentId?: number;
  selectedText?: string;
  currentNoteId?: number;
}

interface MessageSources {
  items: SourceReference[];
  notes: SourceReference[];
  annotations: AnnotationReference[];
  collections: CollectionReference[];
  filters: {
    libraryIds: number[];
    collectionIds: number[];
    tags: TagReference[];
  };
}
```

`ScopeContext` remains the automatic Zotero surface context.
`MessageSources` is the temporary evidence basket for the next request.

### Component Boundaries

#### `Composer`

Owns text-entry orchestration and menu coordination. It delegates source
rendering and source selection to focused child components.

#### `SourceChipRow`

Renders stable and temporary chips, handles removal, and presents overflow.

#### `AddSourcesMenu`

Provides recent items, current selection, text search, and nested filter
navigation.

#### `ModelSelectionButton`

Renders a compact footer control and persists `deepseek-v4-flash` or
`deepseek-v4-pro`.

#### `ComposerDropZone`

Translates supported Zotero drag payloads into source-composition actions and
surfaces short validation errors.

#### `messageSourcesStore`

Owns temporary composition state with typed add, remove, clear, and de-duplicate
operations.

### Request Flow

1. Zotero selection or Reader activity updates `ScopeContext`.
2. The composer renders stable chips from `ScopeContext`.
3. User actions update `messageSourcesStore`.
4. `chatSessionStore.send()` receives message text, active scope, and a
   snapshot of temporary sources.
5. `contextAssembler` merges automatic scope and temporary sources,
   de-duplicates references, and applies truncation rules.
6. The provider sends the request using the persisted DeepSeek model.
7. When the provider accepts the request or streaming begins, the composer
   clears temporary sources and retains automatic scope.
8. If dispatch fails before a response begins, the composer restores the
   temporary-source snapshot for retry.

### Context Assembly Rules

- Current PDF or paper context is always included first.
- Temporary sources are de-duplicated against stable context.
- Notes and annotations include their text directly.
- Collections and filters resolve to a bounded item set.
- Large source sets degrade through explicit caps and summaries, not silent
  omission.
- The assembled context records warnings when content is unavailable or
  truncated so the UI can surface a concise notice.

### Error Handling

- Invalid or unsupported drag payload: show a short inline composer error.
- Missing Zotero item: remove or skip the source and explain why.
- Empty collection or filter result: keep the chip visible and show a warning.
- Provider failure before a response begins: retain the message draft and
  restore the temporary-source snapshot so the researcher can retry.
- Accepted request or started stream: clear temporary sources.
- Stream failure after partial response: keep the submitted history and show
  an actionable error; do not repopulate the composer with already-used
  temporary sources.
- Cancelled stream: retain the already-submitted message history; the next
  composer begins with stable scope only.

## Delivery Tranches

### Tranche 1: Core Source Composer

- move model switching from the header into the composer footer
- render stable chips for current PDF, paper, and selected text
- introduce typed temporary source state
- add removable paper, PDF, note, annotation, and collection chips
- add a compact `+` source menu with recent and current Zotero items
- pass temporary sources into context assembly
- clear temporary sources after accepted sends

### Tranche 2: Researcher Input Shortcuts

- add `@` source search
- add nested library, collection, tag, and note views
- resolve a selected child note into stable `Current Note` context
- add keyboard behavior
- add source-row overflow preview

### Tranche 3: Drag And Drop And Host Smoke

- accept Zotero item, annotation, and collection drag payloads
- add inline invalid-drop feedback
- verify Library and Reader behavior in the daily Zotero profile
- run packaged XPI smoke after the host loop is green

## Testing Strategy

### Logic Tests

- add, remove, clear, and de-duplicate temporary sources
- preserve stable context while clearing temporary evidence
- merge automatic scope and temporary sources deterministically
- retain temporary sources after send failure
- persist footer model selection

### Component Tests

- render stable and temporary chips distinctly
- remove temporary chips but not stable chips
- open the same source menu from `+` and `@`
- keep slash preset behavior intact
- switch `DeepSeek Flash` and `DeepSeek Pro` from the footer

### Zotero Host Smoke

- select one Library paper and confirm `Current Paper`
- open a Reader PDF and confirm `Current File`
- add another paper and confirm visible removable chip
- add a note and annotation
- add a collection filter
- switch models before send
- send successfully and confirm temporary chips clear
- trigger a provider failure and confirm temporary chips remain
- drag a paper, annotation, and collection into the composer

## Git Strategy

The implementation should use one dedicated branch from the current validated
frontend state and commit by tranche:

1. `feat: add typed message source composition state`
2. `feat: add researcher source composer shell`
3. `feat: add source search and filters`
4. `feat: add zotero source drag and drop`
5. `test: verify beaver-style source composer host flow`

Existing unrelated dirty work must be preserved and checkpointed before
implementation begins. Each tranche must pass its focused logic tests before
moving to the Zotero host loop.

## Non-Goals

- direct reuse of Beaver's cloud account, sync, credit, or agent-run state
- embeddings, semantic search, or remote indexing
- web search controls
- arbitrary provider configuration in the composer
- invisible whole-library context

## Acceptance Criteria

The design is accepted when a researcher can:

- open a PDF and see `Current File` without manual setup
- add papers, notes, annotations, collections, and filters through a compact
  source composer
- use `+`, `@`, and drag and drop without leaving the reading flow
- see every active source before sending
- switch between `DeepSeek Flash` and `DeepSeek Pro` in the composer footer
- send successfully and observe temporary evidence clear while stable context
  remains
- retry after a failed send without rebuilding the temporary evidence basket
