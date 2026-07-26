import { EventCard, EventSeatingMode, EventTheme, GuestLanguage, GuestRecord, GuestStatus, InvitationDesignKey } from '../data';
import { appLogger } from '../utils/logger';

export type WhatsappStatus = 'DISCONNECTED' | 'QR_READY' | 'CONNECTED';

export type WhatsappSnapshot = {
  connectionId: string;
  displayName: string;
  hostId: string;
  status: WhatsappStatus;
  qrCode: string | null;
};

export type AuthSession = {
  hostId: string;
  email: string;
  fullName: string;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  phoneNumber?: string;
  profileCompleted: boolean;
  role: 'HOST' | 'OWNER';
  accessToken: string;
};

export type PendingApprovalResponse = {
  pendingApproval: true;
  email: string;
};

export type AuthResponse = AuthSession | PendingApprovalResponse;

export type OwnerUser = {
  id: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  profileCompleted?: boolean;
  role: 'HOST' | 'OWNER';
  accountStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED';
  whatsappStatus: WhatsappStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type OwnerEvent = {
  id: string;
  hostId: string;
  eventName: string;
  eventDate?: string;
  venueName?: string;
  theme?: string;
  totalGuests: number;
};

export type WhatsappRecipient = {
  email?: string;
  fullName?: string;
  guestId?: string;
  inviteLink?: string;
  phoneNumber: string;
};

export type WhatsappQueueItemStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export type WhatsappQueueStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPING' | 'DONE' | 'FAILED' | 'CANCELLED';

export type WhatsappQueueItem = {
  id: string;
  fullName?: string;
  guestId?: string;
  inviteLink?: string;
  phoneNumber: string;
  reason?: string;
  status: WhatsappQueueItemStatus;
};

export type WhatsappQueueSnapshot = {
  batchId: string | null;
  completedAt?: string;
  createdAt?: string;
  eventId?: string;
  items: WhatsappQueueItem[];
  nextRecipient?: string;
  progress: {
    failed: number;
    queued: number;
    sent: number;
    skipped: number;
    total: number;
  };
  status: WhatsappQueueStatus;
};

export type WhatsappBatchHistoryEntry = {
  batchId: string;
  createdAt: string;
  eventId?: string;
  failed: number;
  messagePreview: string;
  sent: number;
  skipped: number;
  total: number;
};

export type GoogleContact = WhatsappRecipient;
export type PublicRsvpStatus = 'confirmed' | 'maybe' | 'declined';

export type AdminProfile = {
  hostId: string;
  email: string;
  fullName: string;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  phoneNumber: string;
  profileCompleted: boolean;
  role: 'HOST' | 'OWNER';
  accountStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'SUSPENDED';
};

export type SystemLogEntry = {
  _id: string;
  category: string;
  createdAt?: string;
  durationMs?: number;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  method?: string;
  path?: string;
  requestId?: string;
  source: 'backend' | 'frontend';
  statusCode?: number;
  userEmail?: string;
};

export type SystemLogQuery = {
  category?: string;
  level?: SystemLogEntry['level'];
  requestId?: string;
  search?: string;
  source?: SystemLogEntry['source'];
};

type BackendEvent = {
  _id?: string;
  id?: string;
  eventName: string;
  eventDate?: string;
  venueName?: string;
  address?: string;
  wazeLink?: string;
  bitLink?: string;
  adminPhoneNumber?: string;
  seatingMode?: EventSeatingMode;
  theme?: EventTheme;
  invitationTitle?: string;
  invitationMessage?: string;
};

type BackendGuest = {
  _id?: string;
  id?: string;
  eventId: { _id?: string; toString?: () => string } | string;
  inviteId: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  language?: GuestLanguage;
  status?: GuestStatus;
  maxAllowed?: number;
  menCount?: number;
  womenCount?: number;
  rsvpDetails?: {
    adults?: number;
    children?: number;
    notes?: string;
  };
};

export type PublicInvite = {
  event: EventCard;
  guest: GuestRecord;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const SESSION_STORAGE_KEY = 'ishru-session';
export const SESSION_EXPIRED_EVENT = 'ishru-session-expired';

export const getApiOrigin = () => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return 'http://localhost:3000';
  }
};

let activeSession: AuthSession | null = null;

