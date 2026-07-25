import { Card, Center, DirectionProvider, MantineProvider, Stack, Text, createTheme } from '@mantine/core';
import { useEffect, useState } from 'react';
import { getPublicInvite, PublicInvite, readGoogleAuthCallback, SESSION_EXPIRED_EVENT } from '../api';
import { FeedbackProvider } from '../components/feedback';
import { AppProvider, useAppContext } from '../context/app';
import { getDefaultInvitationText } from '../data';
import { AuthPanel, ResetPasswordPanel } from '../pages/auth';
import { GuestPanel } from '../pages/guest';
import { useComponentLogger } from '../utils/component-logger';
import { getFriendlyErrorMessage } from '../utils/error-message';
import { Dashboard } from './dashboard';

const theme = createTheme({
  primaryColor: 'ishruGreen',
  colors: {
    ishruGreen: [
      '#ecfff6',
      '#d7ffea',
      '#aaffd2',
      '#78f2b6',
      '#4fe09c',
      '#35d18b',
      '#22c57c',
      '#16a667',
      '#0c8553',
      '#056b42',
    ],
  },
  radius: {
    sm: '8px',
  },
});

const getInviteRoute = (pathname: string) => {
  const parts = pathname.split('/').filter(Boolean);

  if (parts[0] !== 'invite') {
    return null;
  }

  if (parts.length >= 3) {
    return {
      eventId: parts[1],
      inviteId: parts[2],
    };
  }

  return {
    eventId: undefined,
    inviteId: parts[1] ?? '',
  };
};

const AppContent = () => {
  useComponentLogger('App');
  const {
    activeTab,
    dashboardState,
    dir,
    labels,
    locale,
    logout,
    setActiveTab,
    toggleLocale,
  } = useAppContext();
  const [publicInvite, setPublicInvite] = useState<PublicInvite | null>(null);
  const [publicInviteError, setPublicInviteError] = useState<string | null>(null);
  const [publicInviteLoading, setPublicInviteLoading] = useState(false);
  const inviteRoute = getInviteRoute(window.location.pathname);
  const isGoogleAuthCallback = window.location.pathname === '/auth/google/callback';
  const resetToken = window.location.pathname === '/reset-password'
    ? new URLSearchParams(window.location.search).get('token') ?? ''
    : '';
  const [googleAuthMessage, setGoogleAuthMessage] = useState<string | null>(null);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [dir, locale]);

  useEffect(() => {
    if (!inviteRoute?.inviteId) {
      setPublicInvite(null);
      setPublicInviteError(null);
      return;
    }

    setPublicInviteLoading(true);
    void getPublicInvite(inviteRoute.inviteId, inviteRoute.eventId)
      .then((invite) => {
        setPublicInvite(invite);
        setPublicInviteError(null);
      })
      .catch((cause) => {
        setPublicInvite(null);
        setPublicInviteError(getFriendlyErrorMessage(cause, labels));
      })
      .finally(() => setPublicInviteLoading(false));
  }, [inviteRoute?.eventId, inviteRoute?.inviteId, labels]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setSessionExpired(true);
      logout();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [logout]);

  useEffect(() => {
    if (!isGoogleAuthCallback || googleAuthMessage || googleAuthError) {
      return;
    }

    try {
      const result = readGoogleAuthCallback();
      if ('pendingApproval' in result) {
        setGoogleAuthMessage(labels.pendingApprovalMessage);
        window.history.replaceState({}, '', '/auth/google/callback');
        return;
      }

      window.history.replaceState({}, '', '/dashboard/events');
      dashboardState.handleAuthenticated(result);
    } catch (cause) {
      setGoogleAuthError(getFriendlyErrorMessage(cause, labels));
      window.history.replaceState({}, '', '/');
    }
  }, [dashboardState, googleAuthError, googleAuthMessage, isGoogleAuthCallback, labels]);

  return (
    <DirectionProvider key={dir} initialDirection={dir} detectDirection={false}>
      <MantineProvider defaultColorScheme="light" theme={theme}>
        <FeedbackProvider>
          {isGoogleAuthCallback && (googleAuthMessage || googleAuthError) ? (
            <Center className="authSurface" mih="100vh" p="md">
              <Card className="authCard" withBorder radius="sm" p="xl" w="min(100%, 460px)">
                <Stack gap="sm">
                  <Text fw={900}>{googleAuthError ? labels.googleSignInFailed : labels.pendingApproval}</Text>
                  <Text c={googleAuthError ? 'red' : 'dimmed'}>{googleAuthError ?? googleAuthMessage}</Text>
                </Stack>
              </Card>
            </Center>
          ) : resetToken ? (
            <ResetPasswordPanel labels={labels} token={resetToken} onAuthenticated={dashboardState.handleAuthenticated} />
          ) : inviteRoute?.inviteId ? (
            <GuestPanel
              event={publicInvite?.event}
              guest={publicInvite?.guest}
              invitationText={publicInvite ? getDefaultInvitationText(publicInvite.event.theme, 'classic', publicInvite.event) : ''}
              invitationTitle={publicInvite?.event.eventName ?? labels.guestExperience}
              labels={labels}
              loading={publicInviteLoading}
              loadError={publicInviteError}
              locale={locale}
              publicEventId={inviteRoute.eventId}
            />
          ) : !dashboardState.session ? (
            <AuthPanel
              labels={labels}
              onAuthenticated={(session) => {
                setSessionExpired(false);
                dashboardState.handleAuthenticated(session);
              }}
              sessionExpired={sessionExpired}
            />
          ) : (
            <Dashboard
              activeTab={activeTab}
              labels={labels}
              locale={locale}
              onLocaleToggle={toggleLocale}
              onLogout={logout}
              onTabChange={setActiveTab}
              state={dashboardState}
            />
          )}
        </FeedbackProvider>
      </MantineProvider>
    </DirectionProvider>
  );
};

export const App = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);
