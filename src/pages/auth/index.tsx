import { Alert, Box, Button, Card, Center, Group, PasswordInput, SegmentedControl, Stack, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { useState } from 'react';
import { IconBrandGoogle, IconLock, IconMail } from '@tabler/icons-react';
import { AuthSession, forgotPassword, login, register, resetPassword, startGoogleAuth } from '../../api';
import { BrandLogo } from '../../components/brand-logo';
import { useFeedback } from '../../components/feedback';
import { PasswordStrengthMeter } from '../../components/password-strength-meter';
import { uiConfig } from '../../config';
import { useComponentLogger } from '../../utils/component-logger';
import { getFriendlyErrorMessage } from '../../utils/error-message';
import { sanitizeEmailInput } from '../../utils/input-sanitize';
import { appLogger } from '../../utils/logger';
import { getPasswordStrength } from '../../utils/password-strength';
import { validateEmail } from '../../utils/validation';

type AuthPanelProps = {
  labels: Record<string, string>;
  onAuthenticated: (session: AuthSession) => void;
  sessionExpired?: boolean;
};

type AuthMode = 'login' | 'register';

export const AuthPanel = ({ labels, onAuthenticated, sessionExpired = false }: AuthPanelProps) => {
  useComponentLogger('AuthPanel');
  const { showFeedback } = useFeedback();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordStrength = getPasswordStrength(password);
  const emailValidation = validateEmail(email, labels.invalidEmail);

  const submit = async () => {
    if (!emailValidation.isValid) {
      setError(emailValidation.message ?? labels.invalidEmail);
      return;
    }

    if (mode === 'register' && !passwordStrength.isStrong) {
      setError(labels.passwordTooWeak);
      return;
    }

    if (!password.trim()) {
      setError(labels.passwordRequired);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = mode === 'login' ? await login(email, password) : await register(email, password);
      if ('pendingApproval' in result) {
        appLogger.info('auth.register.pending_approval', 'Admin registration is waiting for approval', { email });
        setNotice(labels.pendingApprovalMessage);
        showFeedback({
          type: 'warning',
          title: labels.pendingApproval,
          message: labels.pendingApprovalMessage,
        });
        setMode('login');
        return;
      }

      appLogger.info('auth.login.success', 'Admin authenticated', { email: result.email, role: result.role });
      onAuthenticated(result);
    } catch (cause) {
      const message = getFriendlyErrorMessage(cause, labels);
      appLogger.warn('auth.submit.failed', 'Authentication flow failed', { mode, email, message });
      setError(message);
      showFeedback({
        type: 'error',
        title: labels.actionFailed,
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    setNotice(null);

    try {
      const { authUrl } = await startGoogleAuth();
      window.location.href = authUrl;
    } catch (cause) {
      const message = getFriendlyErrorMessage(cause, labels);
      appLogger.warn('auth.google.start_failed', 'Google sign-in failed to start', { message });
      setError(message);
      showFeedback({ type: 'error', title: labels.googleSignInFailed, message });
    } finally {
      setGoogleLoading(false);
    }
  };

  const enterDemo = () => {
    onAuthenticated({
      hostId: 'demo-host-id',
      email: 'demo@ishru.local',
      fullName: 'משתמש דמו',
      onboardingCompleted: false,
      onboardingSkipped: false,
      phoneNumber: '0500000000',
      profileCompleted: true,
      role: 'HOST',
      accessToken: 'demo-token',
    });
  };

  return (
    <Center className="authSurface" mih="100vh" p="md">
      <Card className="authCard" withBorder radius="sm" p="xl" w="min(100%, 460px)">
        <Stack gap="md">
          <Group justify="space-between">
            <Box className="authLogoWrap">
              <BrandLogo size="auth" />
            </Box>
          </Group>

          <Stack gap={4}>
            <Title order={1} className="authTitle">{labels.authTitle}</Title>
            <Text size="sm" c="dimmed">{labels.authSubtitle}</Text>
          </Stack>

          {sessionExpired && (
            <Alert color="yellow" role="alert" title={labels.sessionExpired}>
              {labels.sessionExpiredHint}
            </Alert>
          )}

          <SegmentedControl
            value={mode}
            onChange={(value) => {
              setMode(value as AuthMode);
              setError(null);
              setNotice(null);
            }}
            data={[
              { value: 'login', label: labels.login },
              { value: 'register', label: labels.register },
            ]}
          />

          <TextInput
            inputMode="email"
            label={labels.email}
            value={email}
            onChange={(event) => setEmail(sanitizeEmailInput(event.currentTarget.value))}
            leftSection={<IconMail size={uiConfig.icons.input} />}
            error={email && !emailValidation.isValid ? emailValidation.message : null}
            required
          />

          <PasswordInput
            label={labels.password}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            leftSection={<IconLock size={uiConfig.icons.input} />}
            required
          />

          {mode === 'register' && <PasswordStrengthMeter labels={labels} password={password} />}

          {error && <Text c="red" role="alert" size="sm">{error}</Text>}
          {notice && <Text c="ishruGreen.8" role="status" size="sm" fw={700}>{notice}</Text>}

          <Button loading={loading} disabled={mode === 'register' && !passwordStrength.isStrong} onClick={submit}>
            {mode === 'login' ? labels.login : labels.register}
          </Button>

          <Button
            variant="light"
            loading={googleLoading}
            leftSection={<IconBrandGoogle size={uiConfig.icons.button} />}
            onClick={signInWithGoogle}
          >
            {labels.signInWithGoogle}
          </Button>

          {mode === 'login' && (
            <UnstyledButton
              onClick={async () => {
                if (!email.trim()) {
                  setError(labels.emailRequiredForReset);
                  return;
                }

                setLoading(true);
                setError(null);
                try {
                  await forgotPassword(email);
                  setNotice(labels.passwordResetEmailSent);
                  showFeedback({
                    type: 'success',
                    title: labels.passwordResetEmailSentTitle,
                    message: labels.passwordResetEmailSent,
                  });
                } catch (cause) {
                  const message = getFriendlyErrorMessage(cause, labels);
                  setError(message);
                  showFeedback({ type: 'error', title: labels.actionFailed, message });
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text size="sm" fw={800} c="ishruGreen.8">{labels.forgotPassword}</Text>
            </UnstyledButton>
          )}

          <Button variant="light" onClick={enterDemo}>
            {labels.demoLogin}
          </Button>
        </Stack>
      </Card>
    </Center>
  );
};

type ResetPasswordPanelProps = {
  labels: Record<string, string>;
  onAuthenticated: (session: AuthSession) => void;
  token: string;
};

export const ResetPasswordPanel = ({ labels, onAuthenticated, token }: ResetPasswordPanelProps) => {
  useComponentLogger('ResetPasswordPanel');
  const { showFeedback } = useFeedback();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordStrength = getPasswordStrength(password);

  const submit = async () => {
    if (!passwordStrength.isStrong) {
      setError(labels.passwordTooWeak);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const session = await resetPassword(token, password);
      showFeedback({
        type: 'success',
        title: labels.passwordUpdated,
        message: labels.passwordUpdatedMessage,
      });
      onAuthenticated(session);
      window.history.replaceState({}, '', '/dashboard/events');
    } catch (cause) {
      const message = getFriendlyErrorMessage(cause, labels);
      setError(message);
      showFeedback({ type: 'error', title: labels.actionFailed, message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center className="authSurface" mih="100vh" p="md">
      <Card className="authCard" withBorder radius="sm" p="xl" w="min(100%, 460px)">
        <Stack gap="md">
          <Box className="authLogoWrap">
            <BrandLogo size="auth" />
          </Box>
          <Stack gap={4}>
            <Title order={1} className="authTitle">{labels.createNewPassword}</Title>
            <Text size="sm" c="dimmed">{labels.createNewPasswordDescription}</Text>
          </Stack>
          <PasswordInput
            label={labels.newPassword}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            leftSection={<IconLock size={uiConfig.icons.input} />}
            required
          />
          <PasswordStrengthMeter labels={labels} password={password} />
          {error && <Text c="red" size="sm">{error}</Text>}
          <Button loading={loading} disabled={!passwordStrength.isStrong} onClick={submit}>
            {labels.saveNewPassword}
          </Button>
        </Stack>
      </Card>
    </Center>
  );
};
