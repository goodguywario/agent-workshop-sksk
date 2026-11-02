# Christmas Party Planner — Agentic Workshop Repo

Design document, 2026-11-02.

## Intent

Mario is running a full-day workshop (09:00–17:00) on agentic systems: skills, agents, and how coding harnesses orchestrate agentic workflows. Participants already have some agentic coding experience. They use **opencode** with **frontier models via OpenRouter** (Opus 5+ or similar).

This repo is the hands-on material. It is a small Christmas-party-planning app. A primary `party-planner` agent delegates to specialist sub-agents. The sub-agents read and write the event state through an MCP server backed by SQLite, and a web frontend shows the result.

**The learning happens in the agent and skill files, not in the code.** The frontend, MCP server and database are scaffolding. They must work on every laptop on the first try and then stay out of the way.

### Shape of the day (for context; this repo does not implement the agenda)

1. Concepts: what a skill is, what an agent is, and how MCP provides state and tools to agents.
2. Mario demos the finished **reference** version: a good run, shown in the views.
3. Participants clone the **starter** version and trigger their first planning run. The result is deliberately underwhelming: it looks plausible, but it ignores allergies, puts the boss at the end of the table, and leaves out Mariah Carey.
4. Pairs improve sub-agents and skills. Examples:
   - the catering agent handles allergies
   - the seating planner places singles vs. couples sensibly
   - a Christmas theme always gets "All I Want For Christmas Is You"
5. Show-and-tell: pairs show both their instruction diffs and what the planner generated.
6. Model step-down: the same agents and skills are run against less capable models (cheaper OpenRouter models, and a model hosted locally in **LM Studio**) to watch the result get more jumbled.

## Goals

- `git clone` → `npm install` → `npm run dev` → open opencode → `/plan-party` works with no manual configuration beyond an OpenRouter key.
- The starter run produces **plausible but naive** output in every view. Each gap traces back to a rule missing from an agent or skill file.
- The seed data contains enough concrete traps that pairs have real rules to find and encode.
- The split between sub-agents (roles, own context, restricted tools) and skills (reusable domain know-how) is clear and arguable, so pairs face real "where does this rule belong?" decisions.
- Results show up live in the frontend while the planner runs.
- Pairs can reset the generated plan and re-run cleanly before a demo.

## Non-goals

- Participants modifying the frontend, MCP server or DB schema. These may be readable and tidy, but they are not the exercise.
- Authentication, multi-user, deployment, or hosting. Everything runs locally per participant.
- Multiple events. There is exactly one event.
- Slides or a timed agenda for the day.
- Making weak models *succeed*. The tool surface is designed for frontier models, and degraded output on weaker models is the point of the final segment. Weaker models must still be able to *run* the flow, though (see Model and provider).

## Anti-goals (would make it a failure even if it "works")

- **Install friction.** Native module builds, global installs, Docker, or per-machine config steps would eat the morning.
- **The server enforcing taste.** If the MCP server enforced "boss in the middle", "couples together" or "no nuts for the nut-allergic guest", there would be nothing left for agents to learn. The server rejects only *broken data*: unknown IDs, duplicates and malformed input. Good judgement lives only in instructions. This boundary should be stated explicitly in code comments and the README, because it is a teaching point.
- **Traps a frontier model fixes unprompted.** Decided with Mario: the main traps are **house rules**, conventions no model can infer from the data. Examples: the boss sits in the middle seat; Mariah is mandatory at Christmas; the company's policy for singles vs. couples; invitations must ask for allergies by the RSVP deadline; tracks/dishes the company always or never wants. Safety traps (allergies, declined guests) stay in the seed. If the starter sometimes handles them, that is a talking point rather than a failure. The message of the day: the model brings competence, and skills bring *your organisation's* conventions. Starter agent files are generic but honest. They are not deliberately sabotaged.
- **A starter so weak it fails outright.** If the starter crashes, refuses, or writes nothing, the "make it better" arc is lost. It must produce complete, mediocre output.
- **A reference that leaks into the starter.** Participants should not find the answers in the starter branch.

## Constraints

- **Node 22.5+** (Mario has Node 24, npm 11). Use plain npm, no pnpm/yarn requirement.
- SQLite via the built-in **`node:sqlite`**, so nothing compiles natively.
- TypeScript run with `tsx` (no build step needed for the MCP server or API).
- opencode is the harness. The repo ships the opencode config: `opencode.json`, plus agents, skills and commands under `.opencode/`. **The builder must verify current opencode conventions** before writing them: agent frontmatter, per-agent tool permissions for MCP tools, skill discovery path and format, and command files.
- All content is in English: seed data, agent instructions and generated output.

## Architecture

```
web/ (React + Vite)  ──HTTP──▶  api (small Node HTTP server)  ──▶ ┐
                                                                    ├─ data/party.db (SQLite, WAL)
opencode ──stdio──▶  mcp server (@modelcontextprotocol/sdk)  ─────▶ ┘
```

