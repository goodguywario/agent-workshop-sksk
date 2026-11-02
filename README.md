# Christmas Party Planner: an agentic workshop

A small app for planning a company Christmas party, built so you can practise writing **agents** and **skills**.

A `party-planner` agent in [opencode](https://opencode.ai) delegates to four sub-agents:

| Sub-agent | Plans |
|---|---|
| invitation writer | the invitation |
| seating planner | the seating plan |
| catering agent | the menu |
| playlist composer | the playlist |

The sub-agents read and write the party through an MCP server. A web app shows the result live while they work.

**You only edit files in `.opencode/`.** The app, the database and the MCP server are scaffolding.

## Setup

You need:

- Node.js 22.5 or newer (`node --version`)
- [opencode](https://opencode.ai/docs/) installed
- an [OpenRouter](https://openrouter.ai) API key

```bash
git clone -b starter --single-branch <repo-url> party-planner
cd party-planner
npm install
npm run dev
```

Open http://localhost:5173. The database is created and seeded the first time anything starts.

In a second terminal, from the same folder:

```bash
opencode
```

Then, inside opencode:

1. Run `/connect`, choose **OpenRouter** and paste your key.
2. Run `/models` and choose `anthropic/claude-opus-5.5`, or another frontier model your facilitator suggests.
3. Run `/plan-party` and watch the web app fill in.

## What's where

```
.opencode/
  agents/        party-planner (primary) and its four sub-agents   ← you edit these
  skills/        house rules the agents load on demand              ← and these
  commands/      /plan-party
opencode.json    registers the party MCP server and model providers
src/db/          SQLite schema, seed data, reads and writes
src/mcp/         the MCP server: the tools agents use
src/api/         a small JSON API for the web app
web/             the web app
```

### Agents vs. skills

- An **agent** is a role. It has a job, its own context window, and only the tools it needs. The playlist composer cannot read the guest list, for example: look at the `permission` block at the top of its file.
- A **skill** is know-how that any agent can load when it's relevant. The `allergies` skill, for example, is useful both for the menu and for the invitation.

Every agent can see each skill's `description`. The full skill body is loaded only when an agent decides to use it, so write descriptions that make the agent reach for the skill at the right moment.

## How state reaches the agents

The agents never touch the database or the files directly. They call tools on the `party` MCP server (`src/mcp/tools.ts`):

| Area | Tools |
|---|---|
| Event | `get_event`, `update_event` |
| Guests | `list_guests`, `get_guest`, `add_guest`, `update_guest`, `remove_guest` |
| Seating | `get_seating_plan`, `set_seating_plan`, `clear_seating_plan` |
| Menu | `get_menu`, `set_menu` |
| Playlist | `get_playlist`, `set_playlist` |
| Invitation | `get_invitation`, `set_invitation` |

Inside opencode, the tools are prefixed with the server name, e.g. `party_set_seating_plan`.

**The server rejects broken data, never bad taste.** It refuses unknown guest IDs, guests seated twice, and malformed input. It happily accepts:

- a declined guest at the table
- peanuts on the menu for someone with a severe nut allergy
- the boss at the far end of the table

Knowing better is the agents' job, and that's what you're here to teach them.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and the web app |
| `npm run plan:reset` | Clears the generated plan (seating, menu, playlist, invitation). Keeps settings and guests, including your edits. |
| `npm run db:reset` | Resets everything to the original seed data |
| `npm test` | Runs the test suite |

A clean demo is `npm run plan:reset` followed by `/plan-party`.

## Trying weaker models

The same agents and skills behave differently on less capable models. To see how far the plan degrades, switch with `/models` and run `/plan-party` again:

1. `anthropic/claude-opus-5.5`: frontier
2. `anthropic/claude-haiku-5.5`: small and fast
3. `mistralai/ministral-8b-2512`: small open-weight model
4. A local model in LM Studio (below)

### LM Studio (local models)

1. Install [LM Studio](https://lmstudio.ai). Download a model that supports tool calling, such as `openai/gpt-oss-20b` or `google/gemma-4-26b-a4b`.
2. Load the model with a **context length of at least 32k tokens**. The default is too small: sub-agents fail with "Context size has been exceeded".
3. In LM Studio's **Developer** tab, start the server on port 1234.
4. Restart opencode. Its built-in `lmstudio` provider picks up the loaded models, and they appear under `/models` as `lmstudio/<model>`.

If your opencode version doesn't list them, add this provider to `opencode.json`:

```json
"provider": {
  "lmstudio": {
    "npm": "@ai-sdk/openai-compatible",
    "name": "LM Studio (local)",
    "options": { "baseURL": "http://127.0.0.1:1234/v1" },
    "models": { "openai/gpt-oss-20b": {} }
  }
}
```

## Troubleshooting

- **The web app says it can't reach the API.** `npm run dev` isn't running, or port 3001 or 5173 is taken. Stop the other process, or set `PORT=3002 npm run dev` and update the proxy in `vite.config.ts`.
- **Agents say they have no `party_*` tools.** Run `opencode mcp list` from the repo folder. The first call in a fresh clone may say "No MCP servers configured", and a new server shows `pending` for a few seconds; run it again and it should say `connected`. If it stays disconnected, run `npx tsx src/mcp/server.ts` to see the error.
- **`node:sqlite` errors.** Your Node.js is older than 22.5. Upgrade it.
- **The plan looks stale.** The web app polls every 2 seconds. If a run was interrupted, `npm run plan:reset` and run again.
