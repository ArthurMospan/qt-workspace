'use client';

import { useState } from 'react';
import {
  CalendarDays,
  CircleDot,
  Clock3,
  Copy,
  Flag,
  MoreHorizontal,
  Shapes,
  Tags,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import ContextMenu from '@/components/ui/ContextMenu';
import { Select } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmProvider';

function encodedOptions(options, operations) {
  return operations.flatMap(operation => options.map(option => ({
    ...option,
    value: `${operation.id}:${option.value}`,
    label: `${operation.label}: ${option.label}`,
  })));
}

/**
 * Fixed toolbar for an active task selection. Common attributes stay visible;
 * less frequent and destructive operations live in its overflow menu.
 *
 * @param {object} props
 * @param {number} props.count Number of currently selected visible tasks.
 * @param {object[]} props.statusOptions Status or category destinations.
 * @param {object[]} props.memberOptions Organization members available for assignment.
 * @param {object[]} props.priorityOptions Configured priorities, including the explicit none option.
 * @param {object[]} props.labelOptions Configured task labels.
 * @param {object[]} props.typeOptions Creatable task types.
 * @param {object[]} props.sprintOptions Active or planned sprint destinations.
 * @param {boolean} props.canArchive Whether the current role may archive tasks.
 * @param {string} props.archiveDisabledReason Explanation shown when archive is unavailable.
 * @param {(action: string, value?: unknown) => Promise<unknown>} props.onApply Runs one registry action for the selection.
 * @param {() => void} props.onClear Leaves selection mode.
 */
export default function BulkActionBar({
  count,
  statusOptions = [],
  memberOptions = [],
  priorityOptions = [],
  labelOptions = [],
  typeOptions = [],
  sprintOptions = [],
  canArchive = false,
  archiveDisabledReason = 'Архівування доступне owner або admin',
  onApply,
  onClear,
}) {
  const [busyAction, setBusyAction] = useState('');
  const confirm = useConfirm();

  if (!count) return null;

  const apply = async (action, value) => {
    if (busyAction) return;
    setBusyAction(action);
    try {
      await onApply?.(action, value);
    } catch {
      // The data hook owns rollback and the user-facing error. Do not leak an
      // unhandled rejected click promise into the browser console.
    } finally {
      setBusyAction('');
    }
  };

  const applyEncoded = (value) => {
    if (!value) return;
    const separator = value.indexOf(':');
    const action = separator >= 0 ? value.slice(0, separator) : value;
    const id = separator >= 0 ? value.slice(separator + 1) : '';
    return apply(action, [id]);
  };

  const askDeadline = async () => {
    const value = await confirm({
      title: `Дедлайн для ${count} завдань`,
      message: 'Оберіть дату, яку буде встановлено для всіх вибраних завдань.',
      confirmText: 'Встановити',
      input: { type: 'date' },
    });
    if (value) await apply('deadline', value);
  };

  const askEstimate = async () => {
    const value = await confirm({
      title: `Оцінка для ${count} завдань`,
      message: 'Вкажіть оцінку в хвилинах від 0 до 525600.',
      confirmText: 'Встановити',
      input: { type: 'number', min: 0, max: 525600, step: 1, placeholder: '60', suffix: 'хв' },
    });
    if (value !== null && value !== '') await apply('estimate', Number(value));
  };

  const askArchive = async () => {
    const accepted = await confirm({
      title: `Архівувати ${count} завдань?`,
      message: 'Завдання зникнуть з активних списків. Залежності або дочірні задачі можуть заблокувати окремі елементи.',
      confirmText: 'Архівувати',
      danger: true,
    });
    if (accepted) await apply('archive');
  };

  const triggerClass = '!bg-white hover:!bg-canvas !text-ink shadow-sm';
  const assigneeActions = [
    { id: 'assignees-add', label: 'Додати' },
    { id: 'assignees-remove', label: 'Прибрати' },
    { id: 'assignees-replace', label: 'Замінити' },
  ];
  const labelActions = [
    { id: 'labels-add', label: 'Додати' },
    { id: 'labels-remove', label: 'Прибрати' },
  ];

  return (
    <div
      data-ui-composition="bulk-actions"
      className="ui-bulk-actions"
      role="toolbar"
      aria-label={`Дії з вибраними завданнями: ${count}`}
    >
      <strong className="ui-bulk-actions__count" aria-live="polite">Обрано: {count}</strong>
      <span className="ui-bulk-actions__divider" aria-hidden="true" />
      <Select
        value=""
        onChange={value => apply('status', value)}
        options={statusOptions}
        placeholder="Статус"
        triggerIcon={CircleDot}
        compact
        size="sm"
        disabled={Boolean(busyAction)}
        ariaLabel="Змінити статус вибраних завдань"
        buttonClassName={triggerClass}
      />
      <Select
        value=""
        onChange={value => (value === 'assignees-clear'
          ? apply('assignees-clear')
          : applyEncoded(value))}
        options={[
          ...encodedOptions(memberOptions, assigneeActions),
          { value: 'assignees-clear', label: 'Очистити відповідальних' },
        ]}
        placeholder="Відповідальні"
        triggerIcon={Users}
        compact
        size="sm"
        disabled={Boolean(busyAction)}
        ariaLabel="Змінити відповідальних вибраних завдань"
        buttonClassName={triggerClass}
      />
      <Select
        value=""
        onChange={value => (value === 'none'
          ? apply('priority-clear')
          : apply('priority', value))}
        options={priorityOptions}
        placeholder="Пріоритет"
        triggerIcon={Flag}
        compact
        size="sm"
        disabled={Boolean(busyAction)}
        ariaLabel="Змінити пріоритет вибраних завдань"
        buttonClassName={triggerClass}
      />
      {labelOptions.length > 0 && (
        <Select
          value=""
          onChange={value => (value === 'labels-clear'
            ? apply('labels-clear')
            : applyEncoded(value))}
          options={[
            ...encodedOptions(labelOptions, labelActions),
            { value: 'labels-clear', label: 'Очистити мітки' },
          ]}
          placeholder="Мітки"
          triggerIcon={Tags}
          compact
          size="sm"
          disabled={Boolean(busyAction)}
          ariaLabel="Змінити мітки вибраних завдань"
          buttonClassName={triggerClass}
        />
      )}
      {typeOptions.length > 0 && (
        <Select
          value=""
          onChange={value => apply('type', value)}
          options={typeOptions}
          placeholder="Тип"
          triggerIcon={Shapes}
          compact
          size="sm"
          disabled={Boolean(busyAction)}
          ariaLabel="Змінити тип вибраних завдань"
          buttonClassName={triggerClass}
        />
      )}
      {sprintOptions.length > 0 && (
        <Select
          value=""
          onChange={value => (value === '__backlog__'
            ? apply('backlog')
            : apply('sprint', value))}
          options={[{ value: '__backlog__', label: 'Без спринта' }, ...sprintOptions]}
          placeholder="Спринт"
          triggerIcon={Zap}
          compact
          size="sm"
          disabled={Boolean(busyAction)}
          ariaLabel="Перемістити вибрані завдання у спринт"
          buttonClassName={triggerClass}
        />
      )}
      <ContextMenu
        trigger={(
          <Button
            style="secondary"
            size="icon-sm"
            icon={MoreHorizontal}
            disabled={Boolean(busyAction)}
            aria-label="Інші масові дії"
            title="Інші масові дії"
            className="!bg-white hover:!bg-canvas !text-ink"
          />
        )}
        items={[
          { label: 'Встановити дедлайн', icon: CalendarDays, onClick: askDeadline },
          { label: 'Очистити дедлайн', icon: CalendarDays, onClick: () => apply('deadline-clear') },
          { label: 'Встановити оцінку', icon: Clock3, onClick: askEstimate },
          { label: 'Очистити оцінку', icon: Clock3, onClick: () => apply('estimate-clear') },
          { isDivider: true },
          { label: `Дублювати (${count})`, icon: Copy, onClick: () => apply('duplicate') },
          {
            label: `Архівувати (${count})`,
            icon: Trash2,
            onClick: askArchive,
            isDanger: true,
            disabled: !canArchive,
            disabledReason: canArchive ? '' : archiveDisabledReason,
          },
        ]}
      />
      <Button
        style="ghost"
        size="icon-sm"
        icon={X}
        onClick={onClear}
        disabled={Boolean(busyAction)}
        aria-label="Зняти вибір"
        title="Зняти вибір"
        className="!text-white hover:!bg-white/15"
      />
    </div>
  );
}