export const setApiSession = (session: AuthSession | null) => {
  activeSession = session;
  if (session) {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
};

const expireSession = () => {
  setApiSession(null);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

const createRequestId = () => {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }

  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

export const getStoredSession = (): AuthSession | null => {
  try {
    const rawSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession) as AuthSession;
    activeSession = session;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return session;
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

export const login = async (email: string, password: string): Promise<AuthSession> =>
  authRequest('/auth/login', email, password) as Promise<AuthSession>;

export const register = async (email: string, password: string): Promise<AuthResponse> =>
  authRequest('/auth/register', email, password);

export const forgotPassword = async (email: string): Promise<{ ok: boolean }> =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPassword = async (token: string, password: string): Promise<AuthSession> =>
  request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ password, token }),
  });

export const startGoogleAuth = async (): Promise<{ authUrl: string }> =>
  request('/auth/google');

export const readGoogleAuthCallback = (): AuthResponse => {
  const query = new URLSearchParams(window.location.search);
  const callbackError = query.get('error');
  if (callbackError) {
    throw new Error(callbackError);
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  const encodedPayload = params.get('payload');
  if (!encodedPayload) {
    throw new Error('Missing Google sign-in payload');
  }

  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const result = JSON.parse(window.atob(paddedBase64)) as AuthResponse;
  if ('accessToken' in result) {
    setApiSession(result);
  }

  return result;
};

export const changeCurrentPassword = async (currentPassword: string, newPassword: string): Promise<{ ok: boolean }> => {
  const result = await request<{ ok: boolean }>('/admin/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  expireSession();
  return result;
};

export const connectWhatsapp = async (): Promise<WhatsappSnapshot> =>
  request('/whatsapp/connect', {
    method: 'POST',
  });

export const getWhatsappQr = async (): Promise<WhatsappSnapshot> =>
  request('/whatsapp/qr');

export const getWhatsappStatus = async (): Promise<WhatsappSnapshot> =>
  request('/whatsapp/status');

export const disconnectWhatsapp = async (): Promise<{ status: WhatsappStatus }> =>
  request('/whatsapp/disconnect', {
    method: 'POST',
  });

export const getEvents = async (): Promise<EventCard[]> => {
  const events = await request<BackendEvent[]>('/events');
  return events.map(mapEvent);
};

export const createEvent = async (event: EventCard): Promise<EventCard> => {
  const createdEvent = await request<BackendEvent>('/events', {
    method: 'POST',
    body: JSON.stringify({
      eventName: event.eventName,
      eventDate: event.eventDate,
      venueName: event.venueName,
      address: event.address,
      wazeLink: event.wazeLink || undefined,
      bitLink: event.bitLink || undefined,
      adminPhoneNumber: event.adminPhoneNumber,
      seatingMode: event.seatingMode,
      theme: event.theme,
      invitationTitle: event.eventName,
      invitationTemplateKey: 'classic',
    }),
  });

  return mapEvent(createdEvent);
};

export const updateEvent = async (
  eventId: string,
  patch: Partial<EventCard> & {
    invitationMessage?: string;
    invitationTemplateKey?: string;
    invitationTitle?: string;
  },
): Promise<EventCard> => {
  const updatedEvent = await request<BackendEvent>(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(mapEventPatch(patch)),
  });

  return mapEvent(updatedEvent);
};

export const getGuests = async (): Promise<GuestRecord[]> => {
  const guests = await request<BackendGuest[]>('/guests');
  return guests.map((guest) => mapGuest(guest, normalizeMongoId(guest.eventId)));
};

export const createGuest = async (
  eventId: string,
  payload: Pick<GuestRecord, 'fullName' | 'phoneNumber' | 'email' | 'language' | 'maxAllowed' | 'menCount' | 'womenCount'>,
): Promise<GuestRecord> => {
  const requestPayload = {
    ...payload,
    ...(payload.email?.trim() ? { email: payload.email.trim() } : { email: undefined }),
  };
  const guest = await request<BackendGuest>(`/guests/event/${eventId}`, {
    method: 'POST',
    body: JSON.stringify(requestPayload),
  });

  return mapGuest(guest, eventId);
};

export const deleteGuest = async (guestId: string): Promise<GuestRecord> => {
  const guest = await request<BackendGuest>(`/guests/${guestId}`, { method: 'DELETE' });
  return mapGuest(guest, normalizeMongoId(guest.eventId));
};

export const updateGuest = async (
  guestId: string,
  payload: Partial<Pick<GuestRecord, 'fullName' | 'phoneNumber' | 'email' | 'language' | 'status' | 'maxAllowed' | 'menCount' | 'womenCount' | 'adults' | 'children' | 'notes'>>,
): Promise<GuestRecord> => {
  const requestPayload = {
    ...payload,
    ...('email' in payload && !payload.email?.trim() ? { email: undefined } : {}),
  };
  const guest = await request<BackendGuest>(`/guests/${guestId}`, {
    method: 'PATCH',
    body: JSON.stringify(requestPayload),
  });

  return mapGuest(guest, normalizeMongoId(guest.eventId));
};

export type WhatsappBatchResult = {
  missingWhatsapp: Array<{ fullName?: string; phoneNumber: string }>;
  queued: number;
};

export const sendWhatsappBatch = async (
  recipients: WhatsappRecipient[],
  message: string,
  options?: { allowResend?: boolean; eventId?: string },
): Promise<WhatsappBatchResult> =>
  request('/whatsapp/send-batch', {
    method: 'POST',
    body: JSON.stringify({
      allowResend: options?.allowResend,
      eventId: options?.eventId,
      recipients,
      message,
      minDelayMs: 2500,
      maxDelayMs: 5000,
    }),
  });

export const sendWhatsappTest = async (phoneNumber: string, message: string): Promise<{ queued: number }> =>
  request('/whatsapp/send-test', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, message }),
  });

