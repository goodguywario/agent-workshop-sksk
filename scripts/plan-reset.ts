import { ensureDb } from '../src/db/connection.ts';
import { clearPlan } from '../src/db/repo.ts';

clearPlan(ensureDb());
console.log('Plan cleared (seating, menu, playlist, invitation). Settings and guests kept.');
