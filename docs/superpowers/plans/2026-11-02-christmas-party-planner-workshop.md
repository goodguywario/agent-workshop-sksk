# Christmas Party Planner Workshop Repo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cloneable workshop repo where an opencode `party-planner` agent and four sub-agents plan a Christmas party through an MCP server over SQLite. A React frontend shows the result live. `main` holds the reference agents and skills; `starter` holds thin ones.

**Architecture:** This is one npm package. `src/db/` owns the schema, the seed and all reads/writes, and validates only broken data. `src/mcp/` exposes `src/db/` as MCP tools over stdio for opencode. `src/api/` exposes it as JSON over HTTP for the Vite/React app in `web/`, which polls every 2 s. The agents, skills and command live in `.opencode/`. They are the only files that differ between branches.

**Tech Stack:** Node ≥22.5 (`node:sqlite`), TypeScript run with `tsx`, `@modelcontextprotocol/sdk` + `zod`, `node:http`, React 18 + Vite, `vitest`, `concurrently`, opencode v2.2.0.

**Spec:** `docs/superpowers/specs/2026-11-02-christmas-party-planner-workshop-design.md`

## Global Constraints

- Node ≥ 22.5. No native-compiled dependencies. Plain `npm install`, with no pnpm/yarn.
- SQLite via `node:sqlite` `DatabaseSync`. WAL mode, `foreign_keys = ON`, `busy_timeout = 5000`.
- The DB lives at `<repo root>/data/party.db`, overridable with env `PARTY_DB` (tests use temp files). `data/` is gitignored.
- The server rejects only broken data (unknown IDs, duplicates, malformed input). It **never** enforces taste: no "boss in middle", no "attending only", no allergen checks. A comment at the top of `src/db/repo.ts` says so, and so does the README.
- Error messages name the exact offending value, e.g. `guest id 42 does not exist`.
- All content is in English.
- The MCP server name in `opencode.json` is `party`, so tools appear to agents as `party_<tool>`.
- opencode v2.2.0 conventions (verified against docs 2026-11-02; re-verify with `opencode debug agents` / `opencode mcp list`):
  - agents in `.opencode/agents/<name>.md` (`description`, `mode`, `permission`)
  - skills in `.opencode/skills/<name>/SKILL.md` (`name` matches the directory, regex `^[a-z0-9]+(-[a-z0-9]+)*$`; `description`)
  - commands in `.opencode/commands/<name>.md` (`description`, `agent`, body = prompt)
  - config key `provider` (singular), `mcp.<name>` = `{ "type": "local", "command": [...] }`
  - per-agent MCP restriction via `permission` glob keys, last matching rule wins
- Branches: `main` = reference, `starter` = thin. They differ only in `.opencode/agents/`, `.opencode/skills/`, `.opencode/commands/` and `FACILITATOR.md` (main only).

## Review Focus

1. **A guest is deleted after seating.** The seat becomes an empty gap. The seat count is unchanged, `get_seating_plan` returns `guestId: null` at that seat, and the view renders the gap. → Task 1 test `removing a seated guest leaves a gap`.
2. **A partner is deleted.** The other guest's `partnerId` becomes `null` (`ON DELETE SET NULL`), and nothing dangles. → Task 1 test `deleting a partner clears the link`.
3. **The API and MCP processes write at the same time** (a user edits guests while the planner runs). Neither fails with `database is locked`. → Task 1 test `two connections write without locking`.
4. **Fresh clone, no `data/` directory, and opencode starts the MCP server before `npm run dev` has run.** The MCP server creates and seeds the DB itself. → Task 3 test `server bootstraps a missing database`.
5. **A weaker model sends sloppy arguments**: numeric strings for IDs, an empty seating list, a missing optional `note`. Numeric strings are coerced. An empty list is a valid clear. Missing optionals default. Truly wrong input gets a message saying what to fix. → Task 3 test `tolerates sloppy-but-meaningful arguments`.

---

## File Structure

