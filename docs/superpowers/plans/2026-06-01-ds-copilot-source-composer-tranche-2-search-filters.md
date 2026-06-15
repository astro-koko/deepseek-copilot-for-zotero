# Deepseek Copliot Source Composer Tranche 2 Search And Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add researcher-efficient source discovery: `@` search, nested library/collection/tag/note views, keyboard navigation, and chip overflow.

**Architecture:** Keep Zotero lookup logic out of React by adding a focused `sourceSearch` service. Extend `messageSourcesStore` with mutually exclusive filters. Let `AddSourcesMenu` own only menu mode, query, active row, and navigation.

**Tech Stack:** React 18, TypeScript, Vitest, Zotero `Search`, `Libraries`, `Collections`, and `Tags` APIs

---

### Task 1: Add Search And Filter Services

**Files:**
- Create: `src/services/sourceSearch.ts`
- Create: `src/services/sourceSearch.test.ts`
- Modify: `src/services/messageSources.ts`
- Modify: `src/services/messageSources.test.ts`

- [ ] **Step 1: Write failing tests**

Cover these contracts:

```ts
expect(await searchSourceItems("attention", [1])).toEqual([
  { kind: "paper", itemId: 7, label: "Attention Is All You Need" },
]);
expect(listLibraries()).toEqual([{ id: 1, label: "My Library" }]);
expect(listCollections(1)).toEqual([{ id: 3, label: "LLM Evaluation", libraryId: 1 }]);
expect(listTags(1)).toEqual([{ id: 9, label: "methods", libraryId: 1 }]);
expect(listNotes([1])).toEqual([{ kind: "note", itemId: 8, label: "Experiment note" }]);
```

Add filter reducer tests:

```ts
expect(setLibraryFilter(state, 1).filters).toEqual({
  libraryIds: [1], collectionIds: [], tags: [],
});
expect(toggleCollectionFilter(state, 3).filters.libraryIds).toEqual([]);
expect(toggleTagFilter(state, tag).filters.collectionIds).toEqual([]);
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/services/sourceSearch.test.ts src/services/messageSources.test.ts
```

Expected: FAIL because service and reducers do not exist.

- [ ] **Step 3: Implement Zotero lookup services**

Create `sourceSearch.ts` with:

```ts
export async function searchSourceItems(
  query: string,
  libraryIds: number[],
): Promise<ItemSourceReference[]> {
  const ids: number[] = [];
  for (const libraryID of libraryIds) {
    const search = new Zotero.Search();
    search.libraryID = libraryID;
    search.addCondition("quicksearch-titleCreatorYear", "contains", query.trim());
    ids.push(...await search.search());
  }
  const items = await Zotero.Items.getAsync(ids);
  return items.map(itemToSource).filter(Boolean).slice(0, 10);
}
```

Also export `listLibraries()`, `listCollections(libraryId)`,
`listTags(libraryId)`, `listNotes(libraryIds)`, and move `itemToSource()` out of
`AddSourcesMenu.tsx` into this service.

- [ ] **Step 4: Implement mutually exclusive filters**

Export from `messageSources.ts`:

```ts
export const setLibraryFilter = (state: MessageSources, libraryId: number): MessageSources => ({
  ...state,
  filters: { libraryIds: [libraryId], collectionIds: [], tags: [] },
});

export const toggleCollectionFilter = (state: MessageSources, collectionId: number): MessageSources => ({
  ...state,
  filters: {
    libraryIds: [],
    collectionIds: state.filters.collectionIds.includes(collectionId)
      ? state.filters.collectionIds.filter((id) => id !== collectionId)
      : [...state.filters.collectionIds, collectionId],
    tags: [],
  },
});
```

Add the equivalent `toggleTagFilter()` and store methods.
Extend `removeSource()` so temporary filter chips can remove
`library-filter:<id>`, `collection-filter:<id>`, and `tag-filter:<id>` keys
without affecting item or collection sources.

- [ ] **Step 5: Run tests and commit**

