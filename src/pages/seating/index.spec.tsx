/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import axe from 'axe-core';
import { MantineProvider } from '@mantine/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventCard, GuestRecord, SeatingTable } from '../../data';
import { canGuestFitTable, SeatingPanel } from '.';

const labels = new Proxy<Record<string, string>>({}, {
  get: (_target, property) => String(property),
});

const event: EventCard = {
  id: 'event_1', eventName: 'Event', eventDate: '2026-08-01', venueName: 'Hall', address: '', wazeLink: '',
  guests: 1, confirmed: 1, pending: 0, theme: 'wedding', seatingMode: 'mixed', bitLink: '',
  adminPhoneNumber: '', isActive: true, invitationDesignKey: 'soft',
};
const guest: GuestRecord = {
  id: 'guest_1', eventId: event.id, inviteId: 'invite_1', fullName: 'Guest Name', phoneNumber: '0500000000',
  language: 'he', status: 'confirmed', maxAllowed: 4, menCount: 0, womenCount: 0, adults: 2, children: 1,
};
const tables: SeatingTable[] = [{
  id: 'table_1', eventId: event.id, name: 'Table One', zone: 'Center', capacity: 2, guestIds: [],
}];

afterEach(() => cleanup());

describe('SeatingPanel', () => {
  it('does not offer a table that cannot fit the whole invitation', () => {
    expect(canGuestFitTable(guest, { seatsLeft: 2 })).toBe(false);
    expect(canGuestFitTable(guest, { seatsLeft: 3 })).toBe(true);
  });

  it('provides keyboard-operable table controls without accessibility violations', async () => {
    const { container } = render(
      <MantineProvider>
        <SeatingPanel
          guests={[guest]}
          labels={labels}
          seatingTables={tables}
          selectedEvent={event}
          onAssignGuest={vi.fn()}
          onCreateTable={vi.fn()}
          onDeleteTable={vi.fn()}
          onRemoveGuest={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(screen.getByRole('button', { name: 'chooseTable: Table One' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('combobox', { name: 'assignToTable: Guest Name' })).toBeDisabled();
    expect((await axe.run(container)).violations).toEqual([]);
  });
});
