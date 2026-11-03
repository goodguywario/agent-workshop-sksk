# Spec: Speech writer

Status: ready for development
Based on: `requests/speech-writer/idea.md` and the UI prototype (variant 2, "speaker list + editor") in `web/src/views/SpeechesPrototype.tsx`. That prototype is throwaway: use it as a reference and do not ship it.

---

## 1. Executive summary

**Problem statement.** Party speeches are hard to write, and they're often written at the last minute. The party planner already knows the event and the guests, but it can't help with speeches. It also gives the organiser no way to steer what a helper produces, apart from free text typed after `/plan-party`.

**Proposed solution.** Add a **speech writer** sub-agent to the party planner run. The organiser switches speeches on and sets up a list of speeches on a new **Speeches** page. For each speech they choose who's speaking (a role, optionally a specific guest), the tone, the length, the cringe level, and anything to mention. On the next `/plan-party` run, the planner writes one speech per entry. Each speech stands on its own, and it uses only public information about guests who are attending.

**Success criteria**

| # | Criterion | How it's measured |
|---|---|---|
| S1 | When speeches are switched off, a planning run makes **0** speech-writer calls and leaves stored speeches unchanged. | Run `/plan-party` with speeches off, then compare `GET /api/speeches` before and after. |
| S2 | **0** speeches contain private guest data (notes, allergies, diets, health) unless that data was typed into the speech's "Things to mention". | Use the evaluation checklist (§3) over 10 runs at cringe level 5. |
| S3 | **0** speeches name a guest whose RSVP is `declined` or `pending`. | Same evaluation. |
| S4 | At least 90% of speeches are within ±25% of their target word count (Short 130, Medium 400, Long 650). | Word count in the UI, or a script over the evaluation runs. |
| S5 | At least 95% of non-empty "Things to mention" entries are clearly reflected in their speech. | Manual check in the evaluation. |

---

## 2. User experience and functionality

### Personas

- **Organiser.** An office manager or HR person who sets up the party in the web app and runs the planner. They're not technical. They want speeches that are ready to hand out and won't embarrass anyone.
- **Speaker.** The boss, HR, the toastmaster or a colleague who reads the speech on the night. They never use the app. They receive copied text.
- **Workshop participant / demo viewer.** This is an example app for multi-agent setups. The feature should show clearly that **settings in the UI steer a sub-agent**, and that **permissions protect privacy**.

### User flow

1. The organiser opens **Speeches** in the sidebar.
2. They switch on **Write speeches**.
3. They add speakers to the list on the left, in running order.
4. They select a speaker and set the role, an optional guest, tone, length, cringe level and things to mention.
5. They run `/plan-party` in opencode. The planner sees that speeches are on and dispatches the speech writer once for each speech.
6. The page updates by itself (polling) as each speech is written. The organiser selects a speaker, reads the speech and copies it.
7. If they change a speech's settings afterwards, that speech is marked **out of date** until the planner runs again.

### Screen: Speeches page (based on prototype variant 2)

- **Header:** the title "Speeches" and a lede explaining that the planner writes the speeches on the next `/plan-party` run.
- **Banner:** the **Write speeches** on/off switch.
  - When it's off, the list and editor are greyed out and can't be used, but the settings stay visible.
  - A line explains that the planner will skip speeches and leave existing ones alone.
- **Left column, speaker list (running order):**
  - Each entry shows its number, the role, the guest's name if one is set, and a short summary (tone · ≈minutes · cringe n/5). It also shows a status mark: *written*, *not written yet* or *out of date*.
  - There is a **+ Add a speaker** button.
  - Clicking an entry selects it.
- **Right column, editor:**
  - **Who's speaking:** a segmented control with Toastmaster, Boss, HR, Host and Colleague.
  - **Speaker (optional):** a dropdown of attending guests, with "No one in particular" as the default. If the role is Boss or HR and no guest is set, a one-click suggestion is shown:
    - for Boss, the attending guest with `isBoss`;
    - for HR, the attending guest with department `People` or a job title containing "HR".
  - **Tone:** a segmented control with Warm, Formal, Playful and Heartfelt.
  - **Length:** a segmented control with Short (≈1 min), Medium (≈3 min) and Long (≈5 min).
  - **Cringe level:** a 1–5 slider with labels: 1 "Safe for the CEO", 2 "Gentle", 3 "Office-party", 4 "Dad-joke", 5 "Full dad-joke".
  - **Things to mention:** a text area with the hint "the only way private details get into a speech".
  - **Earlier**, **Later** and **Remove** buttons.
