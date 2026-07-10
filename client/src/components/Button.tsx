import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'urgent' | 'ghost' | 'plain';
type Size = 'md' | 'lg' | 'sm';

const base =
  'inline-flex items-center justify-center gap-2 font-label text-label-caps uppercase tracking-[0.15em] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary border-2 border-primary hover:bg-primary-container hover:border-primary-fixed hover:shadow-glow',
  urgent:
    'bg-secondary-container text-on-secondary border border-secondary-container hover:bg-error hover:text-on-error hover:shadow-glow-red',
  ghost: 'border border-primary text-primary bg-transparent hover:bg-primary/10 hover:shadow-glow-sm',
  plain: 'text-on-surface-variant hover:text-primary',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-[11px]',
  md: 'px-6 py-3',
  lg: 'px-8 py-4',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
  className?: string;
}

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { as?: 'button' };
type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & { as: 'a' };
type ButtonAsLink = CommonProps & Omit<LinkProps, 'className'> & { as: 'link' };

type ButtonProps = ButtonAsButton | ButtonAsAnchor | ButtonAsLink;

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>((props, ref) => {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth,
    icon,
    iconPosition = 'right',
    className,
    children,
    as: _as,
    ...rest
  } = props as ButtonProps & Record<string, unknown>;

  const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);

  const content = (
    <>
      {icon && iconPosition === 'left' ? icon : null}
      {children}
      {icon && iconPosition === 'right' ? icon : null}
    </>
  );

  if (props.as === 'a') {
    const anchorRest = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a ref={ref as Ref<HTMLAnchorElement>} className={classes} {...anchorRest}>
        {content}
      </a>
    );
  }

  if (props.as === 'link') {
    const linkRest = rest as LinkProps;
    return (
      <Link ref={ref as Ref<HTMLAnchorElement>} className={classes} {...linkRest}>
        {content}
      </Link>
    );
  }

  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button ref={ref as Ref<HTMLButtonElement>} className={classes} type={buttonRest.type ?? 'button'} {...buttonRest}>
      {content}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