```
package.json  tsconfig.json  vite.config.ts  .gitignore  opencode.json
README.md  FACILITATOR.md (main only)
src/db/types.ts      domain types shared by api, mcp, web
src/db/connection.ts openDb(path?) → DatabaseSync; dbPath(); ensureDb() (schema + seed if empty)
src/db/schema.ts     DDL string + applySchema(db)
src/db/repo.ts       all reads/writes + ValidationError
src/db/seed.ts       seed data + seed(db)
src/mcp/tools.ts     registerTools(server, db)
src/mcp/server.ts    stdio entrypoint
src/api/server.ts    createApi(db) → http.Server; entrypoint when run directly
scripts/db-reset.ts  scripts/plan-reset.ts
web/index.html  web/src/main.tsx  web/src/App.tsx  web/src/api.ts  web/src/usePoll.ts  web/src/styles.css
web/src/views/{Settings,Guests,Invitation,Seating,Menu,Playlist}.tsx
web/src/horseshoe.ts seat geometry (pure, tested)
tests/{repo,seed,mcp,api,horseshoe}.test.ts
.opencode/agents/{party-planner,invitation-writer,seating-planner,catering-agent,playlist-composer}.md
.opencode/skills/{allergies,seating-etiquette,christmas-traditions,email-invitation-style}/SKILL.md
.opencode/commands/plan-party.md
```

---

### Task 1: Project scaffold and DB layer

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `src/db/types.ts`, `src/db/connection.ts`, `src/db/schema.ts`, `src/db/repo.ts`
- Test: `tests/repo.test.ts`

**Interfaces — Produces** (`src/db/types.ts`):
```ts
export type RsvpStatus = 'attending' | 'declined' | 'pending';
export type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'pescatarian';
export type Course = 'starter' | 'main' | 'dessert' | 'drinks';
export interface PartyEvent { name: string; hostCompany: string; theme: string; dressCode: string;
  venueName: string; venueAddress: string; startsAt: string; endsAt: string | null; rsvpDeadline: string }
export interface Guest { id: number; firstName: string; lastName: string; email: string;
  jobTitle: string | null; department: string | null; isBoss: boolean; partnerId: number | null;
  rsvpStatus: RsvpStatus; dietaryPreference: DietaryPreference; allergies: string; notes: string }
export type GuestInput = Omit<Guest, 'id'>;
export interface Seat { seatNumber: number; guestId: number | null; guestName: string | null; rsvpStatus: RsvpStatus | null }
export interface SeatingPlan { seatCount: number; middleSeat: number | null; seats: Seat[] }
export interface MenuItem { course: Course; name: string; description: string; allergens: string[]; dietaryTags: string[]; notes: string }
export interface Track { position: number; title: string; artist: string; note: string }
export interface Invitation { subject: string; body: string }
```
Dates are ISO strings: `startsAt`/`endsAt` are `YYYY-MM-DDTHH:mm`, and `rsvpDeadline` is `YYYY-MM-DD`.

**Interfaces — Produces** (`src/db/connection.ts`, `src/db/repo.ts`):
- `dbPath(): string`: `process.env.PARTY_DB` or `<repoRoot>/data/party.db`. The repo root is resolved from `import.meta.url`, not from cwd.
- `openDb(path = dbPath()): DatabaseSync`: creates the parent dir, sets the pragmas from Global Constraints, and calls `applySchema`.
- `class ValidationError extends Error`
- `getEvent(db): PartyEvent`, `updateEvent(db, patch: Partial<PartyEvent>): PartyEvent`
- `listGuests(db): Guest[]` (ordered by id), `getGuest(db, id): Guest`, `addGuest(db, input: GuestInput): Guest`, `updateGuest(db, id, patch: Partial<GuestInput>): Guest`, `removeGuest(db, id): void`
- `getSeatingPlan(db): SeatingPlan`, `setSeatingPlan(db, guestIds: number[]): SeatingPlan`, `clearSeatingPlan(db): void`
- `getMenu(db): MenuItem[]`, `setMenu(db, items: MenuItem[]): MenuItem[]`
- `getPlaylist(db): Track[]`, `setPlaylist(db, tracks: Omit<Track,'position'>[]): Track[]`
- `getInvitation(db): Invitation | null`, `setInvitation(db, inv: Invitation): Invitation`
- `clearPlan(db): void`: clears seating, menu, playlist and invitation.

