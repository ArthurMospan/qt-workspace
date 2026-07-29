'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import FormGroup from '@/components/ui/Forms/FormGroup';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Forms/Textarea';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import StatusVisibilityPicker from './StatusVisibilityPicker';

export default function ProjectSettingsForm({
  name,
  onNameChange,
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
  loading = false,
  layout = 'responsive',
}) {
  const [teamSearch, setTeamSearch] = useState('');
  const filteredTeamMembers = useMemo(() => {
    const query = teamSearch.trim().toLocaleLowerCase('uk-UA');
    if (!query) return teamMembers;
    return teamMembers.filter(member => [member.name, member.displayName, member.email]
      .some(value => String(value || '').toLocaleLowerCase('uk-UA').includes(query)));
  }, [teamMembers, teamSearch]);
  const showTeamSettings = teamMembers.length > 0 && typeof onTeamMemberIdsChange === 'function';

  const toggleTeamMember = userId => {
    if (!userId || userId === ownerId) return;
    onTeamMemberIdsChange(
      teamMemberIds.includes(userId)
        ? teamMemberIds.filter(id => id !== userId)
        : [...teamMemberIds, userId],
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={
        layout === 'stacked'
          ? 'flex flex-col gap-6'
          : 'grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(320px,1.2fr)]'
      }>
        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h3 className="ui-type-card-title mb-1 text-ink">Основні дані</h3>
            <p className="mb-4 text-[13px] text-muted">
              Назва й опис проєкту для всіх його представлень.
            </p>
          </div>
          <FormGroup label="Назва проєкту" required>
            <Input value={name} onChange={event => onNameChange?.(event.target.value)} />
          </FormGroup>
          <FormGroup label="Опис">
            <Textarea
              value={description}
              onChange={event => onDescriptionChange?.(event.target.value)}
              rows={4}
              placeholder="Короткий опис проєкту..."
            />
          </FormGroup>
        </div>

        <div className="min-w-0">
          <h3 className="ui-type-card-title mb-1 text-ink">Видимість колонок</h3>
          <p className="mb-4 text-[13px] text-muted">
            Беклог завжди залишається видимим. Завдання зі статусів, які ви приховаєте,
            будуть перенесені в Беклог після підтвердження.
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
        </div>
      </div>

      {showTeamSettings ? (
        <section className="border-t border-line pt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="ui-type-card-title mb-1 text-ink">Команда проєкту</h3>
              <p className="text-[13px] text-muted">
                Оберіть учасників організації, які працюють у цьому проєкті.
              </p>
            </div>
            <Input
              value={teamSearch}
              onChange={event => setTeamSearch(event.target.value)}
              icon={Search}
              size="md"
              placeholder="Знайти учасника..."
              className="sm:w-[260px]"
            />
          </div>

          <div className="grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredTeamMembers.map(member => {
              const userId = member.id || member.uid;
              const active = teamMemberIds.includes(userId);
              const locked = userId === ownerId;
              return (
                <button
                  key={userId}
                  type="button"
                  data-ui-control="choice-card"
                  aria-pressed={active}
                  disabled={locked}
                  onClick={() => toggleTeamMember(userId)}
                  className={`ui-native-control gap-3 ${
                    active
                      ? 'border-ink bg-canvas'
                      : 'border-line bg-white hover:border-muted'
                  } ${locked ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <UserAvatar user={member} size={34} />
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-[12px] font-bold text-ink">
                        {member.name || member.displayName || member.email || 'Учасник'}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted">
                        {locked ? 'Власник проєкту' : member.email || 'Учасник організації'}
                      </span>
                    </span>
                  </span>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    active ? 'bg-ink text-white' : 'border border-line text-transparent'
                  }`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
