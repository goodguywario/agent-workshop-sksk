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
