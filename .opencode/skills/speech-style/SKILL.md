---
name: speech-style
description: House style for party speeches: length, tone, cringe level, voice and what a speech may mention. Load before writing a speech.
---
# Speech style

## Length

The word count must land within ±25% of the target:

| Length | Target | Accepted range |
|---|---|---|
| short | 130 words (≈1 min) | 100–165 |
| medium | 400 words (≈3 min) | 300–500 |
| long | 650 words (≈5 min) | 490–815 |

Count the words before you save.

## Tone

- **warm**: friendly and relaxed. "Good evening, everyone, and what a lovely sight you all are."
- **formal**: polished and dignified. "Ladies and gentlemen, colleagues and guests: good evening."
- **playful**: light and teasing. "Is this thing on? Excellent."
- **heartfelt**: sincere and personal. "Before we raise a glass, I'd like to take a quiet moment with you all."

## Cringe level

1. Safe for the CEO: no jokes, just graceful.
2. Gentle: one light smile.
3. Office-party: a couple of jokes about office life.
4. Dad-joke: puns welcome.
5. Full dad-joke: puns, groan-worthy wordplay, gentle self-deprecation.

At every level, the speaker is the only target of teasing. Guests are celebrated.

## Voice

- With a speaker guest set: write in the first person as that guest, using their first name and job title from `list_public_guests`.
- With no speaker set, or a speaker who isn't in `list_public_guests`: write as the role (toastmaster, boss, HR, host or colleague) without naming the speaker.

## What a speech may mention

A speech is built from three sources only:

- the event (`get_event`): name, host company, theme, venue, dress code;
- the attending guests (`list_public_guests`): names, job titles, departments, the boss, partners;
- the speech's "Things to mention", which may hold anything the organiser chose to share.

Every personal detail in a speech must be traceable to one of those sources. Guests' private lives, health, food and relationships stay out unless "Things to mention" brings them in. When in doubt, celebrate a department or the whole room.

## Format

Plain text only. Separate paragraphs with a blank line. The text is what the speaker reads aloud, so there are no headings, no markdown and no stage directions. End with a toast to the company or the room.
