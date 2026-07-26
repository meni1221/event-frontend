import { Stack, Tabs } from '@mantine/core';
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ActiveEventBar } from '../../components/active-event-bar';
import { AdminLayout } from '../../components/admin-layout';
import { CookieConsent } from '../../components/cookie-consent';
import { PageLoader } from '../../components/page-loader';
import { OnboardingModal } from '../../components/onboarding-modal';
import { ProfileModal } from '../../components/profile-modal';
import { TermsConsent } from '../../components/terms-consent';
import { useFeedback } from '../../components/feedback';
import { AppTab } from '../../data';
import { Locale } from '../../i18n';
import { GuestPanel } from '../../pages/guest';
import { useComponentLogger } from '../../utils/component-logger';
import { getFriendlyErrorMessage } from '../../utils/error-message';
import { useWhatsappStatus } from '../../hooks/use-whatsapp-status';
import { useDashboardState } from '../hooks/use-dashboard-state';

const isDemoSession = (session: ReturnType<typeof useDashboardState>['session']) => session?.accessToken === 'demo-token';
const EventsPanel = lazy(() => import('../../pages/events').then((module) => ({ default: module.EventsPanel })));
const GuestsPanel = lazy(() => import('../../pages/guests').then((module) => ({ default: module.GuestsPanel })));
const InvitationPanel = lazy(() => import('../../pages/invitations').then((module) => ({ default: module.InvitationPanel })));
const LogsPanel = lazy(() => import('../../pages/logs').then((module) => ({ default: module.LogsPanel })));
const OwnerPanel = lazy(() => import('../../pages/owner').then((module) => ({ default: module.OwnerPanel })));
const SeatingPanel = lazy(() => import('../../pages/seating').then((module) => ({ default: module.SeatingPanel })));
const SettingsPanel = lazy(() => import('../../pages/settings').then((module) => ({ default: module.SettingsPanel })));
const SystemOverviewPanel = lazy(() => import('../../pages/system-overview').then((module) => ({ default: module.SystemOverviewPanel })));
const TermsPanel = lazy(() => import('../../pages/terms').then((module) => ({ default: module.TermsPanel })));
const WhatsappPanel = lazy(() => import('../../pages/whatsapp').then((module) => ({ default: module.WhatsappPanel })));

type DashboardProps = {
  activeTab: AppTab;
  labels: Record<string, string>;
  locale: Locale;
  onLocaleToggle: () => void;
  onLogout: () => void;
  onTabChange: (tab: AppTab) => void;
  state: ReturnType<typeof useDashboardState>;
};

export const Dashboard = ({
  activeTab,
  labels,
  locale,
  onLocaleToggle,
  onLogout,
  onTabChange,
  state,
}: DashboardProps) => {
  useComponentLogger('Dashboard', { activeTab });

  return (
    <DashboardContent
      activeTab={activeTab}
      labels={labels}
      locale={locale}
      onLocaleToggle={onLocaleToggle}
      onLogout={onLogout}
      onTabChange={onTabChange}
      state={state}
    />
  );
};

