import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import { bookingsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTimeLabel, formatPriceCents } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/types';

const STATUS_KEY: Record<BookingStatus, string> = {
  pending: 'account.statusPending',
  confirmed: 'account.statusConfirmed',
  cancelled: 'account.statusCancelled',
  completed: 'account.statusCompleted',
  no_show: 'account.statusNoShow',
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: 'text-primary border-primary',
  confirmed: 'text-primary border-primary',
  cancelled: 'text-error border-error',
  completed: 'text-on-surface-variant border-outline-variant',
  no_show: 'text-error border-error',
};

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'me'],
    queryFn: async () => {
      try {
        return await bookingsApi.mine();
      } catch {
        return [] as Booking[];
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      setCancellingId(null);
    },
    onError: () => setCancellingId(null),
  });

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const list = bookings ?? [];
    return {
      upcoming: list
        .filter((b) => new Date(b.startAt).getTime() >= now && b.status !== 'cancelled')
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
      past: list
        .filter((b) => new Date(b.startAt).getTime() < now || b.status === 'cancelled')
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    };
  }, [bookings]);

  return (
    <div className="container-page py-section-gap">
      <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <span className="eyebrow mb-3">{t('account.title')}</span>
          <h1 className="font-headline text-headline-lg uppercase text-on-surface">
            {t('account.welcome', { name: user?.name ?? '' })}
          </h1>
        </div>
        <Button as="link" to="/book" variant="urgent">
          {t('account.bookNew')}
        </Button>
      </div>

      {isLoading && <p className="font-body text-body-md text-on-surface-variant">{t('common.loading')}</p>}

      {!isLoading && (
        <div className="space-y-16">
          <section>
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('account.upcoming')}</h2>
            {upcoming.length === 0 ? (
              <EmptyState message={t('account.noUpcoming')} />
            ) : (
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                {upcoming.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    locale={locale}
                    onCancel={() => {
                      setCancellingId(booking.id);
                      cancelMutation.mutate(booking.id);
                    }}
                    cancelling={cancellingId === booking.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">{t('account.past')}</h2>
            {past.length === 0 ? (
              <EmptyState message={t('account.noPast')} />
            ) : (
              <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
                {past.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} locale={locale} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-outline-variant bg-surface-container-low p-8 text-center">
      <span className="material-symbols-outlined mb-3 block text-4xl text-outline">event_busy</span>
      <p className="font-body text-body-md text-on-surface-variant">{message}</p>
    </div>
  );
}

function BookingCard({
  booking,
  locale,
  onCancel,
  cancelling,
}: {
  booking: Booking;
  locale: string;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const { t } = useTranslation();
  const canCancel = onCancel && ['pending', 'confirmed'].includes(booking.status) && new Date(booking.cancellationDeadlineAt) > new Date();

  return (
    <div className="border-t-2 border-primary bg-surface-container-high p-6">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-label text-label-md text-on-surface-variant">
          {formatDateTimeLabel(booking.startAt, locale)}
        </span>
        <span className={`border px-2 py-1 font-label text-[10px] uppercase tracking-[0.1em] ${STATUS_COLOR[booking.status]}`}>
          {t(STATUS_KEY[booking.status])}
        </span>
      </div>

      {booking.master && (
        <p className="mb-2 font-body text-body-md text-on-surface">
          {t('account.with')} <span className="text-primary">{booking.master.name}</span>
        </p>
      )}

      <ul className="mb-4 space-y-1 font-body text-body-md text-on-surface-variant">
        {booking.services.map((s) => (
          <li key={s.serviceId}>{s.name}</li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-outline-variant pt-4">
        <span className="font-label text-label-md text-primary">{formatPriceCents(booking.totalPriceCents)}</span>
        {canCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={cancelling}>
            {cancelling ? '…' : t('account.cancelBooking')}
          </Button>
        )}
      </div>
    </div>
  );
}
