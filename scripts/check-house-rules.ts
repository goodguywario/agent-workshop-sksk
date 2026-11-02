// Facilitator tool (main only): grades the current plan against every house rule in FACILITATOR.md.
// Run with: npm run check:rules
import { ensureDb } from '../src/db/connection.ts';
import * as r from '../src/db/repo.ts';

const db = ensureDb();
const guests = r.listGuests(db);
const byName = (n: string) => guests.find((g) => `${g.firstName} ${g.lastName}` === n)!;
const plan = r.getSeatingPlan(db);
const menu = r.getMenu(db);
const playlist = r.getPlaylist(db);
const inv = r.getInvitation(db);
const results: [string, boolean, string?][] = [];
const check = (name: string, ok: boolean, info?: string) => results.push([name, ok, info]);

// --- seating
const seatOf = new Map(plan.seats.filter((s) => s.guestId).map((s) => [s.guestId!, s.seatNumber]));
const N = plan.seatCount;
const attending = guests.filter((g) => g.rsvpStatus === 'attending');
const adj = (a: number, b: number) => seatOf.has(a) && seatOf.has(b) && Math.abs(seatOf.get(a)! - seatOf.get(b)!) === 1;
check('seating: every attending guest seated, nobody else', N === attending.length && attending.every((g) => seatOf.has(g.id)) && plan.seats.every((s) => s.rsvpStatus === 'attending'), `N=${N}`);
const boss = guests.find((g) => g.isBoss)!;
check('seating: boss in middle seat', seatOf.get(boss.id) === Math.ceil(N / 2), `boss seat ${seatOf.get(boss.id)}, middle ${Math.ceil(N / 2)}`);
check('seating: boss partner beside', adj(boss.id, boss.partnerId!));
const couples = attending.filter((g) => g.partnerId && g.id < g.partnerId);
check('seating: all couples adjacent', couples.every((g) => adj(g.id, g.partnerId!)));
const tipOk = (seat: number) => {
  const id = plan.seats[seat - 1]?.guestId; const g = guests.find((x) => x.id === id);
  return !!g?.partnerId && adj(g.id, g.partnerId);
};
check('seating: both tips held by couples', N > 0 && tipOk(1) && tipOk(N));
const daniel = byName('Daniel Okafor');
check('seating: wheelchair user at a tip, partner beside', [1, N].includes(seatOf.get(daniel.id)!) && adj(daniel.id, daniel.partnerId!));
check('seating: new hire beside buddy', adj(byName('Oliver Grant').id, byName('Aisha Khan').id));
check('seating: Ben and Gary apart', !adj(byName('Ben Carter').id, byName('Gary Mills').id));

// --- menu
const text = (m: (typeof menu)[number]) => `${m.name} ${m.description} ${m.notes}`.toLowerCase();
const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());
check('menu: no peanuts or tree nuts anywhere', menu.every((m) => !lower(m.allergens).some((a) => a.includes('nut'))) &&
  !menu.some((m) => /\b(almonds?|walnuts?|pecans?|hazelnuts?|pistachios?|cashews?|peanuts?)\b/.test(`${m.name} ${m.description}`.toLowerCase().replaceAll('almond game', '').replace(/\b(no|without|free of|instead of)( the usual)? (almonds?|nuts?)\b/g, ''))));
for (const course of ['starter', 'main', 'dessert', 'drinks'] as const) {
  const items = menu.filter((m) => m.course === course);
  const free = (allergen: string) => items.some((m) => !lower(m.allergens).some((a) => a.includes(allergen)));
  check(`menu ${course}: gluten-free option`, free('gluten'));
  check(`menu ${course}: milk-free option`, free('milk'));
  check(`menu ${course}: shellfish-free option`, items.some((m) => !lower(m.allergens).some((a) => a.includes('crustacean') || a.includes('mollusc'))));
  check(`menu ${course}: vegan option`, items.some((m) => lower(m.dietaryTags).includes('vegan')));
}
check('menu: pending guest sesame note', menu.some((m) => /elena/.test(text(m)) && /sesame/.test(text(m))));
check('menu: mulled wine + alcohol-free alternative', menu.some((m) => /mulled/.test(text(m))) && menu.some((m) => /(alcohol-free|non-alcoholic|alcohol free)/.test(text(m))));
check('menu: rice pudding with nut-free token', menu.some((m) => m.course === 'dessert' && /rice pudding|risalamande|ris/.test(text(m)) && /(cherry|token|nut-free)/.test(text(m))));
check('menu: no item for declined guest Victor', !menu.some((m) => /victor/.test(text(m))));

// --- playlist
check('playlist: 20-30 tracks', playlist.length >= 20 && playlist.length <= 30, `${playlist.length}`);
const isMariah = (t: (typeof playlist)[number]) => /all i want for christmas/i.test(t.title) && /mariah/i.test(t.artist);
check('playlist: Mariah last, exactly once', playlist.length > 0 && isMariah(playlist[playlist.length - 1]) && playlist.filter(isMariah).length === 1);
check('playlist: no Last Christmas', !playlist.some((t) => /last christmas/i.test(t.title)));

// --- invitation
const body = inv?.body ?? '';
check('invitation: subject <= 60 chars', !!inv && inv.subject.length <= 60, inv?.subject);
check('invitation: plain text', !!inv && !/\*\*|^#|\]\(/m.test(body));
for (const [label, re] of [['date', /11 December/], ['time', /18:00/], ['venue', /Lantern Boathouse/], ['address', /14 Harbour Row/],
  ['dress code', /festive cocktail/i], ['RSVP date', /27 November/], ['asks dietary', /(allerg|dietary)/i], ['asks partner', /partner/i],
  ['signed by boss', /Margaret Holloway/], ['boss title', /Chief Executive Officer/]] as const) {
  check(`invitation: ${label}`, re.test(body));
}

for (const [name, ok, info] of results) console.log(ok ? 'PASS' : 'FAIL', name, info ? `(${info})` : '');
console.log(`\n${results.filter((x) => x[1]).length}/${results.length} rules pass`);
