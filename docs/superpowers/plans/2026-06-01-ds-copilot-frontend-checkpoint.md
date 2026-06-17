# Deepseek Copliot Frontend Checkpoint

Date: 2026-06-01
Status: Saved handoff state for the next window

## Product Decision Captured

- release-facing Settings should be simplified to `API key` only
- `Model` should stop being user-configurable
- `Max Context` should stop being user-configurable
- DeepSeek defaults should remain internal, including the default request budget
- long contexts should be handled by automatic truncation / compression in the context pipeline
- the current visible `Model` / `Max Context` fields are a temporary debug-stage artifact, not the release contract

## Real Runtime Facts Verified In Zotero

- `Settings` is no longer blank in the real daily profile
- `API Key` is now a real secure text field in Zotero Settings
- the settings pane has now been simplified in code toward the release-facing `API key`-only contract
- Reader host remains mounted on active PDF tabs and shows `Ready`
- Reader composer accepts real typed input
- typing into Reader composer enables `Send`
- clicking `Send` is no longer inert: the draft clears, so the frontend event path is firing
- recent chats are visible, so thread persistence is at least partially alive

## Current Surface Status

- `Settings`
  The pane is mounted and the user-facing form is now reduced to `API Key`, but packaged restart and daily-profile revalidation are still pending.
- `Library`
  Native-host acceptance is still pending on both a regular library item and a PDF attachment item in the daily profile.
- `Reader`
  The native host is visible and interactive enough to type and click `Send`, but the post-send thread state still does not settle visibly.

## Current Main Problem

The highest-value remaining blocker is no longer host visibility or input editability.

The current blocker is:

- after manual send, the draft clears but the UI does not settle into a visible active-thread / response state

Most likely next failure layers:

1. `chatSessionStore.send()`
2. `threadController.createThread()` / `appendMessage()`
3. `persistence.ts` read-after-write behavior
4. session state not being reflected back into `Sidebar.tsx`

The strongest current hypothesis is:

- the first user message is not surviving the create-thread plus append-message path cleanly
- the failure is likely being swallowed or only logged, so the draft clears without a visible thread or inline error state

Code-level progress now made against that hypothesis:

- `saveThread()` now throws on write failure instead of silently resolving
- `chatSessionStore.send()` now surfaces a visible session error when the first user message fails before streaming starts
- the sidebar provider pill no longer exposes the internal model choice as user-facing configuration state

## Best Next Debug Pass

Start the next window by instrumenting only the send/session path:

1. log `Sidebar.handleSend()`
2. log `chatSessionStore.send()`
3. log the results of `createThread()` and the first `appendMessage()`
4. confirm whether `loadThread()` immediately returns the saved thread
5. inspect the `threads` table through Zotero `Run JavaScript`, not external `sqlite3`, because the live database may be locked

## Suggested First Code Slice In The Next Window

- first verify in the real daily profile that first-message failures now surface inline instead of failing silently
- then verify whether successful sends now settle into a visible active thread in Reader and Library
- keep DeepSeek default model selection and default context budget internal in `settingsManager`
- move any overflow handling into automatic truncation / compression instead of exposing a budget knob
- keep toolbar-placement redesign out of scope until host surfaces are stable

## Release-Handoff Notes

- Do not call the plugin usable-for-GitHub until the visible host surfaces and the first real send both work after packaged `.xpi` restart.
- Do not treat the current top-toolbar toggle as final placement; it is only a temporary debug affordance.
- Do not expand into provider polish until `Settings`, `Library`, `Reader`, and manual send form a stable host loop in the daily profile.

## Focused Validation Already Run

- `npx vitest run src/modules/preferencesPaneSource.test.ts src/modules/preferencesPane.test.ts`
- result: passed
- `npx vitest run src/services/chatSession.test.ts src/services/persistence.test.ts src/ui/components/sidebarViewModel.test.ts src/services/settingsManager.test.ts src/services/chatEngine.test.ts`
- result: passed
