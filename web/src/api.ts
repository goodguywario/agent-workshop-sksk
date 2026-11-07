import type {
  Guest, GuestInput, Invitation, MenuItem, PartyEvent, SeatingPlan, Track,
} from '../../src/db/types.ts';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: `The API answered ${res.status}. Is "npm run dev" running?` }));
  if (!res.ok) throw new Error(data?.error ?? `Request failed with ${res.status}`);
  return data as T;
}

export const api = {
  getEvent: () => request<PartyEvent>('GET', '/event'),
  updateEvent: (patch: Partial<PartyEvent>) => request<PartyEvent>('PUT', '/event', patch),
  listGuests: () => request<Guest[]>('GET', '/guests'),
  addGuest: (input: GuestInput) => request<Guest>('POST', '/guests', input),
  updateGuest: (id: number, patch: Partial<GuestInput>) => request<Guest>('PUT', `/guests/${id}`, patch),
  removeGuest: (id: number) => request<void>('DELETE', `/guests/${id}`),
  getSeating: () => request<SeatingPlan>('GET', '/seating'),
  getMenu: () => request<MenuItem[]>('GET', '/menu'),
  getPlaylist: () => request<Track[]>('GET', '/playlist'),
  getInvitation: () => request<Invitation | null>('GET', '/invitation'),
  clearPlan: () => request<void>('DELETE', '/plan'),
};

export type { Guest, GuestInput, Invitation, MenuItem, PartyEvent, SeatingPlan, Track };