- **Right column, speech:**
  - The written text on a paper-style panel, with the word count, about how many minutes it takes (words ÷ 130), and a **Copy** button.
  - Empty state: "Not written yet. Run `/plan-party` in opencode."
  - Out-of-date state: the text is still shown, with a notice that the settings changed since the speech was written.
- **Sidebar:** a **Speeches** entry after Playlist.
  - While speeches are off, it shows no progress dot.
  - While they're on, the dot is "done" when there is at least one speech and every speech is written and up to date.

### User stories

#### Story 1: Switch speeches on and off

- **Summary:** Organiser decides whether this party gets speeches at all.

**Use case**
- **As an** organiser
- **I want to** switch speech writing on or off for the event
- **so that** the planner only writes speeches for parties that need them, and never overwrites speeches I'm happy with.

**Acceptance criteria**
- **Scenario:** The default is off.
  - **Given** a freshly seeded database
  - **When** I open the Speeches page
  - **Then** the **Write speeches** switch is off, and the editor is greyed out and can't be used.
- **Scenario:** Switching on persists.
  - **Given** speeches are off
  - **When** I switch them on and reload the page
  - **Then** the switch is still on (`GET /api/speeches` returns `enabled: true`).
- **Scenario:** A run with speeches off leaves speeches alone.
  - **Given** speeches are off
  - **and given** two speeches already have text
  - **When** I run `/plan-party`
  - **Then** the speech writer is not invoked, and both speeches keep exactly the same text and `writtenAt`.

#### Story 2: Set up several speakers in running order

- **Summary:** Organiser plans every speech of the evening in one place.

**Use case**
- **As an** organiser
- **I want to** add, remove and reorder speeches
- **so that** each person speaking on the night gets their own speech, in the order they'll give them.

**Acceptance criteria**
- **Scenario:** Add a speaker.
  - **Given** speeches are on and the list has 2 entries
  - **When** I click **+ Add a speaker**
  - **Then** a third entry appears at the bottom, is selected, and has the defaults: role Colleague, no guest, Warm, Short, cringe 2, and nothing to mention.
- **Scenario:** Reorder.
  - **Given** a list of Toastmaster, Boss and HR
  - **When** I select HR and click **Earlier**
  - **Then** the list reads Toastmaster, HR, Boss, both in the UI and in `GET /api/speeches`.
- **Scenario:** Remove.
  - **Given** a list of 3 speeches
  - **When** I select one and click **Remove**
  - **Then** the list has 2 speeches, and the removed speech's text is gone.
- **Scenario:** Earlier and Later at the ends of the list.
  - **Given** the first speech is selected
  - **When** I click **Earlier**
  - **Then** nothing changes and no error is shown.

#### Story 3: Tune each speech's settings

- **Summary:** Organiser controls how each speech sounds without writing it.

**Use case**
- **As an** organiser
- **I want to** choose the role, tone, length, cringe level and things to mention for each speech separately
- **so that** the boss gets a formal thank-you while the toastmaster gets to be silly.

**Acceptance criteria**
- **Scenario:** Settings save on change.
  - **Given** a selected speech
  - **When** I change its tone from Warm to Formal and reload the page
  - **Then** the speech still shows Formal.
- **Scenario:** Only allowed values are accepted.
  - **Given** the API is running
  - **When** a client sends `PUT /api/speeches/1` with `{ "cringe": 7 }` or `{ "tone": "angry" }`
  - **Then** the API answers 400 with a readable message, and nothing is saved.
- **Scenario:** Editing marks a written speech out of date.
  - **Given** a speech with written text
  - **When** I change any of its settings
  - **Then** its list entry and its speech panel show **out of date**, and the old text is still shown.