```bash
npx vitest run src/services/sourceSearch.test.ts src/services/messageSources.test.ts
git add src/services/sourceSearch.ts src/services/sourceSearch.test.ts src/services/messageSources.ts src/services/messageSources.test.ts
git commit -m "feat: add zotero source search and filters"
```

### Task 2: Add Nested Source Menu And Keyboard Behavior

**Files:**
- Modify: `src/ui/components/AddSourcesMenu.tsx`
- Modify: `src/ui/components/Composer.tsx`
- Create: `src/ui/components/sourceMenuState.ts`
- Create: `src/ui/components/sourceMenuState.test.ts`

- [ ] **Step 1: Write failing menu-state tests**

```ts
expect(openSourceMenu(createSourceMenuState(), "@").mode).toBe("sources");
expect(moveSourceMenuSelection(state, 1, 3).selectedIndex).toBe(1);
expect(moveSourceMenuSelection(state, -1, 3).selectedIndex).toBe(2);
expect(backSourceMenu({ ...state, mode: "tags" }).mode).toBe("sources");
expect(closeSourceMenu(state).open).toBe(false);
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/ui/components/sourceMenuState.test.ts
```

Expected: FAIL because state helpers do not exist.

- [ ] **Step 3: Implement menu state**

Use:

```ts
export type SourceMenuMode =
  | "sources"
  | "libraries"
  | "collections"
  | "tags"
  | "notes";

export interface SourceMenuState {
  mode: SourceMenuMode;
  open: boolean;
  query: string;
  selectedIndex: number;
}
```

Export pure open, close, back, query-change, and wrapping-selection helpers.

- [ ] **Step 4: Wire `@`, nested menu modes, and keyboard rules**

In `Composer.tsx`:

```ts
if (value.endsWith("@") && !showPresets) {
  setInput(value.slice(0, -1));
  setShowSources(true);
  return;
}
```

When the source menu is active:

```text
ArrowDown / ArrowUp -> move active row
Enter -> choose active row
Escape -> close menu
Backspace with empty query in nested mode -> return to sources
```

In `AddSourcesMenu.tsx`, render nested modes from `sourceSearch.ts` and call
the corresponding store actions.

- [ ] **Step 5: Run focused tests and commit**

```bash
npx vitest run src/services/sourceSearch.test.ts src/services/messageSources.test.ts src/ui/components/sourceMenuState.test.ts
npm run build
git add src/ui/components/AddSourcesMenu.tsx src/ui/components/Composer.tsx src/ui/components/sourceMenuState.ts src/ui/components/sourceMenuState.test.ts
git commit -m "feat: add source search shortcuts and nested filters"
```

### Task 3: Add Stable Current-Note Context

**Files:**
- Modify: `src/types/scope.ts`
- Modify: `src/services/scopeResolver.ts`
- Modify: `src/services/scopeResolver.test.ts`
- Modify: `src/services/contextAssembler.ts`
- Modify: `src/services/contextAssembler.test.ts`
- Modify: `src/ui/components/sourceChipViewModel.test.ts`

- [ ] **Step 1: Write failing current-note tests**

Add a Library resolver test with a selected child note:

```ts
expect(resolveScopeFromLibrary()).toEqual({
  type: "paper",
  id: "paper-7",
  label: "Parent paper",
  itemIds: [7],
  currentNoteId: 8,
});
```

Add a chip view-model assertion:

```ts
expect(buildSourceChipViewModel(noteScope, createEmptyMessageSources()).chips)
  .toContainEqual({
    key: "stable:note-8",
    kind: "note",
    label: "Current Note",
    removable: false,
});
```

Add an assembler assertion:

```ts
expect(assembleContext(noteScope).fullText).toContain("Current note text");
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/services/scopeResolver.test.ts src/ui/components/sourceChipViewModel.test.ts
```

Expected: FAIL because `currentNoteId` and note selection handling do not exist.

- [ ] **Step 3: Add the stable note field and resolver branch**

Extend `ScopeContext`:

```ts
currentNoteId?: number;
```

In the one-selected-item branch of `resolveScopeFromLibrary()`:

