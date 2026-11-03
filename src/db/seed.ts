import type { DatabaseSync } from 'node:sqlite';
import { addGuest, addSpeech, clearPlan, setSpeechesEnabled, updateEvent, updateGuest } from './repo.ts';
import type { GuestInput, PartyEvent } from './types.ts';

// The workshop's seed data: one event and its guest list.

export const SEED_EVENT: PartyEvent = {
  name: 'Frostbyte Christmas Party 2026',
  hostCompany: 'Frostbyte Analytics',
  theme: 'Christmas',
  dressCode: 'Festive cocktail — something sparkly encouraged',
  venueName: 'The Lantern Boathouse',
  venueAddress: '14 Harbour Row, Port Ellis',
  startsAt: '2026-12-11T18:00',
  endsAt: '2026-12-12T01:00',
  rsvpDeadline: '2026-11-27',
};

type SeedGuest = Partial<GuestInput> & Pick<GuestInput, 'firstName' | 'lastName'> & { partner?: string };

const employee = (jobTitle: string, department: string) => ({ jobTitle, department });
const plusOne = { jobTitle: null, department: null };

const SEED_GUESTS: SeedGuest[] = [
  { firstName: 'Margaret', lastName: 'Holloway', ...employee('Chief Executive Officer', 'Leadership'), isBoss: true, partner: 'Edward Holloway', notes: 'Goes by Maggie.' },
  { firstName: 'Edward', lastName: 'Holloway', ...plusOne, allergies: 'shellfish' },
  { firstName: 'Priya', lastName: 'Raman', ...employee('Head of Engineering', 'Engineering'), partner: 'Tom Becker', dietaryPreference: 'vegetarian' },
  { firstName: 'Tom', lastName: 'Becker', ...employee('Sales Lead', 'Sales'), allergies: 'coeliac' },
  { firstName: 'Daniel', lastName: 'Okafor', ...employee('Data Engineer', 'Engineering'), partner: 'Sofia Okafor', notes: 'Uses a wheelchair — needs a seat with easy access, end of the table works best.' },
  { firstName: 'Sofia', lastName: 'Okafor', ...plusOne, allergies: 'lactose (a little is ok)' },
  { firstName: 'Lena', lastName: 'Fischer', ...employee('Product Designer', 'Product'), partner: 'Marcus Lindqvist', dietaryPreference: 'vegan', allergies: 'tree nuts' },
  { firstName: 'Marcus', lastName: 'Lindqvist', ...plusOne },
  { firstName: 'Sam', lastName: 'Ortiz', ...employee('QA Engineer', 'Engineering'), partner: 'Jamie Ortiz' },
  { firstName: 'Jamie', lastName: 'Ortiz', ...plusOne, dietaryPreference: 'pescatarian' },
  { firstName: 'Hannah', lastName: 'Price', ...employee('Account Manager', 'Sales'), allergies: 'nuts — SEVERE, carries EpiPen' },
  { firstName: 'Oliver', lastName: 'Grant', ...employee('Junior Developer', 'Engineering'), notes: "Started last week, doesn't know many people yet. Onboarding buddy: Aisha Khan." },
  { firstName: 'Aisha', lastName: 'Khan', ...employee('Senior Developer', 'Engineering') },
  { firstName: 'Ben', lastName: 'Carter', ...employee('Finance Controller', 'Finance'), notes: "Please don't seat me next to Gary Mills — long story." },
  { firstName: 'Gary', lastName: 'Mills', ...employee('Facilities Manager', 'Operations') },
  { firstName: 'Rachel', lastName: 'Kim', ...employee('HR Manager', 'People'), notes: "Doesn't like spicy food." },
  { firstName: 'Jonas', lastName: 'Weber', ...employee('Marketing Specialist', 'Marketing'), dietaryPreference: 'pescatarian' },
  { firstName: 'Chloe', lastName: 'Martin', ...employee('Customer Success Manager', 'Customer Success') },
  { firstName: 'Fatima', lastName: 'Haddad', ...employee('Data Scientist', 'Engineering'), allergies: 'gluten-free pls (not coeliac, just feel better)' },
  { firstName: 'Liam', lastName: "O'Connor", ...employee('DevOps Engineer', 'Engineering') },
  { firstName: 'Nora', lastName: 'Svensson', ...employee('Office Manager', 'Operations') },
  { firstName: 'Victor', lastName: 'Alvarez', ...employee('Sales Representative', 'Sales'), rsvpStatus: 'declined', allergies: 'peanuts' },
  { firstName: 'Ingrid', lastName: 'Berg', ...employee('Marketing Lead', 'Marketing'), rsvpStatus: 'declined' },
  { firstName: 'Elena', lastName: 'Petrova', ...employee('Legal Counsel', 'Legal'), rsvpStatus: 'pending', allergies: 'sesame' },
  { firstName: 'Kevin', lastName: 'Doyle', ...employee('Support Engineer', 'Customer Success'), rsvpStatus: 'pending' },
];

function emailFor(g: SeedGuest): string {
  const local = `${g.firstName}.${g.lastName}`.toLowerCase().replace(/[^a-z.]/g, '');
  return g.department === null ? `${local}@mail.example` : `${local}@frostbyte.example`;
}

/** Wipes everything and inserts the workshop event and guest list with an empty plan. */
export function seed(db: DatabaseSync): void {
  clearPlan(db);
  db.exec("DELETE FROM guests; DELETE FROM sqlite_sequence WHERE name = 'guests';");
  updateEvent(db, SEED_EVENT);

  const ids = new Map<string, number>();
  for (const { partner: _partner, ...g } of SEED_GUESTS) {
    const guest = addGuest(db, {
      email: emailFor(g), jobTitle: null, department: null, isBoss: false, partnerId: null,
      rsvpStatus: 'attending', dietaryPreference: 'none', allergies: '', notes: '',
      ...g,
    });
    ids.set(`${g.firstName} ${g.lastName}`, guest.id);
  }
  for (const g of SEED_GUESTS) {
    if (g.partner) updateGuest(db, ids.get(`${g.firstName} ${g.lastName}`)!, { partnerId: ids.get(g.partner)! });
  }

  // Speeches start switched off, with two examples so the feature is quick to try.
  db.exec("DELETE FROM speeches; DELETE FROM sqlite_sequence WHERE name = 'speeches';");
  setSpeechesEnabled(db, false);
  addSpeech(db, { role: 'toastmaster', tone: 'playful', length: 'short', cringe: 4 });
  addSpeech(db, { role: 'boss', speakerGuestId: ids.get('Margaret Holloway')!, tone: 'formal', length: 'medium', cringe: 1 });
}