- **Scenario:** Polling doesn't overwrite my typing.
  - **Given** I'm typing in "Things to mention"
  - **When** the page polls the API in the background
  - **Then** my unsaved text in the field is not replaced.

#### Story 4: Optionally name the guest who gives the speech

- **Summary:** The speech can speak in the real speaker's voice.

**Use case**
- **As an** organiser
- **I want to** optionally choose which attending guest gives a speech
- **so that** the speech can refer to the speaker's real role ("as your CEO, I…") instead of a generic one.

**Acceptance criteria**
- **Scenario:** The suggestion for Boss.
  - **Given** a speech with role Boss and no guest set
  - **and given** Margaret Holloway is attending with `isBoss = true`
  - **When** I look at the editor
  - **Then** I see a one-click suggestion, "Use Margaret Holloway".
- **Scenario:** Only attending guests can be picked.
  - **Given** Victor Alvarez has declined
  - **When** I open the speaker dropdown
  - **Then** Victor is not in the list.
- **Scenario:** The linked guest later stops attending.
  - **Given** a speech is linked to a guest
  - **When** that guest's RSVP changes to declined
  - **Then** the editor shows a warning that the speaker isn't attending, and the speech writer treats the speech as role-only.
- **Scenario:** The linked guest is deleted.
  - **Given** a speech is linked to a guest
  - **When** that guest is removed from the guest list
  - **Then** the speech's guest becomes "No one in particular", and the speech is kept.

#### Story 5: Get speeches written by the planner

- **Summary:** One `/plan-party` run writes every speech to match its settings.

**Use case**
- **As an** organiser
- **I want to** get the speeches written as part of the normal planning run
- **so that** I don't need a separate tool or have to write them myself.

**Acceptance criteria**
- **Scenario:** One speech for each entry.
  - **Given** speeches are on with 3 entries
  - **When** I run `/plan-party`
  - **Then** each of the 3 entries has text, a `writtenAt` time, and is no longer out of date.
- **Scenario:** Speeches stand on their own.
  - **Given** a toastmaster speech and a boss speech
  - **When** both are written
  - **Then** neither speech mentions or introduces the other speech or speaker.
- **Scenario:** The settings show in the text.
  - **Given** a Short, Formal, cringe 1 speech and a Long, Playful, cringe 5 speech
  - **When** both are written
  - **Then** the first is 100–165 words with no jokes, and the second is 490–815 words and clearly playful.
- **Scenario:** Things to mention appear.
  - **Given** a speech whose "Things to mention" says "Thank Engineering for shipping the new platform in October"
  - **When** it is written
  - **Then** the text thanks Engineering for the October platform launch.
- **Scenario:** An empty list is skipped.
  - **Given** speeches are on but the list is empty
  - **When** I run `/plan-party`
  - **Then** the speech writer is not invoked, and the planner's summary says there were no speeches to write.

#### Story 6: Private guest details stay out of speeches

- **Summary:** Speeches never embarrass guests with things they told the organiser in confidence.

**Use case**
- **As an** organiser
- **I want to** be sure the speech writer only uses public information about guests
- **so that** no-one hears their health, allergies or private requests read out at the company party.

**Acceptance criteria**
- **Scenario:** The writer can't see private fields.
  - **Given** the speech-writer agent's permissions
  - **When** it lists guests
  - **Then** it can only call `party_list_public_guests`. Each guest there has only `id`, `firstName`, `lastName`, `jobTitle`, `department`, `isBoss` and `partnerId`. The agent can't call `party_list_guests` or `party_get_guest`.
- **Scenario:** Only attending guests are visible.
  - **Given** 21 attending, 2 declined and 2 pending guests (the seed data)
  - **When** the writer calls `party_list_public_guests`
  - **Then** it gets exactly the 21 attending guests.
- **Scenario:** Private data typed by the organiser is allowed.
  - **Given** "Things to mention" says "Welcome Oliver, who started last week, and thank Aisha for being his buddy"
  - **When** the speech is written
  - **Then** the speech may mention Oliver's start and Aisha's role as his buddy.
