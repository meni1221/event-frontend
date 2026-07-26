import { useEffect, useMemo, useState } from 'react';
import {
  AuthSession,
  createEvent as createEventRequest,
  createGuest as createGuestRequest,
  deleteGuest as deleteGuestRequest,
  getEvents,
  getCurrentProfile,
  getGuests,
  getSeatingTables,
  getStoredSession,
  setApiSession,
  updateCurrentOnboarding,
  updateEvent as updateEventRequest,
  updateGuest as updateGuestRequest,
  updateSeatingTables,
} from '../../../api';
import { EventCard, EventTheme, getDefaultInvitationText, GuestRecord, sampleEvents, sampleGuests, sampleSeatingTables, SeatingTable, TemplateKey } from '../../../data';
import { appLogger } from '../../../utils/logger';

const isDemoSession = (session: AuthSession | null) => session?.email === 'demo@ishru.local';
const getInitialEvents = (session: AuthSession | null) => (isDemoSession(session) ? sampleEvents : []);
const getInitialGuests = (session: AuthSession | null) => (isDemoSession(session) ? sampleGuests : []);
const getInitialSeatingTables = (session: AuthSession | null) => (isDemoSession(session) ? sampleSeatingTables : []);

const applyGuestTotals = (targetEvents: EventCard[], targetGuests: GuestRecord[]) =>
  targetEvents.map((event) => {
    const eventGuests = targetGuests.filter((guest) => guest.eventId === event.id);
    const confirmed = eventGuests.filter((guest) => guest.status === 'confirmed').length;

    return {
      ...event,
      confirmed,
      guests: eventGuests.length,
      pending: eventGuests.filter((guest) => ['pending', 'maybe'].includes(guest.status)).length,
    };
  });

