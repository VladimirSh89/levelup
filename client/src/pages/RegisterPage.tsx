import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import { useAuth } from '@/lib/auth';
import { roleHome, ApiRequestError } from '@/lib/api';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMatch'));
      return;
    }

    setLoading(true);
    try {
      const user = await register({
        name,
        email,
        password,
        phone: phone || undefined,
        preferredLocale: i18n.language?.startsWith('ru') ? 'ru' : 'en',
      });
      navigate(from || roleHome(user.role), { state: from === '/book' ? { from } : undefined, replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('auth.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-section-gap">
      <div className="w-full max-w-md border-t-2 border-primary bg-surface-container-high p-8 md:p-10">
        <h1 className="mb-2 font-headline text-headline-lg uppercase text-on-surface">{t('auth.registerTitle')}</h1>
        <p className="mb-8 font-body text-body-md text-on-surface-variant">{t('auth.registerSubtitle')}</p>

        {from === '/book' && (
          <div className="mb-6 flex items-center gap-2 border border-outline-variant bg-surface-container-low p-3 font-body text-[13px] text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-[18px]">event_available</span>
            {t('booking.draftRestored')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormField label={t('auth.name')} name="name" value={name} onChange={setName} required autoComplete="name" />
          <FormField label={t('auth.email')} name="email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
          <FormField label={`${t('auth.phone')} (${t('common.optional')})`} name="phone" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
          <FormField
            label={t('auth.password')}
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="new-password"
          />
          <FormField
            label={t('auth.confirmPassword')}
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            autoComplete="new-password"
          />

          {error && <p className="font-body text-[13px] text-error">{error}</p>}

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? t('auth.registering') : t('auth.registerButton')}
          </Button>
        </form>

        <p className="mt-8 text-center font-body text-body-md text-on-surface-variant">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" state={location.state} className="text-primary underline">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
