import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
}

/**
 * Badge-style monogram: an angular hexagonal shield with an "L^" mark,
 * echoing the aviation-industrial brand language from DESIGN.md.
 */
export default function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-10 w-10', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Level Up Barbershop"
    >
      <path
        d="M32 2 L59 16 V48 L32 62 L5 48 V16 Z"
        fill="#1c1b1b"
        stroke="#f2ca50"
        strokeWidth="2"
      />
      <path d="M32 2 L59 16 L32 30 L5 16 Z" fill="#f2ca50" opacity="0.15" />
      <path
        d="M19 40V22h5.2v14.4H33V40H19Z"
        fill="#f2ca50"
      />
      <path
        d="M37 40l7.5-18h4.9L57 40h-5l-1.3-3.5h-7.4L42 40h-5Zm7.7-7.5h4.7l-2.35-6.5-2.35 6.5Z"
        fill="#e5e2e1"
      />
      <path d="M32 2 L59 16 V48 L32 62 L5 48 V16 Z" stroke="#4d4635" strokeOpacity="0.4" strokeWidth="0.5" />
    </svg>
  );
}