export const useDashboardState = () => {
  const storedSession = getStoredSession();
  const [session, setSession] = useState<AuthSession | null>(storedSession);
  const [hostId, setHostId] = useState(storedSession?.hostId ?? '');
  const [events, setEvents] = useState<EventCard[]>(getInitialEvents(storedSession));
  const [guests, setGuests] = useState<GuestRecord[]>(getInitialGuests(storedSession));
  const [seatingTables, setSeatingTables] = useState<SeatingTable[]>(getInitialSeatingTables(storedSession));
  const [query, setQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(getInitialEvents(storedSession)[0]?.id ?? '');
  const [selectedTheme, setSelectedTheme] = useState<EventTheme>(getInitialEvents(storedSession)[0]?.theme ?? 'brit');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('classic');
  const [invitationTitle, setInvitationTitle] = useState(getInitialEvents(storedSession)[0]?.eventName ?? '');
  const [invitationText, setInvitationText] = useState('');

  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0];

  const loadHostEvents = async (targetSession: AuthSession) => {
    if (isDemoSession(targetSession)) {
      return;
    }

    try {
      const [hostEvents, hostGuests] = await Promise.all([getEvents(), getGuests()]);
      const hostSeatingTables = (await Promise.all(
        hostEvents.map((event) => getSeatingTables(event.id)),
      )).flat();
      setEvents(applyGuestTotals(hostEvents, hostGuests));
      setGuests(hostGuests);
      setSeatingTables(hostSeatingTables);
      setSelectedEventId(hostEvents[0]?.id ?? '');
      setInvitationTitle(hostEvents[0]?.eventName ?? '');
      appLogger.info('dashboard.events.loaded', 'Loaded host data from backend', { events: hostEvents.length, guests: hostGuests.length });
    } catch (cause) {
      appLogger.warn('dashboard.events.load_failed', 'Failed loading host events from backend', {
        message: cause instanceof Error ? cause.message : String(cause),
      });
      setEvents([]);
      setSelectedEventId('');
      setInvitationTitle('');
    }
  };

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return events;
    }

    return events.filter((event) =>
      [event.eventName, event.venueName].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [events, query]);

  const updateEvent = (eventId: string, patch: Partial<EventCard>) => {
    setEvents((currentEvents) =>
      currentEvents.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
    );

    if (session && !isDemoSession(session)) {
      void updateEventRequest(eventId, patch).catch((cause) => {
        appLogger.warn('dashboard.event.update_failed', 'Failed updating event in backend', {
          eventId,
          message: cause instanceof Error ? cause.message : String(cause),
        });
      });
    }
  };

  const createEvent = async (event: EventCard) => {
    if (!session || isDemoSession(session)) {
      setEvents((currentEvents) => [event, ...currentEvents]);
      setSelectedEventId(event.id);
      return;
    }

    try {
      const createdEvent = await createEventRequest(event);
      setEvents((currentEvents) => [createdEvent, ...currentEvents]);
      setSelectedEventId(createdEvent.id);
    } catch (cause) {
      appLogger.warn('dashboard.event.create_failed', 'Failed creating event in backend', {
        message: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  };

  const persistSeatingTables = async (eventId: string, eventTables: SeatingTable[]) => {
    const savedTables = !session || isDemoSession(session)
      ? eventTables
      : await updateSeatingTables(eventId, eventTables);

    setSeatingTables((currentTables) => [
      ...currentTables.filter((table) => table.eventId !== eventId),
      ...savedTables,
    ]);
  };

  const createSeatingTable = async (table: SeatingTable) => {
    const eventTables = seatingTables.filter((currentTable) => currentTable.eventId === table.eventId);
    await persistSeatingTables(table.eventId, [table, ...eventTables]);
  };

  const createGuest = async (guest: GuestRecord) => {
    if (!session || isDemoSession(session)) {
      setGuests((currentGuests) => [guest, ...currentGuests]);
      return guest;
    }

    try {
      const createdGuest = await createGuestRequest(guest.eventId, {
        email: guest.email,
        fullName: guest.fullName,
        language: guest.language,
        maxAllowed: guest.maxAllowed,
        menCount: guest.menCount,
        phoneNumber: guest.phoneNumber,
        womenCount: guest.womenCount,
      });
      setGuests((currentGuests) => [createdGuest, ...currentGuests]);
      setEvents((currentEvents) => applyGuestTotals(currentEvents, [createdGuest, ...guests]));
      return createdGuest;
    } catch (cause) {
      appLogger.warn('dashboard.guest.create_failed', 'Failed creating guest in backend', {
        eventId: guest.eventId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  };

  const deleteGuest = async (guestId: string) => {
    const targetGuest = guests.find((guest) => guest.id === guestId);

    if (!session || isDemoSession(session)) {
      const nextGuests = guests.filter((guest) => guest.id !== guestId);
      setGuests(nextGuests);
      setEvents((currentEvents) => applyGuestTotals(currentEvents, nextGuests));
      await removeGuestFromTable(guestId);
      return;
    }

    try {
      await deleteGuestRequest(guestId);
      const nextGuests = guests.filter((guest) => guest.id !== guestId);
      setGuests(nextGuests);
      setEvents((currentEvents) => applyGuestTotals(currentEvents, nextGuests));
      await removeGuestFromTable(guestId);
    } catch (cause) {
      appLogger.warn('dashboard.guest.delete_failed', 'Failed deleting guest in backend', {
        eventId: targetGuest?.eventId,
        guestId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  };

  const updateGuest = async (guestId: string, patch: Partial<GuestRecord>) => {
    const applyGuestPatch = (updatedGuest: GuestRecord) => {
      const nextGuests = guests.map((guest) => (guest.id === guestId ? updatedGuest : guest));
      setGuests(nextGuests);
      setEvents((currentEvents) => applyGuestTotals(currentEvents, nextGuests));
    };

    if (!session || isDemoSession(session)) {
      const targetGuest = guests.find((guest) => guest.id === guestId);
      if (!targetGuest) {
        return;
      }

      applyGuestPatch({ ...targetGuest, ...patch });
      return;
    }

    try {
      const updatedGuest = await updateGuestRequest(guestId, patch);
      applyGuestPatch(updatedGuest);
    } catch (cause) {
      appLogger.warn('dashboard.guest.update_failed', 'Failed updating guest in backend', {
        guestId,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      throw cause;
    }
  };

  const saveInvitationDraft = async () => {
    if (!selectedEventId) {
      return;
    }

    if (session && !isDemoSession(session)) {
      await updateEventRequest(selectedEventId, {
        invitationMessage: invitationText,
        invitationTemplateKey: selectedTemplate,
        invitationTitle,
      });
    }

    appLogger.info('dashboard.invitation.saved', 'Invitation draft saved', { eventId: selectedEventId });
  };

  const assignGuestToTable = async (guestId: string, tableId: string) => {
    const targetTable = seatingTables.find((table) => table.id === tableId);
    if (!targetTable) {
      return;
    }

    const eventTables = seatingTables
      .filter((table) => table.eventId === targetTable.eventId)
      .map((table) => ({
        ...table,
        guestIds:
          table.id === tableId
            ? Array.from(new Set([...table.guestIds, guestId]))
            : table.guestIds.filter((currentGuestId) => currentGuestId !== guestId),
      }));
    await persistSeatingTables(targetTable.eventId, eventTables);
  };

  const removeGuestFromTable = async (guestId: string) => {
    const targetTable = seatingTables.find((table) => table.guestIds.includes(guestId));
    if (!targetTable) {
      return;
    }

    const eventTables = seatingTables
      .filter((table) => table.eventId === targetTable.eventId)
      .map((table) => ({
        ...table,
        guestIds: table.guestIds.filter((currentGuestId) => currentGuestId !== guestId),
      }));
    await persistSeatingTables(targetTable.eventId, eventTables);
  };

  const deleteSeatingTable = async (tableId: string) => {
    const targetTable = seatingTables.find((table) => table.id === tableId);
    if (!targetTable) {
      return;
    }

    const eventTables = seatingTables.filter(
      (table) => table.eventId === targetTable.eventId && table.id !== tableId,
    );
    await persistSeatingTables(targetTable.eventId, eventTables);
  };

  const handleAuthenticated = (nextSession: AuthSession) => {
    setApiSession(nextSession);
    setSession(nextSession);
    setHostId(nextSession.hostId);
    const nextEvents = getInitialEvents(nextSession);
    setEvents(nextEvents);
    setGuests(getInitialGuests(nextSession));
    setSeatingTables(getInitialSeatingTables(nextSession));
    setSelectedEventId(nextEvents[0]?.id ?? '');
    setInvitationTitle(nextEvents[0]?.eventName ?? '');
    void loadHostEvents(nextSession);
  };

  const updateSession = (nextSession: AuthSession) => {
    setSession((currentSession) => {
      const mergedSession = {
        ...currentSession,
        ...nextSession,
        fullName: nextSession.fullName?.trim() ?? currentSession?.fullName ?? '',
      };

      setApiSession(mergedSession);
      setHostId(mergedSession.hostId);
      return mergedSession;
    });
  };

  const refreshSessionProfile = async (targetSession: AuthSession) => {
    if (isDemoSession(targetSession)) {
      return;
    }

    try {
      const profile = await getCurrentProfile();
      updateSession({
        ...targetSession,
        email: profile.email,
        fullName: profile.fullName,
        onboardingCompleted: profile.onboardingCompleted,
        onboardingSkipped: profile.onboardingSkipped,
        phoneNumber: profile.phoneNumber,
        profileCompleted: profile.profileCompleted,
        role: profile.role,
      });
      appLogger.info('dashboard.session.profile_refreshed', 'Session profile refreshed from backend', { role: profile.role });
    } catch (cause) {
      appLogger.warn('dashboard.session.profile_refresh_failed', 'Failed refreshing session profile', {
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  };

  const updateOnboarding = async (payload: { completed?: boolean; skipped?: boolean }) => {
    if (!session) {
      return;
    }

    if (isDemoSession(session)) {
      updateSession({
        ...session,
        onboardingCompleted: Boolean(payload.completed),
        onboardingSkipped: Boolean(payload.skipped),
      });
      return;
    }

    const profile = await updateCurrentOnboarding(payload);
    updateSession({
      ...session,
      onboardingCompleted: profile.onboardingCompleted,
      onboardingSkipped: profile.onboardingSkipped,
    });
  };

  const clearSession = () => {
    setApiSession(null);
    setSession(null);
    setHostId('');
    setEvents([]);
    setGuests([]);
    setSeatingTables([]);
    setSelectedEventId('');
  };

  useEffect(() => {
    if (session) {
      void refreshSessionProfile(session);
      void loadHostEvents(session);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    setSelectedTheme(selectedEvent.theme);
    setInvitationTitle(selectedEvent.eventName);
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    setInvitationText(getDefaultInvitationText(selectedTheme, selectedTemplate, selectedEvent));
  }, [selectedEvent, selectedTemplate, selectedTheme]);

  return {
    events,
    clearSession,
    createEvent,
    createGuest,
    deleteGuest,
    deleteSeatingTable,
    updateGuest,
    createSeatingTable,
    assignGuestToTable,
    filteredEvents,
    guests,
    handleAuthenticated,
    hostId,
    invitationText,
    invitationTitle,
    query,
    removeGuestFromTable,
    saveInvitationDraft,
    selectedEvent,
    selectedEventId,
    selectedTemplate,
    selectedTheme,
    seatingTables,
    session,
    setHostId,
    setInvitationText,
    setInvitationTitle,
    setQuery,
    setSelectedEventId,
    setSelectedTemplate,
    setSelectedTheme,
    updateEvent,
    updateOnboarding,
    updateSession,
  };
};
