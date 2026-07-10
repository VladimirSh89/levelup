import { useTranslation } from 'react-i18next';
import Button from '@/components/Button';

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center text-center py-section-gap">
      <span className="font-headline text-display-lg-mobile text-primary md:text-display-lg">
        {t('notFound.title')}
      </span>
      <h1 className="mt-4 mb-8 font-headline text-headline-md uppercase text-on-surface-variant">
        {t('notFound.subtitle')}
      </h1>
      <Button as="link" to="/" variant="primary">
        {t('notFound.cta')}
      </Button>
    </div>
  );
}