export const getWhatsappQueueState = async (): Promise<WhatsappQueueSnapshot> =>
  request('/whatsapp/send-state');

export const getWhatsappSendHistory = async (eventId?: string): Promise<WhatsappBatchHistoryEntry[]> => {
  const params = new URLSearchParams();
  if (eventId) {
    params.set('eventId', eventId);
  }

  return request(`/whatsapp/send-history${params.toString() ? `?${params.toString()}` : ''}`);
};

export const stopWhatsappBatch = async (): Promise<WhatsappQueueSnapshot> =>
  request('/whatsapp/send-stop', { method: 'POST' });

export const pauseWhatsappBatch = async (): Promise<WhatsappQueueSnapshot> =>
  request('/whatsapp/send-pause', { method: 'POST' });

export const resumeWhatsappBatch = async (): Promise<WhatsappQueueSnapshot> =>
  request('/whatsapp/send-resume', { method: 'POST' });

export const retryFailedWhatsappBatch = async (): Promise<WhatsappBatchResult> =>
  request('/whatsapp/send-retry-failed', { method: 'POST' });

export const sendInvitationEmailBatch = async (
  recipients: Array<Pick<WhatsappRecipient, 'email' | 'fullName' | 'inviteLink'>>,
  message: string,
): Promise<{ failed: Array<{ email: string; reason: string }>; sent: number }> =>
  request('/mail/send-invitations', {
    method: 'POST',
    body: JSON.stringify({
      recipients: recipients.filter((recipient) => Boolean(recipient.email)),
      message,
    }),
  });

export type GoogleConnectionStatus = {
  connected: boolean;
  googleAccountEmail?: string;
  connectedAt?: string;
};

export const getGoogleStatus = async (): Promise<GoogleConnectionStatus> =>
  request('/google/status');

export const startGoogleConnection = async (): Promise<{ authUrl: string }> =>
  request('/google/connect');

export const getGoogleContacts = async (): Promise<{ contacts: GoogleContact[] }> =>
  request('/google/contacts');

export const disconnectGoogle = async (): Promise<{ connected: boolean }> =>
  request('/google/disconnect', { method: 'POST' });

export const deleteCurrentHostData = async (): Promise<{ deletedAdmin: number; deletedEvents: number; deletedGuests: number }> =>
  request('/admin/me', { method: 'DELETE' });

export const getCurrentProfile = async (): Promise<AdminProfile> =>
  request('/admin/me/profile');

export const updateCurrentProfile = async (
  payload: {
    email: string;
    fullName: string;
    phoneNumber: string;
  },
): Promise<AdminProfile> =>
  request('/admin/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const updateCurrentOnboarding = async (
  payload: {
    completed?: boolean;
    skipped?: boolean;
  },
): Promise<AdminProfile> =>
  request('/admin/me/onboarding', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const getOwnerOverview = async (): Promise<{ users: OwnerUser[]; events: OwnerEvent[] }> =>
  request('/admin/overview');

export const approveAdmin = async (adminId: string): Promise<OwnerUser> =>
  request(`/admin/${adminId}/approve`, { method: 'PATCH' });

export const suspendAdmin = async (adminId: string): Promise<OwnerUser> =>
  request(`/admin/${adminId}/suspend`, { method: 'PATCH' });

export const restoreAdmin = async (adminId: string): Promise<OwnerUser> =>
  request(`/admin/${adminId}/restore`, { method: 'PATCH' });

export const getSystemLogs = async (query: SystemLogQuery): Promise<{ items: SystemLogEntry[]; total: number }> => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  params.set('limit', '100');

  return request(`/logs?${params.toString()}`);
};