const DashboardContent = ({
  activeTab,
  labels,
  locale,
  onLocaleToggle,
  onLogout,
  onTabChange,
  state,
}: DashboardProps) => {
  useComponentLogger('DashboardContent', { activeTab, role: state.session?.role });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileRequired, setIsProfileRequired] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isAutomaticOnboardingDismissed, setIsAutomaticOnboardingDismissed] = useState(false);
  const [isOnboardingSaving, setIsOnboardingSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(isDemoSession(state.session));
  const { showFeedback } = useFeedback();
  const userDisplayName = state.session?.fullName?.trim() ? state.session.fullName.trim() : state.session?.email || labels.guest;
  const acceptTerms = useCallback(() => setTermsAccepted(true), []);
  const isDemo = isDemoSession(state.session);
  const whatsappStatus = useWhatsappStatus({ enabled: Boolean(state.session && !isDemo) });
  const shouldShowOnboarding = Boolean(
    state.session &&
    state.session.role === 'HOST' &&
    termsAccepted &&
    state.session.profileCompleted &&
    !state.session.onboardingCompleted &&
    !state.session.onboardingSkipped &&
    !isAutomaticOnboardingDismissed,
  );
  const isAutomaticOnboardingOpen = shouldShowOnboarding && !isTourOpen;
  const isOnboardingOpen = isAutomaticOnboardingOpen || isTourOpen;
  const ownerTabs: AppTab[] = ['system_overview', 'owner', 'logs', 'terms', 'settings', 'whatsapp'];

  useEffect(() => {
    setTermsAccepted(isDemoSession(state.session));
    setIsTourOpen(false);
    setIsAutomaticOnboardingDismissed(false);
  }, [state.session?.hostId]);

  useEffect(() => {
    if (state.session?.role === 'OWNER' && !ownerTabs.includes(activeTab)) {
      onTabChange('system_overview');
    }
  }, [activeTab, onTabChange, state.session?.role]);

  useEffect(() => {
    if (state.session?.role !== 'OWNER' && (activeTab === 'guests' || activeTab === 'whatsapp')) {
      onTabChange('audience');
    }
  }, [activeTab, onTabChange, state.session?.role]);

  useEffect(() => {
    if (state.session && termsAccepted && !state.session.profileCompleted) {
      setIsProfileRequired(true);
      setIsProfileOpen(true);
    }
  }, [state.session, termsAccepted]);

  const openProfileEditor = () => {
    setIsProfileRequired(false);
    setIsProfileOpen(true);
  };

  const closeProfileEditor = () => {
    if (isProfileRequired) {
      return;
    }

    setIsProfileOpen(false);
  };

  const handleLogoClick = () => {
    if (isDemo) {
      onLogout();
      return;
    }

    onTabChange(state.session?.role === 'OWNER' ? 'system_overview' : 'events');
  };

  const completeOnboarding = async () => {
    setIsTourOpen(false);
    setIsAutomaticOnboardingDismissed(true);
    setIsOnboardingSaving(true);

    try {
      await state.updateOnboarding({ completed: true });
      showFeedback({
        type: 'success',
        title: labels.onboardingCompletedTitle,
        message: labels.onboardingCompletedMessage,
      });
    } catch (cause) {
      setIsAutomaticOnboardingDismissed(false);
      showFeedback({
        type: 'error',
        title: labels.actionFailed,
        message: getFriendlyErrorMessage(cause, labels),
      });
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  const skipOnboarding = async () => {
    if (isTourOpen) {
      setIsTourOpen(false);
      return;
    }

    setIsAutomaticOnboardingDismissed(true);
    setIsOnboardingSaving(true);

    try {
      await state.updateOnboarding({ skipped: true });
      showFeedback({
        type: 'info',
        title: labels.onboardingSkippedTitle,
        message: labels.onboardingSkippedMessage,
      });
    } catch (cause) {
      setIsAutomaticOnboardingDismissed(false);
      showFeedback({
        type: 'error',
        title: labels.actionFailed,
        message: getFriendlyErrorMessage(cause, labels),
      });
    } finally {
      setIsOnboardingSaving(false);
    }
  };

  return (
  <AdminLayout
    activeTab={activeTab}
    labels={labels}
    onLocaleToggle={onLocaleToggle}
    onLogoClick={handleLogoClick}
    onLogout={onLogout}
    onProfileClick={openProfileEditor}
    onStartTour={() => setIsTourOpen(true)}
    onTabChange={onTabChange}
    role={state.session?.role ?? 'HOST'}
    userDisplayName={userDisplayName}
    whatsappStatus={whatsappStatus.status}
  >
    {state.session && !isDemo && <TermsConsent hostId={state.session.hostId} labels={labels} onAccepted={acceptTerms} />}
    {state.session && (
      <ProfileModal
        isDemoMode={isDemo}
        labels={labels}
        opened={isProfileOpen}
        required={isProfileRequired}
        session={state.session}
        onClose={closeProfileEditor}
        onSaved={(nextSession) => {
          state.updateSession(nextSession);
          setIsProfileRequired(false);
          setIsProfileOpen(false);
        }}
      />
    )}
    <OnboardingModal
      actionLoading={isOnboardingSaving}
      labels={labels}
      opened={isOnboardingOpen}
      onComplete={completeOnboarding}
      onNavigate={onTabChange}
      onSkip={skipOnboarding}
    />
    {termsAccepted && !isOnboardingOpen && <CookieConsent labels={labels} />}

    <ActiveEventBar event={state.selectedEvent} labels={labels} onNavigate={onTabChange} />

    <Suspense fallback={<PageLoader label={labels.loading} />}>
    <Tabs value={activeTab} onChange={(value) => value && onTabChange(value as AppTab)} keepMounted={false}>
      <Tabs.Panel value="events">
        <EventsPanel
          locale={locale}
          labels={labels}
          events={state.filteredEvents}
          query={state.query}
          selectedEventId={state.selectedEventId}
          onCreateEvent={state.createEvent}
          onQueryChange={state.setQuery}
          onSelectEvent={state.setSelectedEventId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="audience">
        <Stack gap="xl">
          <GuestsPanel
            labels={labels}
            guests={state.guests}
            isDemoMode={isDemo}
            selectedEvent={state.selectedEvent}
            onCreateGuest={state.createGuest}
            onDeleteGuest={state.deleteGuest}
            onUpdateGuest={state.updateGuest}
          />
          <WhatsappPanel
            guests={state.guests}
            labels={labels}
            selectedEvent={state.selectedEvent}
            isDemoMode={isDemo}
            statusSnapshot={whatsappStatus.snapshot}
          />
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="guests">
        <GuestsPanel
          labels={labels}
          guests={state.guests}
          isDemoMode={isDemo}
          selectedEvent={state.selectedEvent}
          onCreateGuest={state.createGuest}
          onDeleteGuest={state.deleteGuest}
          onUpdateGuest={state.updateGuest}
        />
      </Tabs.Panel>

      <Tabs.Panel value="seating">
        <SeatingPanel
          guests={state.guests}
          labels={labels}
          seatingTables={state.seatingTables}
          selectedEvent={state.selectedEvent}
          onAssignGuest={state.assignGuestToTable}
          onCreateTable={state.createSeatingTable}
          onDeleteTable={state.deleteSeatingTable}
          onRemoveGuest={state.removeGuestFromTable}
        />
      </Tabs.Panel>

      <Tabs.Panel value="invitations">
        <InvitationPanel
          events={state.events}
          locale={locale}
          labels={labels}
          selectedEvent={state.selectedEvent}
          selectedEventId={state.selectedEventId}
          selectedTheme={state.selectedTheme}
          selectedTemplate={state.selectedTemplate}
          invitationTitle={state.invitationTitle}
          invitationText={state.invitationText}
          onSaveDraft={state.saveInvitationDraft}
          onSelectEvent={state.setSelectedEventId}
          onSelectTheme={state.setSelectedTheme}
          onSelectTemplate={state.setSelectedTemplate}
          onTitleChange={state.setInvitationTitle}
          onTextChange={state.setInvitationText}
        />
      </Tabs.Panel>

      <Tabs.Panel value="guest">
        <GuestPanel
          event={state.selectedEvent}
          invitationText={state.invitationText}
          invitationTitle={state.invitationTitle}
          labels={labels}
          locale={locale}
        />
      </Tabs.Panel>

      <Tabs.Panel value="whatsapp">
        <WhatsappPanel
          guests={state.guests}
          labels={labels}
          selectedEvent={state.selectedEvent}
          isDemoMode={isDemo}
          statusSnapshot={whatsappStatus.snapshot}
        />
      </Tabs.Panel>

      <Tabs.Panel value="system_overview">
        <SystemOverviewPanel labels={labels} />
      </Tabs.Panel>

      <Tabs.Panel value="owner">
        <OwnerPanel labels={labels} />
      </Tabs.Panel>

      <Tabs.Panel value="logs">
        <LogsPanel labels={labels} />
      </Tabs.Panel>

      <Tabs.Panel value="terms">
        <TermsPanel labels={labels} />
      </Tabs.Panel>

      <Tabs.Panel value="settings">
        <SettingsPanel
          labels={labels}
          hostId={state.hostId}
          events={state.events}
          selectedEvent={state.selectedEvent}
          selectedEventId={state.selectedEventId}
          isDemoMode={isDemo}
          onHostIdChange={state.setHostId}
          onSelectEvent={state.setSelectedEventId}
          onDeleteAccount={onLogout}
          onUpdateEvent={state.updateEvent}
        />
      </Tabs.Panel>
    </Tabs>
    </Suspense>
  </AdminLayout>
  );
};
