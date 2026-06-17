# Custom Commands

Deepseek Copliot custom commands are reusable slash commands for common
reading workflows. The normal path is to add and edit commands in Zotero
Settings. JSON import is for creating several commands at once.

## JSON Shape

Paste a JSON array into
`Settings -> Deepseek Copliot -> Commands and Prompts -> Import from JSON`.

```json
[
  {
    "id": "replication-risk",
    "label": "Replication Risk",
    "description": "Assess whether the result is likely to replicate",
    "promptPrefix": "Assess the main replication risks for this paper. Separate evidence from the paper, assumptions you infer, and checks that would require external verification",
    "aliases": ["replication", "robustness"],
    "scopeHint": ["paper", "pdf"],
    "showInSidebar": false,
    "evidenceHint": true
  }
]
```

## Fields

- `id`: lower-case slash command id, such as `replication-risk`
- `label`: display name
- `description`: short helper text
- `promptPrefix`: text inserted before the user's message
- `aliases`: optional slash-menu search aliases
- `scopeHint`: any of `paper`, `pdf`, `collection`, or `manual-selection`
- `showInSidebar`: whether the command may appear on the sidebar home panel
- `evidenceHint`: whether the command should lean toward web verification

## AI Prompt

Use the `Copy AI prompt` button in Zotero Settings, then add your own command
ideas below it. The AI should return only a JSON array. Paste that array back
into Zotero Settings, validate it, preview the commands, and apply the import.
