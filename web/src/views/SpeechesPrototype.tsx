// PROTOTYPE: three variants of the Speeches page from requests/speech-writer/idea.md, switchable via ?variant=1|2|3.
// Throwaway: settings live in memory only, speeches are fake sample text built from the real event and guest list.
import { useState } from 'react';
import { api, type Guest, type PartyEvent } from '../api.ts';
import { formatDateTime } from '../format.ts';
import { PrototypeSwitcher, useVariant } from '../PrototypeSwitcher.tsx';
import { usePoll } from '../usePoll.ts';
import './SpeechesPrototype.css';

// ---------- shared prototype model ----------

const ROLES = ['Toastmaster', 'Boss', 'HR', 'Host', 'Colleague'] as const;
const TONES = ['Warm', 'Formal', 'Playful', 'Heartfelt'] as const;
const LENGTHS = ['Short', 'Medium', 'Long'] as const;
const CRINGE = ['Safe for the CEO', 'Gentle', 'Office-party', 'Dad-joke', 'Full dad-joke'];
const LENGTH_HINT: Record<Length, string> = { Short: '≈1 min', Medium: '≈3 min', Long: '≈5 min' };

type Role = (typeof ROLES)[number];
type Tone = (typeof TONES)[number];
type Length = (typeof LENGTHS)[number];
type Speech = { id: number; role: Role; tone: Tone; length: Length; cringe: number; mention: string };
type Config = { enabled: boolean; speeches: Speech[] };

let nextId = 4;
const DEFAULT: Config = {
  enabled: true,
  speeches: [
    { id: 1, role: 'Toastmaster', tone: 'Playful', length: 'Short', cringe: 4, mention: '' },
    { id: 2, role: 'Boss', tone: 'Formal', length: 'Medium', cringe: 1, mention: "Thank Engineering for shipping the new platform in October." },
    { id: 3, role: 'HR', tone: 'Heartfelt', length: 'Short', cringe: 2, mention: '' },
  ],
};