Schema decisions:
- `event` has a single row (`id = 1 CHECK`).
- `guests.partner_id REFERENCES guests(id) ON DELETE SET NULL`.
- `seating` has a single row holding `seat_count`.
- `seat_assignments(seat_number PK, guest_id UNIQUE REFERENCES guests(id) ON DELETE CASCADE)`.
- `menu_items` stores allergens/tags as JSON text plus `sort_order`.
- `playlist_tracks(position PK, ...)`.
- `invitation` has a single row.

Partner links are symmetric: setting A.partnerId = B sets B.partnerId = A and clears any old partners of both. Setting it to null clears both sides. `middleSeat = seatCount ? Math.ceil(seatCount / 2) : null`.

- [ ] **Step 1: Scaffold.** `npm init`, then install deps: `@modelcontextprotocol/sdk zod react react-dom` and dev `typescript tsx vitest vite @vitejs/plugin-react @types/node @types/react @types/react-dom concurrently`. Set `"type": "module"` and `"engines": {"node": ">=22.5"}`. Scripts: `test: vitest run`. `.gitignore`: `node_modules data dist`.
- [ ] **Step 2: Write failing tests** in `tests/repo.test.ts`. Each test uses a fresh temp DB via `openDb(tmpfile)`, with a minimal event and guests inserted by a local helper (not the seed).
  - `setSeatingPlan rejects unknown ids` → throws `ValidationError` with message containing `guest id 999 does not exist`
  - `setSeatingPlan rejects duplicates` → message contains `appears more than once`
  - `setSeatingPlan accepts declined guests` → no throw (taste is not enforced)
  - `middle seat is ceil(n/2)` → 5 seats → 3; 4 seats → 2; empty → `null`
  - `removing a seated guest leaves a gap` → seat 2 has `guestId: null`, `seatCount` is unchanged
  - `deleting a partner clears the link` → `getGuest(a).partnerId === null`
  - `partner links are symmetric` → after `updateGuest(a, {partnerId: b})`, `getGuest(b).partnerId === a`; re-pairing `a` with `c` clears `b`
  - `setMenu replaces and round-trips arrays`; `setPlaylist assigns positions 1..n`
  - `clearPlan empties outputs but keeps guests and event`
  - `two connections write without locking` → two `openDb` handles on the same file interleave 50 `updateGuest`/`setPlaylist` calls with no throw
- [ ] **Step 3: Run** `npx vitest run tests/repo.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement** `types.ts`, `schema.ts`, `connection.ts`, `repo.ts` per the interfaces. Each write function runs in a transaction (`BEGIN IMMEDIATE`). Top-of-file comment in `repo.ts`: *"This layer rejects broken data only. Rules about what makes a GOOD plan live in .opencode/ — that's the workshop."*
- [ ] **Step 5: Run** `npx vitest run tests/repo.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: sqlite data layer with validation`.

---

### Task 2: Seed data and reset scripts

**Files:**
- Create: `src/db/seed.ts`, `scripts/db-reset.ts`, `scripts/plan-reset.ts`
- Modify: `src/db/connection.ts` (add `ensureDb`), `package.json` scripts
- Test: `tests/seed.test.ts`

**Interfaces:**
- Consumes: Task 1 repo functions and types.
- Produces: `seed(db): void`, which wipes everything and inserts the event + guests with an empty plan. `ensureDb(path?): DatabaseSync` calls `openDb` and seeds if the `guests` table is empty. The npm scripts are `db:reset` (`tsx scripts/db-reset.ts`) and `plan:reset` (`tsx scripts/plan-reset.ts`, which calls `clearPlan`).

Seed content: the company name, venue and people are the implementer's choice. The structure is fixed:
- **Event:** theme `Christmas`; dress code `Festive cocktail — something sparkly encouraged`; a fictional venue + address; `startsAt 2026-12-11T18:00`, `endsAt 2026-12-12T01:00`; `rsvpDeadline 2026-11-27`.
- **About 20 employees + 4–6 non-employee partners (24–26 guests).** Non-employees have `department: null` and `jobTitle: null`.
- **Exactly one boss** (CEO), `attending`, with an attending non-employee partner.
- **3–4 couples:** ≥1 employee+employee, ≥1 employee+non-employee besides the boss.
- **A wheelchair user**, attending and *in a couple*. Their notes say e.g. `Uses a wheelchair — needs a seat with easy access, end of the table works best.`
- **A new hire** (single, attending), whose notes say e.g. `Started last week, doesn't know many people yet. Onboarding buddy: <Name>.` The buddy is an attending single.
- **Two guests who must not be adjacent.** One of them has a note such as `Please don't seat me next to <Name> — long story.`
- **Messy free-text allergies**, each on an attending guest unless noted:
  - `nuts — SEVERE, carries EpiPen`
  - `coeliac`
  - `lactose (a little is ok)`
  - `shellfish`
  - a `vegan` guest with allergy `tree nuts`
  - a `vegetarian`
  - one guest with allergies empty but notes `doesn't like spicy food`
  - one **pending** guest with `sesame`
