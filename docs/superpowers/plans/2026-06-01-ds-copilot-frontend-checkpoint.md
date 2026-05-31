# DS Copilot Frontend Checkpoint

Date: 2026-06-01
Status: Saved handoff state for the next window

## Product Decision Captured

- release-facing Settings should be simplified to `API key` only
- `Max Context` should stop being user-configurable
- DeepSeek defaults should remain internal
- long contexts should be handled by automatic truncation / compression in the context pipeline

## Real Runtime Facts Verified In Zotero

- `Settings` is no longer blank in the real daily profile
- `API Key` is now a real secure text field in Zotero Settings
- `Max Context` is now a real editable numeric control in Zotero Settings
- `Tab` focus reaches `API Key`, `Model`, and `Max Context` in order
- Reader host remains mounted on active PDF tabs and shows `Ready`
- Reader composer accepts real typed input
- typing into Reader composer enables `Send`
- clicking `Send` is no longer inert: the draft clears, so the frontend event path is firing
- recent chats are visible, so thread persistence is at least partially alive

## Current Main Problem

The highest-value remaining blocker is no longer host visibility or input editability.

The current blocker is:

- after manual send, the draft clears but the UI does not settle into a visible active-thread / response state

Most likely next failure layers:

1. `chatSessionStore.send()`
2. `threadController.createThread()` / `appendMessage()`
3. `persistence.ts` read-after-write behavior
4. session state not being reflected back into `Sidebar.tsx`

## Best Next Debug Pass

Start the next window by instrumenting only the send/session path:

1. log `Sidebar.handleSend()`
2. log `chatSessionStore.send()`
3. log the results of `createThread()` and the first `appendMessage()`
4. confirm whether `loadThread()` immediately returns the saved thread
5. inspect the `threads` table through Zotero `Run JavaScript`, not external `sqlite3`, because the live database may be locked

## Suggested First Code Slice In The Next Window

- first unblock visible send/thread behavior
- once manual send is stable, remove `Max Context` from the user-facing Settings pane
- keep toolbar-placement redesign out of scope until host surfaces are stable

## Focused Validation Already Run

- `npx vitest run src/modules/preferencesPaneSource.test.ts src/modules/preferencesPane.test.ts`
- result: passed
