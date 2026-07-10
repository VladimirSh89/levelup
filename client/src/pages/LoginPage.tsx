import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import Button from '@/components/Button';
import FormField from '@/components/FormField';
import { useAuth } from '@/lib/auth';
import { roleHome, ApiRequestError } from '@/lib/api';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(from || roleHome(user.role), { state: from === '/book' ? { from } : undefined, replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 401 ? t('auth.errorInvalid') : t('auth.errorGeneric'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-section-gap">
      <div className="w-full max-w-md border-t-2 border-primary bg-surface-container-high p-8 md:p-10">
        <h1 className="mb-2 font-headline text-headline-lg uppercase text-on-surface">{t('auth.loginTitle')}</h1>
        <p className="mb-8 font-body text-body-md text-on-surface-variant">{t('auth.loginSubtitle')}</p>

        {from === '/book' && (
          <div className="mb-6 flex items-center gap-2 border border-outline-variant bg-surface-container-low p-3 font-body text-[13px] text-on-surface-variant">
            <span className="material-symbols-outlined text-primary text-[18px]">event_available</span>
            {t('booking.draftRestored')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <FormField label={t('auth.email')} name="email" type="email" value={email} onChange={setEmail} required />
          <FormField
            label={t('auth.password')}
            name="password"
            type="password"
            value={password}
            onChange={setPassword}
            required
          />

          {error && <p className="font-body text-[13px] text-error">{error}</p>}

          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </Button>
        </form>

        <p className="mt-8 text-center font-body text-body-md text-on-surface-variant">
          {t('auth.noAccount')}{' '}
          <Link to="/register" state={location.state} className="text-primary underline">
            {t('auth.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
