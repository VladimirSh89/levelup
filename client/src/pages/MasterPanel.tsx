import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import { masterPanelApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDateTimeLabel, formatPriceCents, formatDuration } from '@/lib/utils';
import type { Booking, Service } from '@/types';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

type DayOverride = { date: string; type: string; startTime?: string | null; endTime?: string | null };

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

export default function MasterPanel() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
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

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [manualServiceIds, setManualServiceIds] = useState<string[]>([]);
  const [manualDate, setManualDate] = useState('');
  const [manualSlot, setManualSlot] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState(false);

  const { data: availability } = useQuery({
    queryKey: ['master', 'availability'],
    queryFn: () => masterPanelApi.getAvailability(),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['master', 'services'],
    queryFn: () => masterPanelApi.services(),
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['master', 'bookings'],
    queryFn: async () => {
      try {
        return await masterPanelApi.bookings();
      } catch {
        return [] as Booking[];
      }
    },
  });

  const { data: slots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ['master', 'slots', manualDate, manualServiceIds],
    queryFn: () => masterPanelApi.slots(manualDate, manualServiceIds),
    enabled: Boolean(manualDate && manualServiceIds.length > 0),
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

  useEffect(() => {
    setManualSlot('');
  }, [manualDate, manualServiceIds]);

  const saveWeekly = useMutation({
    mutationFn: () =>
      masterPanelApi.putAvailability({
        rules: selectedDays.map((dayOfWeek) => ({ dayOfWeek, startTime, endTime })),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master', 'availability'] }),
  });

  const setDay = useMutation({
    mutationFn: (payload: { date: string; action: 'closed' | 'open' | 'clear' }) =>
      masterPanelApi.setDayAvailability({
        ...payload,
        startTime,
        endTime,
      }),
    onSuccess: (data) => {
      setOverrides(data.overrides);
      queryClient.invalidateQueries({ queryKey: ['master', 'availability'] });
    },
  });

  const createManual = useMutation({
    mutationFn: () =>
      masterPanelApi.createBooking({
        clientName,
        clientPhone,
        clientEmail: clientEmail || undefined,
        serviceIds: manualServiceIds,
        startAt: manualSlot,
      }),
    onSuccess: () => {
      setManualSuccess(true);
      setManualError(null);
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setManualServiceIds([]);
      setManualDate('');
      setManualSlot('');
      queryClient.invalidateQueries({ queryKey: ['master', 'bookings'] });
      queryClient.invalidateQueries({ queryKey: ['master', 'slots'] });
    },
    onError: (err: Error) => {
      setManualSuccess(false);
      setManualError(err.message || t('masterPanel.manualFailed'));
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

  const { today, upcoming } = useMemo(() => {
    const list = bookings ?? [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const relevant = list
      .filter((b) => b.status !== 'cancelled')
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return {
      today: relevant.filter((b) => {
        const d = new Date(b.startAt);
        return d >= startOfToday && d < endOfToday;
      }),
      upcoming: relevant.filter((b) => new Date(b.startAt) >= endOfToday),
    };
  }, [bookings]);

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
    if (status === 'closed') {
      setDay.mutate({ date: dateKey, action: 'clear' });
    } else if (status === 'forced') {
      setDay.mutate({ date: dateKey, action: 'clear' });
    } else if (status === 'available') {
      setDay.mutate({ date: dateKey, action: 'closed' });
    } else {
      setDay.mutate({ date: dateKey, action: 'open' });
    }
  };

  const toggleManualService = (id: string) => {
    setManualServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    setManualSuccess(false);
    setManualError(null);
    if (!clientName.trim() || !clientPhone.trim() || !manualServiceIds.length || !manualSlot) {
      setManualError(t('masterPanel.manualIncomplete'));
      return;
    }
    createManual.mutate();
  };

  const todayKey = toDateKey(new Date());

  return (
    <div className="container-page py-section-gap">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow mb-3">{t('masterPanel.subtitle')}</span>
          <h1 className="font-headline text-headline-lg uppercase text-on-surface">{t('masterPanel.title')}</h1>
        </div>
        {user?.isOwner && (
          <Button as="link" to="/master/team" variant="ghost" size="sm">
            {t('masterPanel.teamTitle')}
            <span className="material-symbols-outlined text-[18px]">group</span>
          </Button>
        )}
      </div>

      {/* Weekly hours */}
      <section className="mb-12 border-t-2 border-primary bg-surface-container-high p-8">
        <h2 className="mb-2 font-headline text-headline-md uppercase text-on-surface">
          {t('masterPanel.availability')}
        </h2>
        <p className="mb-6 font-body text-[13px] text-on-surface-variant">{t('masterPanel.availabilityHint')}</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekday(day)}
              className={cn(
                'border px-3 py-2 font-label text-label-caps uppercase',
                selectedDays.includes(day)
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant text-on-surface-variant',
              )}
            >
              {t(`masterPanel.day${day}`)}
            </button>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-4">
          <label className="font-label text-label-md text-on-surface-variant">
            {t('masterPanel.start')}
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="ml-2 border border-outline-variant bg-surface-container-lowest px-2 py-1 text-on-surface"
            />
          </label>
          <label className="font-label text-label-md text-on-surface-variant">
            {t('masterPanel.end')}
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="ml-2 border border-outline-variant bg-surface-container-lowest px-2 py-1 text-on-surface"
            />
          </label>
        </div>
        <Button variant="primary" onClick={() => saveWeekly.mutate()} disabled={saveWeekly.isPending}>
          {t('masterPanel.saveAvailability')}
        </Button>
      </section>

      {/* Calendar day overrides */}
      <section className="mb-12 border-t-2 border-primary bg-surface-container-high p-8">
        <h2 className="mb-2 font-headline text-headline-md uppercase text-on-surface">
          {t('masterPanel.calendar')}
        </h2>
        <p className="mb-6 font-body text-[13px] text-on-surface-variant">{t('masterPanel.calendarHint')}</p>

        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCalMonth((m) => {
                const d = new Date(m.year, m.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </Button>
          <span className="font-headline text-headline-md uppercase text-on-surface">
            {monthLabel(calMonth.year, calMonth.month, locale)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setCalMonth((m) => {
                const d = new Date(m.year, m.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })
            }
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </Button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center font-label text-[10px] uppercase text-on-surface-variant">
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
                disabled={isPast || setDay.isPending}
                onClick={() => handleDayClick(cell.dateKey!)}
                title={t(`masterPanel.dayStatus.${status}`)}
                className={cn(
                  'aspect-square border font-label text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
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

        <div className="mt-4 flex flex-wrap gap-4 font-label text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border border-primary/60 bg-primary/10" /> {t('masterPanel.dayStatus.available')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border border-primary bg-primary" /> {t('masterPanel.dayStatus.forced')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border border-error/50 bg-error/10" /> {t('masterPanel.dayStatus.closed')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 border border-outline-variant" /> {t('masterPanel.dayStatus.off')}
          </span>
        </div>
      </section>

      {/* Manual booking */}
      <section className="mb-16 border-t-2 border-primary bg-surface-container-high p-8">
        <h2 className="mb-2 font-headline text-headline-md uppercase text-on-surface">
          {t('masterPanel.manualTitle')}
        </h2>
        <p className="mb-6 font-body text-[13px] text-on-surface-variant">{t('masterPanel.manualHint')}</p>

        <form onSubmit={submitManual} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('masterPanel.clientName')}
              name="clientName"
              value={clientName}
              onChange={setClientName}
              required
            />
            <FormField
              label={t('masterPanel.clientPhone')}
              name="clientPhone"
              value={clientPhone}
              onChange={setClientPhone}
              required
            />
          </div>
          <FormField
            label={t('masterPanel.clientEmail')}
            name="clientEmail"
            type="email"
            value={clientEmail}
            onChange={setClientEmail}
            placeholder={t('masterPanel.clientEmailOptional')}
          />

          <div>
            <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
              {t('masterPanel.manualServices')}
            </span>
            {services.length === 0 ? (
              <p className="font-body text-[13px] text-on-surface-variant">{t('masterPanel.noServices')}</p>
            ) : (
              <div className="space-y-1 border border-outline-variant bg-surface-container-low p-2">
                {services.map((service: Service) => {
                  const checked = manualServiceIds.includes(service.id);
                  const name = locale === 'ru' ? service.nameRu || service.name : service.nameEn || service.name;
                  return (
                    <label
                      key={service.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2',
                        checked ? 'bg-primary/10' : 'hover:bg-primary/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleManualService(service.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="flex-1 font-body text-body-md text-on-surface">{name}</span>
                      <span className="font-label text-[11px] text-primary">
                        {formatPriceCents(service.priceCents ?? service.basePriceCents)} ·{' '}
                        {formatDuration(service.durationMinutes ?? service.baseDurationMinutes, t('common.min'))}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
                {t('masterPanel.manualDate')}
              </span>
              <input
                type="date"
                value={manualDate}
                min={todayKey}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-body-md text-on-surface outline-none focus:border-primary"
              />
            </label>
            <div>
              <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
                {t('masterPanel.manualTime')}
              </span>
              {!manualDate || !manualServiceIds.length ? (
                <p className="border border-outline-variant px-4 py-3 font-body text-[13px] text-on-surface-variant">
                  {t('masterPanel.pickDateServicesFirst')}
                </p>
              ) : slotsLoading ? (
                <p className="border border-outline-variant px-4 py-3 font-body text-[13px] text-on-surface-variant">
                  {t('common.loading')}
                </p>
              ) : slots.length === 0 ? (
                <p className="border border-outline-variant px-4 py-3 font-body text-[13px] text-on-surface-variant">
                  {t('masterPanel.noSlots')}
                </p>
              ) : (
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto border border-outline-variant p-2">
                  {slots.map((slot) => {
                    const label = new Date(slot).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    });
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setManualSlot(slot)}
                        className={cn(
                          'border px-3 py-1.5 font-label text-[11px] uppercase',
                          manualSlot === slot
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant text-on-surface-variant hover:border-primary',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {manualError && <p className="font-body text-[13px] text-error">{manualError}</p>}
          {manualSuccess && <p className="font-body text-[13px] text-primary">{t('masterPanel.manualSuccess')}</p>}

          <Button type="submit" variant="primary" disabled={createManual.isPending}>
            {createManual.isPending ? '…' : t('masterPanel.manualSubmit')}
          </Button>
        </form>
      </section>

      {isLoading && <p className="font-body text-body-md text-on-surface-variant">{t('common.loading')}</p>}

      {!isLoading && (
        <div className="space-y-16">
          <section>
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('masterPanel.today')}</h2>
            {today.length === 0 ? (
              <EmptyState message={t('masterPanel.noBookings')} />
            ) : (
              <div className="space-y-3">
                {today.map((b) => (
                  <MasterBookingRow key={b.id} booking={b} locale={locale} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('masterPanel.upcoming')}</h2>
            {upcoming.length === 0 ? (
              <EmptyState message={t('masterPanel.noBookings')} />
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => (
                  <MasterBookingRow key={b.id} booking={b} locale={locale} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function MasterBookingRow({ booking, locale }: { booking: Booking; locale: string }) {
  return (
    <div className="flex flex-col gap-2 border border-outline-variant bg-surface-container-high p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-label text-label-md text-primary">
          {formatDateTimeLabel(booking.startAt, locale)}
        </p>
        <p className="font-body text-body-md text-on-surface">
          {booking.client?.name ?? booking.services.map((s) => s.name).join(', ')}
        </p>
        {booking.client?.phone && (
          <p className="font-label text-[11px] text-on-surface-variant">{booking.client.phone}</p>
        )}
        <p className="font-label text-label-caps uppercase text-on-surface-variant">{booking.status}</p>
      </div>
      <p className="font-label text-label-md text-primary">{formatPriceCents(booking.totalPriceCents)}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="border border-dashed border-outline-variant p-8 font-body text-body-md text-on-surface-variant">
      {message}
    </p>
  );
}
