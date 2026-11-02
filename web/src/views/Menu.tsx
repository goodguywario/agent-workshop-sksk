import { COURSES } from '../../../src/db/types.ts';
import { api } from '../api.ts';
import { EmptyState } from '../EmptyState.tsx';
import { usePoll } from '../usePoll.ts';

const COURSE_NAMES = { starter: 'Starters', main: 'Mains', dessert: 'Desserts', drinks: 'Drinks' };

export function Menu() {
  const { data: menu } = usePoll(api.getMenu);
  if (!menu) return <p className="loading">Loading menu…</p>;

  return (
    <section>
      <header className="view-header">
        <h2>Menu</h2>
        <p className="lede">Allergens are marked in red, dietary labels in green.</p>
      </header>
      {menu.length === 0 ? <EmptyState what="menu" /> : (
        <div className="menu">
          {COURSES.filter((c) => menu.some((m) => m.course === c)).map((course) => (
            <div key={course} className="course">
              <h3>{COURSE_NAMES[course]}</h3>
              {menu.filter((m) => m.course === course).map((item, i) => (
                <div key={i} className="menu-item">
                  <div className="menu-item-name">{item.name}</div>
                  {item.description && <p>{item.description}</p>}
                  <div>
                    {item.allergens.map((a) => <span key={a} className="chip is-allergy">{a}</span>)}
                    {item.dietaryTags.map((t) => <span key={t} className="chip is-diet">{t}</span>)}
                  </div>
                  {item.notes && <div className="menu-item-note">{item.notes}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
