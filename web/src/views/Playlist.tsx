import { api } from '../api.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePoll } from '../usePoll.ts';

export function Playlist() {
  const { data: tracks } = usePoll(api.getPlaylist);
  if (!tracks) return <p className="loading">Loading playlist…</p>;

  return (
    <section>
      <header className="view-header">
        <h2>Playlist</h2>
        <p className="lede">{tracks.length > 0 ? `${tracks.length} tracks, in play order.` : 'Music for the evening, in play order.'}</p>
      </header>
      {tracks.length === 0 ? <EmptyState what="playlist" /> : (
        <ol className="playlist">
          {tracks.map((t) => (
            <li key={t.position} className="track">
              <span className="track-position">{t.position}</span>
              <span>
                <span className="track-title">{t.title}</span> <span className="muted">by {t.artist}</span>
                {t.note && <span className="track-note">{t.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
