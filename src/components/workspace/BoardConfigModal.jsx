'use client';

import { useMemo, useState } from 'react';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import {
  Button,
  Dialog,
  ProjectSettingsForm,
  useConfirm,
} from '@/components/ui';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { updateProjectSettings } from '@/lib/services/projects';

export default function BoardConfigModal({
  project,
  issues = [],
  organizationMembers = [],
  canManageTeam = false,
  onClose,
}) {
  const showToast = useWorkspaceStore(state => state.showToast);
  const confirm = useConfirm();
  const { statuses, loading } = useWorkflowConfig();
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [hiddenColumns, setHiddenColumns] = useState(
    (project?.hiddenColumns || []).filter(statusId => statusId !== 'backlog'),
  );
  const [teamMemberIds, setTeamMemberIds] = useState(
    Array.isArray(project?.team) ? project.team : [],
  );
  const [saving, setSaving] = useState(false);
  const backlogStatusId = statuses.some(status => status.id === 'backlog')
    ? 'backlog'
    : statuses[0]?.id;
  const statusesToHide = useMemo(
    () => hiddenColumns.filter(statusId => statusId !== backlogStatusId),
    [backlogStatusId, hiddenColumns],
  );
  const affectedIssues = useMemo(
    () => issues.filter(issue => statusesToHide.includes(issue.columnId || issue.status)),
    [issues, statusesToHide],
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    if (statuses.length > 0 && statusesToHide.length >= statuses.length) {
      showToast('Дошка повинна мати хоча б одну видиму колонку', 'error');
      return;
    }

    const newlyHidden = statusesToHide.filter(
      statusId => !(project?.hiddenColumns || []).includes(statusId),
    );
    if (newlyHidden.length > 0 || affectedIssues.length > 0) {
      const hiddenLabels = statuses
        .filter(status => newlyHidden.includes(status.id))
        .map(status => status.label)
        .join(', ');
      const accepted = await confirm({
        title: 'Приховати колонки проєкту?',
        message: affectedIssues.length > 0
          ? `${affectedIssues.length} завд. із прихованих колонок буде перенесено в Беклог. ${hiddenLabels ? `Колонки: ${hiddenLabels}.` : ''}`
          : `Колонки ${hiddenLabels || 'буде приховано'}. Нові завдання з них не залишатимуться поза дошкою.`,
        confirmText: affectedIssues.length > 0 ? 'Приховати й перенести' : 'Приховати',
      });
      if (!accepted) return;
    }

    setSaving(true);
    try {
      const result = await updateProjectSettings(project.id, {
        name: name.trim(),
        description: description.trim(),
        hiddenColumns: statusesToHide,
        ...(canManageTeam ? { team: teamMemberIds } : {}),
      });
      showToast(
        result.movedIssues > 0
          ? `Налаштування збережено, ${result.movedIssues} завд. перенесено в Беклог ✓`
          : 'Налаштування проєкту збережено ✓',
      );
      onClose();
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Помилка збереження', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Налаштування проєкту"
      size="sm"
      footer={(
        <>
          <Button style="secondary" size="md" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            style="primary"
            size="md"
            onClick={handleSave}
            disabled={!name.trim() || saving || loading}
            loading={saving}
          >
            Зберегти зміни
          </Button>
        </>
      )}
    >
      <ProjectSettingsForm
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        statuses={statuses}
        hiddenStatusIds={statusesToHide}
        onHiddenStatusIdsChange={setHiddenColumns}
        backlogStatusId={backlogStatusId}
        teamMembers={canManageTeam ? organizationMembers : []}
        teamMemberIds={teamMemberIds}
        onTeamMemberIdsChange={canManageTeam ? setTeamMemberIds : undefined}
        ownerId={project?.createdBy}
        loading={loading}
        layout="stacked"
      />
    </Dialog>
  );
}