- **RSVP:** exactly 2 `declined`, exactly 2 `pending`, the rest `attending`. One declined guest has an allergy, so a naive planner caters for it.

- [ ] **Step 1: Write failing tests** in `tests/seed.test.ts`:
  - `seed has exactly one boss and they attend with a partner`
  - `seed has 24-26 guests with 2 declined and 2 pending`
  - `partner links in seed are symmetric`
  - `seed contains each allergy trap`: case-insensitive substring checks for `epipen`, `coeliac`, `lactose`, `shellfish`, `sesame` (on a pending guest), and a vegan guest whose allergies contain `nut`
  - `seed has a wheelchair user in a couple`, `seed has a new hire with an attending buddy`, `seed has a do-not-seat-next-to note naming a real guest`
  - `ensureDb seeds an empty database once`: a second call doesn't duplicate guests
  - `plan reset keeps edited guests`: edit a guest, set the playlist, call `clearPlan`, then the edit persists and the playlist is empty
- [ ] **Step 2: Run** `npx vitest run tests/seed.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `seed.ts`, `ensureDb`, and both scripts. Each script prints one line, e.g. `Database reset and reseeded (25 guests).`
- [ ] **Step 4: Run** `npx vitest run`. Expected: all PASS. Then `npm run db:reset && npm run plan:reset`. Expected: both print their line and exit 0.
- [ ] **Step 5: Commit** `feat: seed data with workshop traps, reset scripts`.

---

### Task 3: MCP server and opencode wiring

**Files:**
- Create: `src/mcp/tools.ts`, `src/mcp/server.ts`, `opencode.json`
- Test: `tests/mcp.test.ts`

**Interfaces:**
- Consumes: Task 1 repo, Task 2 `ensureDb`.
- Produces: `registerTools(server: McpServer, db: DatabaseSync): void`. Tool names, exactly:
  - `get_event`, `update_event`
  - `list_guests`, `get_guest`, `add_guest`, `update_guest`, `remove_guest`
  - `get_seating_plan`, `set_seating_plan`, `clear_seating_plan`
  - `get_menu`, `set_menu`
  - `get_playlist`, `set_playlist`
  - `get_invitation`, `set_invitation`

  Every tool returns a JSON text content block of the repo result. A `ValidationError` becomes `isError: true` with the message.
- `server.ts`: `ensureDb()`, `new McpServer({name: 'party', version: '1.0.0'})`, `registerTools`, `StdioServerTransport`. Nothing is written to stdout except the protocol.

Schema rules (for weaker models):
- flat zod objects
- IDs are `z.coerce.number().int()`
- enums for course, RSVP status and diet
- `note`/`notes`/`dietaryTags`/`allergens` are optional and default to `''`/`[]`
- `set_seating_plan` takes `{ guestIds: number[] }`; an empty array clears the plan

Descriptions say what the tool does and nothing about what a good result looks like. Example: `set_seating_plan`: *"Replace the whole seating plan. guestIds[i] sits in seat i+1 around a horseshoe table, numbered from one tip, around the curve, to the other tip."*

`opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": { "party": { "type": "local", "command": ["npx", "tsx", "src/mcp/server.ts"], "enabled": true } }
}
```
(Providers are added in Task 8.)

- [ ] **Step 1: Write failing tests** in `tests/mcp.test.ts`. Connect an SDK `Client` to `registerTools` over `InMemoryTransport.createLinkedPair()` with a temp seeded DB.
  - `lists exactly the expected tool names`
  - `set_seating_plan with unknown id returns isError with the id in the message`
  - `tolerates sloppy-but-meaningful arguments`: `get_guest {id: "3"}` works; `set_playlist` without `note` works; `set_seating_plan {guestIds: []}` returns `seatCount: 0`
  - `server bootstraps a missing database`: spawn `npx tsx src/mcp/server.ts` with `PARTY_DB` pointing at a non-existent path in a temp dir, connect via `StdioClientTransport`, and `list_guests` returns ≥24 guests
- [ ] **Step 2: Run** `npx vitest run tests/mcp.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `tools.ts`, `server.ts`, `opencode.json`.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS. Then run `opencode mcp list` from the repo root. Expected: `party` is listed as connected. If opencode reports a config error, fix it against the installed v2.2.0 schema and note the difference in the commit message.
- [ ] **Step 5: Commit** `feat: party MCP server registered in opencode`.

