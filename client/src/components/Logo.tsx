import { useId } from 'react';
import { cn, prefersReducedMotion } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Spin the pole stripes (default true; respects prefers-reduced-motion) */
  animate?: boolean;
}

/**
 * Classic barber pole mark — red & blue helical stripes on a chrome cylinder.
 * Replaces the old LA monogram; used in nav, footer, and intro reveal.
 */
export default function Logo({ className, animate = true }: LogoProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `pole-body-${uid}`;
  const shineId = `pole-shine-${uid}`;
  const reduced = typeof window !== 'undefined' && prefersReducedMotion();
  const shouldAnimate = animate && !reduced;

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden', className)}
      role="img"
      aria-label="Level Up Barbershop"
    >
      <svg viewBox="0 0 48 64" className="h-full w-full overflow-hidden" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id={clipId}>
            <rect x="14" y="12" width="20" height="40" />
          </clipPath>
          <linearGradient id={shineId} x1="14" y1="0" x2="34" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
            <stop offset="35%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Cylinder body — stripes clipped; animate via SVG so clipPath stays valid */}
        <g clipPath={`url(#${clipId})`}>
          <rect x="14" y="12" width="20" height="40" fill="#f5f5f5" />
          <g>
            {shouldAnimate && (
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="0 28"
                dur="2.4s"
                repeatCount="indefinite"
              />
            )}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
              const y = -24 + i * 14;
              const color = i % 2 === 0 ? '#ce0301' : '#1e3a8a';
              return (
                <path
                  key={i}
                  d={`M14 ${y + 18} L34 ${y} L34 ${y + 8} L14 ${y + 26} Z`}
                  fill={color}
                />
              );
            })}
          </g>
          <rect x="14" y="12" width="20" height="40" fill={`url(#${shineId})`} />
        </g>

        {/* Outline */}
        <rect x="14" y="12" width="20" height="40" stroke="#f2ca50" strokeWidth="1.5" fill="none" />

        {/* Caps drawn last so they always cover any stripe bleed */}
        <ellipse cx="24" cy="7" rx="11" ry="4.5" fill="#e5e2e1" />
        <rect x="13" y="7" width="22" height="5" fill="#c7c6c6" />
        <ellipse cx="24" cy="12" rx="11" ry="3.5" fill="#f2ca50" />

        <ellipse cx="24" cy="52" rx="11" ry="3.5" fill="#f2ca50" />
        <rect x="13" y="52" width="22" height="5" fill="#c7c6c6" />
        <ellipse cx="24" cy="57" rx="11" ry="4" fill="#e5e2e1" />
      </svg>
    </span>
  );
}
