import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import { cn } from '@/lib/utils';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export type DayOverride = {
  date: string;
  type: string;
  startTime?: string | null;
  endTime?: string | null;
};

export type AvailabilityPayload = {
  rules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  overrides: DayOverride[];
};

type DayAction = 'closed' | 'open' | 'clear';

interface MasterAvailabilityEditorProps {
  /** Unique query key segment (e.g. master id or "self") */
  queryKey: string;
  loadAvailability: () => Promise<AvailabilityPayload>;
  saveWeekly: (rules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => Promise<unknown>;
  setDay: (data: {
    date: string;
    action: DayAction;
    startTime?: string;
    endTime?: string;
  }) => Promise<{ overrides: DayOverride[] }>;
  compact?: boolean;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number, locale: string): string {
  return new Date(year, month, 1).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export default function MasterAvailabilityEditor({
  queryKey,
  loadAvailability,
  saveWeekly,
  setDay,
  compact,
}: MasterAvailabilityEditorProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const queryClient = useQueryClient();

  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:30');
  const [selectedDays, setSelectedDays] = useState<number[]>([2, 3, 4, 5, 6]);
  const [overrides, setOverrides] = useState<DayOverride[]>([]);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const { data: availability } = useQuery({
    queryKey: ['availability', queryKey],
    queryFn: loadAvailability,
  });

  useEffect(() => {
    if (!availability) return;
    if (availability.rules.length) {
      setSelectedDays(availability.rules.map((r) => r.dayOfWeek).sort());
      setStartTime(availability.rules[0]?.startTime ?? '10:00');
      setEndTime(availability.rules[0]?.endTime ?? '18:30');
    }
    setOverrides(availability.overrides);
  }, [availability]);

  const saveWeeklyMutation = useMutation({
    mutationFn: () =>
      saveWeekly(selectedDays.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability', queryKey] }),
  });

  const setDayMutation = useMutation({
    mutationFn: (payload: { date: string; action: DayAction }) =>
      setDay({ ...payload, startTime, endTime }),
    onSuccess: (data) => {
      setOverrides(data.overrides);
      queryClient.invalidateQueries({ queryKey: ['availability', queryKey] });
    },
  });

  const overrideByDate = useMemo(() => {
    const map = new Map<string, DayOverride>();
    for (const o of overrides) map.set(o.date, o);
    return map;
  }, [overrides]);

  const calendarDays = useMemo(() => {
    const first = new Date(calMonth.year, calMonth.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(calMonth.year, calMonth.month + 1, 0).getDate();
    const cells: Array<{ key: string; dateKey: string | null; day: number | null }> = [];
    for (let i = 0; i < startPad; i++) cells.push({ key: `pad-${i}`, dateKey: null, day: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toDateKey(new Date(calMonth.year, calMonth.month, d));
      cells.push({ key: dateKey, dateKey, day: d });
    }
    return cells;
  }, [calMonth]);

  const toggleWeekday = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const dayStatus = (dateKey: string): 'available' | 'closed' | 'forced' | 'off' => {
    const override = overrideByDate.get(dateKey);
    if (override?.type === 'closed') return 'closed';
    if (override?.type === 'custom_hours') return 'forced';
    const dow = new Date(`${dateKey}T12:00:00`).getDay();
    return selectedDays.includes(dow) ? 'available' : 'off';
  };

  const handleDayClick = (dateKey: string) => {
    const status = dayStatus(dateKey);
    if (status === 'closed' || status === 'forced') {
      setDayMutation.mutate({ date: dateKey, action: 'clear' });
    } else if (status === 'available') {
      setDayMutation.mutate({ date: dateKey, action: 'closed' });
    } else {
      setDayMutation.mutate({ date: dateKey, action: 'open' });
    }
  };

  const todayKey = toDateKey(new Date());

  return (
    <div className={cn('space-y-6', compact && 'space-y-4')}>
      <div>
        <h3 className="mb-1 font-headline text-body-lg uppercase text-on-surface">
          {t('masterPanel.availability')}
        </h3>
        <p className="mb-3 font-body text-[12px] text-on-surface-variant">{t('masterPanel.availabilityHint')}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekday(day)}
              className={cn(
                'border px-2 py-1.5 font-label text-[10px] uppercase',
                selectedDays.includes(day)
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant text-on-surface-variant',
              )}
            >
              {t(`masterPanel.day${day}`)}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-3">
          <label className="font-label text-[11px] text-on-surface-variant">
            {t('masterPanel.start')}
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="ml-2 border border-outline-variant bg-surface-container-lowest px-2 py-1 text-on-surface"
            />
          </label>
          <label className="font-label text-[11px] text-on-surface-variant">
            {t('masterPanel.end')}
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="ml-2 border border-outline-variant bg-surface-container-lowest px-2 py-1 text-on-surface"
            />
          </label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => saveWeeklyMutation.mutate()}
          disabled={saveWeeklyMutation.isPending}
        >
          {t('masterPanel.saveAvailability')}
        </Button>
      </div>

      <div>
        <h3 className="mb-1 font-headline text-body-lg uppercase text-on-surface">{t('masterPanel.calendar')}</h3>
        <p className="mb-3 font-body text-[12px] text-on-surface-variant">{t('masterPanel.calendarHint')}</p>

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="border border-outline-variant p-1 text-on-surface-variant hover:border-primary hover:text-primary"
            onClick={() =>
              setCalMonth((m) => {
                const d = new Date(m.year, m.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>
          <span className="font-headline text-body-lg uppercase text-on-surface">
            {monthLabel(calMonth.year, calMonth.month, locale)}
          </span>
          <button
            type="button"
            className="border border-outline-variant p-1 text-on-surface-variant hover:border-primary hover:text-primary"
            onClick={() =>
              setCalMonth((m) => {
                const d = new Date(m.year, m.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center font-label text-[9px] uppercase text-on-surface-variant">
              {t(`masterPanel.day${d}`)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell) => {
            if (!cell.dateKey || cell.day == null) {
              return <div key={cell.key} className="aspect-square" />;
            }
            const status = dayStatus(cell.dateKey);
            const isPast = cell.dateKey < todayKey;
            return (
              <button
                key={cell.key}
                type="button"
                disabled={isPast || setDayMutation.isPending}
                onClick={() => handleDayClick(cell.dateKey!)}
                title={t(`masterPanel.dayStatus.${status}`)}
                className={cn(
                  'aspect-square border font-label text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  status === 'available' && 'border-primary/60 bg-primary/10 text-primary',
                  status === 'forced' && 'border-primary bg-primary text-on-primary',
                  status === 'closed' && 'border-error/50 bg-error/10 text-error line-through',
                  status === 'off' && 'border-outline-variant text-outline',
                  cell.dateKey === todayKey && 'ring-1 ring-primary',
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 font-label text-[9px] uppercase tracking-[0.1em] text-on-surface-variant">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-primary/60 bg-primary/10" /> {t('masterPanel.dayStatus.available')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-primary bg-primary" /> {t('masterPanel.dayStatus.forced')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-error/50 bg-error/10" /> {t('masterPanel.dayStatus.closed')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 border border-outline-variant" /> {t('masterPanel.dayStatus.off')}
          </span>
        </div>
      </div>
    </div>
  );
}
