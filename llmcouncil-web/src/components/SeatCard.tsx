import { memo } from 'react';
import type { Seat } from '../lib/council';
import { Markdown } from './Markdown';

interface Props {
  title: string;
  subtitle?: string;
  seat: Seat;
  placeholder: string;
  featured?: boolean;
}

const DOT: Record<Seat['status'], string> = {
  idle: 'bg-zinc-400',
  working: 'bg-violet-500 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-rose-500',
};

export const SeatCard = memo(function SeatCard({ title, subtitle, seat, placeholder, featured }: Props) {
  return (
    <section
      aria-busy={seat.status === 'working'}
      className={`rounded-2xl border p-4 ${
        featured
          ? 'border-violet-300 bg-white shadow-sm dark:border-violet-500/40 dark:bg-zinc-900'
          : 'border-zinc-200 bg-white/60 dark:border-zinc-800 dark:bg-zinc-900/50'
      }`}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className={`size-2 rounded-full ${DOT[seat.status]}`} aria-hidden />
        <h2 className={featured ? 'text-base font-semibold' : 'text-sm font-semibold'}>{title}</h2>
        {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
        <span className="sr-only">{seat.status}</span>
      </header>
      {seat.text ? (
        <div className={seat.status === 'working' ? 'caret' : ''}>
          <Markdown text={seat.text} />
        </div>
      ) : seat.status === 'error' ? null : (
        <p className="text-sm text-zinc-500">{seat.status === 'working' ? 'Thinking…' : placeholder}</p>
      )}
      {seat.error && (
        <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">
          {seat.error}
        </p>
      )}
    </section>
  );
});