- **Scenario:** Seeded private notes never appear.
  - **Given** the seed data, cringe level 5 and nothing to mention
  - **When** the speech is written
  - **Then** the text contains none of these (case-insensitive, whole words): "wheelchair", "EpiPen", "nuts", "coeliac", "shellfish", "lactose", "vegan", "long story", "Maggie".
  - **and then** it doesn't mention Ben Carter and Gary Mills in the same sentence.

#### Story 7: Read and copy the finished speech

- **Summary:** Organiser hands each speaker their text.

**Use case**
- **As an** organiser
- **I want to** read each speech in the app and copy it with one click
- **so that** I can send it to the person giving it.

**Acceptance criteria**
- **Scenario:** Copy.
  - **Given** a written speech is selected
  - **When** I click **Copy**
  - **Then** the speech text (without the settings summary) is on my clipboard, and the button says "Copied!" for about 2 seconds.
- **Scenario:** Reading time.
  - **Given** a written speech of 390 words
  - **When** I select it
  - **Then** the panel shows "390 words · about 3 min".
- **Scenario:** Live updates.
  - **Given** the Speeches page is open
  - **When** the planner writes a speech
  - **Then** the speech appears without reloading the page, within the normal poll interval of 2 s.

#### Story 8: Reset keeps the setup, clears the text

- **Summary:** Organiser can start a fresh plan without retyping their speakers.

**Use case**
- **As an** organiser (or workshop participant)
- **I want** `npm run plan:reset` to clear the written speeches but keep my speech setup
- **so that** I can run the planner again from scratch without setting up every speaker again.

**Acceptance criteria**
- **Scenario:** Reset.
  - **Given** speeches are on, with 3 written speeches
  - **When** I run `npm run plan:reset`
  - **Then** speeches are still on, and the same 3 entries with the same settings exist. All three show **not written yet**.

### Non-goals

- Speeches that link together (handovers, "and now, Maggie!") or that coordinate jokes across speeches.
- Editing the speech text in the app. To change a speech, change its settings and run the planner again.
- Starting a planning run, or rewriting a single speech, from the web app.
- Free-text tone, or custom roles beyond the five listed.
- Timings or a run sheet for the evening (prototype variant 3), and printable cue cards.
- Text-to-speech, translations, or multiple languages.

### Anti-goals (failures even if the feature "works")

- A speech that reveals a guest's health, allergy, diet or private note that the organiser didn't type in.
- A planning run that overwrites polished speeches while speeches are switched off.
- A speech that thanks someone who isn't there.

---

## 3. AI system requirements

### Agents

**New sub-agent `speech-writer`** (`.opencode/agents/speech-writer.md`, `mode: subagent`).
- Its permissions follow the house pattern: `"*": deny`, then allow only:
  - `party_get_event`
  - `party_get_speeches`
  - `party_list_public_guests`
  - `party_set_speech_text`
  - skills: `speech-style`, `christmas-traditions`
- It must **not** have `party_list_guests` or `party_get_guest`. This is how the privacy rule is enforced: by permission, not by instructions in the prompt.
- One invocation writes **one** speech. The planner passes the speech `id` in the task prompt. The agent reads that speech's settings with `party_get_speeches` and writes the text with `party_set_speech_text`.

**Changes to `party-planner`** (`.opencode/agents/party-planner.md`):
- Allow `task: speech-writer` and `party_get_speeches`.
- Prompt: read `party_get_speeches`.
  - If `enabled` is false or the list is empty, skip speeches entirely and say so in the summary.
  - Otherwise, dispatch `speech-writer` once for each speech. These calls may run in parallel. Each prompt contains only that speech's id, not the other speeches, so that each speech stands on its own.

**New skill `speech-style`** (`.opencode/skills/speech-style/SKILL.md`). This holds what a good speech looks like. Tool descriptions stay neutral, following the existing convention at the top of `src/mcp/tools.ts`. It must cover:
- **Target lengths:** Short ≈130 words, Medium ≈400, Long ≈650, each within ±25%.
- **Tones:** Warm, Formal, Playful, Heartfelt, with one example opening line each.
- **Cringe scale:** 1 means no jokes; 5 means puns, dad-jokes and gentle self-deprecation. Even at 5, nobody is the butt of a joke.
- **Speaking in role:**
  - If a speaker guest is set, use their first name and job title in the first person.
  - If not, speak as the role.
  - If the linked guest isn't in the public guest list (not attending), fall back to the role.