function useConfig() {
  const [config, setConfig] = useState<Config>(DEFAULT);
  const update = (id: number, patch: Partial<Speech>) =>
    setConfig((c) => ({ ...c, speeches: c.speeches.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const add = () => {
    const s: Speech = { id: nextId++, role: 'Colleague', tone: 'Warm', length: 'Short', cringe: 2, mention: '' };
    setConfig((c) => ({ ...c, speeches: [...c.speeches, s] }));
    return s.id;
  };
  const remove = (id: number) => setConfig((c) => ({ ...c, speeches: c.speeches.filter((s) => s.id !== id) }));
  const move = (id: number, step: number) => setConfig((c) => {
    const list = [...c.speeches];
    const i = list.findIndex((s) => s.id === id);
    const j = i + step;
    if (j < 0 || j >= list.length) return c;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...c, speeches: list };
  });
  const toggle = () => setConfig((c) => ({ ...c, enabled: !c.enabled }));
  return { config, update, add, remove, move, toggle };
}
type ConfigApi = ReturnType<typeof useConfig>;

/** The suggested real person for a role, using public guest-list fields only. */
function suggestedSpeaker(role: Role, guests: Guest[]): Guest | undefined {
  const here = guests.filter((g) => g.rsvpStatus === 'attending');
  if (role === 'Boss') return here.find((g) => g.isBoss);
  if (role === 'HR') return here.find((g) => g.department === 'People' || /HR/.test(g.jobTitle ?? ''));
  return undefined;
}

/** Fake speech text. Uses only public facts: names, titles, departments, partners, event details. Never notes, allergies or diets. */
function sampleSpeech(s: Speech, event: PartyEvent, guests: Guest[]): string[] {
  const here = guests.filter((g) => g.rsvpStatus === 'attending');
  const staff = here.filter((g) => g.department);
  const partners = here.length - staff.length;
  const depts = [...new Set(staff.map((g) => g.department!))];
  const boss = here.find((g) => g.isBoss);
  const co = event.hostCompany || 'everyone';
  const juniors = staff.filter((g) => /junior/i.test(g.jobTitle ?? ''));

  const open: Record<Tone, string> = {
    Warm: `Good evening, everyone, and what a lovely sight you all are.`,
    Formal: `Ladies and gentlemen, colleagues and guests: good evening, and welcome to ${event.name}.`,
    Playful: `Is this thing on? Excellent. Hello, ${co}!`,
    Heartfelt: `Before we raise a glass, I'd like to take a quiet moment with all of you.`,
  };
  const who: Record<Role, string> = {
    Toastmaster: `I'm your toastmaster tonight, which means my job is to keep things moving and keep the speeches short. Mostly mine.`,
    Boss: boss ? `As ${boss.jobTitle?.toLowerCase() ?? 'your boss'}, I get the privilege of saying thank you on behalf of the whole company.` : `I get the privilege of saying thank you on behalf of the whole company.`,
    HR: `From all of us in People: this evening is our favourite part of the year, and not just because nobody's filling in a form.`,
    Host: `On behalf of ${co}, thank you for coming.`,
    Colleague: `I'm not a manager and nobody asked me to approve this speech, so let's see how it goes.`,
  };
  const jokes = [
    '',
    'I promise to keep this short.',
    'I asked IT how to make tonight even better. They asked if I had tried turning it off and on again.',
    'Why did the spreadsheet come to the party? It heard there would be plenty of cells to mingle with.',
    'Yes, there will be karaoke. No, you cannot opt out. It is in your contract. Legal has checked. Probably.',
  ];

  const p: string[] = [`${open[s.tone]} ${who[s.role]}`];
  p.push(`Tonight there are ${here.length} of us at ${event.venueName}: people from ${depts.join(', ')}${partners ? `, and ${partners} partners who were brave enough to join us` : ''}. The theme is ${event.theme.toLowerCase()}, and judging by the outfits, "${event.dressCode}" was taken seriously.`);
  if (s.cringe >= 2) p.push(jokes.slice(1, s.cringe).join(' '));
  if (s.length !== 'Short') {
    p.push(depts.slice(0, s.length === 'Long' ? depts.length : 3).map((d) => `To ${d}: thank you, the year would not have worked without you.`).join(' '));
    if (juniors.length) p.push(`And a special welcome to our newest colleagues, ${juniors.map((g) => g.firstName).join(' and ')}. This is what we're like all year. Sorry.`);
  }
  if (s.length === 'Long') {
    p.push(`It has been a year of big launches and small wins, of late nights and early coffees. Look around the table: every person here made some part of it a little better.`);
    if (s.cringe >= 3) p.push(`I was going to make a pun about our year being "unbe-leaf-able", but my toastmaster said no. So I'm saying it anyway.`);
  }
  if (s.mention.trim()) p.push(s.mention.trim());
  p.push(s.tone === 'Formal' ? `Please rise and raise your glasses: to ${co}.` : `So, glasses up, everyone: to ${co}, and to all of you!`);
  return p.filter(Boolean);
}

const words = (p: string[]) => p.join(' ').split(/\s+/).length;
const minutes = (p: string[]) => Math.max(1, Math.round(words(p) / 130));

function summary(s: Speech) {
  return `${s.tone} · ${s.length} (${LENGTH_HINT[s.length]}) · ${CRINGE[s.cringe - 1]}`;
}

function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button className={`button${small ? ' is-small' : ''}`} onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => {});
    }}>{done ? 'Copied!' : 'Copy'}</button>
  );
}

function Toggle({ on, onChange, label = 'Write speeches' }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <label className="proto-toggle">
      <input type="checkbox" role="switch" checked={on} onChange={onChange} />
      <span className="proto-toggle-track" aria-hidden="true" />
      <span>{label}: <strong>{on ? 'On' : 'Off'}</strong></span>
    </label>
  );
}

function OffNotice() {
  return (
    <div className="empty">
      <p className="empty-title">Speeches are switched off</p>
      <p>The planner will skip speeches on the next <code>/plan-party</code> run and leave any existing speeches alone.</p>
    </div>
  );
}

/** Shows the state the speech writer would receive, and what it is not allowed to see. */
function WhatTheWriterGets({ config, guests }: { config: Config; guests: Guest[] }) {
  const here = guests.filter((g) => g.rsvpStatus === 'attending');
  const skipped = guests.length - here.length;
  return (
    <details className="proto-state">
      <summary>Prototype: what the speech writer would get</summary>
      <div className="proto-state-cols">
        <div>
          <h4>Can use</h4>
          <ul>
            <li>Event name, theme, venue, dress code</li>
            <li>{here.length} attending guests: names, job titles, departments, boss, partners</li>
            <li>Anything typed into "Things to mention"</li>
          </ul>
          <h4>Kept out</h4>
          <ul>
            <li>Private notes, allergies, diets, health</li>
            <li>{skipped} guests who declined or haven't replied</li>
          </ul>
        </div>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>
    </details>
  );
}

