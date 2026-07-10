import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import { bookingsApi, mastersApi, shopApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDateTimeLabel, formatPriceCents } from '@/lib/utils';
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

const FALLBACK_PHONE = '(513) 668-3522';

function isActiveUpcoming(booking: Booking): boolean {
  return (
    ['pending', 'confirmed'].includes(booking.status) &&
    new Date(booking.startAt).getTime() >= Date.now()
  );
}

function canSelfServe(booking: Booking): boolean {
  if (!isActiveUpcoming(booking)) return false;
  const deadline = new Date(booking.cancellationDeadlineAt).getTime();
  return Number.isFinite(deadline) && deadline > Date.now();
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', 'me', locale],
    queryFn: async () => {
      try {
        return await bookingsApi.mine();
      } catch {
        return [] as Booking[];
      }
    },
  });

  const { data: shop } = useQuery({
    queryKey: ['shop-settings'],
    queryFn: () => shopApi.settings(),
    staleTime: 5 * 60 * 1000,
  });

  const contactPhone = shop?.contactPhone?.trim() || FALLBACK_PHONE;

  const serviceIds = useMemo(
    () => rescheduleBooking?.services.map((s) => s.serviceId) ?? [],
    [rescheduleBooking],
  );
  const masterId = rescheduleBooking?.master?.id;

  const { data: slots = [], isFetching: slotsLoading } = useQuery({
    queryKey: ['account', 'reschedule-slots', masterId, rescheduleDate, serviceIds],
    queryFn: () => mastersApi.slots(masterId!, rescheduleDate, serviceIds),
    enabled: Boolean(masterId && rescheduleDate && serviceIds.length),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      setBusyId(null);
      setActionError(null);
    },
    onError: (err: Error) => {
      setBusyId(null);
      setActionError(err.message || t('account.cancelFailed'));
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: (payload: { id: string; startAt: string }) =>
      bookingsApi.reschedule(payload.id, payload.startAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
      setRescheduleBooking(null);
      setRescheduleDate('');
      setRescheduleSlot('');
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message || t('account.modifyFailed'));
    },
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

  const handleCancel = (booking: Booking) => {
    if (!canSelfServe(booking)) return;
    if (!window.confirm(t('account.cancelConfirm'))) return;
    setBusyId(booking.id);
    setActionError(null);
    cancelMutation.mutate(booking.id);
  };

  const openReschedule = (booking: Booking) => {
    if (!canSelfServe(booking) || !booking.master?.id) return;
    setActionError(null);
    setRescheduleBooking(booking);
    setRescheduleDate(toDateKey(new Date(booking.startAt)));
    setRescheduleSlot('');
  };

  const submitReschedule = (e: FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !rescheduleSlot) return;
    rescheduleMutation.mutate({ id: rescheduleBooking.id, startAt: rescheduleSlot });
  };

  const todayKey = toDateKey(new Date());

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

      {actionError && (
        <p className="mb-6 border border-error/40 bg-error/10 px-4 py-3 font-body text-[13px] text-error">
          {actionError}
        </p>
      )}

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
                    contactPhone={contactPhone}
                    busy={busyId === booking.id}
                    onCancel={() => handleCancel(booking)}
                    onModify={() => openReschedule(booking)}
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
                  <BookingCard key={booking.id} booking={booking} locale={locale} contactPhone={contactPhone} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border-t-2 border-primary bg-surface-container-high p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-2 font-headline text-headline-md uppercase text-on-surface">
              {t('account.modifyTitle')}
            </h2>
            <p className="mb-6 font-body text-[13px] text-on-surface-variant">
              {rescheduleBooking.master?.name
                ? t('account.with') + ' ' + rescheduleBooking.master.name
                : t('account.modifyHint')}
            </p>

            <form onSubmit={submitReschedule} className="space-y-4">
              <label className="block">
                <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
                  {t('account.modifyDate')}
                </span>
                <input
                  type="date"
                  min={todayKey}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleSlot('');
                  }}
                  className="w-full border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-body-md text-on-surface outline-none focus:border-primary"
                  required
                />
              </label>

              <div>
                <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
                  {t('account.modifyTime')}
                </span>
                {!rescheduleDate ? (
                  <p className="border border-outline-variant px-4 py-3 font-body text-[13px] text-on-surface-variant">
                    {t('account.pickDateFirst')}
                  </p>
                ) : slotsLoading ? (
                  <p className="border border-outline-variant px-4 py-3 font-body text-[13px] text-on-surface-variant">
                    {t('common.loading')}
                  </p>
                ) : slots.length === 0 ? (
                  <p className="border border-outline-variant px-4 py-3 font-body text-[13px] text-on-surface-variant">
                    {t('account.noSlots')}
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
                          onClick={() => setRescheduleSlot(slot)}
                          className={cn(
                            'border px-3 py-1.5 font-label text-[11px] uppercase',
                            rescheduleSlot === slot
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

              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={!rescheduleSlot || rescheduleMutation.isPending}>
                  {rescheduleMutation.isPending ? '…' : t('account.modifySave')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setRescheduleBooking(null);
                    setActionError(null);
                  }}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
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
  contactPhone,
  onCancel,
  onModify,
  busy,
}: {
  booking: Booking;
  locale: string;
  contactPhone: string;
  onCancel?: () => void;
  onModify?: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation();
  const active = isActiveUpcoming(booking);
  const selfServe = active && canSelfServe(booking);
  const locked = active && !canSelfServe(booking);

  return (
    <div className="border-t-2 border-primary bg-surface-container-high p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
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

      <div className="border-t border-outline-variant pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-label text-label-md text-primary">{formatPriceCents(booking.totalPriceCents)}</span>
        </div>

        {selfServe && (
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={onModify} disabled={busy}>
              {t('account.modifyBooking')}
            </Button>
            <Button variant="plain" size="sm" className="text-error hover:text-error" onClick={onCancel} disabled={busy}>
              {busy ? '…' : t('account.cancelBooking')}
            </Button>
          </div>
        )}

        {locked && (
          <div className="border border-outline-variant bg-surface-container-low p-4">
            <p className="mb-2 font-body text-[13px] text-on-surface-variant">{t('account.cutoffMessage')}</p>
            <a
              href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-2 font-label text-label-md uppercase text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
              {contactPhone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
