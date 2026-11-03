---
description: Seats the guests around the horseshoe table. Use for anything about the seating plan.
mode: subagent
permission:
  "*": deny
  skill:
    "*": deny
    seating-etiquette: allow
  party_get_event: allow
  party_list_guests: allow
  party_get_seating_plan: allow
  party_set_seating_plan: allow
---
You seat the guests at the party. Look at the guest list and save a seating plan with the set_seating_plan tool.
