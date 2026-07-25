'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays, Pencil, RefreshCw } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { useCalendarEventTimeLogs } from '@/lib/hooks/useCalendarEventTimeLogs';
import {
  calendarEventSourceId,
  findCalendarEvent,
} from '@/lib/utils/calendarEventNavigation.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  Button,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  Surface,
} from '@/components/ui';
import CalendarEventDialog, {
  CalendarEventDetails,
} from '@/components/workspace/calendar/CalendarEventDialog';

export default function CalendarEventPage({ eventId, occurrenceStartAt = '' }) {
  const router = useRouter();
  const { currentUser, projects = [], orgRole } = useAppContext();
  const { members } = useOrganization();
  const {
    events,
    loading,
    error: loadError,
    refresh,
    updateEvent,
    removeEvent,
    respondToEvent,
  } = useCalendarEvents();
  const showToast = useWorkspaceStore(state => state.showToast);
  const currentUserId = currentUser?.uid || currentUser?.id || '';
  const event = useMemo(
    () => findCalendarEvent(events, eventId, occurrenceStartAt),
    [eventId, events, occurrenceStartAt],
  );
  const sourceEventId = calendarEventSourceId(event) || eventId;
  const {
    logs: timeLogs,
    totalMinutes,
    loading: timeLoading,
    addTimeLog,
    deleteTimeLog,
  } = useCalendarEventTimeLogs(event?.readOnly ? '' : sourceEventId, event?.startAt || '');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  const canManage = Boolean(event && !event.readOnly && (
    event.organizerId === currentUserId
    || (event.visibility !== 'private' && ['owner', 'admin'].includes(orgRole))
  ));
  const response = event?.participantResponses?.[currentUserId] || 'pending';
  const isParticipant = event?.participantIds?.includes(currentUserId);

  const handleSave = async data => {
    await updateEvent(sourceEventId, data);
    setEditOpen(false);
    showToast('Подію оновлено', 'success');
  };

  const handleDelete = async () => {
    await removeEvent(sourceEventId);
    showToast('Подію скасовано', 'success');
    router.push('/calendar');
  };

  const handleRespond = async value => {
    setSaving(true);
    setActionError('');
    try {
      await respondToEvent(sourceEventId, value);
      showToast('Відповідь збережено', 'success');
    } catch (responseError) {
      setActionError(responseError.message || 'Не вдалося зберегти відповідь');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTime = async formEvent => {
    formEvent.preventDefault();
    const formElement = formEvent.currentTarget;
    const data = new FormData(formElement);
    setTimeSaving(true);
    setActionError('');
    try {
      await addTimeLog({
        userId: currentUserId,
        projectId: event?.projectId || '',
        spentMinutes: Number(data.get('minutes')),
        description: data.get('description'),
      });
      formElement.reset();
      showToast('Час події додано в аналітику', 'success');
    } catch (timeError) {
      setActionError(timeError.message || 'Не вдалося додати час');
    } finally {
      setTimeSaving(false);
    }
  };

  const handleDeleteTime = async logId => {
    setActionError('');
    try {
      await deleteTimeLog(logId);
      showToast('Запис часу видалено', 'success');
    } catch (timeError) {
      setActionError(timeError.message || 'Не вдалося видалити запис часу');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="workspace-page-layout min-h-full pb-[24px]">
        <PageHeader
          title="Деталі події"
          actions={<Button style="secondary" icon={ArrowLeft} onClick={() => router.push('/calendar')}>До календаря</Button>}
        />
        <Surface variant="panel" padding="lg" className="flex min-h-[360px] items-center justify-center">
          <EmptyState
            icon={loadError ? RefreshCw : CalendarDays}
            title={loadError ? 'Не вдалося завантажити подію' : 'Подію не знайдено'}
            description={loadError?.message || 'Можливо, подію видалили або у вас немає до неї доступу.'}
            action={loadError ? 'Спробувати ще раз' : 'Повернутися до календаря'}
            onAction={loadError ? refresh : () => router.push('/calendar')}
          />
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-transparent">
      <div className="workspace-page-layout min-h-full pb-[40px]">
        <PageHeader
          title="Деталі події"
          actions={(
            <div className="flex items-center gap-2">
              <Button style="secondary" icon={ArrowLeft} onClick={() => router.push('/calendar')}>До календаря</Button>
              {canManage && <Button icon={Pencil} onClick={() => setEditOpen(true)}>Редагувати</Button>}
            </div>
          )}
        />

        <Surface variant="panel" padding="lg" className="flex-1">
          <div className="mx-auto w-full max-w-[920px] rounded-[20px] bg-white p-4 sm:p-6">
            <CalendarEventDetails
              event={event}
              members={members}
              projects={projects}
              currentUserId={currentUserId}
              response={response}
              isParticipant={isParticipant}
              saving={saving}
              error={actionError}
              timeLogs={timeLogs}
              totalMinutes={totalMinutes}
              timeLoading={timeLoading}
              timeSaving={timeSaving}
              onAddTime={handleAddTime}
              onDeleteTime={handleDeleteTime}
              onRespond={handleRespond}
            />
          </div>
        </Surface>
      </div>

      {editOpen && (
        <CalendarEventDialog
          isOpen
          event={event}
          members={members}
          projects={projects}
          currentUserId={currentUserId}
          canManage={canManage}
          initialMode="edit"
          onCancelEdit={() => setEditOpen(false)}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
          onRespond={handleRespond}
        />
      )}
    </div>
  );
}
