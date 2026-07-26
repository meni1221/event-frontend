/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerUser } from '../../api';
import { FeedbackProvider } from '../../components/feedback';
import { OwnerPanel } from '.';

const apiMocks = vi.hoisted(() => ({
  getOwnerOverview: vi.fn(),
  restoreAdmin: vi.fn(),
  suspendAdmin: vi.fn(),
}));

vi.mock('../../api', () => ({
  approveAdmin: vi.fn(),
  getOwnerOverview: apiMocks.getOwnerOverview,
  restoreAdmin: apiMocks.restoreAdmin,
  suspendAdmin: apiMocks.suspendAdmin,
}));

const labels = new Proxy<Record<string, string>>({}, {
  get: (_target, property) => String(property),
});

const createUser = (overrides: Partial<OwnerUser>): OwnerUser => ({
  id: 'host-id',
  email: 'host@example.com',
  role: 'HOST',
  accountStatus: 'APPROVED',
  whatsappStatus: 'DISCONNECTED',
  ...overrides,
});

const renderOwnerPanel = () => render(
  <MantineProvider>
    <FeedbackProvider>
      <OwnerPanel labels={labels} />
    </FeedbackProvider>
  </MantineProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

describe('OwnerPanel account lifecycle', () => {
  it('requires confirmation to suspend a host and never offers the action for an owner', async () => {
    const owner = createUser({ id: 'owner-id', email: 'owner@example.com', role: 'OWNER' });
    const host = createUser({});
    apiMocks.getOwnerOverview.mockResolvedValue({ users: [owner, host], events: [] });
    apiMocks.suspendAdmin.mockResolvedValue({ ...host, accountStatus: 'SUSPENDED' });

    renderOwnerPanel();

    const ownerRow = (await screen.findByText('owner@example.com')).closest('tr');
    const hostRow = screen.getByText('host@example.com').closest('tr');
    expect(ownerRow).not.toBeNull();
    expect(hostRow).not.toBeNull();
    expect(within(ownerRow as HTMLElement).queryByRole('button', { name: 'suspendAdmin' })).not.toBeInTheDocument();

    fireEvent.click(within(hostRow as HTMLElement).getByRole('button', { name: 'suspendAdmin' }));
    const dialog = await screen.findByRole('dialog', { name: 'suspendAdminTitle' });
    expect(dialog).toHaveTextContent('host@example.com');
    expect(apiMocks.suspendAdmin).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'suspendAdmin' }));
    await waitFor(() => expect(apiMocks.suspendAdmin).toHaveBeenCalledWith('host-id'));
    await screen.findByRole('button', { name: 'restoreAdmin' });
  });

  it('restores a suspended host without a destructive confirmation', async () => {
    const host = createUser({ accountStatus: 'SUSPENDED' });
    apiMocks.getOwnerOverview.mockResolvedValue({ users: [host], events: [] });
    apiMocks.restoreAdmin.mockResolvedValue({ ...host, accountStatus: 'APPROVED' });

    renderOwnerPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'restoreAdmin' }));
    await waitFor(() => expect(apiMocks.restoreAdmin).toHaveBeenCalledWith('host-id'));
    await screen.findByRole('button', { name: 'suspendAdmin' });
  });
});