- **Privacy:**
  - Use only the event details, the public guest fields and "Things to mention".
  - Never guess at private matters.
  - Only mention attending guests, which is all the tool returns.
- **Standalone:** never refer to other speeches or speakers, and never hand over.
- **Format:** plain text, with paragraphs separated by blank lines. No headings, no stage directions in brackets, no markdown.

### Tools (MCP, `src/mcp/tools.ts`)

| Tool | Input | Returns | Notes |
|---|---|---|---|
| `get_speeches` | none | `{ enabled, speeches: Speech[] }` | `Speech` is defined in §4. |
| `list_public_guests` | none | `PublicGuest[]` | Attending guests only, with `id, firstName, lastName, jobTitle, department, isBoss, partnerId`. |
| `set_speech_text` | `{ id, body }`, where `body` is a non-empty string | `Speech` | Sets `body` and `writtenAt = now`. Rejects an unknown id. Rejects calls while speeches are off ("speeches are switched off"). |

The organiser owns the settings, so the agents get **no** tools to change them. `tests/mcp.test.ts` checks the exact list of tool names and must be updated.

### Evaluation strategy

Agent output can't be checked in unit tests, so use a repeatable manual evaluation:

1. Run `npm run db:reset`.
2. Switch speeches on and add four speeches:
   - (a) Toastmaster, Playful, Short, cringe 5, nothing to mention;
   - (b) Boss with Margaret Holloway, Formal, Medium, cringe 1, "Thank Engineering for shipping the new platform in October";
   - (c) HR, Heartfelt, Long, cringe 2, "Welcome Oliver, who started last week";
   - (d) Colleague, Warm, Short, cringe 3, nothing to mention.
3. Run `/plan-party` **10 times**. After each run, record for every speech:
   - the word count against its target (S4);
   - whether it contains any banned strings from Story 6 (S2);
   - whether it names any declined or pending guest: Victor Alvarez, Ingrid Berg, Elena Petrova or Kevin Doyle (S3);
   - whether "Things to mention" is reflected (S5);
   - whether it refers to another speech.
4. Run `/plan-party` once with speeches off, and check S1.

Pass: S1–S3 at 100%, S4 at 90% or more, S5 at 95% or more. Record the results in `requests/speech-writer/eval.md`.

---

## 4. Technical specifications

> Constraint: the README says workshop participants only edit `.opencode/`, and everything else is scaffolding. This feature changes the scaffolding (database, API, MCP, web). It's a change for the maintainers of the example app, and it has to keep the existing tests and `npm run typecheck` passing.

### Data model (`src/db/schema.ts`, `src/db/types.ts`)

```sql
CREATE TABLE IF NOT EXISTS speech_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO speech_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS speeches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('toastmaster','boss','hr','host','colleague')),
  speaker_guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  tone TEXT NOT NULL CHECK (tone IN ('warm','formal','playful','heartfelt')),
  length TEXT NOT NULL CHECK (length IN ('short','medium','long')),
  cringe INTEGER NOT NULL CHECK (cringe BETWEEN 1 AND 5),
  mention TEXT NOT NULL DEFAULT '',
  body TEXT,                 -- null until written
  written_at TEXT,           -- ISO time the text was written
  settings_updated_at TEXT NOT NULL
);
```

```ts
type SpeechRole = 'toastmaster' | 'boss' | 'hr' | 'host' | 'colleague';
type SpeechTone = 'warm' | 'formal' | 'playful' | 'heartfelt';
type SpeechLength = 'short' | 'medium' | 'long';
interface Speech {
  id: number; position: number; role: SpeechRole; speakerGuestId: number | null;
  tone: SpeechTone; length: SpeechLength; cringe: 1 | 2 | 3 | 4 | 5; mention: string;
  body: string | null; writtenAt: string | null;
  outOfDate: boolean; // derived: body !== null && settings_updated_at > written_at
}
interface SpeechPlan { enabled: boolean; speeches: Speech[] }
type PublicGuest = Pick<Guest, 'id' | 'firstName' | 'lastName' | 'jobTitle' | 'department' | 'isBoss' | 'partnerId'>;
```

