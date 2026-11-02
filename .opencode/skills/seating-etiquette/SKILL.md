---
name: seating-etiquette
description: House rules for seating guests at the company's horseshoe table — who sits in the middle, where couples and singles go, accessibility, and guest requests. Load before creating or changing a seating plan.
---
# Seating etiquette

## The table

One horseshoe (U-shaped) table. With N seats, seat 1 is the tip of the left arm, the seats run around the curve, and seat N is the tip of the right arm. Seats i and i+1 are **neighbours**. The **middle seat** is seat ceil(N/2). The **tips** are seats 1 and N.

## Who gets a seat

N is the number of guests with RSVP status `attending`, and every one of them gets exactly one seat. Guests who are `pending` or `declined` get no seat, because the table is set for confirmed guests.

## House rules

1. **The boss** sits in the middle seat, and their partner sits in a neighbouring seat.
2. **Partners** always sit in neighbouring seats.
3. **Tips go to couples.** Seats 1 and N each go to someone whose partner sits next to them. Singles sit away from the tips, in the curve or along the arms, next to other singles or next to the boss's couple.
4. **Accessibility first.** A guest whose notes mention a wheelchair, mobility or easy access gets a tip seat (rule 3 still holds: their partner sits beside them).
5. **New hires** sit next to the onboarding buddy named in their notes.
6. **Guest requests** in the notes are honoured. A "don't seat me next to X" request means the two are never neighbours.
7. **Mix departments.** Where the rules above leave a choice, avoid seating two colleagues from the same department as neighbours, unless they are a couple.

## Checklist

Before saving, confirm every item against the draft:

- [ ] N equals the number of attending guests; no pending or declined guest is seated.
- [ ] The boss is in seat ceil(N/2); their partner is a neighbour.
- [ ] Every couple are neighbours.
- [ ] Seats 1 and N are both held by someone in a couple.
- [ ] The accessibility guest is at a tip, partner beside them.
- [ ] Every new hire is beside their buddy.
- [ ] Every "don't seat me next to" pair are not neighbours.