export const submitPublicRsvp = async (
  inviteId: string,
  payload: {
    status: PublicRsvpStatus;
    adults: number;
    children: number;
    notes?: string;
  },
  eventId?: string,
): Promise<{ inviteId: string; fullName: string; status: PublicRsvpStatus }> => {
  const path = eventId ? `/guests/invite/${eventId}/${inviteId}/rsvp` : `/guests/invite/${inviteId}/rsvp`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-request-id': createRequestId() },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ inviteId: string; fullName: string; status: PublicRsvpStatus }>;
};

export const getPublicInvite = async (inviteId: string, eventId?: string): Promise<PublicInvite> => {
  const path = eventId ? `/guests/invite/${eventId}/${inviteId}` : `/guests/invite/${inviteId}`;
  const result = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'content-type': 'application/json', 'x-request-id': createRequestId() },
  });

  if (!result.ok) {
    throw new Error(await result.text());
  }

  const payload = await result.json() as { event: BackendEvent; guest: BackendGuest };
  const event = mapEvent(payload.event);

  return {
    event,
    guest: mapGuest(payload.guest, event.id),
  };
};

const mapEvent = (event: BackendEvent): EventCard => ({
  id: event.id ?? event._id ?? '',
  eventName: event.eventName,
  eventDate: event.eventDate ?? new Date().toISOString(),
  venueName: event.venueName ?? '',
  address: event.address ?? '',
  wazeLink: event.wazeLink ?? '',
  guests: 0,
  confirmed: 0,
  pending: 0,
  theme: event.theme ?? 'brit',
  seatingMode: event.seatingMode ?? 'mixed',
  bitLink: event.bitLink ?? '',
  adminPhoneNumber: event.adminPhoneNumber ?? '',
  isActive: true,
  invitationDesignKey: 'soft' as InvitationDesignKey,
});

const mapEventPatch = (patch: Partial<EventCard> & {
  invitationMessage?: string;
  invitationTemplateKey?: string;
  invitationTitle?: string;
}) => ({
  adminPhoneNumber: patch.adminPhoneNumber,
  address: patch.address,
  bitLink: patch.bitLink || undefined,
  eventDate: patch.eventDate,
  eventName: patch.eventName,
  invitationMessage: 'invitationMessage' in patch ? patch.invitationMessage : undefined,
  invitationTemplateKey: 'invitationTemplateKey' in patch ? patch.invitationTemplateKey : undefined,
  invitationTitle: 'invitationTitle' in patch ? patch.invitationTitle : undefined,
  seatingMode: patch.seatingMode,
  theme: patch.theme,
  venueName: patch.venueName,
  wazeLink: patch.wazeLink || undefined,
});

const mapGuest = (guest: BackendGuest, eventId: string): GuestRecord => ({
  id: guest.id ?? guest._id ?? guest.inviteId,
  eventId,
  inviteId: guest.inviteId,
  fullName: guest.fullName,
  phoneNumber: guest.phoneNumber ?? '',
  email: guest.email,
  language: guest.language ?? 'he',
  status: guest.status ?? 'pending',
  maxAllowed: guest.maxAllowed ?? 2,
  menCount: guest.menCount ?? 0,
  womenCount: guest.womenCount ?? 0,
  adults: guest.rsvpDetails?.adults ?? 0,
  children: guest.rsvpDetails?.children ?? 0,
  notes: guest.rsvpDetails?.notes,
});

const normalizeMongoId = (value: { _id?: string; toString?: () => string } | string) => {
  if (typeof value === 'string') {
    return value;
  }

  return value._id ?? value.toString?.() ?? '';
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const requestId = createRequestId();
  const method = init?.method ?? 'GET';
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        ...(activeSession?.accessToken ? { authorization: `Bearer ${activeSession.accessToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    appLogger.request(method, path, 'failed');
    throw cause;
  }

  if (!response.ok) {
    appLogger.request(method, path, 'failed', response.status);
    if (response.status === 401 && activeSession) {
      expireSession();
    }

    throw new Error(await response.text());
  }

  appLogger.request(method, path, 'success', response.status);
  return response.json() as Promise<T>;
};

const authRequest = async (path: string, email: string, password: string): Promise<AuthResponse> => {
  const method = 'POST';
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-request-id': createRequestId() },
      body: JSON.stringify({ email, password }),
    });
  } catch (cause) {
    appLogger.request(method, path, 'failed');
    throw cause;
  }

  if (!response.ok) {
    appLogger.request(method, path, 'failed', response.status);
    throw new Error(await response.text());
  }

  appLogger.request(method, path, 'success', response.status);
  const result = await response.json() as AuthResponse;
  if ('accessToken' in result) {
    setApiSession(result);
  }

  return result;
};
