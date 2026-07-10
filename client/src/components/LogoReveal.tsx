import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Logo from '@/components/Logo';
import { prefersReducedMotion } from '@/lib/utils';

const SEEN_KEY = 'levelup.introSeen';
const REVEAL_MS = 800;

export default function LogoReveal() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.sessionStorage.getItem(SEEN_KEY);
  });

  useEffect(() => {
    if (!visible) return;

    window.sessionStorage.setItem(SEEN_KEY, '1');

    const reduced = prefersReducedMotion();
    const timeout = window.setTimeout(() => setVisible(false), reduced ? 150 : REVEAL_MS);
    return () => window.clearTimeout(timeout);
  }, [visible]);

  const reduced = prefersReducedMotion();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-surface"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.4, ease: 'easeInOut' }}
        >
          <motion.div
            initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <Logo className="h-24 w-16" animate />
            <span className="font-headline text-headline-md text-primary tracking-[0.2em]">LEVEL UP</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
