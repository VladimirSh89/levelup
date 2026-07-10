import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Logo from '@/components/Logo';
import LanguageSwitch from '@/components/LanguageSwitch';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/admin/dashboard', icon: 'space_dashboard', key: 'dashboard' },
  { to: '/admin/masters', icon: 'groups', key: 'masters' },
  { to: '/admin/services', icon: 'content_cut', key: 'services' },
  { to: '/admin/bookings', icon: 'event_note', key: 'bookings' },
  { to: '/admin/settings', icon: 'settings', key: 'settings' },
] as const;

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 flex-none border-r border-outline-variant bg-surface-container-lowest transition-transform duration-300 md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b border-outline-variant px-6">
          <Logo className="h-9 w-9" />
          <span className="font-headline text-headline-md uppercase text-primary">{t('common.brand')}</span>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 font-label text-label-caps uppercase transition-all duration-300',
                  isActive
                    ? 'border-l-2 border-primary bg-primary/10 text-primary'
                    : 'border-l-2 border-transparent text-on-surface-variant hover:bg-primary/5 hover:text-primary',
                )
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {t(`admin.nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-outline-variant p-4">
          <div className="mb-3 truncate font-body text-body-md text-on-surface-variant">{user?.name}</div>
          <div className="flex items-center justify-between">
            <LanguageSwitch />
            <button
              type="button"
              onClick={logout}
              className="font-label text-label-caps uppercase text-on-surface-variant transition-colors hover:text-primary"
            >
              {t('common.logout')}
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 md:ml-0">
        <header className="flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-6 md:hidden">
          <span className="font-headline text-headline-md uppercase text-primary">{t('common.brand')}</span>
          <button type="button" onClick={() => setMobileOpen((o) => !o)} className="text-primary">
            <span className="material-symbols-outlined text-[28px]">{mobileOpen ? 'close' : 'menu'}</span>
          </button>
        </header>

        <main className="p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
