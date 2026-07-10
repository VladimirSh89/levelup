import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import { masterPanelApi } from '@/lib/api';
import { formatDateTimeLabel, formatPriceCents } from '@/lib/utils';
import type { Booking } from '@/types';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export default function MasterPanel() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('18:30');
  const [selectedDays, setSelectedDays] = useState<number[]>([2, 3, 4, 5, 6]);

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

  const saveAvailability = useMutation({
    mutationFn: () =>
      masterPanelApi.putAvailability({
        rules: selectedDays.map((dayOfWeek) => ({
          dayOfWeek,
          startTime,
          endTime,
        })),
        overrides: [],
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master'] }),
  });

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

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  return (
    <div className="container-page py-section-gap">
      <div className="mb-12">
        <span className="eyebrow mb-3">{t('masterPanel.subtitle')}</span>
        <h1 className="font-headline text-headline-lg uppercase text-on-surface">{t('masterPanel.title')}</h1>
      </div>

      <section className="mb-16 border-t-2 border-primary bg-surface-container-high p-8">
        <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">
          {t('masterPanel.availability')}
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`border px-3 py-2 font-label text-label-caps uppercase ${
                selectedDays.includes(day)
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-outline-variant text-on-surface-variant'
              }`}
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
        <Button
          variant="primary"
          onClick={() => saveAvailability.mutate()}
          disabled={saveAvailability.isPending}
        >
          {t('masterPanel.saveAvailability')}
        </Button>
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
