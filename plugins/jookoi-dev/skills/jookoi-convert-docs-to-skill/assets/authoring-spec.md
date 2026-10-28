# Authoring spec for <product> skill reference files

Give this to every drafter subagent. Fill in the angle-bracket parts.

## Reader and job

The reader is an LLM agent helping a person use <product> <major version>. It loads one reference file per question. It must be able to:
1. translate the user's words into the product concept
2. pick the least powerful mechanism that works: <ordered list from staff answers>
3. produce the exact change (setting path, command, config snippet, script)
4. know limits, pitfalls and version gates

## Writing rules

- Dense. Tables and short rules. No tutorials, marketing or history.
- Every fact comes from the manual extract (`<extract folder>`, index `INDEX.md`) or is tagged `[unverified]`. Forum and tutorial content shows where to look and what people struggle with. Never copy a community step without confirming it in the extract.
- Exact names: settings as `<path format>`, commands in backticks with real arguments.
- Size: 12K to 28K characters. Cut the long tail. The agent falls back to the online docs.
- No manual text copied in bulk.
- Installed version is <installed>. The manual is <manual edition>. Mark features that arrived in a later build as `(x.y+)`.

## Shape

```
# <Topic>
One-line scope.

## User says → concept
| User words | Concept | Where / how |

## Model
How this area works. Short.

## <Mechanism sections>
Tables with exact names.

## Recipes
Goal → exact steps or snippet. Only common goals (forum demand).

## Pitfalls
Symptom → cause → fix. Version gates. Not possible natively, with the nearest workaround.
```

Drop empty sections.

## Research method

- Grep `INDEX.md`, read only the sections for the topic. Grep large sections.
- Link to the generated index (`<commands.md>`) instead of repeating argument lists.
- Grep the forum corpus (`<corpus path>`) for the topic to learn demand and wording.
- Domain findings: `<domain doc>`. Tested facts: `<config reference>`. Link, don't duplicate.

## Tools

- Do not call an advisor or reviewer tool. Drafting from the extract doesn't need it, and it forwards the whole transcript to a costlier model.
- Do not send commands to the running app. The main session does live tests.

## Report back

File written, size in characters, extract sections used, every `[unverified]` claim, open questions. Nothing else.
