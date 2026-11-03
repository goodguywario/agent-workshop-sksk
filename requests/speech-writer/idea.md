# Speech writer

## What it is
A new helper in the party planner that writes speeches for the party. During a normal planning run it works next to the helpers that write the invitation, menu, playlist and seating. It follows speech settings that the organiser picks in the app.

## Why
Party speeches are hard to write, and the planner already knows the event and the guests. This is an example app that shows off a team of AI helpers. The speech writer is another helper that follows the same pattern, and it shows that the app's settings can steer what a helper does.

## What we agreed
- **Off by default.** The organiser switches speeches on in the settings. When speeches are off, a planning run skips them and leaves any existing speeches alone.
- **Several speeches.** The organiser can add and remove speeches in running order. Each speech has its own settings:
  - **Who's speaking:** for example toastmaster, boss or HR.
  - **Tone:** for example warm, formal or playful.
  - **Length:** for example short, medium or long.
  - **Cringe level:** from "safe for the CEO" to "full dad-joke".
  - **Things to mention:** free text, for example "Congratulate Priya's team on the launch".
- **Each speech stands on its own.** Speeches aren't written to link together, and speakers don't hand over to each other.
- **Public information only, by default.** The writer may use names, job titles, departments, who the boss is, partners, who's new, and the event details (theme, venue, dress code). It must not use private notes, allergies, diets or health information. The only exception is something the organiser types into "Things to mention".
- **Only guests who are coming.** People who declined or haven't replied aren't thanked or mentioned as if they're there.
- **A new Speeches page** next to Invitation, Menu, Playlist and Seating. It shows one card per speech with the speaker, ready to copy, and has the same "done" marker as the other pages.

## Suggestions to confirm
- Tone, length and cringe level are fixed choices, not free text, so results are predictable and quick to set.
- The speech settings live on the Speeches page itself.
- The speeches are read-only in the app, like the other results. To change one, change the settings and run the planner again.
- Planning is still started the same way as today. This idea doesn't add a "run" button to the app.

## Not in scope
- Speeches that link together or refer to each other.
- Editing speeches inside the app.
- Starting a planning run from the app.
