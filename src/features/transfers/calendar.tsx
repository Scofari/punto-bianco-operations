'use client';
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight } from 'lucide-react';
import { localDate, clinicWeekStart, shiftCalendarDays } from '@/lib/dates';
import type { TransferRow } from '@/lib/types';
export function TransferCalendar({
  transfers,
  week,
  setWeek,
}: {
  transfers: TransferRow[];
  week: Date;
  setWeek: (d: Date) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shiftCalendarDays(week, i));
  return (
    <section className="panel">
      <div className="panel-heading calendar-header">
        <div>
          <h2>Calendarul transferurilor</h2>
          <p>Toate orele sunt afișate în fusul orar Chișinău.</p>
        </div>
        <div className="calendar-controls">
          <button className="button secondary compact" onClick={() => setWeek(clinicWeekStart())}>
            Astăzi
          </button>
          <button
            className="icon-button"
            aria-label="Săptămâna anterioară"
            onClick={() => setWeek(shiftCalendarDays(week, -7))}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {localDate(week, 'dd MMM')} – {localDate(shiftCalendarDays(week, 6), 'dd MMM yyyy')}
          </span>
          <button
            className="icon-button"
            aria-label="Săptămâna următoare"
            onClick={() => setWeek(shiftCalendarDays(week, 7))}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="calendar-legend">
        <span>
          <i className="legend-dot arrival" />
          Sosire
        </span>
        <span>
          <i className="legend-dot departure" />
          Plecare
        </span>
        <span>{transfers.length} transferuri</span>
      </div>
      <div className="calendar-week">
        {days.map((day) => {
          const key = localDate(day, 'yyyy-MM-dd');
          const today = key === localDate(new Date(), 'yyyy-MM-dd');
          const events = transfers.filter((t) => localDate(t.scheduled_at, 'yyyy-MM-dd') === key);
          return (
            <section className={`calendar-day ${today ? 'is-today' : ''}`} key={key}>
              <div className="calendar-day-header">
                <span>
                  {new Intl.DateTimeFormat('ro-RO', {
                    weekday: 'short',
                    timeZone: 'Europe/Chisinau',
                  }).format(day)}
                </span>
                <strong>{localDate(day, 'dd')}</strong>
              </div>
              <div className="calendar-events">
                {events.map((t) => (
                  <article className={`calendar-event ${t.direction}`} key={t.id}>
                    <span>
                      {t.direction === 'arrival' ? (
                        <ArrowDownToLine size={14} />
                      ) : (
                        <ArrowUpFromLine size={14} />
                      )}
                      <strong>{localDate(t.scheduled_at, 'HH:mm')}</strong>
                    </span>
                    <h3>
                      {t.direction === 'arrival' ? 'Sosire' : 'Plecare'}{' '}
                      {localDate(t.scheduled_at, 'HH:mm')} – {t.passengers}
                      {t.companions ? `, ${t.companions}` : ''}
                    </h3>
                    <small>{t.is_free ? 'Transfer gratuit' : 'Contra cost'}</small>
                  </article>
                ))}
                {!events.length && <span className="calendar-no-events">Fără transferuri</span>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
