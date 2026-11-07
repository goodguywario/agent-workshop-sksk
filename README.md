# Christmas Party Planner: an agentic workshop

A small app for planning a company Christmas party, built so you can practise writing **agents** and **skills**.

A `party-planner` agent in [opencode](https://opencode.ai) delegates to five sub-agents:

| Sub-agent | Plans |
|---|---|
| invitation writer | the invitation |
| seating planner | the seating plan |
| catering agent | the menu |
| playlist composer | the playlist |
| speech writer | the speeches, one per speaker, only when speeches are switched on in the web app |

The sub-agents read and write the party through an MCP server. A web app shows the result live while they work.

**You only edit files in `.opencode/`.** The app, the database and the MCP server are scaffolding.

## Setup

You need:

- Node.js 22.13 or newer (`node --version`)
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

## Install the workshop skills

These skills are installed globally (in `~/.agents/skills/`), so they're available in any project but stay out of this repo.

```bash
npx skills add obra/superpowers -g -a opencode -y -s brainstorming

npx skills add mattpocock/skills -g -a opencode -y -s prototype -s writing-for-agents

npx skills add github/awesome-copilot -g -a opencode -y -s prd

npx skills add deanpeters/product-manager-skills -g -a opencode -y -s user-story -s storyboard
```

Restart opencode afterwards so it picks them up.

| Skill | From | What it's for |
|---|---|---|
| `brainstorming` | Superpowers | Explores an idea with you, one question at a time, before anything gets built |
| `prototype` | Matt Pocock | Builds throwaway versions of a page to compare |
| `writing-for-agents` | Matt Pocock | How to write skills and agent instructions |
| `prd` | GitHub | Writes a product requirements document |
| `user-story` | Dean Peters | Writes user stories with testable acceptance criteria |
| `storyboard` | Dean Peters | Tells a user's journey in six frames |

## Spec a feature as a decision maker

You don't need to write code to shape a feature. Describe what you want in your own words, and these commands use the skills above to turn it into something developers can build from:

| Command | What you get |
|---|---|
| `/plan-feature <idea>` | A conversation that sharpens the idea, saved as `requests/<name>/idea.md` |
| `/mockup <what to show>` | Three versions of the screen inside the running app, with real data |
| `/spec <idea>` | A spec with user stories, acceptance criteria and a task list for the developers |
| `/story-page <idea>` | An animated web page telling the user's story, in `requests/<name>/story.html` |

For example: `/plan-feature We want a speech writer that turns a few bullet points we type in the app into a speech for the party.`

The commands run on opencode's default `build` agent. The party-planning agents can't see these skills, so they never interfere with `/plan-party`.

## What's where

```
.opencode/
  agents/        party-planner (primary) and its five sub-agents   ← you edit these
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

Each agent may only load the skills listed under `skill:` in its `permission` block. **When you create a new skill, also allow it in every agent that should use it**, or that agent won't see it at all.

## How state reaches the agents

The agents never touch the database or the files directly. They call tools on the `party` MCP server (`src/mcp/tools.ts`), and each tool is an HTTP call to the same API the web app uses. **`npm run dev` must be running for the tools to work.**

| Area | Tools |
|---|---|
| Event | `get_event`, `update_event` |
| Guests | `list_guests`, `get_guest`, `add_guest`, `update_guest`, `remove_guest` |
| Seating | `get_seating_plan`, `set_seating_plan`, `clear_seating_plan` |
| Menu | `get_menu`, `set_menu` |
| Playlist | `get_playlist`, `set_playlist` |
| Invitation | `get_invitation`, `set_invitation` |
| Speeches | `get_speeches`, `list_public_guests`, `set_speech_text` |

The speech settings (who speaks, tone, length, cringe level, things to mention) are chosen by the organiser on the **Speeches** page; agents can read them but not change them. `list_public_guests` returns only attending guests and only their public details, so the speech writer can't leak notes, allergies or diets.

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
| `npm run plan:reset` | Same as the **Clear plan** button at the bottom of the web app's sidebar: clears the generated plan (seating, menu, playlist, invitation, speech texts). Keeps settings, guests and the speech setup, including your edits. |
| `npm run db:reset` | Resets everything to the original seed data |
| `npm test` | Runs the test suite |

A clean demo is **Clear plan** in the web app followed by `/plan-party`.

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

If your opencode version doesn't list them, add an `lmstudio` entry **inside the existing `provider` block** of `opencode.json`, next to `openrouter`:

```json
"lmstudio": {
  "npm": "@ai-sdk/openai-compatible",
  "name": "LM Studio (local)",
  "options": { "baseURL": "http://127.0.0.1:1234/v1" },
  "models": { "openai/gpt-oss-20b": {} }
}
```

## Troubleshooting

- **The web app says it can't reach the API.** `npm run dev` isn't running, or port 3001 or 5173 is taken. Stop the other process, or set `PORT=3002 npm run dev` and update the proxy in `vite.config.ts`.
- **Agents say they have no `party_*` tools.** Run `opencode mcp list` from the repo folder. The first call in a fresh clone may say "No MCP servers configured", and a new server shows `pending` for a few seconds; run it again and it should say `connected`. If it stays disconnected, run `npx tsx src/mcp/server.ts` to see the error.
- **Tools answer "Can't reach the party API".** Start `npm run dev`. The MCP server looks for the API on port 3001; if you moved it, set `PARTY_API_URL` (for example `PARTY_API_URL=http://localhost:3002`) before starting opencode.
- **`node:sqlite` errors.** Your Node.js is older than 22.13. Upgrade it.
- **The plan looks stale.** The web app polls every 2 seconds. If a run was interrupted, click **Clear plan** in the sidebar and run again.