function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="proto-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} className={o === value ? 'is-on' : ''} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

type Props = { c: ConfigApi; event: PartyEvent; guests: Guest[] };

// ---------- Variant 1: one page, settings table on top, speeches below ----------

function Variant1({ c, event, guests }: Props) {
  const { config } = c;
  return (
    <section>
      <header className="view-header view-header-row">
        <div>
          <h2>Speeches</h2>
          <p className="lede">Set up who speaks and how. The planner writes one speech per row the next time it runs.</p>
        </div>
        <Toggle on={config.enabled} onChange={c.toggle} />
      </header>

      {!config.enabled ? <OffNotice /> : (
        <>
          <div className="table-wrap v1-table">
            <table className="guest-table">
              <thead>
                <tr><th>#</th><th>Who's speaking</th><th>Tone</th><th>Length</th><th>Cringe level</th><th>Things to mention</th><th /></tr>
              </thead>
              <tbody>
                {config.speeches.map((s, i) => (
                  <tr key={s.id}>
                    <td className="muted">{i + 1}</td>
                    <td className="field"><select value={s.role} onChange={(e) => c.update(s.id, { role: e.target.value as Role })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                    <td className="field"><select value={s.tone} onChange={(e) => c.update(s.id, { tone: e.target.value as Tone })}>{TONES.map((r) => <option key={r}>{r}</option>)}</select></td>
                    <td className="field"><select value={s.length} onChange={(e) => c.update(s.id, { length: e.target.value as Length })}>{LENGTHS.map((r) => <option key={r} value={r}>{r} ({LENGTH_HINT[r]})</option>)}</select></td>
                    <td className="field"><select value={s.cringe} onChange={(e) => c.update(s.id, { cringe: Number(e.target.value) })}>{CRINGE.map((l, n) => <option key={l} value={n + 1}>{n + 1}. {l}</option>)}</select></td>
                    <td className="field"><input value={s.mention} placeholder="Optional" onChange={(e) => c.update(s.id, { mention: e.target.value })} /></td>
                    <td><div className="row-actions">
                      <button className="button is-small" onClick={() => c.move(s.id, -1)} aria-label="Move up">↑</button>
                      <button className="button is-small" onClick={() => c.move(s.id, 1)} aria-label="Move down">↓</button>
                      <button className="button is-small is-danger" onClick={() => c.remove(s.id)}>Remove</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions v1-actions">
            <button className="button" onClick={c.add}>+ Add a speech</button>
            <span className="muted">Settings are saved on their own. Run <code>/plan-party</code> to write the speeches.</span>
          </div>

          <h3 className="v1-heading">Written speeches</h3>
          <div className="v1-speeches">
            {config.speeches.map((s, i) => {
              const text = sampleSpeech(s, event, guests);
              return (
                <article key={s.id} className="invitation v1-speech">
                  <div className="invitation-subject view-header-row">
                    <div><span>Speech {i + 1} · {summary(s)}</span><h3>{s.role}</h3></div>
                    <CopyButton text={text.join('\n\n')} small />
                  </div>
                  <div className="invitation-body">{text.map((t, k) => <p key={k}>{t}</p>)}</div>
                </article>
              );
            })}
          </div>
        </>
      )}
      <WhatTheWriterGets config={config} guests={guests} />
    </section>
  );
}

// ---------- Variant 2: speaker list on the left, editor + preview on the right ----------

function Variant2({ c, event, guests }: Props) {
  const { config } = c;
  const [selected, setSelected] = useState<number | undefined>(config.speeches[0]?.id);
  const s = config.speeches.find((x) => x.id === selected) ?? config.speeches[0];
  const text = s ? sampleSpeech(s, event, guests) : [];
  const person = s && suggestedSpeaker(s.role, guests);

  return (
    <section>
      <header className="view-header">
        <h2>Speeches</h2>
        <p className="lede">Pick a speaker on the left to tune their speech.</p>
      </header>
      <div className="v2-banner">
        <Toggle on={config.enabled} onChange={c.toggle} label="Speeches in the next planning run" />
      </div>

      <div className={`v2-layout${config.enabled ? '' : ' is-off'}`}>
        <nav className="v2-list" aria-label="Speakers">
          <ol>
            {config.speeches.map((x, i) => (
              <li key={x.id}>
                <button className={x.id === s?.id ? 'is-on' : ''} onClick={() => setSelected(x.id)}>
                  <span className="v2-num">{i + 1}</span>
                  <span><strong>{x.role}</strong><br /><span className="cell-sub">{x.tone} · {LENGTH_HINT[x.length]} · cringe {x.cringe}/5</span></span>
                </button>
              </li>
            ))}
          </ol>
          <button className="button v2-add" onClick={() => setSelected(c.add())}>+ Add a speaker</button>
        </nav>

        {s ? (
          <div className="v2-detail">
            <div className="panel v2-form">
              <div className="view-header-row">
                <h3>Speech {config.speeches.indexOf(s) + 1}: {s.role}</h3>
                <div className="row-actions">
                  <button className="button is-small" onClick={() => c.move(s.id, -1)}>Earlier</button>
                  <button className="button is-small" onClick={() => c.move(s.id, 1)}>Later</button>
                  <button className="button is-small is-danger" onClick={() => c.remove(s.id)}>Remove</button>
                </div>
              </div>
              <div className="v2-row"><span className="field-label">Who's speaking</span><Segmented label="Who's speaking" options={ROLES} value={s.role} onChange={(role) => c.update(s.id, { role })} /></div>
              {person && <p className="v2-person">Suggested from the guest list: <strong>{person.firstName} {person.lastName}</strong>, {person.jobTitle}</p>}
              <div className="v2-row"><span className="field-label">Tone</span><Segmented label="Tone" options={TONES} value={s.tone} onChange={(tone) => c.update(s.id, { tone })} /></div>
              <div className="v2-row"><span className="field-label">Length</span><Segmented label="Length" options={LENGTHS} value={s.length} onChange={(length) => c.update(s.id, { length })} /></div>
              <div className="v2-row">
                <span className="field-label">Cringe level</span>
                <div className="v2-slider">
                  <input type="range" min={1} max={5} value={s.cringe} onChange={(e) => c.update(s.id, { cringe: Number(e.target.value) })} />
                  <span className="v2-cringe">{'😬'.repeat(s.cringe)} {CRINGE[s.cringe - 1]}</span>
                </div>
              </div>
              <label className="field">
                <span className="field-label">Things to mention <span className="field-hint">(the only way private details get in)</span></span>
                <textarea rows={2} value={s.mention} placeholder="e.g. Congratulate Priya's team on the launch" onChange={(e) => c.update(s.id, { mention: e.target.value })} />
              </label>
            </div>

            <article className="v2-paper">
              <div className="view-header-row">
                <span className="muted">Preview · {words(text)} words · about {minutes(text)} min</span>
                <CopyButton text={text.join('\n\n')} small />
              </div>
              {text.map((t, k) => <p key={k}>{t}</p>)}
            </article>
          </div>
        ) : <div className="empty"><p className="empty-title">No speakers yet</p><p>Add one on the left.</p></div>}
      </div>
      <WhatTheWriterGets config={config} guests={guests} />
    </section>
  );
}

// ---------- Variant 3: run sheet of the evening + large-print cue cards ----------

function Variant3({ c, event, guests }: Props) {
  const { config } = c;
  const [editing, setEditing] = useState<number>();
  const start = new Date(event.startsAt);
  let clock = new Date(start.getTime() + 75 * 60_000); // pretend speeches start after the starter
  const slots = config.speeches.map((s) => {
    const text = sampleSpeech(s, event, guests);
    const at = clock;
    clock = new Date(clock.getTime() + (minutes(text) + 2) * 60_000);
    return { s, text, at };
  });
  const hhmm = (d: Date) => d.toTimeString().slice(0, 5);

  return (
    <section>
      <header className="view-header view-header-row">
        <div>
          <h2>Speeches</h2>
          <p className="lede">The evening's running order. Print the cue cards and hand them to each speaker.</p>
        </div>
        <Toggle on={config.enabled} onChange={c.toggle} />
      </header>

      {!config.enabled ? <OffNotice /> : (
        <>
          <ol className="v3-timeline">
            <li className="v3-fixed"><span>{hhmm(start)}</span>Doors open</li>
            {slots.map(({ s, text, at }) => (
              <li key={s.id}><a href={`#speech-${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`speech-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>
                <span>{hhmm(at)}</span>{s.role}<em>{minutes(text)} min</em>
              </a></li>
            ))}
            <li className="v3-add"><button className="button is-small" onClick={() => setEditing(c.add())}>+ Speech</button></li>
          </ol>
          <p className="muted v3-note">Times are a guess for the prototype: speeches start after the starter, 2 minutes between speakers. {formatDateTime(event.startsAt)}.</p>

          {slots.map(({ s, text, at }, i) => (
            <div key={s.id} id={`speech-${s.id}`} className="v3-speech">
              <div className="v3-speech-head">
                <div>
                  <span className="v3-time">{hhmm(at)}</span>
                  <h3>{i + 1}. {s.role}</h3>
                  <p className="muted">{summary(s)}{s.mention && <> · mentions: "{s.mention}"</>}</p>
                </div>
                <div className="row-actions">
                  <button className="button is-small" onClick={() => setEditing(editing === s.id ? undefined : s.id)}>{editing === s.id ? 'Done' : 'Adjust'}</button>
                  <CopyButton text={text.join('\n\n')} small />
                </div>
              </div>
              {editing === s.id && (
                <div className="v3-adjust">
                  <label className="field"><span className="field-label">Who's speaking</span><select value={s.role} onChange={(e) => c.update(s.id, { role: e.target.value as Role })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
                  <label className="field"><span className="field-label">Tone</span><select value={s.tone} onChange={(e) => c.update(s.id, { tone: e.target.value as Tone })}>{TONES.map((r) => <option key={r}>{r}</option>)}</select></label>
                  <label className="field"><span className="field-label">Length</span><select value={s.length} onChange={(e) => c.update(s.id, { length: e.target.value as Length })}>{LENGTHS.map((r) => <option key={r}>{r}</option>)}</select></label>
                  <label className="field"><span className="field-label">Cringe: {CRINGE[s.cringe - 1]}</span><input type="range" min={1} max={5} value={s.cringe} onChange={(e) => c.update(s.id, { cringe: Number(e.target.value) })} /></label>
                  <label className="field is-wide"><span className="field-label">Things to mention</span><input value={s.mention} onChange={(e) => c.update(s.id, { mention: e.target.value })} /></label>
                  <div className="row-actions is-wide">
                    <button className="button is-small" onClick={() => c.move(s.id, -1)}>Earlier</button>
                    <button className="button is-small" onClick={() => c.move(s.id, 1)}>Later</button>
                    <button className="button is-small is-danger" onClick={() => c.remove(s.id)}>Remove speech</button>
                  </div>
                </div>
              )}
              <div className="v3-cards">
                {text.map((t, k) => (
                  <div key={k} className="v3-card"><span className="v3-card-num">{k + 1}/{text.length}</span>{t}</div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
      <WhatTheWriterGets config={config} guests={guests} />
    </section>
  );
}

// ---------- page ----------

const VARIANTS = [
  { key: '1', name: 'One page: settings table, then speeches' },
  { key: '2', name: 'Speaker list + editor with live preview' },
  { key: '3', name: 'Evening run sheet + cue cards' },
];

export function SpeechesPrototype() {
  const { data: event } = usePoll(api.getEvent, 5000);
  const { data: guests } = usePoll(api.listGuests, 5000);
  const c = useConfig();
  const [variant, setVariant] = useVariant(VARIANTS.map((v) => v.key));

  if (!event || !guests) return <p className="loading">Loading…</p>;
  const props = { c, event, guests };
  return (
    <>
      <p className="proto-flag">Prototype: settings are not saved and the speeches are sample text.</p>
      {variant === '1' && <Variant1 {...props} />}
      {variant === '2' && <Variant2 {...props} />}
      {variant === '3' && <Variant3 {...props} />}
      <PrototypeSwitcher variants={VARIANTS} current={variant} onChange={setVariant} />
    </>
  );
}
