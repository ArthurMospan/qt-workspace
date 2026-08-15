'use client';

import { useState } from 'react';
import { CircleDot, Flag, Users, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';

/**
 * Fixed toolbar for actions that apply to a board selection. Each select is an
 * action rather than a persistent filter, so it returns to its placeholder
 * after the write finishes and the same selection can receive another change.
 *
 * @param {number} props.count Number of currently selected issues.
 * @param {Array<{value: string, label: string}>} props.statusOptions Status actions available for the selection.
 * @param {Array<{value: string, label: string}>} props.memberOptions Assignee actions available for the selection.
 * @param {Array<{value: string, label: string}>} props.priorityOptions Priority actions available for the selection.
 * @param {(action: string, value: string) => Promise<void>|void} props.onApply Applies one field change to the selection.
 * @param {() => void} props.onClear Clears the current board selection.
 */
export default function BulkActionBar({
  count,
  statusOptions = [],
  memberOptions = [],
  priorityOptions = [],
  onApply,
  onClear,
}) {
  const [busyAction, setBusyAction] = useState('');

  if (!count) return null;

  const apply = async (action, value) => {
    if (!value || busyAction) return;
    setBusyAction(action);
    try {
      await onApply?.(action, value);
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div
      data-ui-composition="bulk-actions"
      className="ui-bulk-actions"
      role="toolbar"
      aria-label={`Дії з вибраними завданнями: ${count}`}
    >
      <strong className="ui-bulk-actions__count" aria-live="polite">{count} обрано</strong>
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
        buttonClassName="!bg-white/10 hover:!bg-white/15 !text-white"
      />
      <Select
        value=""
        onChange={value => apply('assignee', value)}
        options={memberOptions}
        placeholder="Відповідальний"
        triggerIcon={Users}
        compact
        size="sm"
        disabled={Boolean(busyAction)}
        ariaLabel="Змінити відповідального вибраних завдань"
        buttonClassName="!bg-white/10 hover:!bg-white/15 !text-white"
      />
      <Select
        value=""
        onChange={value => apply('priority', value)}
        options={priorityOptions}
        placeholder="Пріоритет"
        triggerIcon={Flag}
        compact
        size="sm"
        disabled={Boolean(busyAction)}
        ariaLabel="Змінити пріоритет вибраних завдань"
        buttonClassName="!bg-white/10 hover:!bg-white/15 !text-white"
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
