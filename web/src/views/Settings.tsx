import { useEffect, useState, type FormEvent } from 'react';
import { api, type PartyEvent } from '../api.ts';

type Field = { key: keyof PartyEvent; label: string; type?: string; hint?: string; wide?: boolean };

const FIELDS: Field[] = [
  { key: 'name', label: 'Event name', wide: true },
  { key: 'hostCompany', label: 'Host company' },
  { key: 'theme', label: 'Theme' },
  { key: 'dressCode', label: 'Dress code', wide: true },
  { key: 'venueName', label: 'Venue' },
  { key: 'venueAddress', label: 'Address' },
  { key: 'startsAt', label: 'Starts', type: 'datetime-local' },
  { key: 'endsAt', label: 'Ends', type: 'datetime-local', hint: 'Optional' },
  { key: 'rsvpDeadline', label: 'RSVP no later than', type: 'date' },
];

export function Settings() {
  const [form, setForm] = useState<PartyEvent>();
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string }>();

  useEffect(() => { api.getEvent().then(setForm); }, []);

  if (!form) return <p className="loading">Loading settings…</p>;

  const set = (key: keyof PartyEvent, value: string) => {
    setForm({ ...form, [key]: key === 'endsAt' && value === '' ? null : value });
    setStatus(undefined);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setForm(await api.updateEvent(form));
      setStatus({ kind: 'saved', text: 'Settings saved' });
    } catch (err) {
      setStatus({ kind: 'error', text: (err as Error).message });
    }
  };

  return (
    <section>
      <header className="view-header">
        <h2>Event settings</h2>
        <p className="lede">The planner reads these before it plans anything. Change them, then run <code>/plan-party</code> again.</p>
      </header>
      <form className="settings-form" onSubmit={save}>
        {FIELDS.map((f) => (
          <label key={f.key} className={f.wide ? 'field is-wide' : 'field'}>
            <span className="field-label">{f.label}{f.hint && <span className="field-hint"> ({f.hint})</span>}</span>
            <input type={f.type ?? 'text'} value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
          </label>
        ))}
        <div className="form-actions is-wide">
          <button type="submit" className="button is-primary">Save settings</button>
          {status && <span className={`form-status is-${status.kind}`} role="status">{status.text}</span>}
        </div>
      </form>
    </section>
  );
}
