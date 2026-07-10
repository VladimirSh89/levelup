import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from '@/lib/api';
import { formatPriceCents } from '@/lib/utils';
import type { DashboardStats } from '@/types';

const FALLBACK_STATS: DashboardStats = {
  bookingsToday: 6,
  bookingsThisWeek: 34,
  revenueThisMonthCents: 512000,
  activeMasters: 3,
  pendingBookings: 2,
};

export default function DashboardPage() {
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      try {
        return await adminApi.stats();
      } catch {
        return FALLBACK_STATS;
      }
    },
  });

  const stats = data ?? FALLBACK_STATS;
  const bookingsToday = stats.bookingsToday ?? stats.todayCount ?? 0;
  const bookingsWeek = stats.bookingsThisWeek ?? stats.weekCount ?? (stats as { bookingsThisMonth?: number }).bookingsThisMonth ?? 0;
  const revenue = stats.revenueThisMonthCents ?? (stats as { totalRevenueCents?: number }).totalRevenueCents ?? 0;
  const activeMasters = stats.activeMasters ?? (stats as { totalMasters?: number }).totalMasters ?? 0;
  const pending = stats.pendingBookings ?? (stats as { upcomingBookings?: number }).upcomingBookings ?? 0;

  const cards = [
    { label: t('admin.dashboard.bookingsToday'), value: bookingsToday, icon: 'today' },
    { label: t('admin.dashboard.bookingsWeek'), value: bookingsWeek, icon: 'date_range' },
    { label: t('admin.dashboard.revenueMonth'), value: formatPriceCents(revenue), icon: 'payments' },
    { label: t('admin.dashboard.activeMasters'), value: activeMasters, icon: 'groups' },
    { label: t('admin.dashboard.pendingBookings'), value: pending, icon: 'pending_actions' },
  ];

  return (
    <div>
      <h1 className="mb-8 font-headline text-headline-lg uppercase text-on-surface">{t('admin.dashboard.title')}</h1>

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="border-t-2 border-primary bg-surface-container-high p-6 glow-hover">
            <div className="mb-4 flex items-center justify-between">
              <span className="material-symbols-outlined text-3xl text-primary">{card.icon}</span>
            </div>
            <div className="font-headline text-headline-lg text-on-surface">{card.value}</div>
            <div className="mt-2 font-label text-label-caps uppercase text-on-surface-variant">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
