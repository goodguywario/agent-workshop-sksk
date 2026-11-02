import { openDb } from '../src/db/connection.ts';
import { listGuests } from '../src/db/repo.ts';
import { seed } from '../src/db/seed.ts';

const db = openDb();
seed(db);
console.log(`Database reset and reseeded (${listGuests(db).length} guests).`);
