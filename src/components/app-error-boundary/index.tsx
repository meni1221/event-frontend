import { Component, type ErrorInfo, type ReactNode } from 'react';
import { appLogger } from '../../utils/logger';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

const fallbackCopy = {
  en: {
    action: 'Reload the application',
    description: 'Your information is still saved. Reload the application to continue.',
    title: 'The application could not display this screen',
  },
  he: {
    action: 'טעינה מחדש של המערכת',
    description: 'המידע שלך עדיין שמור. יש לטעון את המערכת מחדש כדי להמשיך.',
    title: 'לא הצלחנו להציג את המסך',
  },
} as const;

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    appLogger.fatal('frontend.render', 'React render failed', {
      componentStack: info.componentStack ?? undefined,
      message: error.message,
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const locale = document.documentElement.lang === 'en' ? 'en' : 'he';
    const copy = fallbackCopy[locale];

    return (
      <main className="appErrorSurface" dir={locale === 'he' ? 'rtl' : 'ltr'}>
        <section className="appErrorCard" role="alert">
          <span className="appErrorMark" aria-hidden="true">!</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {copy.action}
          </button>
        </section>
      </main>
    );
  }
}
