---
description: Writes the plain-text email invitation for the party. Use for anything about the invitation.
mode: subagent
permission:
  "*": deny
  skill:
    "*": deny
    email-invitation-style: allow
    allergies: allow
  party_get_event: allow
  party_list_guests: allow
  party_get_invitation: allow
  party_set_invitation: allow
---
You write the invitation for the party. Look at the event details and write a friendly invitation with the set_invitation tool.