- Positions are kept as 1..n with no gaps after every add, remove and reorder.
- **Every settings change** sets `settings_updated_at = now`. Setting text doesn't change it.
- `clearPlan` (used by `npm run plan:reset`) sets `body` and `written_at` to null on every speech. It keeps `speech_settings` and the speech rows.
- **Seed:** speeches are off, with two example entries so the demo is quick to try:
  - Toastmaster, Playful, Short, cringe 4;
  - Boss, linked to the `isBoss` guest, Formal, Medium, cringe 1.

### Repository functions (`src/db/repo.ts`)

Add `getSpeeches`, `setSpeechesEnabled`, `addSpeech`, `updateSpeech`, `removeSpeech`, `reorderSpeeches(ids)`, `setSpeechText(id, body)` and `listPublicGuests`.

All validation lives here and throws `ValidationError`, the same as the existing functions:
- enum values and the cringe range;
- `speakerGuestId` must exist;
- `reorderSpeeches` must receive exactly the current set of ids;
- `setSpeechText` rejects an empty body, an unknown id, and calls while speeches are off.

### JSON API (`src/api/server.ts`)

| Route | Body | Result |
|---|---|---|
| `GET /api/speeches` | none | `SpeechPlan` |
| `PUT /api/speeches/settings` | `{ enabled: boolean }` | `SpeechPlan` |
| `POST /api/speeches` | optional partial settings | `Speech` (201), added at the end with the defaults from Story 2 |
| `PUT /api/speeches/:id` | partial `{ role, speakerGuestId, tone, length, cringe, mention }` | `Speech` |
| `DELETE /api/speeches/:id` | none | 204 |
| `PUT /api/speeches/order` | `{ ids: number[] }` | `SpeechPlan` |

- The router currently only matches `:id` for `/api/guests`. Make that match generic, and make sure the literal paths `/api/speeches/settings` and `/api/speeches/order` aren't treated as ids.
- The API has no route that sets speech text. Only the agent writes it.

### Web (`web/src/`)

- `api.ts`: add client calls for the routes above, and export the new types.
- `views/Speeches.tsx`: a new view following the layout in §2. Rebuild it properly from the prototype instead of copying it.
- Polling (`usePoll`) refreshes the list and the speech text. The editor keeps local state for the selected speech's fields, so that a poll never replaces a field the user is editing.
- `App.tsx`:
  - add a `speeches` view with the label "Speeches";
  - add the progress rule from §2 to `fetchProgress`;
  - remove the prototype entry.
- `styles.css`: add the styles needed. Reuse the existing tokens (`--pine`, `--cranberry`, `.panel`, `.button`, `.field`, `.empty`).
- Delete `web/src/views/SpeechesPrototype.tsx`, `SpeechesPrototype.css` and `web/src/PrototypeSwitcher.tsx`.

### Security and privacy

- Privacy is enforced by **tool access**. The speech writer can't read `notes`, `allergies`, `dietaryPreference` or `email`, and it can't see non-attending guests.
- "Things to mention" is the only channel for private details. The organiser types it on purpose.
- "Who's new" isn't a public field. The writer can only infer it from a job title (for example "Junior") or learn it from "Things to mention". This is expected.
- No auth changes: the app is local-only, as it is today.

---

## 5. Risks and roadmap

### Phased rollout

- **MVP (this spec):** everything in §2–§4.
- **v1.1 (candidates, not committed):**
  - a "rewrite this speech only" request from the app;
  - showing which settings changed since the speech was written;
  - a printable view.
- **v2 (ideas):**
  - a running order with times, and cue cards (prototype variant 3);
  - optional handovers between speeches.

### Risks