---

### Task 4: HTTP API and dev script

**Files:**
- Create: `src/api/server.ts`
- Modify: `package.json` (scripts `dev`, `api`)
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: Task 1 repo, Task 2 `ensureDb`.
- Produces: `createApi(db): http.Server`, listening on `PORT ?? 3001` when run directly. JSON routes, used by `web/src/api.ts`:
  - `GET|PUT /api/event`
  - `GET|POST /api/guests`
  - `PUT|DELETE /api/guests/:id`
  - `GET /api/seating`, `GET /api/menu`, `GET /api/playlist`, `GET /api/invitation` (returns `null` when unset)
- A `ValidationError` returns 400 `{ error }`. A not-found returns 404. Anything else returns 500.
- Scripts: `api: tsx watch src/api/server.ts`; `dev: concurrently -n api,web "npm:api" "vite"`.

- [ ] **Step 1: Write failing tests**: `GET /api/guests returns seeded guests`, `PUT /api/guests/:id with partnerId to unknown guest returns 400 with message`, `DELETE /api/guests/:id returns 204`. Use an ephemeral port via `listen(0)`.
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement** with `node:http` and a small route table, with no framework. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: JSON API for the frontend`.

---

### Task 5: Frontend shell, Settings and Guests views

**Files:**
- Create: `vite.config.ts` (root `web`, proxy `/api` → `http://localhost:3001`, port 5173), `web/index.html`, `web/src/{main.tsx,App.tsx,api.ts,usePoll.ts,styles.css}`, `web/src/views/{Settings,Guests}.tsx`

**Interfaces:**
- Consumes: Task 4 routes; types imported from `src/db/types.ts`.
- Produces: `usePoll<T>(fetcher: () => Promise<T>, ms = 2000): { data: T | undefined; error: string | undefined; refresh(): void }`. Also typed fetch helpers in `api.ts` (one per route) and an `<EmptyState />` that reads "Nothing planned yet — run `/plan-party` in opencode."

Layout:
- A tab/side navigation with Settings, Guests, Invitation, Seating, Menu, Playlist, and the event name in the header.
- The look is festive but restrained (deep green/cream/red accents), with light and dark modes via CSS variables. Use the `frontend-design` skill for this task.
- **Settings:** a form for all `PartyEvent` fields with save; datetime/date inputs for the time fields.
- **Guests:** a table showing name, title/department, RSVP badge, diet, allergies, partner name, notes and a boss marker. Add opens an inline form; edit is inline; remove asks for confirmation. The partner field is a select of other guests. Server error messages are shown inline.

- [ ] **Step 1: Implement** the shell + both views.
- [ ] **Step 2: Verify** with `npm run dev`, then Playwright at `http://localhost:5173`:
  - edit the theme in Settings and reload; the value persists
  - add a guest, then edit their partner; both rows show the link
  - remove the guest; the row is gone
  - change a guest via `curl -X PUT` while the page is open; the change appears within 3 s without a reload

  Take a screenshot of each view.
