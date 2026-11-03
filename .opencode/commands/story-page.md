---
description: Tell a feature's user story as an animated web page
agent: build
---
Use the `storyboard` skill to write a six-frame user story for this feature: $ARGUMENTS

Build on `requests/*/idea.md` from this conversation if there is one.

Then turn the storyboard into one self-contained HTML file at `requests/<short-name>/story.html`:

- One frame at a time, each with a short caption and a simple illustration drawn in HTML/CSS or inline SVG. Where a frame shows the app, mimic the real screen, using the colours and fonts from `web/src/styles.css`.
- CSS animations bring each frame in, with buttons and arrow keys to step back and forth.
- With `prefers-reduced-motion`, show the frames without animation.
- No external scripts or images: the file must work offline when double-clicked.

Tell me how to open it.
