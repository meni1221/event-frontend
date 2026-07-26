import { Alert, Badge, Button, Card, Group, NumberInput, Progress, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { ReactNode } from 'react';
import { IconArmchair, IconDownload, IconPlus, IconUserPlus, IconUsersGroup, IconX } from '@tabler/icons-react';
import { uiConfig } from '../../config';
import { EventCard, GuestRecord, SeatingTable } from '../../data';
import { useComponentLogger } from '../../utils/component-logger';
import { sanitizeShortTextInput } from '../../utils/input-sanitize';

type SeatingPanelProps = {
  guests: GuestRecord[];
  labels: Record<string, string>;
  seatingTables: SeatingTable[];
  selectedEvent: EventCard | undefined;
  onAssignGuest: (guestId: string, tableId: string) => Promise<void>;
  onCreateTable: (table: SeatingTable) => Promise<void>;
  onDeleteTable: (tableId: string) => Promise<void>;
  onRemoveGuest: (guestId: string) => Promise<void>;
};

type TableMetric = SeatingTable & {
  guests: GuestRecord[];
  seatedCount: number;
  seatsLeft: number;
};

type SeatingViewMode = 'tables' | 'gender';

export const getPartySize = (guest: GuestRecord) => {
  const total = guest.adults + guest.children;
  return total > 0 ? total : 1;
};

export const canGuestFitTable = (guest: GuestRecord, table: Pick<TableMetric, 'seatsLeft'>) =>
  table.seatsLeft >= getPartySize(guest);

const getGenderSplitText = (guest: GuestRecord, labels: Record<string, string>) => {
  if (!guest.menCount && !guest.womenCount) {
    return '';
  }

  return ` · ${labels.men}: ${guest.menCount} / ${labels.women}: ${guest.womenCount}`;
};

export const SeatingPanel = ({
  guests,
  labels,
  seatingTables,
  selectedEvent,
  onAssignGuest,
  onCreateTable,
  onDeleteTable,
  onRemoveGuest,
}: SeatingPanelProps) => {
  useComponentLogger('SeatingPanel', { selectedEventId: selectedEvent?.id, tables: seatingTables.length, guests: guests.length });
  const eventTables = useMemo(
    () => seatingTables.filter((table) => table.eventId === selectedEvent?.id),
    [seatingTables, selectedEvent?.id],
  );
  const [selectedTableId, setSelectedTableId] = useState(eventTables[0]?.id ?? '');
  const [tableName, setTableName] = useState('');
  const [tableZone, setTableZone] = useState('');
  const [tableCapacity, setTableCapacity] = useState<number | string>(10);
  const [viewMode, setViewMode] = useState<SeatingViewMode>('tables');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const eventGuests = useMemo(
    () => guests.filter((guest) => guest.eventId === selectedEvent?.id && guest.status !== 'declined'),
    [guests, selectedEvent?.id],
  );

  const tableMetrics = useMemo<TableMetric[]>(
    () =>
      eventTables.map((table) => {
        const tableGuests = eventGuests.filter((guest) => table.guestIds.includes(guest.id));
        const seatedCount = tableGuests.reduce((sum, guest) => sum + getPartySize(guest), 0);

        return {
          ...table,
          guests: tableGuests,
          seatedCount,
          seatsLeft: table.capacity - seatedCount,
        };
      }),
    [eventGuests, eventTables],
  );

  const assignedGuestIds = useMemo(
    () => new Set(tableMetrics.flatMap((table) => table.guestIds)),
    [tableMetrics],
  );
  const unassignedGuests = eventGuests.filter((guest) => !assignedGuestIds.has(guest.id));
  const selectedTable = tableMetrics.find((table) => table.id === selectedTableId) ?? tableMetrics[0];
  const totalSeated = tableMetrics.reduce((sum, table) => sum + table.seatedCount, 0);
  const totalCapacity = tableMetrics.reduce((sum, table) => sum + table.capacity, 0);
  const totalMen = eventGuests.reduce((sum, guest) => sum + (guest.menCount || 0), 0);
  const totalWomen = eventGuests.reduce((sum, guest) => sum + (guest.womenCount || 0), 0);

  const runMutation = async (mutation: () => Promise<void>) => {
    if (isSaving) {
      return false;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      await mutation();
      return true;
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : labels.seatingSaveError);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTable = async () => {
    if (!selectedEvent || !tableName.trim()) {
      return;
    }

    const table: SeatingTable = {
      id: `table_${crypto.randomUUID().replace(/-/g, '')}`,
      eventId: selectedEvent.id,
      name: tableName.trim(),
      zone: tableZone.trim() || labels.generalZone,
      capacity: Number(tableCapacity) || 10,
      guestIds: [],
    };

    const saved = await runMutation(() => onCreateTable(table));
    if (!saved) {
      return;
    }
    setSelectedTableId(table.id);
    setTableName('');
    setTableZone('');
    setTableCapacity(10);
  };

  const exportSeatingCsv = () => {
    const assignedTableByGuestId = new Map<string, SeatingTable>();
    tableMetrics.forEach((table) => {
      table.guestIds.forEach((guestId) => assignedTableByGuestId.set(guestId, table));
    });

    const rows = eventGuests.map((guest) => {
      const table = assignedTableByGuestId.get(guest.id);
      return [
        guest.fullName,
        guest.phoneNumber,
        guest.email ?? '',
        labels[guest.status],
        String(guest.maxAllowed),
        String(guest.menCount || 0),
        String(guest.womenCount || 0),
        String(getPartySize(guest)),
        table?.name ?? labels.unassignedGuests,
        table?.zone ?? '',
        guest.notes ?? '',
      ];
    });

    downloadCsv(`${selectedEvent?.eventName || 'seating'}-seating.csv`, [
      [
        labels.fullName,
        labels.phoneNumber,
        labels.email,
        labels.status,
        labels.maxAllowed,
        labels.men,
        labels.women,
        labels.seats,
        labels.tableName,
        labels.tableZone,
        labels.notes,
      ],
      ...rows,
    ]);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Title order={2}>{labels.seating}</Title>
          <Text size="sm" c="dimmed">{selectedEvent?.eventName}</Text>
        </Stack>
        <Group>
          <Button variant="light" leftSection={<IconDownload size={uiConfig.icons.button} />} onClick={exportSeatingCsv}>
            {labels.exportExcel}
          </Button>
          <Badge size="lg" variant="light" color="ishruGreen">
            {totalSeated}/{totalCapacity || 0} {labels.seatsAssigned}
          </Badge>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <SeatingMetric label={labels.tables} value={eventTables.length} />
        <SeatingMetric label={labels.unassignedGuests} value={unassignedGuests.length} />
        <SeatingMetric label={labels.seatedGuests} value={totalSeated} />
      </SimpleGrid>

      {saveError && (
        <Alert color="red" title={labels.seatingSaveError} role="alert" withCloseButton onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      <SegmentedControl
        value={viewMode}
        onChange={(value) => setViewMode(value as SeatingViewMode)}
        data={[
          { value: 'tables', label: labels.tableView },
          { value: 'gender', label: labels.genderView },
        ]}
      />

      {viewMode === 'gender' ? (
        <GenderSeatingView
          guests={eventGuests}
          labels={labels}
          totalMen={totalMen}
          totalWomen={totalWomen}
        />
      ) : (
      <SimpleGrid cols={{ base: 1, lg: 3 }} className="seatingGrid">
        <Stack gap="md">
          <Card className="studioCard" withBorder radius="sm" p="lg">
            <Stack gap="sm">
              <Group gap="xs">
                <IconPlus size={uiConfig.icons.alert} />
                <Title order={3}>{labels.addTable}</Title>
              </Group>
              <TextInput
                label={labels.tableName}
                value={tableName}
                onChange={(event) => setTableName(sanitizeShortTextInput(event.currentTarget.value))}
                required
              />
              <TextInput
                label={labels.tableZone}
                value={tableZone}
                onChange={(event) => setTableZone(sanitizeShortTextInput(event.currentTarget.value))}
                required
              />
              <NumberInput label={labels.capacity} min={1} value={tableCapacity} onChange={setTableCapacity} required />
              <Button loading={isSaving} leftSection={<IconPlus size={uiConfig.icons.button} />} onClick={handleCreateTable}>
                {labels.createTable}
              </Button>
            </Stack>
          </Card>

          {tableMetrics.map((table) => (
            <TableCard
              key={table.id}
              labels={labels}
              table={table}
              isSelected={selectedTable?.id === table.id}
              onSelect={() => setSelectedTableId(table.id)}
            />
          ))}
        </Stack>

        <Card className="studioCard seatingFocus" withBorder radius="sm" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Stack gap={2}>
                <Title order={3}>{selectedTable?.name ?? labels.chooseTable}</Title>
                <Text size="sm" c="dimmed">{selectedTable?.zone}</Text>
              </Stack>
              <Group gap="xs">
                <Badge variant="light">{selectedTable?.seatedCount ?? 0}/{selectedTable?.capacity ?? 0}</Badge>
                {selectedTable && (
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    disabled={isSaving}
                    onClick={() => void runMutation(() => onDeleteTable(selectedTable.id))}
                  >
                    {labels.deleteTable}
                  </Button>
                )}
              </Group>
            </Group>

            {selectedTable?.guests.length ? (
              selectedTable.guests.map((guest) => (
                <GuestSeatRow
                  key={guest.id}
                  guest={guest}
                  labels={labels}
                  action={
                    <Button size="xs" variant="subtle" color="red" disabled={isSaving} leftSection={<IconX size={uiConfig.icons.smallButton} />} onClick={() => void runMutation(() => onRemoveGuest(guest.id))}>
                      {labels.remove}
                    </Button>
                  }
                />
              ))
            ) : (
              <EmptySeatingState labels={labels} />
            )}
          </Stack>
        </Card>

        <Card className="studioCard" withBorder radius="sm" p="lg">
          <Stack gap="md">
            <Group gap="xs">
              <IconUserPlus size={uiConfig.icons.alert} />
              <Title order={3}>{labels.unassignedGuests}</Title>
            </Group>

            {unassignedGuests.length ? (
              unassignedGuests.map((guest) => (
                <GuestSeatRow
                  key={guest.id}
                  guest={guest}
                  labels={labels}
                  action={
                    <Select
                      size="xs"
                      w={180}
                      placeholder={tableMetrics.some((table) => canGuestFitTable(guest, table)) ? labels.assignToTable : labels.noTableCapacity}
                      data={tableMetrics.filter((table) => canGuestFitTable(guest, table)).map((table) => ({
                        value: table.id,
                        label: `${table.name} (${table.seatsLeft} ${labels.seatsLeft})`,
                      }))}
                      disabled={isSaving || !tableMetrics.some((table) => canGuestFitTable(guest, table))}
                      aria-label={`${labels.assignToTable}: ${guest.fullName}`}
                      onChange={(tableId) => tableId && void runMutation(() => onAssignGuest(guest.id, tableId))}
                    />
                  }
                />
              ))
            ) : (
              <EmptySeatingState labels={labels} text={labels.allGuestsSeated} />
            )}
          </Stack>
        </Card>
      </SimpleGrid>
      )}
    </Stack>
  );
};

const SeatingMetric = ({ label, value }: { label: string; value: number }) => (
  <Card className="studioCard" withBorder radius="sm" p="md">
    <Text size="sm" c="dimmed">{label}</Text>
    <Text fw={900} size="xl">{value}</Text>
  </Card>
);

const TableCard = ({
  labels,
  table,
  isSelected,
  onSelect,
}: {
  labels: Record<string, string>;
  table: TableMetric;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const progress = table.capacity ? Math.min((table.seatedCount / table.capacity) * 100, 100) : 0;
  const color = table.seatsLeft < 0 ? 'red' : table.seatsLeft <= 2 ? 'yellow' : 'ishruGreen';

  return (
    <Card
      className={isSelected ? 'studioCard seatingTable selected' : 'studioCard seatingTable'}
      withBorder
      radius="sm"
      p="md"
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${labels.chooseTable}: ${table.name}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconArmchair size={uiConfig.icons.alert} />
            <Text fw={900}>{table.name}</Text>
          </Group>
          <Badge color={color} variant="light">{table.seatsLeft} {labels.seatsLeft}</Badge>
        </Group>
        <Text size="sm" c="dimmed">{table.zone}</Text>
        <Progress value={progress} color={color} radius="xl" aria-label={`${table.name}: ${labels.seatsAssigned}`} />
        <Text size="xs" c="dimmed">{table.seatedCount}/{table.capacity} {labels.seatsAssigned}</Text>
      </Stack>
    </Card>
  );
};

const GuestSeatRow = ({
  action,
  guest,
  labels,
}: {
  action: ReactNode;
  guest: GuestRecord;
  labels: Record<string, string>;
}) => (
  <Group className="seatGuestRow" justify="space-between" wrap="nowrap">
    <Stack gap={1}>
      <Text fw={800}>{guest.fullName}</Text>
      <Text size="xs" c="dimmed">
        {getPartySize(guest)} {labels.seats} · {guest.phoneNumber}{getGenderSplitText(guest, labels)}
      </Text>
    </Stack>
    {action}
  </Group>
);

const EmptySeatingState = ({ labels, text }: { labels: Record<string, string>; text?: string }) => (
  <Card withBorder radius="sm" p="md" className="emptySeatingState">
    <Text size="sm" c="dimmed">{text ?? labels.noSeatingGuests}</Text>
  </Card>
);

const GenderSeatingView = ({
  guests,
  labels,
  totalMen,
  totalWomen,
}: {
  guests: GuestRecord[];
  labels: Record<string, string>;
  totalMen: number;
  totalWomen: number;
}) => {
  const guestsWithSplit = guests.filter((guest) => guest.menCount || guest.womenCount);
  const guestsWithoutSplit = guests.filter((guest) => !guest.menCount && !guest.womenCount);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <SeatingMetric label={labels.men} value={totalMen} />
        <SeatingMetric label={labels.women} value={totalWomen} />
        <SeatingMetric label={labels.noGenderSplit} value={guestsWithoutSplit.length} />
      </SimpleGrid>

      <Card className="studioCard" withBorder radius="sm" p="lg">
        <Stack gap="md">
          <Group gap="xs">
            <IconUsersGroup size={uiConfig.icons.alert} />
            <Title order={3}>{labels.genderView}</Title>
          </Group>

          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{labels.fullName}</Table.Th>
                  <Table.Th>{labels.phoneNumber}</Table.Th>
                  <Table.Th>{labels.men}</Table.Th>
                  <Table.Th>{labels.women}</Table.Th>
                  <Table.Th>{labels.maxAllowed}</Table.Th>
                  <Table.Th>{labels.arriving}</Table.Th>
                  <Table.Th>{labels.status}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {guestsWithSplit.map((guest) => (
                  <Table.Tr key={guest.id}>
                    <Table.Td>{guest.fullName}</Table.Td>
                    <Table.Td>{guest.phoneNumber}</Table.Td>
                    <Table.Td>{guest.menCount || 0}</Table.Td>
                    <Table.Td>{guest.womenCount || 0}</Table.Td>
                    <Table.Td>{guest.maxAllowed}</Table.Td>
                    <Table.Td>{getPartySize(guest)}</Table.Td>
                    <Table.Td><Badge variant="light">{labels[guest.status]}</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {!guestsWithSplit.length && (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text ta="center" c="dimmed" size="sm">{labels.noGenderSplitGuests}</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>
    </Stack>
  );
};

const escapeCsvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

const downloadCsv = (fileName: string, rows: string[][]) => {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.replace(/[\\/:*?"<>|]/g, '-');
  link.click();
  URL.revokeObjectURL(url);
};