- [ ] **Step 3: Commit** `feat: frontend shell, settings and guest management`.

---

### Task 6: Invitation, Seating, Menu and Playlist views

**Files:**
- Create: `web/src/horseshoe.ts`, `web/src/views/{Invitation,Seating,Menu,Playlist}.tsx`
- Test: `tests/horseshoe.test.ts`

**Interfaces:**
- Produces: `horseshoeLayout(seatCount: number, width: number, height: number): { seatNumber: number; x: number; y: number }[]`.
  - Seat 1 is at the top of the left arm. Seats run down the left arm, around the bottom curve, and up the right arm. Seat `ceil(n/2)` is at the bottom centre.
  - Arms are straight and the bottom is a semicircle.
  - Seats are spaced evenly along the path length (left arm + half-circle + right arm, parametrised by arc length).

- [ ] **Step 1: Write failing tests**:
  - `horseshoe returns n seats`
  - `middle seat is lowest point and horizontally centred` (n = 25 and n = 24, within 1 px tolerance of centre for odd n)
  - `seat 1 and seat n are the arm tips, mirrored` (same y, x symmetric)
  - `n = 0 returns []`
- [ ] **Step 2: Run.** Expected: FAIL. **Step 3: Implement** `horseshoe.ts`. **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Implement the views:**
  - **Invitation:** subject + body rendered with preserved line breaks. A **Copy to clipboard** button copies `Subject: <subject>\n\n<body>` via `navigator.clipboard.writeText` and shows "Copied!" for 2 s.
  - **Seating:** an SVG drawn from `horseshoeLayout`, with the table drawn as a thick U path behind the seats.
    - Each seat shows the first name + last initial, with the full name in a tooltip.
    - Badges: ★ boss; a thin line joining partners who sit adjacent; a dietary dot for anyone with non-empty allergies or a non-`none` diet.
    - The middle seat ring is highlighted.
    - Declined guests get a red ring and "declined"; pending get an amber ring and "pending".
    - An empty seat (`guestId: null`) gets a dashed outline.
    - Below the chart: a list of attending guests not seated.
  - **Menu:** grouped by course in `starter, main, dessert, drinks` order; each item shows its name, description, allergen chips, dietary tag chips and notes.
  - **Playlist:** a numbered list of title — artist with a muted note.
  - Every view uses `<EmptyState />` when there is no data.
- [ ] **Step 6: Verify** with Playwright. Populate via `curl`/MCP-equivalent repo calls: a seating plan that includes a declined guest, a menu and a playlist. Check that each view renders and the declined seat is flagged, and that the copy button puts the expected text on the clipboard (`browser_evaluate` with `navigator.clipboard.readText()` after granting permission). Then delete a seated guest in Guests; Seating shows a dashed gap within 3 s. Take screenshots.
- [ ] **Step 7: Commit** `feat: invitation, horseshoe seating, menu and playlist views`.

---

### Task 7: Reference agents, skills and `/plan-party`

**Files:**
- Create: the five `.opencode/agents/*.md`, the four `.opencode/skills/*/SKILL.md`, and `.opencode/commands/plan-party.md`

Use the `mattpocock-skills:writing-for-agents` skill for this task.

**Tool permissions** (frontmatter `permission`, deny-all then allow; last match wins):

| Agent | mode | MCP allow (after `"party_*": deny`) | Other |
|---|---|---|---|
| `party-planner` | primary | `party_get_event`, `party_list_guests`, all `party_get_*` | `task`: deny `*`, allow the four sub-agents; `edit`/`bash`/`webfetch`: deny |
| `invitation-writer` | subagent | `get_event`, `list_guests`, `get_invitation`, `set_invitation` | `edit`/`bash`/`webfetch`/`task`: deny; `skill`: allow |
| `seating-planner` | subagent | `get_event`, `list_guests`, `get_seating_plan`, `set_seating_plan` | same |
| `catering-agent` | subagent | `get_event`, `list_guests`, `get_menu`, `set_menu` | same |
| `playlist-composer` | subagent | `get_event`, `get_playlist`, `set_playlist` (**no guests**) | same |

