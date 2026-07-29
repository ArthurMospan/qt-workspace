'use client';

import { UserPlus, Users } from 'lucide-react';
import FormGroup from '@/components/ui/Forms/FormGroup';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Forms/Textarea';
import { MultiSelect } from '@/components/ui/Select';
import StatusVisibilityPicker from './StatusVisibilityPicker';

// Shared body for "Новий проєкт" and "Налаштування проєкту". Both dialogs edit
// exactly the same four things, so they render the same form — only the title,
// the footer buttons and the optional danger zone differ.
export default function ProjectSettingsForm({
  name,
  onNameChange,
  nameError,
  description,
  onDescriptionChange,
  statuses = [],
  hiddenStatusIds = [],
  onHiddenStatusIdsChange,
  backlogStatusId,
  teamMembers = [],
  teamMemberIds = [],
  onTeamMemberIdsChange,
  ownerId,
  teamHint = 'Ви як автор проєкту будете додані автоматично.',
  teamPlaceholder = 'Оберіть учасників проєкту',
  onInvite,
  loading = false,
  dangerZone = null,
}) {
  const showTeamSettings = teamMembers.length > 0 && typeof onTeamMemberIdsChange === 'function';

  const memberOptions = teamMembers.flatMap(member => {
    const userId = member.id || member.uid;
    if (!userId) return [];
    return [{
      value: userId,
      label: member.name || member.displayName || member.email || 'Учасник',
      user: member,
    }];
  });

  // The owner can never be dropped from their own project, so a deselect that
  // would remove them is silently corrected instead of rejected.
  const handleTeamChange = next => {
    onTeamMemberIdsChange(
      ownerId && !next.includes(ownerId) && teamMemberIds.includes(ownerId)
        ? [...next, ownerId]
        : next,
    );
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <FormGroup label="Назва проєкту" required error={nameError}>
        <Input
          value={name}
          onChange={event => onNameChange?.(event.target.value)}
          placeholder="Наприклад: Редизайн сайту"
          composition="project-name"
          error={Boolean(nameError)}
        />
      </FormGroup>

      <FormGroup label="Опис">
        <Textarea
          value={description}
          onChange={event => onDescriptionChange?.(event.target.value)}
          rows={3}
          placeholder="Короткий опис проєкту..."
          composition="project-description"
        />
      </FormGroup>

      {showTeamSettings ? (
        <FormGroup label="Команда проєкту">
          <div className="flex items-center gap-2">
            <MultiSelect
              value={teamMemberIds}
              onChange={handleTeamChange}
              options={memberOptions}
              placeholder={teamPlaceholder}
              searchPlaceholder="Знайти учасника..."
              className="min-w-0 flex-1"
              dropdownClassName="w-full max-w-none"
              triggerIcon={Users}
              selectAllLabel="Вибрати всіх учасників"
              showSelectedAvatars
            />
            {onInvite ? (
              <Button
                style="secondary"
                size="lg"
                icon={UserPlus}
                onClick={onInvite}
                title="Запросити нову людину в організацію"
              >
                Запросити
              </Button>
            ) : null}
          </div>
          {teamHint ? <p className="mt-1.5 text-[11px] text-muted">{teamHint}</p> : null}
        </FormGroup>
      ) : null}

      <FormGroup label="Колонки проєкту">
        <p className="text-[11px] text-muted">
          Оберіть потрібні колонки. Беклог залишається видимим завжди. Завдання зі
          статусів, які ви приховаєте, будуть перенесені в Беклог після підтвердження.
        </p>
        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          <StatusVisibilityPicker
            statuses={statuses}
            hiddenStatusIds={hiddenStatusIds}
            onChange={onHiddenStatusIdsChange}
            backlogStatusId={backlogStatusId}
          />
        )}
      </FormGroup>

      {dangerZone}
    </div>
  );
}
