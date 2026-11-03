export type RsvpStatus = 'attending' | 'declined' | 'pending';
export type DietaryPreference = 'none' | 'vegetarian' | 'vegan' | 'pescatarian';
export type Course = 'starter' | 'main' | 'dessert' | 'drinks';

export const RSVP_STATUSES: RsvpStatus[] = ['attending', 'declined', 'pending'];
export const DIETARY_PREFERENCES: DietaryPreference[] = ['none', 'vegetarian', 'vegan', 'pescatarian'];
export const COURSES: Course[] = ['starter', 'main', 'dessert', 'drinks'];

/** Dates are ISO strings: startsAt/endsAt `YYYY-MM-DDTHH:mm`, rsvpDeadline `YYYY-MM-DD`. */
export interface PartyEvent {
  name: string;
  hostCompany: string;
  theme: string;
  dressCode: string;
  venueName: string;
  venueAddress: string;
  startsAt: string;
  endsAt: string | null;
  rsvpDeadline: string;
}

export interface Guest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  isBoss: boolean;
  partnerId: number | null;
  rsvpStatus: RsvpStatus;
  dietaryPreference: DietaryPreference;
  allergies: string;
  notes: string;
}

export type GuestInput = Omit<Guest, 'id'>;

export interface Seat {
  seatNumber: number;
  guestId: number | null;
  guestName: string | null;
  rsvpStatus: RsvpStatus | null;
}

export interface SeatingPlan {
  seatCount: number;
  middleSeat: number | null;
  seats: Seat[];
}

export interface MenuItem {
  course: Course;
  name: string;
  description: string;
  allergens: string[];
  dietaryTags: string[];
  notes: string;
}

export interface Track {
  position: number;
  title: string;
  artist: string;
  note: string;
}

export interface Invitation {
  subject: string;
  body: string;
}

export type SpeechRole = 'toastmaster' | 'boss' | 'hr' | 'host' | 'colleague';
export type SpeechTone = 'warm' | 'formal' | 'playful' | 'heartfelt';
export type SpeechLength = 'short' | 'medium' | 'long';

export const SPEECH_ROLES: SpeechRole[] = ['toastmaster', 'boss', 'hr', 'host', 'colleague'];
export const SPEECH_TONES: SpeechTone[] = ['warm', 'formal', 'playful', 'heartfelt'];
export const SPEECH_LENGTHS: SpeechLength[] = ['short', 'medium', 'long'];

/** The settings of one speech: chosen by the organiser in the web app. */
export interface SpeechSettings {
  role: SpeechRole;
  /** The attending guest who gives the speech, or null for "no one in particular". */
  speakerGuestId: number | null;
  tone: SpeechTone;
  length: SpeechLength;
  /** 1 (safe for the CEO) to 5 (full dad-joke). */
  cringe: number;
  /** Free text. The only way private details may get into a speech. */
  mention: string;
}

export interface Speech extends SpeechSettings {
  id: number;
  position: number;
  /** The speech text, written by the speech-writer agent; null until written. */
  body: string | null;
  writtenAt: string | null;
  /** True when the settings changed after the text was written. */
  outOfDate: boolean;
}

export interface SpeechPlan {
  enabled: boolean;
  speeches: Speech[];
}

/** What the speech writer may know about a guest. No notes, allergies, diets or email. */
export type PublicGuest = Pick<Guest, 'id' | 'firstName' | 'lastName' | 'jobTitle' | 'department' | 'isBoss' | 'partnerId'>;