**House rules.** The reference must encode all of these, and `FACILITATOR.md` lists them:

- **`seating-etiquette` skill**
  - Seat only `attending` guests, and every attending guest exactly once.
  - The boss is in seat `ceil(N/2)`, with their partner directly beside them.
  - Partners always sit adjacent.
  - Arm-tip seats (1 and N) go to couples. Singles are never put at a tip; they sit within the curve or the inner arms, next to each other or next to the boss's neighbours.
  - Guests with accessibility needs get a tip seat, with their partner beside them.
  - New hires sit next to their onboarding buddy.
  - Honour every "don't seat me next to" note.
  - Before calling `set_seating_plan`, compute N and check each rule.
- **`allergies` skill**
  - Treat free-text allergies seriously: interpret abbreviations and severity words.
  - Any allergy marked severe or with an EpiPen makes the **whole menu** free of that allergen.
  - Every course has at least one option each attending guest can safely eat.
  - Label allergens using the 14 EU allergen names.
  - Distinguish preferences ("doesn't like spicy") from allergies. Note the preference, but don't restructure the menu around it.
  - Pending guests' allergies go in a menu note ("if <name> confirms…"). Declined guests are ignored.
  - For invitations, always ask guests to report dietary needs by the RSVP deadline.
- **`christmas-traditions` skill** (applies when the theme contains "christmas", case-insensitive)
  - The playlist **must** include Mariah Carey – "All I Want For Christmas Is You", and it is the **last** track (the finale).
  - Wham! – "Last Christmas" is banned (company tradition after The Incident of 2019).
  - The playlist has 20–30 tracks.
  - The drinks course includes mulled wine **and** an alcohol-free alternative.
  - Dessert is traditional (e.g. rice pudding with an almond hidden in one bowl; the finder wins a prize). That conflicts with a severe nut allergy, so the allergy rule wins: swap in a nut-free prize token, and say so in the notes.
- **`email-invitation-style` skill**
  - Output is plain text with no markdown.
  - It includes the date and time in a human format, the venue and address, the dress code, and the RSVP deadline.
  - It asks for dietary needs and plus-one confirmation.
  - It is signed by the boss by name, read from the guest list.
  - The subject is ≤ 60 characters.

**Agents (reference):**
- **Sub-agents:** each states its single job, names the skills it must load before writing (catering: `allergies` + `christmas-traditions`; invitation: `email-invitation-style` + `allergies`; seating: `seating-etiquette`; playlist: `christmas-traditions`), reads the current state, writes once, and replies with a 3–5 line summary of the decisions it made.
- **`party-planner`:** reads the event and guests, delegates to all four sub-agents (in parallel where possible) with the event context in each brief, then reports a short summary per area plus anything it could not satisfy.
- **`/plan-party`** (`agent: party-planner`): "Plan the party for the current event. $ARGUMENTS"

- [ ] **Step 1: Write** all files.
- [ ] **Step 2: Verify config.** Run `opencode debug agents` and check that all five agents are listed with the correct mode. Run `opencode debug config` and check there are no errors. If skills aren't listed anywhere, start opencode and confirm the `skill` tool lists four skills.
- [ ] **Step 3: Verify end-to-end.** Run `npm run plan:reset`, then `opencode run --agent party-planner --auto "Plan the party for the current event."` with a frontier model. **This needs a configured model provider** (no OpenRouter key exists on this machine as of 2026-11-02), so ask Mario before this step. Check every house rule against the DB using `npx tsx` one-liners or the views:
  - boss in the middle seat with partner adjacent; couples adjacent; no single at a tip; the wheelchair user at a tip
  - new hire beside buddy; the do-not-seat pair apart; no declined/pending guests seated
  - the menu has no nuts and covers coeliac/lactose/shellfish/vegan; the sesame note is present
  - Mariah is last and "Last Christmas" is absent
  - the invitation includes all settings and is signed by the boss

  Also verify least privilege: ask `playlist-composer` directly (`--agent playlist-composer`) to list guests; it must report it can't. Iterate on the wording of the instructions until two consecutive runs pass every rule.
