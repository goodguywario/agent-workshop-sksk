import { api, type Guest, type SeatingPlan } from '../api.ts';
import { EmptyState } from '../EmptyState.tsx';
import { horseshoeGeometry, horseshoeLayout } from '../horseshoe.ts';
import { usePoll } from '../usePoll.ts';

const W = 960, H = 700, SEAT_R = 24, TABLE_OFFSET = 52;

async function fetchSeating(): Promise<{ plan: SeatingPlan; guests: Guest[] }> {
  const [plan, guests] = await Promise.all([api.getSeating(), api.listGuests()]);
  return { plan, guests };
}

const initials = (g: Guest) => `${g.firstName[0]}${g.lastName[0]}`;
const shortName = (g: Guest) => `${g.firstName} ${g.lastName[0]}.`;
const hasDietaryNeeds = (g: Guest) => g.allergies.trim() !== '' || g.dietaryPreference !== 'none';

/** The table outline, drawn inside the ring of seats. */
function tablePath(): string {
  const { armX, topY, cx, cy, r } = horseshoeGeometry(W, H);
  const inner = r - TABLE_OFFSET;
  const left = armX + TABLE_OFFSET, right = W - armX - TABLE_OFFSET;
  return `M ${left} ${topY} L ${left} ${cy} A ${inner} ${inner} 0 0 0 ${right} ${cy} L ${right} ${topY}`;
}

export function Seating() {
  const { data } = usePoll(fetchSeating);
  if (!data) return <p className="loading">Loading seating…</p>;

  const { plan, guests } = data;
  const byId = new Map(guests.map((g) => [g.id, g]));
  const seatedIds = new Set(plan.seats.map((s) => s.guestId));
  const unseated = guests.filter((g) => g.rsvpStatus === 'attending' && !seatedIds.has(g.id));
  const positions = horseshoeLayout(plan.seatCount, W, H);
  const seatOf = new Map(plan.seats.filter((s) => s.guestId !== null).map((s) => [s.guestId!, s.seatNumber]));

  const partnerLinks = plan.seats.flatMap((s) => {
    const g = s.guestId !== null ? byId.get(s.guestId) : undefined;
    const partnerSeat = g?.partnerId ? seatOf.get(g.partnerId) : undefined;
    return partnerSeat === s.seatNumber + 1 ? [[s.seatNumber, partnerSeat] as const] : [];
  });

  return (
    <section>
      <header className="view-header">
        <h2>Seating</h2>
        <p className="lede">
          {plan.seatCount > 0
            ? `${plan.seatCount} seats around a horseshoe table. Seat 1 is the top of the left arm; seat ${plan.middleSeat} is the middle.`
            : 'One horseshoe table, seated by the planner.'}
        </p>
      </header>

      {plan.seatCount === 0 ? <EmptyState what="seating plan" /> : (
        <figure className="seating-figure">
          <svg className="seating-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Horseshoe table with ${plan.seatCount} seats`}>
            <path className="table-shape" d={tablePath()} strokeWidth={46} />
            {partnerLinks.map(([a, b]) => {
              const pa = positions[a - 1], pb = positions[b - 1];
              const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
              const ux = (pb.x - pa.x) / len, uy = (pb.y - pa.y) / len;
              return <line key={a} className="partner-link"
                x1={pa.x + ux * SEAT_R} y1={pa.y + uy * SEAT_R} x2={pb.x - ux * SEAT_R} y2={pb.y - uy * SEAT_R} />;
            })}
            {plan.seats.map((seat) => {
              const pos = positions[seat.seatNumber - 1];
              const g = seat.guestId !== null ? byId.get(seat.guestId) : undefined;
              const out = { dx: -pos.inward.dx, dy: -pos.inward.dy };
              const lx = pos.x + out.dx * (SEAT_R + 10), ly = pos.y + out.dy * (SEAT_R + 10);
              const anchor = out.dx > 0.35 ? 'start' : out.dx < -0.35 ? 'end' : 'middle';
              const baseline = out.dy > 0.35 ? 14 : out.dy < -0.35 ? -18 : 4;
              const classes = ['seat',
                seat.seatNumber === plan.middleSeat && 'is-middle',
                !g && 'is-empty',
                g?.isBoss && 'is-boss',
                g && g.rsvpStatus !== 'attending' && `is-${g.rsvpStatus}`,
              ].filter(Boolean).join(' ');
              return (
                <g key={seat.seatNumber} className={classes}>
                  <title>{g ? `Seat ${seat.seatNumber}: ${g.firstName} ${g.lastName} (${g.rsvpStatus})` : `Seat ${seat.seatNumber}: empty`}</title>
                  <circle className="seat-ring" cx={pos.x} cy={pos.y} r={SEAT_R} />
                  {g ? (
                    <>
                      <text className="seat-initials" x={pos.x} y={pos.y + 5}>{initials(g)}</text>
                      {hasDietaryNeeds(g) && <circle className="diet-dot" cx={pos.x + SEAT_R * 0.72} cy={pos.y - SEAT_R * 0.72} r={6} />}
                      <text x={lx} y={ly + baseline} textAnchor={anchor}>
                        {g.isBoss ? '★ ' : ''}{shortName(g)}
                        {g.rsvpStatus !== 'attending' && <tspan className="seat-status" x={lx} dy={14}>{g.rsvpStatus}</tspan>}
                      </text>
                    </>
                  ) : (
                    <text className="seat-number" x={pos.x} y={pos.y + 4}>{seat.seatNumber}</text>
                  )}
                </g>
              );
            })}
          </svg>
          <ul className="legend">
            <li><span className="legend-swatch" style={{ borderColor: 'var(--brass)', background: 'var(--brass-soft)' }} />Middle seat</li>
            <li><span className="legend-swatch" style={{ borderColor: 'var(--ok)', background: 'var(--ok)' }} />Dietary needs</li>
            <li><span className="legend-swatch" style={{ borderColor: 'var(--cranberry)' }} />Declined guest seated</li>
            <li><span className="legend-swatch" style={{ borderColor: 'var(--amber)' }} />Pending guest seated</li>
            <li><span className="legend-swatch" style={{ borderColor: 'var(--muted)', borderStyle: 'dashed' }} />Empty seat</li>
            <li>★ The boss</li>
            <li><span className="legend-line" />Partners side by side</li>
          </ul>
        </figure>
      )}

      {plan.seatCount > 0 && unseated.length > 0 && (
        <div className="seating-issues panel">
          <h3>Attending but not seated</h3>
          <ul>{unseated.map((g) => <li key={g.id}>{g.firstName} {g.lastName}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
