import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
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

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingsPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'en';
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<Booking | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus>('confirmed');
  const [editStartAt, setEditStartAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });

  const { data, isLoading } = useQuery({
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

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; status: BookingStatus; startAt: string }) =>
      adminApi.bookings.update(payload.id, {
        status: payload.status,
        startAt: new Date(payload.startAt).toISOString(),
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => adminApi.bookings.remove(id),
    onSuccess: () => {
      invalidate();
      if (editing) setEditing(null);
    },
  });

  const bookings = data ?? [];

  const openEdit = (booking: Booking) => {
    setEditing(booking);
    setEditStatus(booking.status);
    setEditStartAt(toDatetimeLocalValue(booking.startAt));
    setError(null);
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editStartAt) return;
    updateMutation.mutate({ id: editing.id, status: editStatus, startAt: editStartAt });
  };

  const handleDelete = (booking: Booking) => {
    const label = booking.client?.name ?? booking.id;
    if (!window.confirm(t('admin.bookings.deleteConfirm', { name: label }))) return;
    removeMutation.mutate(booking.id);
  };

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

      {isLoading ? (
        <p className="font-body text-body-md text-on-surface-variant">{t('common.loading')}</p>
      ) : bookings.length === 0 ? (
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
                <th className="px-4 py-3">{t('admin.bookings.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-t border-outline-variant font-body text-body-md text-on-surface">
                  <td className="px-4 py-3">
                    <div>{booking.client?.name ?? '—'}</div>
                    {booking.client?.phone && (
                      <div className="font-label text-[11px] text-on-surface-variant">{booking.client.phone}</div>
                    )}
                  </td>
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
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(booking)}
                        className="font-label text-[11px] uppercase text-primary hover:underline"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(booking)}
                        disabled={removeMutation.isPending}
                        className="font-label text-[11px] uppercase text-error hover:underline"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border-t-2 border-primary bg-surface-container-high p-8">
            <h2 className="mb-6 font-headline text-headline-md uppercase text-on-surface">
              {t('admin.bookings.edit')}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <p className="font-body text-body-md text-on-surface">
                {editing.client?.name ?? '—'}
                {editing.master?.name ? ` · ${editing.master.name}` : ''}
              </p>

              <label className="block">
                <span className="mb-2 block font-label text-label-caps uppercase text-on-surface-variant">
                  {t('admin.bookings.status')}
                </span>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as BookingStatus)}
                  className="w-full border border-outline-variant bg-surface-container-low px-4 py-3 font-body text-body-md text-on-surface outline-none focus:border-primary"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {t(STATUS_KEY[status])}
                    </option>
                  ))}
                </select>
              </label>

              <FormField
                label={t('admin.bookings.dateTime')}
                name="startAt"
                type="datetime-local"
                value={editStartAt}
                onChange={setEditStartAt}
                required
              />

              {error && <p className="font-body text-[13px] text-error">{error}</p>}

              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? '…' : t('common.save')}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
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
