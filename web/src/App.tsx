import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api.ts';
import { formatDateTime } from './format.ts';
import { usePoll } from './usePoll.ts';
import { Guests } from './views/Guests.tsx';
import { Invitation } from './views/Invitation.tsx';
import { Menu } from './views/Menu.tsx';
import { Playlist } from './views/Playlist.tsx';
import { Seating } from './views/Seating.tsx';
import { Settings } from './views/Settings.tsx';
import { Speeches } from './views/Speeches.tsx';

type ViewId = 'settings' | 'guests' | 'invitation' | 'seating' | 'menu' | 'playlist' | 'speeches';

const VIEWS: { id: ViewId; label: string; render: () => ReactNode }[] = [
  { id: 'settings', label: 'Event settings', render: () => <Settings /> },
  { id: 'guests', label: 'Guests', render: () => <Guests /> },
  { id: 'invitation', label: 'Invitation', render: () => <Invitation /> },
  { id: 'seating', label: 'Seating', render: () => <Seating /> },
  { id: 'menu', label: 'Menu', render: () => <Menu /> },
  { id: 'playlist', label: 'Playlist', render: () => <Playlist /> },
  { id: 'speeches', label: 'Speeches', render: () => <Speeches /> },
];

function currentView(): ViewId {
  const id = window.location.hash.replace('#/', '') as ViewId;
  return VIEWS.some((v) => v.id === id) ? id : 'settings';
}

/** Which planner outputs exist, so the nav can show progress while the planner runs. */
async function fetchProgress(): Promise<Partial<Record<ViewId, boolean>>> {
  const [invitation, seating, menu, playlist, speeches] = await Promise.all([
    api.getInvitation(), api.getSeating(), api.getMenu(), api.getPlaylist(), api.getSpeeches(),
  ]);
  return {
    invitation: invitation !== null,
    seating: seating.seatCount > 0,
    menu: menu.length > 0,
    playlist: playlist.length > 0,
    // No dot while speeches are switched off: there is nothing to plan.
    speeches: speeches.enabled
      ? speeches.speeches.length > 0 && speeches.speeches.every((s) => s.body !== null && !s.outOfDate)
      : undefined,
  };
}

export function App() {
  const [view, setView] = useState<ViewId>(currentView);
  const { data: event } = usePoll(api.getEvent, 5000);
  const { data: progress, error } = usePoll(fetchProgress);

  useEffect(() => {
    const onHash = () => setView(currentView());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // On narrow screens the nav scrolls sideways; keep the current view's tab visible.
  useEffect(() => {
    document.querySelector('.sidebar [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [view]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>{event?.name ?? 'Party planner'}</h1>
          {event && (
            <p className="brand-meta">
              {formatDateTime(event.startsAt)}<br />{event.venueName}
            </p>
          )}
        </div>
        <nav aria-label="Views">
          <ul>
            {VIEWS.map((v) => {
              const planned = progress?.[v.id];
              return (
                <li key={v.id}>
                  <a href={`#/${v.id}`} aria-current={view === v.id ? 'page' : undefined}>
                    <span>{v.label}</span>
                    {planned !== undefined && (
                      <span className={`progress-dot${planned ? ' is-done' : ''}`}
                        title={planned ? 'Planned' : 'Not planned yet'} aria-label={planned ? 'Planned' : 'Not planned yet'} />
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        {error && <p className="sidebar-error" role="alert">Can't reach the API. Is <code>npm run dev</code> running?</p>}
      </aside>
      <main className="content">{VIEWS.find((v) => v.id === view)!.render()}</main>
    </div>
  );
}
