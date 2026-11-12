'use client';

import { useTheme } from 'next-themes';
import { useRef, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const subscribe = () => () => {};
export function ThemeSettings() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const trigger = useRef<HTMLButtonElement>(null);
  const pendingTheme = useRef<string | null>(null);
  const transitioning = useRef(false);
  const queuedTheme = useRef<string | null>(null);

  async function changeTheme(value: string) {
    if (transitioning.current) { queuedTheme.current = value; return; }
    const target = value === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value;
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches || target === current) {
      setTheme(value);
      return;
    }
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) { setTheme(value); return; }
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    transitioning.current = true;
    document.documentElement.dataset.themeTransition = 'radial';
    try {
      const transition = document.startViewTransition(() => flushSync(() => setTheme(value)));
      // Skipped transitions still update the theme; handle both promises.
      const finished = transition.finished.catch(() => {});
      try {
        await transition.ready;
        await document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 550, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)', fill: 'both' }
        ).finished;
      } catch { /* A skipped animation must never prevent the theme change. */ }
      await finished;
    } finally {
      delete document.documentElement.dataset.themeTransition;
      transitioning.current = false;
      const queued = queuedTheme.current;
      queuedTheme.current = null;
      if (queued) void changeTheme(queued);
    }
  }
  return (
    <div className="settings-row">
      <div><Label htmlFor="theme">Tema da interface</Label><p id="theme-description">Escolha a aparência neste navegador.</p></div>
      <Select disabled={!mounted} value={mounted ? theme : 'system'} onValueChange={value => { pendingTheme.current = value; }}>
        <SelectTrigger ref={trigger} id="theme" aria-describedby="theme-description" className="w-full sm:w-[210px]"><SelectValue /></SelectTrigger>
        <SelectContent position="popper" className="data-[state=closed]:animate-none" onCloseAutoFocus={event => {
          event.preventDefault();
          trigger.current?.focus();
          const value = pendingTheme.current;
          pendingTheme.current = null;
          if (value) requestAnimationFrame(() => { void changeTheme(value); });
        }}>
          <SelectItem value="system">Automático{mounted ? ` (${resolvedTheme === 'dark' ? 'escuro' : 'claro'})` : ''}</SelectItem>
          <SelectItem value="light">Claro</SelectItem>
          <SelectItem value="dark">Escuro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
