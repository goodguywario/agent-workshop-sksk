import { useState, type FormEvent } from 'react';
import { DIETARY_PREFERENCES, RSVP_STATUSES } from '../../../src/db/types.ts';
import { api, type Guest, type GuestInput } from '../api.ts';
import { usePoll } from '../usePoll.ts';

const BLANK: GuestInput = {
  firstName: '', lastName: '', email: '', jobTitle: null, department: null, isBoss: false,
  partnerId: null, rsvpStatus: 'pending', dietaryPreference: 'none', allergies: '', notes: '',
};

const fullName = (g: Guest) => `${g.firstName} ${g.lastName}`;
const withoutId = ({ id: _id, ...input }: Guest): GuestInput => input;

/** Lets long addresses wrap before the @ instead of widening the table. */
function breakableEmail(email: string) {
  const at = email.indexOf('@');
  return at > 0 ? <>{email.slice(0, at)}<wbr />{email.slice(at)}</> : email;
}

function GuestForm({ initial, guests, selfId, submitLabel, onSubmit, onCancel }: {
  initial: GuestInput;
  guests: Guest[];
  selfId?: number;
  submitLabel: string;
  onSubmit: (input: GuestInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string>();
  const set = <K extends keyof GuestInput>(key: K, value: GuestInput[K]) => setForm({ ...form, [key]: value });
  const orNull = (v: string) => (v.trim() === '' ? null : v);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await onSubmit(form);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="guest-form" onSubmit={submit}>
      <label className="field"><span className="field-label">First name</span>
        <input required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></label>
      <label className="field"><span className="field-label">Last name</span>
        <input required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></label>
      <label className="field"><span className="field-label">Email</span>
        <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
      <label className="field"><span className="field-label">Job title</span>
        <input value={form.jobTitle ?? ''} placeholder="Leave empty for plus-ones" onChange={(e) => set('jobTitle', orNull(e.target.value))} /></label>
      <label className="field"><span className="field-label">Department</span>
        <input value={form.department ?? ''} placeholder="Leave empty for plus-ones" onChange={(e) => set('department', orNull(e.target.value))} /></label>
      <label className="field"><span className="field-label">Coming with</span>
        <select value={form.partnerId ?? ''} onChange={(e) => set('partnerId', e.target.value ? Number(e.target.value) : null)}>
          <option value="">Nobody</option>
          {guests.filter((g) => g.id !== selfId).map((g) => <option key={g.id} value={g.id}>{fullName(g)}</option>)}
        </select></label>
      <label className="field"><span className="field-label">RSVP</span>
        <select value={form.rsvpStatus} onChange={(e) => set('rsvpStatus', e.target.value as GuestInput['rsvpStatus'])}>
          {RSVP_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select></label>
      <label className="field"><span className="field-label">Diet</span>
        <select value={form.dietaryPreference} onChange={(e) => set('dietaryPreference', e.target.value as GuestInput['dietaryPreference'])}>
          {DIETARY_PREFERENCES.map((d) => <option key={d}>{d}</option>)}
        </select></label>
      <label className="field checkbox-field">
        <input type="checkbox" checked={form.isBoss} onChange={(e) => set('isBoss', e.target.checked)} />
        <span>The boss</span></label>
      <label className="field is-wide"><span className="field-label">Allergies</span>
        <input value={form.allergies} placeholder="As the guest wrote it" onChange={(e) => set('allergies', e.target.value)} /></label>
      <label className="field is-wide"><span className="field-label">Notes</span>
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      <div className="form-actions is-wide">
        <button type="submit" className="button is-primary">{submitLabel}</button>
        <button type="button" className="button" onClick={onCancel}>Cancel</button>
        {error && <span className="form-status is-error" role="alert">{error}</span>}
      </div>
    </form>
  );
}

export function Guests() {
  const { data: guests, refresh } = usePoll(api.listGuests);
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  if (!guests) return <p className="loading">Loading guests…</p>;
  const byId = new Map(guests.map((g) => [g.id, g]));
  const counts = Object.fromEntries(RSVP_STATUSES.map((s) => [s, guests.filter((g) => g.rsvpStatus === s).length]));

  const remove = async (g: Guest) => {
    if (!window.confirm(`Remove ${fullName(g)} from the guest list?`)) return;
    try {
      await api.removeGuest(g.id);
    } catch (err) {
      window.alert(`Couldn't remove ${fullName(g)}: ${(err as Error).message}`);
    }
    refresh();
  };

  const done = () => { setEditing(null); refresh(); };

  return (
    <section>
      <header className="view-header view-header-row">
        <div>
          <h2>Guests</h2>
          <p className="lede">{guests.length} invited: {counts.attending} attending, {counts.pending} pending, {counts.declined} declined.</p>
        </div>
        <button className="button is-primary" onClick={() => setEditing('new')} disabled={editing === 'new'}>Add guest</button>
      </header>

      {editing === 'new' && (
        <div className="panel">
          <GuestForm initial={BLANK} guests={guests} submitLabel="Add guest"
            onSubmit={async (input) => { await api.addGuest(input); done(); }} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="table-wrap">
        <table className="guest-table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>RSVP</th><th>Diet and allergies</th><th>Coming with</th><th>Notes</th><th><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {guests.map((g) => editing === g.id ? (
              <tr key={g.id} className="is-editing">
                <td colSpan={7}>
                  <GuestForm initial={withoutId(g)} guests={guests} selfId={g.id} submitLabel="Save guest"
                    onSubmit={async (input) => { await api.updateGuest(g.id, input); done(); }} onCancel={() => setEditing(null)} />
                </td>
              </tr>
            ) : (
              <tr key={g.id}>
                <td className="guest-name">
                  {fullName(g)}
                  {g.isBoss && <span className="boss-mark" title="The boss"> ★<span className="visually-hidden">The boss</span></span>}
                  <div className="cell-sub">{breakableEmail(g.email)}</div>
                </td>
                <td>{g.jobTitle ?? <span className="muted">Plus-one</span>}<div className="cell-sub">{g.department}</div></td>
                <td><span className={`rsvp rsvp-${g.rsvpStatus}`}>{g.rsvpStatus}</span></td>
                <td className="diet-cell">
                  {g.dietaryPreference !== 'none' && <span className="chip">{g.dietaryPreference}</span>}
                  {g.allergies && <span className="chip is-allergy">{g.allergies}</span>}
                </td>
                <td className="nowrap">{g.partnerId ? fullName(byId.get(g.partnerId)!) : <span className="muted">Nobody</span>}</td>
                <td className="notes">{g.notes}</td>
                <td>
                  <div className="row-actions">
                    <button className="button is-small" onClick={() => setEditing(g.id)}>Edit</button>
                    <button className="button is-small is-danger" onClick={() => remove(g)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
