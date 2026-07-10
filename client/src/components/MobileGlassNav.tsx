import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';

import { useAuth } from '@/lib/auth';
import { roleHome } from '@/lib/api';
import { cn } from '@/lib/utils';

function sectionFromHash(hash: string): string {
  return hash.replace(/^#/, '').trim();
}

export default function MobileGlassNav() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isBooking = location.pathname.startsWith('/book');
  const routeSection = sectionFromHash(location.hash);
  const [pendingSection, setPendingSection] = useState<string | null>(null);

  useEffect(() => {
    setPendingSection(null);
  }, [location.pathname, location.hash]);

  if (location.pathname.startsWith('/admin')) return null;

  const activeSection = pendingSection ?? routeSection;

  const accountTo = isAuthenticated && user ? roleHome(user.role) : '/login';
  const accountLabel = isAuthenticated
    ? user?.role === 'admin'
      ? t('nav.admin')
      : user?.role === 'master'
        ? t('nav.masterPanel')
        : t('nav.you')
    : t('nav.you');

  const goHome = () => {
    setPendingSection(null);
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goHash = (hash: string) => {
    const section = sectionFromHash(hash);
    setPendingSection(section);
    if (isHome) {
      document.querySelector(`#${section}`)?.scrollIntoView({ behavior: 'smooth' });
      navigate(`/#${section}`, { replace: true });
      return;
    }
    navigate(`/#${section}`);
  };

  // Booking flow: the sticky booking bar owns the bottom edge (incl. a Home
  // button), so the floating nav is hidden here to avoid a see-through gap.
  if (isBooking) return null;

  const tabs = [
    {
      key: 'home',
      label: t('nav.home'),
      icon: 'home',
      active: isHome && !activeSection,
      onClick: goHome,
    },
    {
      key: 'services',
      label: t('nav.services'),
      icon: 'content_cut',
      active: isHome && activeSection === 'services',
      onClick: () => goHash('services'),
    },
    {
      key: 'book',
      label: t('nav.book'),
      icon: 'calendar_month',
      active: false,
      to: '/book',
    },
    {
      key: 'you',
      label: accountLabel,
      icon: isAuthenticated ? 'person' : 'login',
      active:
        location.pathname.startsWith('/account') ||
        location.pathname.startsWith('/login') ||
        location.pathname.startsWith('/register') ||
        location.pathname.startsWith('/master'),
      to: accountTo,
    },
  ] as const;

  return (
    <nav
      aria-label={t('nav.menu')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key="expanded"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="liquid-glass pointer-events-auto flex w-full max-w-md items-stretch gap-0.5 rounded-full p-1.5"
        >
          {tabs.map((tab) => {
            const active = tab.active;
            const inner = (
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

            const className =
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 transition-colors';

            if ('onClick' in tab && tab.onClick) {
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={className}
                  onClick={tab.onClick}
                  aria-current={active ? 'page' : undefined}
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={tab.key}
                to={'to' in tab ? tab.to! : '/'}
                className={className}
                aria-current={active ? 'page' : undefined}
              >
                {inner}
              </Link>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </nav>
  );
}
