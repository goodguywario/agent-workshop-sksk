import { useEffect, useRef, useState } from 'react';
import {
  SPEECH_LENGTHS, SPEECH_ROLES, SPEECH_TONES, type SpeechLength, type SpeechRole, type SpeechTone,
} from '../../../src/db/types.ts';
import { api, type Guest, type Speech, type SpeechSettings } from '../api.ts';
import { usePoll } from '../usePoll.ts';

const ROLE_LABEL: Record<SpeechRole, string> = {
  toastmaster: 'Toastmaster', boss: 'Boss', hr: 'HR', host: 'Host', colleague: 'Colleague',
};
const TONE_LABEL: Record<SpeechTone, string> = { warm: 'Warm', formal: 'Formal', playful: 'Playful', heartfelt: 'Heartfelt' };
const LENGTH_LABEL: Record<SpeechLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' };
const LENGTH_MINUTES: Record<SpeechLength, string> = { short: '≈1 min', medium: '≈3 min', long: '≈5 min' };
const CRINGE_LABEL = ['Safe for the CEO', 'Gentle', 'Office-party', 'Dad-joke', 'Full dad-joke'];

const fullName = (g: Guest) => `${g.firstName} ${g.lastName}`;
const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** The attending guest who usually fills a role, from public guest-list fields. */
function suggestedSpeaker(role: SpeechRole, guests: Guest[]): Guest | undefined {
  const attending = guests.filter((g) => g.rsvpStatus === 'attending');
  if (role === 'boss') return attending.find((g) => g.isBoss);
  if (role === 'hr') return attending.find((g) => g.department === 'People' || /\bHR\b/.test(g.jobTitle ?? ''));
  return undefined;
}

function status(s: Speech): { label: string; kind: 'done' | 'pending' | 'stale' } {
  if (s.body === null) return { label: 'Not written yet', kind: 'pending' };
  if (s.outOfDate) return { label: 'Out of date', kind: 'stale' };
  return { label: 'Written', kind: 'done' };
}

function Segmented<T extends string>({ label, options, labels, value, onChange }: {
  label: string; options: readonly T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="speech-row">
      <span className="field-label" id={`seg-${label}`}>{label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => o !== value && onChange(o)}>
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const run = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
    setTimeout(() => setCopy('idle'), 2000);
  };
  return (
    <button className="button is-small" onClick={run} aria-live="polite">
      {copy === 'copied' ? 'Copied!' : copy === 'failed' ? 'Copy failed: select the text instead' : 'Copy'}
    </button>
  );
}

function Editor({ speech, index, count, guests, save, move, remove }: {
  speech: Speech; index: number; count: number; guests: Guest[];
  save: (patch: Partial<SpeechSettings>) => void; move: (step: number) => void; remove: () => void;
}) {
  // Local copy of the free text, so background polling never replaces what is being typed.
  const [mention, setMention] = useState<string>();
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  // Drop the local copy once the saved value has caught up and the field is no longer focused.
  useEffect(() => {
    if (!typing && mention !== undefined && mention === speech.mention) setMention(undefined);
  }, [typing, mention, speech.mention]);

  const typeMention = (text: string) => {
    setMention(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save({ mention: text }), 600);
  };
  const flushMention = () => {
    setTyping(false);
    clearTimeout(timer.current);
    if (mention !== undefined && mention !== speech.mention) save({ mention });
  };

  const attending = guests.filter((g) => g.rsvpStatus === 'attending');
  const speaker = guests.find((g) => g.id === speech.speakerGuestId);
  const suggestion = speech.speakerGuestId === null ? suggestedSpeaker(speech.role, guests) : undefined;

  return (
    <div className="panel speech-editor">
      <div className="view-header-row">
        <h3>Speech {index + 1}: {ROLE_LABEL[speech.role]}</h3>
        <div className="row-actions">
          <button className="button is-small" onClick={() => move(-1)} disabled={index === 0}>Earlier</button>
          <button className="button is-small" onClick={() => move(1)} disabled={index === count - 1}>Later</button>
          <button className="button is-small is-danger" onClick={remove}>Remove</button>
        </div>
      </div>

      <Segmented label="Who's speaking" options={SPEECH_ROLES} labels={ROLE_LABEL} value={speech.role} onChange={(role) => save({ role })} />

      <div className="speech-row">
        <label className="field-label" htmlFor="speech-speaker">Speaker <span className="field-hint">(optional)</span></label>
        <div className="field">
          <select id="speech-speaker" value={speech.speakerGuestId ?? ''}
            onChange={(e) => save({ speakerGuestId: e.target.value ? Number(e.target.value) : null })}>
            <option value="">No one in particular</option>
            {speaker && speaker.rsvpStatus !== 'attending' && <option value={speaker.id}>{fullName(speaker)} ({speaker.rsvpStatus})</option>}
            {attending.map((g) => <option key={g.id} value={g.id}>{fullName(g)}{g.jobTitle ? `, ${g.jobTitle}` : ''}</option>)}
          </select>
          {suggestion && (
            <span className="speech-hint">
              Suggested from the guest list:{' '}
              <button type="button" className="link-button" onClick={() => save({ speakerGuestId: suggestion.id })}>
                Use {fullName(suggestion)}
              </button>
            </span>
          )}
          {speaker && speaker.rsvpStatus !== 'attending' && (
            <span className="speech-hint is-warning" role="status">
              {fullName(speaker)} isn't attending ({speaker.rsvpStatus}). The speech will be written for the role only.
            </span>
          )}
        </div>
      </div>

      <Segmented label="Tone" options={SPEECH_TONES} labels={TONE_LABEL} value={speech.tone} onChange={(tone) => save({ tone })} />
      <Segmented label="Length" options={SPEECH_LENGTHS}
        labels={Object.fromEntries(SPEECH_LENGTHS.map((l) => [l, `${LENGTH_LABEL[l]} (${LENGTH_MINUTES[l]})`])) as Record<SpeechLength, string>}
        value={speech.length} onChange={(length) => save({ length })} />

      <div className="speech-row">
        <label className="field-label" htmlFor="speech-cringe">Cringe level</label>
        <div className="speech-cringe">
          <input id="speech-cringe" type="range" min={1} max={5} step={1} value={speech.cringe}
            aria-valuetext={`${speech.cringe}: ${CRINGE_LABEL[speech.cringe - 1]}`}
            onChange={(e) => save({ cringe: Number(e.target.value) })} />
          <span><strong>{speech.cringe}/5</strong> {CRINGE_LABEL[speech.cringe - 1]}</span>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Things to mention <span className="field-hint">(the only way private details get into a speech)</span></span>
        <textarea rows={2} value={mention ?? speech.mention} placeholder="e.g. Congratulate Priya's team on the launch"
          onFocus={() => setTyping(true)} onChange={(e) => typeMention(e.target.value)} onBlur={flushMention} />
      </label>
    </div>
  );
}

