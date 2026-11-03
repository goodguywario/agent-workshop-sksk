---
description: Turn a feature idea into a spec and task list for the developers
agent: build
---
Use the `prd` skill to turn this feature request into a spec the developers can act on: $ARGUMENTS

Build on `requests/*/idea.md` and any mockup from this conversation if they exist. Use the `user-story` skill for the user stories, so each one has acceptance criteria a developer can test.

Write it for a developer who wasn't in the conversation. Then end with a task list that names which part of this codebase each task touches:

- web app views: `web/src/views/`
- JSON API: `src/api/`
- data and seed: `src/db/`
- MCP tools for the agents: `src/mcp/tools.ts`
- agents and skills: `.opencode/`

Save it as `requests/<short-name>/spec.md` and tell me where it is.
