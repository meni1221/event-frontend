import { Badge, Button, Card, Group, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { IconBan, IconCheck, IconRefresh } from '@tabler/icons-react';
import { approveAdmin, getOwnerOverview, OwnerEvent, OwnerUser, restoreAdmin, suspendAdmin } from '../../api';
import { useFeedback } from '../../components/feedback';
import { uiConfig } from '../../config';
import { useComponentLogger } from '../../utils/component-logger';
import { getFriendlyErrorMessage } from '../../utils/error-message';
import { appLogger } from '../../utils/logger';

type OwnerPanelProps = {
  labels: Record<string, string>;
};

export const OwnerPanel = ({ labels }: OwnerPanelProps) => {
  useComponentLogger('OwnerPanel');
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<OwnerUser | null>(null);
  const { showFeedback } = useFeedback();

  const eventsByHostId = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => {
      map.set(event.hostId, (map.get(event.hostId) ?? 0) + 1);
    });
    return map;
  }, [events]);

  const loadOverview = async () => {
    try {
      const overview = await getOwnerOverview();
      setUsers(overview.users);
      setEvents(overview.events);
      appLogger.info('owner.overview.loaded', 'Owner overview loaded', { users: overview.users.length, events: overview.events.length });
    } catch (cause) {
      showFeedback({
        type: 'error',
        title: labels.actionFailed,
        message: getFriendlyErrorMessage(cause, labels),
      });
    }
  };

  const updateAccountStatus = async (user: OwnerUser, action: 'restore' | 'suspend') => {
    setLoadingId(user.id);
    try {
      const updatedUser = action === 'suspend' ? await suspendAdmin(user.id) : await restoreAdmin(user.id);
      setUsers((currentUsers) => currentUsers.map((currentUser) => (
        currentUser.id === user.id ? { ...currentUser, ...updatedUser } : currentUser
      )));
      appLogger.info(
        `owner.admin.${action}`,
        action === 'suspend' ? 'Owner suspended admin user' : 'Owner restored admin user',
        { adminId: user.id, email: updatedUser.email },
      );
      showFeedback({
        type: 'success',
        title: action === 'suspend' ? labels.adminSuspended : labels.adminRestored,
        message: action === 'suspend' ? labels.adminSuspendedMessage : labels.adminRestoredMessage,
      });
      return true;
    } catch (cause) {
      showFeedback({
        type: 'error',
        title: labels.actionFailed,
        message: getFriendlyErrorMessage(cause, labels),
      });
      return false;
    } finally {
      setLoadingId(null);
    }
  };

  const approveUser = async (userId: string) => {
    setLoadingId(userId);
    try {
      const updatedUser = await approveAdmin(userId);
      setUsers((currentUsers) => currentUsers.map((user) => (user.id === userId ? { ...user, ...updatedUser } : user)));
      appLogger.info('owner.admin.approved', 'Owner approved admin user', { adminId: userId, email: updatedUser.email });
      showFeedback({
        type: 'success',
        title: labels.adminApproved,
        message: labels.adminApprovedMessage,
      });
    } catch (cause) {
      showFeedback({
        type: 'error',
        title: labels.actionFailed,
        message: getFriendlyErrorMessage(cause, labels),
      });
    } finally {
      setLoadingId(null);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <Stack gap="md">
      <Modal
        centered
        opened={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title={labels.suspendAdminTitle}
      >
        <Stack gap="md">
          <Text>
            {labels.suspendAdminConfirmation?.replace('{email}', suspendTarget?.email ?? '')}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSuspendTarget(null)}>
              {labels.cancel}
            </Button>
            <Button
              color="red"
              loading={loadingId === suspendTarget?.id}
              leftSection={<IconBan size={uiConfig.icons.smallButton} />}
              onClick={async () => {
                if (suspendTarget && await updateAccountStatus(suspendTarget, 'suspend')) {
                  setSuspendTarget(null);
                }
              }}
            >
              {labels.suspendAdmin}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Stack gap={2}>
        <Title order={2}>{labels.ownerDashboard}</Title>
        <Text size="sm" c="dimmed">{labels.ownerDashboardDescription}</Text>
      </Stack>

      <Card className="studioCard" withBorder radius="sm" p="lg">
        <Stack gap="md">
          <Title order={3}>{labels.systemUsers}</Title>
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{labels.email}</Table.Th>
                  <Table.Th>{labels.status}</Table.Th>
                  <Table.Th>{labels.activeEvents}</Table.Th>
                  <Table.Th>WhatsApp</Table.Th>
                  <Table.Th>{labels.lastSeen}</Table.Th>
                  <Table.Th>{labels.actions}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={user.accountStatus === 'APPROVED' ? 'ishruGreen' : user.accountStatus === 'SUSPENDED' ? 'red' : 'yellow'}
                        variant="light"
                      >
                        {labels[user.accountStatus] ?? user.accountStatus}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{eventsByHostId.get(user.id) ?? 0}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{user.whatsappStatus}</Badge>
                    </Table.Td>
                    <Table.Td>{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '-'}</Table.Td>
                    <Table.Td>
                      {user.accountStatus === 'PENDING_APPROVAL' && (
                        <Button
                          size="xs"
                          leftSection={<IconCheck size={uiConfig.icons.smallButton} />}
                          loading={loadingId === user.id}
                          onClick={() => approveUser(user.id)}
                        >
                          {labels.approveAdmin}
                        </Button>
                      )}
                      {user.role === 'HOST' && user.accountStatus === 'APPROVED' && (
                        <Button
                          color="red"
                          size="xs"
                          variant="light"
                          leftSection={<IconBan size={uiConfig.icons.smallButton} />}
                          loading={loadingId === user.id}
                          onClick={() => setSuspendTarget(user)}
                        >
                          {labels.suspendAdmin}
                        </Button>
                      )}
                      {user.role === 'HOST' && user.accountStatus === 'SUSPENDED' && (
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconRefresh size={uiConfig.icons.smallButton} />}
                          loading={loadingId === user.id}
                          onClick={() => updateAccountStatus(user, 'restore')}
                        >
                          {labels.restoreAdmin}
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>

      <Card className="studioCard" withBorder radius="sm" p="lg">
        <Stack gap="md">
          <Title order={3}>{labels.events}</Title>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{labels.eventName}</Table.Th>
                  <Table.Th>{labels.eventDate}</Table.Th>
                  <Table.Th>{labels.venue}</Table.Th>
                  <Table.Th>{labels.totalGuests}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {events.map((event) => (
                  <Table.Tr key={event.id}>
                    <Table.Td>{event.eventName}</Table.Td>
                    <Table.Td>{event.eventDate ? new Date(event.eventDate).toLocaleDateString() : '-'}</Table.Td>
                    <Table.Td>{event.venueName || '-'}</Table.Td>
                    <Table.Td>{event.totalGuests}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>
    </Stack>
  );
};
