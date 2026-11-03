---
description: Show a few versions of a UI idea inside the running app
agent: build
---
Use the `prototype` skill, UI branch, to show what this could look like: $ARGUMENTS

If there's a `requests/*/idea.md` from this conversation, build on it.

- Put the variants on the existing page in `web/src/views/` where the feature would live, so they show the real data. Only add a new page if nothing fits.
- The app uses hash routes, so a variant opens at e.g. `http://localhost:5173/?variant=2#/seating`.
- Keep it a throwaway prototype: don't commit it, and don't touch the database, the API or the MCP server.

Finish by telling me which URLs to open (`npm run dev` must be running) and what to look for in each variant.