```ts
if (item.isNote?.() && item.parentItem) {
  return {
    type: "paper",
    id: `paper-${item.parentItem.id}`,
    label: item.parentItem.getDisplayTitle(),
    itemIds: [item.parentItem.id],
    currentNoteId: item.id,
  };
}
```

Render `Current Note` as a non-removable stable chip when present. Standalone
notes remain addable as temporary sources; they do not fabricate a paper scope.

In `assembleContext()`, append stable note content when `scope.currentNoteId`
resolves:

```ts
const currentNote = scope.currentNoteId
  ? Zotero.Items.get(scope.currentNoteId)
  : null;
const currentNoteText = String((currentNote as any)?.getNote?.() || "").trim();
```

Append `=== CURRENT NOTE ===` and `currentNoteText` after the automatic paper
text when it is non-empty.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run src/services/scopeResolver.test.ts src/ui/components/sourceChipViewModel.test.ts
git add src/types/scope.ts src/services/scopeResolver.ts src/services/scopeResolver.test.ts src/services/contextAssembler.ts src/services/contextAssembler.test.ts src/ui/components/sourceChipViewModel.ts src/ui/components/sourceChipViewModel.test.ts
git commit -m "feat: show selected zotero note as stable context"
```

### Task 4: Resolve Filters Into Bounded Context

**Files:**
- Modify: `src/services/messageSourcesContext.ts`
- Modify: `src/services/messageSourcesContext.test.ts`

- [ ] **Step 1: Write failing filter assembly tests**

```ts
expect(assembleMessageSourcesContext(collectionFilterSources, new Set()).metadata)
  .toContain("Filtered items: 2");
expect(assembleMessageSourcesContext(tagFilterSources, new Set()).warnings)
  .toContain("Filtered source set truncated to 20 items.");
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx vitest run src/services/messageSourcesContext.test.ts
```

Expected: FAIL on missing filter resolution.

- [ ] **Step 3: Implement bounded filter resolution**

Add:

```ts
const FILTER_ITEM_LIMIT = 20;
```

Resolve collection filters through `Zotero.Collections.get(id).getChildItems(true)`.
Normalize returned entries before use:

```ts
const normalizeItemIds = (items: Array<number | Zotero.Item>): number[] =>
  items.map((item) => typeof item === "number" ? item : item.id);
```

Resolve tag filters by reading candidate item tags with `item.getTags()`.
Deduplicate IDs, cap at `FILTER_ITEM_LIMIT`, and append a truncation warning
when capped.

- [ ] **Step 4: Run tests and commit**

```bash
npx vitest run src/services/messageSourcesContext.test.ts src/services/contextAssembler.test.ts
git add src/services/messageSourcesContext.ts src/services/messageSourcesContext.test.ts
git commit -m "feat: resolve source filters into bounded context"
```

### Task 5: Add Filter Chips, Overflow Preview, And Verify Tranche 2

**Files:**
- Modify: `src/ui/components/SourceChipRow.tsx`
- Modify: `src/ui/components/sourceChipViewModel.test.ts`
- Update: `docs/zotero-dev-smoke-checklist.md`

- [ ] **Step 1: Add overflow interaction**

Extend `buildSourceChipViewModel()` so `filters.libraryIds`,
`filters.collectionIds`, and `filters.tags` become removable temporary chips.
Use the existing `overflowCount` and add a disclosure button that lists hidden
temporary chips. Keep stable chips always visible.

- [ ] **Step 2: Run full logic loop**

```bash
npm test
npm run build
npm run verify:xpi
```

Expected: PASS.

- [ ] **Step 3: Run daily-profile smoke and commit evidence**

Record PASS/FAIL for `@` search, keyboard selection, library filter, collection
filter, tag filter, note picker, and `+N` overflow. Then:

```bash
git add src/ui/components/SourceChipRow.tsx src/ui/components/sourceChipViewModel.test.ts docs/zotero-dev-smoke-checklist.md
git commit -m "test: verify source search and filter flow"
```