function SpeechText({ speech }: { speech: Speech }) {
  if (speech.body === null) {
    return (
      <div className="empty">
        <p className="empty-title">Not written yet</p>
        <p>Run <code>/plan-party</code> in opencode. This page updates by itself while the planner works.</p>
      </div>
    );
  }
  const words = wordCount(speech.body);
  return (
    <article className="speech-paper">
      {speech.outOfDate && (
        <p className="speech-stale" role="status">The settings changed since this was written. Run <code>/plan-party</code> again to rewrite it.</p>
      )}
      <div className="view-header-row speech-paper-head">
        <span className="muted">{words} words · about {Math.max(1, Math.round(words / 130))} min</span>
        <CopyButton text={speech.body} />
      </div>
      <div className="speech-body">{speech.body}</div>
    </article>
  );
}

export function Speeches() {
  const { data: plan, error, refresh } = usePoll(api.getSpeeches);
  const { data: guests } = usePoll(api.listGuests, 5000);
  const [selected, setSelected] = useState<number>();
  const [failure, setFailure] = useState<string>();

  if ((!plan || !guests) && !error) return <p className="loading">Loading speeches…</p>;
  if (!plan || !guests) return <p className="loading" role="alert">{error}</p>;

  const speeches = plan.speeches;
  const current = speeches.find((s) => s.id === selected) ?? speeches[0];
  const index = current ? speeches.indexOf(current) : -1;
  const byId = new Map(guests.map((g) => [g.id, g]));

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setFailure(undefined);
    } catch (err) {
      setFailure((err as Error).message);
    }
    refresh();
  };

  const add = () => run(async () => setSelected((await api.addSpeech()).id));
  const move = (step: number) => {
    const ids = speeches.map((s) => s.id);
    const j = index + step;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => api.reorderSpeeches(ids));
  };

  return (
    <section>
      <header className="view-header">
        <h2>Speeches</h2>
        <p className="lede">
          Set up who speaks and how. The planner writes one speech per speaker on the next <code>/plan-party</code> run.
          Speeches only use public details about guests who are coming, plus what you type under "Things to mention".
        </p>
      </header>

      <div className="speech-banner">
        <label className="switch">
          <input type="checkbox" role="switch" checked={plan.enabled}
            onChange={(e) => run(() => api.setSpeechesEnabled(e.target.checked))} />
          <span className="switch-track" aria-hidden="true" />
          <span>Write speeches: <strong>{plan.enabled ? 'On' : 'Off'}</strong></span>
        </label>
        {!plan.enabled && <span className="muted">The planner skips speeches and leaves existing ones alone.</span>}
        {failure && <span className="form-status is-error" role="alert">{failure}</span>}
      </div>

      <fieldset className={`speech-layout${plan.enabled ? '' : ' is-off'}`} disabled={!plan.enabled}>
        <legend className="visually-hidden">Speakers in running order</legend>
        <nav className="speech-list" aria-label="Speakers">
          <ol>
            {speeches.map((s, i) => {
              const st = status(s);
              const speaker = s.speakerGuestId !== null ? byId.get(s.speakerGuestId) : undefined;
              return (
                <li key={s.id}>
                  <button type="button" aria-current={s.id === current?.id ? 'true' : undefined} onClick={() => setSelected(s.id)}>
                    <span className="speech-num">{i + 1}</span>
                    <span className="speech-summary">
                      <strong>{ROLE_LABEL[s.role]}</strong>{speaker && <> · {speaker.firstName}</>}
                      <span className="cell-sub">{TONE_LABEL[s.tone]} · {LENGTH_MINUTES[s.length]} · cringe {s.cringe}/5</span>
                      <span className={`speech-status is-${st.kind}`}>{st.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" className="button speech-add" onClick={add}>+ Add a speaker</button>
        </nav>

        {current ? (
          <div className="speech-detail">
            <Editor key={current.id} speech={current} index={index} count={speeches.length} guests={guests}
              save={(patch) => run(() => api.updateSpeech(current.id, patch))}
              move={move}
              remove={() => window.confirm(`Remove speech ${index + 1} (${ROLE_LABEL[current.role]})?`) && run(() => api.removeSpeech(current.id))} />
            <SpeechText speech={current} />
          </div>
        ) : (
          <div className="empty">
            <p className="empty-title">No speakers yet</p>
            <p>Add a speaker to get started.</p>
          </div>
        )}
      </fieldset>
    </section>
  );
}
