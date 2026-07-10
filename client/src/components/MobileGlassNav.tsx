import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { useAuth } from '@/lib/auth';
import { roleHome } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = {
  key: string;
  label: string;
  icon: string;
  iconFilled?: boolean;
  to?: string;
  hash?: string;
  match?: (path: string) => boolean;
};

export default function MobileGlassNav() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  // Hide on booking flow — StickyBookingBar owns the bottom
  if (location.pathname.startsWith('/book')) return null;
  // Admin has its own chrome
  if (location.pathname.startsWith('/admin')) return null;

  const accountTo = isAuthenticated && user ? roleHome(user.role) : '/login';
  const accountLabel = isAuthenticated
    ? user?.role === 'admin'
      ? t('nav.admin')
      : user?.role === 'master'
        ? t('nav.masterPanel')
        : t('nav.you')
    : t('nav.you');

  const tabs: Tab[] = [
    {
      key: 'home',
      label: t('nav.home'),
      icon: 'home',
      to: '/',
      match: (p) => p === '/',
    },
    {
      key: 'services',
      label: t('nav.services'),
      icon: 'content_cut',
      hash: '#services',
      match: () => isHome && location.hash === '#services',
    },
    {
      key: 'book',
      label: t('nav.book'),
      icon: 'calendar_month',
      to: '/book',
      match: (p) => p.startsWith('/book'),
    },
    {
      key: 'you',
      label: accountLabel,
      icon: isAuthenticated ? 'person' : 'login',
      to: accountTo,
      match: (p) =>
        p.startsWith('/account') ||
        p.startsWith('/login') ||
        p.startsWith('/register') ||
        p.startsWith('/master') ||
        (user?.role === 'admin' && p.startsWith('/admin')),
    },
  ];

  const goHash = (hash: string) => {
    if (isHome) {
      const el = document.querySelector(hash);
      el?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', hash);
      return;
    }
    navigate({ pathname: '/', hash: hash.replace(/^#/, '') });
  };

  return (
    <nav
      aria-label={t('nav.menu')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="liquid-glass pointer-events-auto flex w-full max-w-md items-stretch gap-0.5 rounded-full p-1.5">
        {tabs.map((tab) => {
          const active = tab.match?.(location.pathname) ?? false;
          const content = (
            <>
              {active && (
                <motion.span
                  layoutId="mobile-glass-pill"
                  className="absolute inset-0 rounded-full bg-primary/20 ring-1 ring-primary/40"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span
                className={cn(
                  'material-symbols-outlined relative z-10 text-[22px]',
                  active ? 'text-primary' : 'text-on-surface-variant',
                )}
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {tab.icon}
              </span>
              <span
                className={cn(
                  'relative z-10 max-w-full truncate font-label text-[9px] uppercase tracking-[0.12em]',
                  active ? 'text-primary' : 'text-on-surface-variant',
                )}
              >
                {tab.label}
              </span>
            </>
          );

          const className = cn(
            'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 transition-colors',
          );

          if (tab.hash) {
            return (
              <button
                key={tab.key}
                type="button"
                className={className}
                onClick={() => goHash(tab.hash!)}
                aria-current={active ? 'page' : undefined}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={tab.key}
              to={tab.to!}
              className={className}
              aria-current={active ? 'page' : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
