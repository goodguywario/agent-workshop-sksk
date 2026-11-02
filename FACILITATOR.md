# Facilitator guide

This file is for the facilitator only. It exists on `main` (the reference) and is removed on `starter`.

## The seeded traps

Each trap maps to a rule that the reference agents and skills handle and the starter does not.

| Trap | Guest(s) | Handled by |
|---|---|---|
| The boss belongs in the middle seat, partner beside her | Margaret Holloway (CEO) + Edward Holloway | `seating-etiquette` rule 1 |
| Couples sit together | Priya Raman + Tom Becker (both employees); Daniel + Sofia Okafor, Lena Fischer + Marcus Lindqvist, Sam + Jamie Ortiz (plus-ones) | `seating-etiquette` rule 2 |
| Singles are kept off the tips | the 11 attending singles | `seating-etiquette` rule 3 |
| Wheelchair user needs a tip seat | Daniel Okafor (notes) | `seating-etiquette` rule 4 |
| New hire sits by their buddy | Oliver Grant → Aisha Khan (notes) | `seating-etiquette` rule 5 |
| Feud: don't seat them together | Ben Carter ↔ Gary Mills (Ben's notes) | `seating-etiquette` rule 6 |
| Declined and pending guests get no seat | Victor Alvarez, Ingrid Berg (declined); Elena Petrova, Kevin Doyle (pending) | `seating-etiquette` "Who gets a seat" |
| Severe nut allergy: the whole menu is nut-free | Hannah Price ("nuts — SEVERE, carries EpiPen") | `allergies` rule 1 |
| Coeliac | Tom Becker | `allergies` rule 2 |
| Mild lactose intolerance | Sofia Okafor ("lactose (a little is ok)") | `allergies` rule 2 |
| Shellfish means crustaceans + molluscs | Edward Holloway | `allergies` "Reading the guest list" |
| Vegan with a tree-nut allergy | Lena Fischer | `allergies` rules 1–2 |
| Vegetarian / pescatarian | Priya Raman / Jonas Weber, Jamie Ortiz | `allergies` rule 2 |
| Preference, not allergy | Rachel Kim (doesn't like spicy, in notes), Fatima Haddad ("gluten-free pls (not coeliac…)") | `allergies` "Reading the guest list" |
| Pending guest's allergy goes in a note | Elena Petrova (sesame) | `allergies` "Reading the guest list" |
| Declined guest's allergy is ignored | Victor Alvarez (peanuts) | `allergies` "Reading the guest list" |
| Mariah closes the night | — | `christmas-traditions` playlist rule 1 |
| No "Last Christmas" | — | `christmas-traditions` playlist rule 2 |
| Mulled wine + alcohol-free alternative | — | `christmas-traditions` menu rule 2 |
| Almond game vs. nut allergy | Hannah Price | `christmas-traditions` menu rule 3 |
| Invitation asks for allergies by the RSVP date | — | `allergies` "In invitations" (shared skill, used by two agents) |
| Invitation signed by the boss, plain text, all details | Margaret Holloway | `email-invitation-style` |

## House rules, in brief

- **Seating:** only attending guests; boss in seat ceil(N/2) with partner beside; couples adjacent; tips (seats 1 and N) go to couples; accessibility guest at a tip; new hire beside buddy; honour "don't seat me next to"; mix departments.
- **Menu:** severe allergens are banned kitchen-wide; every attending guest has a safe option in every course; allergens are labelled with the EU 14; alternatives name who they're for; pending guests get a note and declined guests are ignored.
- **Christmas:** Mariah's "All I Want For Christmas Is You" is the last track; no Wham! "Last Christmas"; 20–30 tracks; a traditional roast; mulled wine plus an alcohol-free version; rice pudding with a nut-free token when someone has a severe nut allergy.
- **Invitation:** plain text; subject ≤ 60 chars; date and time, venue and address, dress code, RSVP deadline; asks about dietary needs and partners; signed by the boss with her title.

## Suggested pairs

One pair per area. With more pairs, double up on seating and catering, which have the most traps.

| Pair | Files |
|---|---|
| Seating | `agents/seating-planner.md`, `skills/seating-etiquette/` |
| Catering | `agents/catering-agent.md`, `skills/allergies/` (menu rules) |
| Christmas | `agents/playlist-composer.md`, `skills/christmas-traditions/` |
| Invitation | `agents/invitation-writer.md`, `skills/email-invitation-style/`, `skills/allergies/` (invitation section) |
| Orchestration | `agents/party-planner.md`: briefing, verifying sub-agent output, re-delegating |

Good discussion prompts for show-and-tell:

- Did you put the rule in the agent or in a skill, and why?
- Which rules did the model already follow without being told?
- What did your description change about *when* the skill was loaded?

## Show-and-tell checklist

Run `npm run plan:reset`, then `/plan-party`, then check:

- [ ] Seating: Margaret is in the middle seat with Edward beside her
- [ ] Seating: every couple sits together, and both tips belong to couples
- [ ] Seating: Daniel is at a tip with Sofia beside him; Oliver is beside Aisha; Ben and Gary are apart
- [ ] Seating: there are no red or amber seats (no declined or pending guests), and no "Attending but not seated" list
- [ ] Menu: no peanuts or tree nuts anywhere
- [ ] Menu: gluten-free, lactose-free, vegan and shellfish-free options in every course
- [ ] Menu: a note about Elena's sesame allergy
- [ ] Menu: mulled wine and an alcohol-free version; a nut-free almond-game token
- [ ] Playlist: 20–30 tracks, Mariah last, no "Last Christmas"
- [ ] Invitation: plain text, every detail present, asks about allergies by 27 November, signed by Margaret Holloway, CEO

## What the starter typically catches

*(Filled in after test runs of the starter branch.)*
