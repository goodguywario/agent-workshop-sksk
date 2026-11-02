import { useState } from 'react';
import { api } from '../api.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePoll } from '../usePoll.ts';

export function Invitation() {
  const { data: invitation, error } = usePoll(api.getInvitation);
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

  if (invitation === undefined && !error) return <p className="loading">Loading invitation…</p>;

  const copyToClipboard = async () => {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${invitation.subject}\n\n${invitation.body}`);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
    setTimeout(() => setCopy('idle'), 2000);
  };

  return (
    <section>
      <header className="view-header view-header-row">
        <div>
          <h2>Invitation</h2>
          <p className="lede">Copy it and paste it straight into an email.</p>
        </div>
        {invitation && (
          <button className="button is-primary" onClick={copyToClipboard} aria-live="polite">
            {copy === 'copied' ? 'Copied!' : copy === 'failed' ? 'Copy failed: select the text instead' : 'Copy to clipboard'}
          </button>
        )}
      </header>
      {!invitation ? <EmptyState what="invitation" /> : (
        <article className="invitation">
          <div className="invitation-subject"><span>Subject</span><h3>{invitation.subject}</h3></div>
          <pre className="invitation-body">{invitation.body}</pre>
        </article>
      )}
    </section>
  );
}
