# Deepseek Copliot History Actions And Model Diagnostic Design

## Scope

This tranche adds three small, user-facing capabilities without reopening broader sidebar architecture:

1. Persist a separate runtime diagnostic record for the latest provider request so model choice can be verified independently of UI refresh timing.
2. Allow deleting a saved conversation from the recent-threads list.
3. Allow exporting a single saved conversation to a local Markdown file from the recent-threads list.

## Approach

The provider diagnostic should be written at request time, not indirectly through sidebar refresh, because the existing `/tmp/ds-copilot-surface-state.json` snapshot depends on UI lifecycle and can miss the latest request. A dedicated lightweight diagnostic file keeps the evidence chain stable for runtime verification.

History actions should live beside each recent thread entry, because that is the narrowest surface where the user can manage saved conversations without adding a separate management view. Delete should remove persisted storage and update in-memory sidebar state. Export should serialize one thread into Markdown with title, timestamps, scope metadata, and ordered messages.

## Boundaries

- No bulk export in this tranche.
- No batch delete in this tranche.
- No new persistence schema.
- No redesign of the recent-thread information architecture.

## Verification

- Unit test the provider diagnostic write.
- Unit test thread export formatting and file-write call.
- Unit test delete behavior and sidebar refresh after deletion.
- Re-run targeted runtime smoke to confirm `deepseek-v4-pro` evidence is available from the dedicated diagnostic file.