- **One package, one repo.** Shared `src/db/` module (schema, queries, validation) used by both the API and the MCP server, so the rules are identical in both paths.
- The **MCP server** runs over stdio. It is launched by opencode via `opencode.json` (`npx tsx src/mcp/server.ts` or equivalent), and the DB path is resolved relative to the repo root.
- The **API** is a small HTTP server for the frontend. Choice of framework is the builder's call; keep it minimal.
- The **frontend** polls every ~2 s so views fill in live during a run.
- SQLite in WAL mode, because two processes open the same file.

### npm scripts (names are the builder's call, but these capabilities must exist)

- `dev`: starts API + Vite together. First run auto-creates and seeds the DB if it is missing.
- `db:reset`: drops everything and reseeds (settings, guests, empty plan).
- `plan:reset`: clears generated output only (seating, menu, playlist, invitation) and keeps settings and guests, including any edits made in the guest view.

## Data model

One event row. Lists such as allergens are stored as JSON-array text where needed; the tools accept and return real arrays.

**event**
- name, host company
- **theme**
- **dress code**
- **location**: venue name + address
- **time**: start datetime; end datetime optional
- **RSVP deadline**: date

**guests**
- id, first name, last name, email
- job title, department
- `is_boss` (exactly one in the seed; the schema doesn't enforce it)
- `partner_id`: nullable self-reference, symmetric. A partner may be a non-employee plus-one; that guest has no department.
- RSVP status: `attending` | `declined` | `pending`
- dietary preference: `none` | `vegetarian` | `vegan` | `pescatarian`
- allergies: **free text**. This is deliberately messy and realistic ("coeliac", "nuts — SEVERE, carries EpiPen", "lactose, a little is ok").
- notes: free text, where several traps hide

**seat_assignments**
- seat number (1..N), guest_id (unique, FK → guests, `ON DELETE CASCADE`)
- **Seat count (builder's call):** N = length of the list submitted to `set_seating_plan`. There is no fixed table size. The middle seat is defined as seat `ceil(N/2)`; the reference skill states this, and the frontend highlights that seat. If a guest is later removed, their seat stays as a visible empty gap. Nothing is renumbered, so the gap is obvious until the planner is re-run.
- **Decision:** a table, not a JSON string. A JSON string silently keeps dangling guest IDs when a guest is removed in the guest view. The table clears that seat automatically. The agent never sees storage either way.

**menu_items**
- course: `starter` | `main` | `dessert` | `drinks`
- name, description
- allergens: array
- dietary tags: array, e.g. vegan, gluten-free
- notes: e.g. "alternative main for guests with shellfish allergy"
- sort order

**playlist_tracks**
- position, title, artist, optional note ("why this track")

**invitation**
- subject, body (plain text, email-ready)

## MCP tools

These are coarse-grained and frontier-model-friendly. "Set" tools replace the whole list in one call, which keeps each agent's job to a single, inspectable write.

| Tool | Notes |
|---|---|
| `get_event` / `update_event` | `update_event` exists, but no planning agent is granted it. Settings belong to the human. |
| `list_guests`, `get_guest`, `add_guest`, `update_guest`, `remove_guest` | Planning agents get read-only access. CRUD exists for completeness and for the frontend's API. |
| `get_seating_plan`, `set_seating_plan(guest_ids: ordered list)`, `clear_seating_plan` | Seat *i* = position *i*. Validation: IDs exist, no duplicates. It deliberately does **not** reject declined or pending guests; seating them is a planner mistake to learn from. |
| `get_menu`, `set_menu(items[])` | Replace-all. |
| `get_playlist`, `set_playlist(tracks[])` | Replace-all. |
| `get_invitation`, `set_invitation(subject, body)` | |

Tool descriptions should be clear and neutral. They say what a tool does, never what good output looks like, because that knowledge belongs to the agents and skills.

Errors should be descriptive, so an agent can self-correct (for example, "guest id 42 does not exist", or "guest 7 appears twice").

## Frontend views

The frontend is festive but clean. It is not the focus, so it should be competent, not elaborate.

1. **Settings:** edit all event fields.
2. **Guests:** table with add/edit/remove. Shows RSVP status, diet, allergies, partner and notes, plus a boss marker.
3. **Invitation:** rendered subject + body, with a **Copy to clipboard** button that copies plain text ready to paste into an email.
4. **Seating:** a **horseshoe (U-shaped) table** drawn with N seats.
   - Seats are numbered from one tip, around the curve, to the other tip; the middle seat is at the centre of the curve.
   - Each seat shows the guest name, with a subtle marker for boss, partner links, and dietary flags.
   - Seats holding declined or pending guests are visibly flagged, so mistakes are easy to spot at show-and-tell.
   - An empty plan shows an empty-state message.
5. **Menu:** grouped by course, with allergen and dietary badges per item.
6. **Playlist:** ordered track list.

Every planning view has an empty state that says "Run `/plan-party` in opencode". The views poll for changes.

## Agents and skills

### Agents (in `.opencode/`)

- **`party-planner`** (primary): reads the event and guests, then delegates to the four sub-agents. Parallel delegation is fine where the harness supports it. It finishes with a short summary. It has no write tools of its own beyond what delegation requires.
- **`invitation-writer`**: read event + guests; write invitation.
- **`seating-planner`**: read event + guests; write seating.
- **`catering-agent`**: read event + guests; write menu.
- **`playlist-composer`**: read event; write playlist. It does **not** get guest access; this is a deliberate tool-scoping example for the morning talk.

Each sub-agent is granted only the MCP tools it needs. That demonstrates least privilege, and it's a nice "aha" when a pair tries to make the playlist agent use guest data.

### Skills (examples; final set is the builder's call)

- **`allergies`**: how to read messy free-text allergy notes, what severity means, cross-contamination, and alternatives per course. Used by catering *and* the invitation writer, who asks guests to report dietary needs by the RSVP date. This shows one skill reused by two agents.
- **`seating-etiquette`**: boss in the middle seat, partners adjacent, how to place singles, honouring guest notes, accessibility, and only seating attending guests.
- **`christmas-traditions`**: when the theme is Christmas, the playlist **must** include Mariah Carey – "All I Want For Christmas Is You". It also holds other theme-dependent conventions, such as a traditional menu.
- **`email-invitation-style`**: plain text, no markdown, and must include date/time, location, dress code and RSVP deadline.

### Command

- **`/plan-party`**: triggers the `party-planner` on the current event.

### Two branches

- **`main` = reference.** Full, well-crafted agents and skills that handle every seeded trap. Mario demos this up front and uses it as a fallback for stuck pairs. *(Builder's call: `main` as reference, `starter` as a separate branch. Participants clone with `git clone -b starter --single-branch`, and the README states that prominently. The reference stays reachable for anyone who goes looking; that's acceptable, since it doubles as the fallback for stuck pairs.)*
- **`starter` = thin.** Same code, same seed, same file names. Agents are a few generic lines each, and skill files exist but are vague stubs. That way the agent/skill split is visible from the start, and pairs improve files rather than invent the structure. The starter must still produce complete output in every view.
- The branches differ **only** in `.opencode/agent/`, `.opencode/skill/` and `.opencode/command/` (if needed). Code fixes must land on both.

## Seed data

- A fictional company (name is the builder's call), ~20 employees plus some non-employee partners, about 24–26 guests total.
- An event with the theme "Christmas", a festive dress code, a fictional venue, a date in mid-December 2026, and an RSVP deadline about two weeks before.

Required traps (each one maps to a rule the reference handles and the starter misses):

- **One boss** (CEO), attending with a partner. The boss belongs in the middle seat, with the partner beside them.
- **3–4 couples**: at least one employee + employee, and at least one employee + non-employee plus-one.
- **Singles**, including a brand-new hire who knows nobody.
- **Allergies**, written messily:
  - a severe nut allergy
  - coeliac
  - lactose intolerance (mild)
  - shellfish
  - a **vegan with a nut allergy**
  - a vegetarian
  - one preference that is *not* an allergy ("doesn't like spicy food")
- **Two guests who must not sit next to each other.** The hint lives in a guest's notes field.
- **A wheelchair user** who needs an end seat at a horseshoe tip, stated in notes.
- **RSVP mix:** about 2 declined and 2 pending. *(Builder's call:)* the reference seats only `attending` guests and caters for attending guests' needs. The catering agent mentions pending guests' allergies in a menu note ("if X confirms…"). The seating view flags a declined guest in a seat as an error and a pending guest as a warning.

A short facilitator-only file (`FACILITATOR.md`, on `main` only) lists every trap and which agent or skill handles it in the reference. *(Builder's call.)*

## Model and provider

- The README explains OpenRouter setup for opencode, including the API key and selecting a frontier model.
- `opencode.json` may set a default model. **The builder must verify current OpenRouter model IDs** at build time rather than hard-coding from memory.
- `opencode.json` also ships a ready-made **LM Studio provider** (OpenAI-compatible endpoint on `http://localhost:1234/v1`). The README has a short section on loading a tool-calling-capable model in LM Studio and switching opencode to it. **The builder must verify** the current opencode syntax for custom OpenAI-compatible providers.
- The README suggests one or two cheaper OpenRouter models for the step-down segment *(builder's call which)*.
- Because weaker models will be used, MCP tool schemas stay simple: flat arguments where possible, small enums, no deeply nested optional structures. Error messages say exactly what to fix, so a weak model's failures show up as *jumbled plans* rather than a dead tool loop.

## Verification

- Automated tests for the DB and validation layer, and for MCP tool behaviour (valid writes, rejected broken data, cascade on guest removal).
- Manual end-to-end on Mario's machine:
  - fresh clone → install → dev → `/plan-party` on **both** branches
  - the starter shows naive-but-complete output, and the reference visibly handles every trap
  - this needs Mario's OpenRouter key in opencode
- A cold-install check from a clean clone, so no hidden local state is relied on.
- A smoke run of `/plan-party` through the LM Studio provider config. This only checks that the wiring connects, not output quality, and it needs LM Studio running on Mario's machine.

## Left to the builder

- Company/venue names and exact seed content within the trap list above.
- API framework, frontend styling and component structure.
- Exact skill set and naming beyond the four examples, as long as the agent/skill split stays teachable.
- Exact script names.
