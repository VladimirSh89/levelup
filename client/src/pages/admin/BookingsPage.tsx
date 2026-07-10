import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '@/lib/api';
import { cn, formatDateTimeLabel, formatPriceCents } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/types';

const STATUS_OPTIONS: BookingStatus[] = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];

const STATUS_KEY: Record<BookingStatus, string> = {
  pending: 'account.statusPending',
  confirmed: 'account.statusConfirmed',
  cancelled: 'account.statusCancelled',
  completed: 'account.statusCompleted',
  no_show: 'account.statusNoShow',
};

export default function BookingsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data } = useQuery({
    queryKey: ['admin', 'bookings', statusFilter],
    queryFn: async () => {
      try {
        return await adminApi.bookings.list(
          statusFilter === 'all' ? undefined : { status: statusFilter },
        );
      } catch {
        return [] as Booking[];
      }
    },
  });

  const bookings = data ?? [];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-headline text-headline-lg uppercase text-on-surface">{t('admin.bookings.title')}</h1>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-outline-variant bg-surface-container-low px-4 py-2 font-label text-label-caps uppercase text-on-surface outline-none focus:border-primary"
        >
          <option value="all">{t('admin.bookings.filterAll')}</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {t(STATUS_KEY[status])}
            </option>
          ))}
        </select>
      </div>

      {bookings.length === 0 ? (
        <div className="border border-outline-variant bg-surface-container-low p-8 text-center font-body text-body-md text-on-surface-variant">
          {t('admin.bookings.empty')}
        </div>
      ) : (
        <div className="overflow-x-auto border border-outline-variant">
          <table className="w-full text-left">
            <thead className="bg-surface-container-lowest">
              <tr className="font-label text-label-caps uppercase text-on-surface-variant">
                <th className="px-4 py-3">{t('admin.bookings.client')}</th>
                <th className="px-4 py-3">{t('admin.bookings.master')}</th>
                <th className="px-4 py-3">{t('admin.bookings.dateTime')}</th>
                <th className="px-4 py-3">{t('admin.bookings.total')}</th>
                <th className="px-4 py-3">{t('admin.bookings.status')}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-t border-outline-variant font-body text-body-md text-on-surface">
                  <td className="px-4 py-3">{booking.client?.name ?? '—'}</td>
                  <td className="px-4 py-3">{booking.master?.name ?? t('master.any')}</td>
                  <td className="px-4 py-3">{formatDateTimeLabel(booking.startAt, locale)}</td>
                  <td className="px-4 py-3 font-label text-primary">{formatPriceCents(booking.totalPriceCents)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'border px-2 py-1 font-label text-[11px] uppercase',
                        booking.status === 'cancelled' || booking.status === 'no_show'
                          ? 'border-error text-error'
                          : 'border-primary text-primary',
                      )}
                    >
                      {t(STATUS_KEY[booking.status])}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