| Risk | Mitigation |
|---|---|
| The agent ignores the length or tone settings. | Give precise targets in the `speech-style` skill, and run the evaluation in §3 before release. |
| The agent invents private-sounding details ("Ben and Gary's feud") from public data alone. | The skill rule "never guess at private matters", plus the banned-string check in the evaluation. |
| Polling overwrites what the organiser is typing. | Keep editor fields in local state (Story 3). |
| A linked speaker guest declines after setup. | The UI warns, and the agent falls back to role-only (Story 4). |
| Parallel speech-writer calls are slow or costly with many speeches. | Normally there are 2–5 speeches. No hard cap in the MVP. Note it if the evaluation shows a problem. |
| The new generic router match breaks guest routes. | The existing `tests/api.test.ts` cases for guests must still pass. |

---

## 6. Decisions log

- **Decided by the product owner:**
  - several speeches, each standing on its own;
  - off by default;
  - public information only, unless typed into "Things to mention";
  - only attending guests;
  - page layout from prototype variant 2;
  - role plus an optional guest as the speaker.
- **Developer/product calls made in this spec (open to change):**
  - the five roles and four tones, and the target word counts;
  - settings save on change, without a Save button;
  - one speech-writer call per speech;
  - privacy enforced through a separate `list_public_guests` tool;
  - `plan:reset` clears the text but keeps the setup;
  - the seed includes two example speeches, switched off;
  - `set_speech_text` is rejected while speeches are off.

---

## 7. Task list

| # | Task | Area | Files |
|---|---|---|---|
| 1 | Add the `speech_settings` and `speeches` tables, and the types `Speech`, `SpeechPlan` and `PublicGuest` plus the role/tone/length constants. | data and seed | `src/db/schema.ts`, `src/db/types.ts` |
| 2 | Add the repo functions with validation (`getSpeeches`, `setSpeechesEnabled`, `addSpeech`, `updateSpeech`, `removeSpeech`, `reorderSpeeches`, `setSpeechText`, `listPublicGuests`), and make `clearPlan` clear the speech text only. | data and seed | `src/db/repo.ts` |
| 3 | Seed speeches as off, with two example entries. Keep `tests/seed.test.ts` passing. | data and seed | `src/db/seed.ts` |
| 4 | Repo unit tests: validation, keeping positions gapless, `outOfDate`, the guest-delete behaviour (`SET NULL`), `clearPlan`, and `listPublicGuests` returning only attending guests and only public fields. | data and seed | `tests/repo.test.ts` |
| 5 | Make the router's `:id` matching generic, and add the six speech routes. | JSON API | `src/api/server.ts` |
| 6 | API tests for each route, including 400 on bad values and on wrong reorder ids, and a regression check on the guest routes. | JSON API | `tests/api.test.ts` |
| 7 | Add the MCP tools `get_speeches`, `list_public_guests` and `set_speech_text`, with neutral descriptions. Update the expected tool list in the test. | MCP tools | `src/mcp/tools.ts`, `tests/mcp.test.ts` |
| 8 | Add the speech client calls and types to the web API client. | web app views | `web/src/api.ts` |
| 9 | Build the Speeches view: switch, speaker list, editor, guest picker with suggestion, speech panel with word count, copy, and the empty and out-of-date states. | web app views | `web/src/views/Speeches.tsx`, `web/src/styles.css` |
| 10 | Add the Speeches route and nav entry, plus the progress-dot rule. Remove the prototype entry. | web app views | `web/src/App.tsx` |
| 11 | Delete the prototype files. | web app views | `web/src/views/SpeechesPrototype.tsx`, `web/src/views/SpeechesPrototype.css`, `web/src/PrototypeSwitcher.tsx` |
| 12 | Create the `speech-writer` sub-agent with deny-by-default permissions and its prompt. | agents and skills | `.opencode/agents/speech-writer.md` |
| 13 | Write the `speech-style` skill (lengths, tones, cringe scale, voice, privacy, standalone rule, format). | agents and skills | `.opencode/skills/speech-style/SKILL.md` |
| 14 | Update `party-planner`: allow `task: speech-writer` and `party_get_speeches`, and add the skip-or-dispatch-per-speech logic to the prompt. | agents and skills | `.opencode/agents/party-planner.md` |
| 15 | Mention speeches in `plan:reset` output and in the README's agent and command tables. | data and seed / docs | `scripts/plan-reset.ts`, `README.md` |
| 16 | Run the evaluation in §3 and record the results. | agents and skills | `requests/speech-writer/eval.md` |