- [ ] **Step 4: Commit** `feat: reference agents, skills and /plan-party`.

---

### Task 8: Providers, README, FACILITATOR

**Files:**
- Modify: `opencode.json` (add `provider`)
- Create: `README.md`, `FACILITATOR.md`

`opencode.json` additions:
- An `lmstudio` provider: `npm: "@ai-sdk/openai-compatible"`, `options.baseURL: "http://127.0.0.1:1234/v1"`, and one example model entry (verify a current tool-calling-capable model ID in LM Studio's catalogue).
- An `openrouter` block listing the frontier default plus 2 cheaper models for the step-down segment. Verify the IDs with `opencode models openrouter` after auth, or from openrouter.ai/models.
- Do not set a global `model`. The README tells people to pick one with `/models`.

**README** (for participants):
1. Prerequisites: Node ≥22.5, opencode, an OpenRouter key.
2. `git clone -b starter --single-branch <url>`, `npm install`, `npm run dev`, open http://localhost:5173.
3. In opencode: `/connect` → OpenRouter, then `/models`, then `/plan-party`.
4. A map of what's where, which says plainly: "you edit `.opencode/`, nothing else".
5. A "how state reaches agents" section explaining the MCP tools and the *broken data vs. taste* boundary.
6. Reset commands.
7. Switching to cheaper models and LM Studio.
8. Troubleshooting:
   - port in use
   - `opencode mcp list` shows `party` disconnected → run `npx tsx src/mcp/server.ts` to see the error
   - Node too old

**FACILITATOR.md** (main only): the seeded traps table (trap → guest → which rule/skill handles it), the house-rule list from Task 7, a suggested pair assignment (one pair per sub-agent/skill area), and the show-and-tell checklist mirroring Task 7's verification list.

- [ ] **Step 1: Write** the files. **Step 2: Verify:** `opencode debug config` shows no errors and `opencode models` lists the `lmstudio` model. If LM Studio is running locally, do a smoke `opencode run -m lmstudio/<model> --agent seating-planner "Plan the seating"` that only checks the wiring connects.
- [ ] **Step 3: Commit** `docs: README, facilitator guide, provider config`.

---

### Task 9: Starter branch and cold-clone check

**Files (on branch `starter` only):**
- Modify: all `.opencode/agents/*.md`, `.opencode/skills/*/SKILL.md`
- Delete: `FACILITATOR.md`

Starter content: same file names, same `permission` blocks (least privilege is infrastructure, not the lesson), and the same command.
- **Agent bodies** are 2–4 generic lines. Example (catering): *"You plan the food and drinks for the party. Look at the event details and write a festive menu with the set_menu tool."* Sub-agents mention no skills by name.
- **Skill bodies** are a single vague sentence each. Example (seating-etiquette): *"Seat guests in a sensible, friendly arrangement."* Descriptions stay accurate so the skills are still discoverable.
- None of the house rules appear anywhere on `starter`.

- [ ] **Step 1:** `git checkout -b starter`, rewrite the files, `git rm FACILITATOR.md`. Then `grep -riE "mariah|ceil|wham|epipen|buddy|tip" .opencode` → expect no matches.
- [ ] **Step 2: Verify end-to-end** (with Mario's provider): `npm run plan:reset` + `opencode run --agent party-planner --auto "Plan the party for the current event."` Every view must be populated (a complete plan), and at least the house rules (boss middle, Mariah last, singles off tips, no "Last Christmas", invitation signed by the boss) must be missed. Record what it got right in `FACILITATOR.md` on `main` under "What the starter typically catches".
- [ ] **Step 3: Commit** on `starter`: `chore: thin starter agents and skills`.
- [ ] **Step 4: Cold-clone check:** `git clone -b starter --single-branch /home/bruker1/workshop <scratch>/cold && cd <scratch>/cold && npm install && npx vitest run && opencode mcp list`. Expected: tests pass and `party` is connected, with no `data/` present beforehand. Repeat on `main`.
- [ ] **Step 5:** Return to `main`, commit the FACILITATOR update, and confirm `git diff main starter --stat` touches only `.opencode/` and `FACILITATOR.md`.
