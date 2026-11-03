// PROTOTYPE: floating bar for flipping between UI variants via ?variant=. Throwaway, do not ship.
import { useEffect, useState } from 'react';

function readVariant(keys: string[]): string {
  const v = new URLSearchParams(window.location.search).get('variant');
  return v && keys.includes(v) ? v : keys[0];
}

export function useVariant(keys: string[]): [string, (k: string) => void] {
  const [variant, setVariantState] = useState(() => readVariant(keys));
  const setVariant = (k: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('variant', k);
    window.history.replaceState(null, '', url);
    setVariantState(k);
  };
  return [variant, setVariant];
}

export function PrototypeSwitcher({ variants, current, onChange }: {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}) {
  const i = Math.max(0, variants.findIndex((v) => v.key === current));
  const go = (step: number) => onChange(variants[(i + step + variants.length) % variants.length].key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="proto-switcher" role="toolbar" aria-label="Prototype variants">
      <button onClick={() => go(-1)} aria-label="Previous variant">←</button>
      <span><strong>Variant {variants[i].key}</strong> · {variants[i].name}</span>
      <button onClick={() => go(1)} aria-label="Next variant">→</button>
    </div>
  );
}
