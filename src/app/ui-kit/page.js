'use client';
// UI Kit Showcase Page - Phase 2: Full Component Library
// Internal only, not in user navigation

import { Button } from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Tabs from '@/components/ui/Tabs';
import Stack from '@/components/ui/Stack';
import Spacer from '@/components/ui/Spacer';
import Surface from '@/components/ui/Surface';
import PageLayout from '@/components/ui/PageLayout';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Checkbox from '@/components/ui/Forms/Checkbox';
import RadioButton from '@/components/ui/Forms/RadioButton';
import ToggleSwitch from '@/components/ui/Forms/ToggleSwitch';
import { Textarea } from '@/components/ui/Forms/Textarea';
import { SearchInput } from '@/components/ui/Forms/SearchInput';
import { DatePicker } from '@/components/ui/Forms/DatePicker';
import { TimePicker } from '@/components/ui/Forms/TimePicker';
import { FileInput } from '@/components/ui/Forms/FileInput';
import Badge from '@/components/ui/DataDisplay/Badge';
import Tag from '@/components/ui/DataDisplay/Tag';
import Avatar from '@/components/ui/DataDisplay/Avatar';
import Progress from '@/components/ui/DataDisplay/Progress';
import StatusBadge from '@/components/ui/DataDisplay/StatusBadge';
import { Plus, Settings, MoreHorizontal, Trash2, Edit2, Zap, User, Mail, AlertCircle } from 'lucide-react';
import { useState } from 'react';

const DEMO_TABS = [
  { id: 'forms', label: 'Форми' },
  { id: 'data', label: 'Дані' },
  { id: 'navigation', label: 'Навігація' },
  { id: 'feedback', label: 'Зворотній зв\'язок' },
  { id: 'layout', label: 'Макет' },
  { id: 'colors', label: 'Кольори' },
];

const colorPalette = [
  { name: 'Dark', hex: '#1f1f1f', desc: 'Основний темний колір' },
  { name: 'Light', hex: '#f7f7f7', desc: 'Легкий фон' },
  { name: 'Surface', hex: '#ffffff', desc: 'Білі поверхні' },
  { name: 'Border', hex: '#e9e9e9', desc: 'Границі' },
  { name: 'Text Muted', hex: '#9a9a9a', desc: 'Приглушений текст' },
  { name: 'Success', hex: '#10b981', desc: 'Успіх' },
  { name: 'Warning', hex: '#eab308', desc: 'Попередження' },
  { name: 'Danger', hex: '#ef4444', desc: 'Небезпека' },
  { name: 'Error', hex: '#f97316', desc: 'Помилка' },
  { name: 'Info', hex: '#6366f1', desc: 'Інформація' },
];

export default function UIKitPage() {
  const [activeTab, setActiveTab] = useState('forms');
  const [formStates, setFormStates] = useState({
    checkbox: false,
    radio: 'option1',
    toggle: false,
    textarea: '',
    search: '',
    date: '',
    time: '',
  });

  const header = (
    <div className="px-8 py-6">
      <h1 className="text-[32px] font-bold text-[#1f1f1f] mb-2">UI Kit Showcase - Phase 2</h1>
      <p className="text-[14px] text-[#9a9a9a]">
        Повна бібліотека компонентів для менеджера завдань
      </p>
    </div>
  );

  return (
    <PageLayout header={header}>
      <div className="mb-8">
        <Tabs
          tabs={DEMO_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FORMS SECTION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'forms' && (
        <div className="space-y-8">
          {/* Checkboxes */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Checkboxes (3 розміри)</h2>
            <Surface padding="lg" className="space-y-3">
              <Checkbox
                size="sm"
                label="Малий checkbox (16px)"
                checked={formStates.checkbox}
                onChange={(v) => setFormStates({...formStates, checkbox: v})}
              />
              <Checkbox
                size="md"
                label="Стандартний checkbox (18px)"
                checked={formStates.checkbox}
                onChange={(v) => setFormStates({...formStates, checkbox: v})}
              />
              <Checkbox
                size="lg"
                label="Великий checkbox (20px)"
                checked={formStates.checkbox}
                onChange={(v) => setFormStates({...formStates, checkbox: v})}
              />
            </Surface>
          </div>

          {/* Radio Buttons */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Radio Buttons</h2>
            <Surface padding="lg">
              <RadioButton
                name="demo"
                options={[
                  { value: 'option1', label: 'Варіант 1' },
                  { value: 'option2', label: 'Варіант 2' },
                  { value: 'option3', label: 'Варіант 3' },
                ]}
                value={formStates.radio}
                onChange={(v) => setFormStates({...formStates, radio: v})}
                layout="vertical"
              />
            </Surface>
          </div>

          {/* Toggles */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Toggle Switches (3 розміри)</h2>
            <Surface padding="lg" className="space-y-4">
              <ToggleSwitch
                size="sm"
                label="Малий (24px)"
                checked={formStates.toggle}
                onChange={(v) => setFormStates({...formStates, toggle: v})}
              />
              <ToggleSwitch
                size="md"
                label="Стандартний (32px)"
                checked={formStates.toggle}
                onChange={(v) => setFormStates({...formStates, toggle: v})}
              />
              <ToggleSwitch
                size="lg"
                label="Великий (36px)"
                checked={formStates.toggle}
                onChange={(v) => setFormStates({...formStates, toggle: v})}
              />
            </Surface>
          </div>

          {/* Textarea */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Textarea</h2>
            <Surface padding="lg">
              <Textarea
                placeholder="Введіть текст..."
                rows={4}
                value={formStates.textarea}
                onChange={(e) => setFormStates({...formStates, textarea: e.target.value})}
              />
            </Surface>
          </div>

          {/* Search Input */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Search Input (36px)</h2>
            <Surface padding="lg">
              <SearchInput
                placeholder="Введіть для пошуку..."
                value={formStates.search}
                onChange={(v) => setFormStates({...formStates, search: v})}
              />
            </Surface>
          </div>

          {/* Date & Time */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Date & Time Pickers (36px)</h2>
            <Surface padding="lg">
              <Stack direction="vertical" gap="lg">
                <div>
                  <label className="text-[11px] font-bold text-[#9a9a9a] block mb-2">Дата</label>
                  <DatePicker
                    value={formStates.date}
                    onChange={(v) => setFormStates({...formStates, date: v})}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#9a9a9a] block mb-2">Час</label>
                  <TimePicker
                    value={formStates.time}
                    onChange={(v) => setFormStates({...formStates, time: v})}
                  />
                </div>
              </Stack>
            </Surface>
          </div>

          {/* File Input */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">File Upload</h2>
            <Surface padding="lg">
              <FileInput />
            </Surface>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* DATA DISPLAY SECTION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'data' && (
        <div className="space-y-8">
          {/* Badges */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Badges (3 розміри, 6 варіантів)</h2>
            <Surface padding="lg">
              <Stack direction="vertical" gap="lg">
                <Stack direction="horizontal" gap="md" align="start">
                  <Badge size="sm" variant="default">Default SM</Badge>
                  <Badge size="sm" variant="success">Success SM</Badge>
                  <Badge size="sm" variant="warning">Warning SM</Badge>
                  <Badge size="sm" variant="danger">Danger SM</Badge>
                </Stack>
                <Stack direction="horizontal" gap="md" align="start">
                  <Badge size="md" variant="default">Default MD</Badge>
                  <Badge size="md" variant="success">Success MD</Badge>
                  <Badge size="md" variant="warning">Warning MD</Badge>
                  <Badge size="md" variant="danger">Danger MD</Badge>
                </Stack>
                <Stack direction="horizontal" gap="md" align="start">
                  <Badge size="lg" variant="default">Default LG</Badge>
                  <Badge size="lg" variant="success">Success LG</Badge>
                  <Badge size="lg" variant="warning">Warning LG</Badge>
                  <Badge size="lg" variant="danger">Danger LG</Badge>
                </Stack>
              </Stack>
            </Surface>
          </div>

          {/* Tags */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Tags (Removable)</h2>
            <Surface padding="lg" className="flex flex-wrap gap-2">
              <Tag label="Vue" onRemove={() => {}} />
              <Tag label="React" variant="success" onRemove={() => {}} />
              <Tag label="Angular" variant="warning" onRemove={() => {}} />
              <Tag label="Svelte" variant="danger" onRemove={() => {}} />
            </Surface>
          </div>

          {/* Avatars */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Avatars (4 розміри)</h2>
            <Surface padding="lg" className="flex items-center gap-4">
              <Avatar size="sm" initials="AB" name="Alice Brown" />
              <Avatar size="md" initials="JD" name="John Doe" />
              <Avatar size="lg" initials="MS" name="Mary Smith" />
              <Avatar size="xl" initials="CJ" name="Charles Johnson" />
            </Surface>
          </div>

          {/* Progress Bars */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Progress Bars (3 розміри, 4 варіанти)</h2>
            <Surface padding="lg" className="space-y-4">
              <div>
                <p className="text-[12px] font-bold text-[#9a9a9a] mb-2">Малі (4px)</p>
                <Stack direction="vertical" gap="md">
                  <Progress value={30} size="sm" variant="default" showLabel />
                  <Progress value={60} size="sm" variant="success" showLabel />
                  <Progress value={90} size="sm" variant="warning" showLabel />
                </Stack>
              </div>
              <div>
                <p className="text-[12px] font-bold text-[#9a9a9a] mb-2">Стандартні (6px)</p>
                <Stack direction="vertical" gap="md">
                  <Progress value={45} size="md" variant="default" showLabel />
                  <Progress value={75} size="md" variant="success" showLabel />
                </Stack>
              </div>
            </Surface>
          </div>

          {/* Status Badges */}
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Status Badges (для задач)</h2>
            <Surface padding="lg" className="flex gap-3">
              <StatusBadge status="todo" />
              <StatusBadge status="in-progress" />
              <StatusBadge status="done" />
              <StatusBadge status="blocked" />
            </Surface>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* NAVIGATION SECTION */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'navigation' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Навігаційні компоненти</h2>
            <Surface padding="lg">
              <p className="text-[14px] text-[#9a9a9a]">
                Breadcrumb, Pagination, Menu, Popover, Tooltip, Stepper — компоненти будуть додані
              </p>
            </Surface>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* FEEDBACK SECTION */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'feedback' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Компоненти зворотного зв\'язку</h2>
            <Surface padding="lg">
              <p className="text-[14px] text-[#9a9a9a]">
                Alert, Toast, LoadingSpinner, LoadingSkeleton, EmptyState, ErrorBoundary
              </p>
            </Surface>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* LAYOUT SECTION */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'layout' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Layout Components</h2>
            <Surface padding="lg" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Surface key={i} variant="panel" padding="lg">
                  <p className="text-[12px] font-bold text-[#1f1f1f]">Card {i}</p>
                  <p className="text-[13px] text-[#9a9a9a] mt-1">Макет карточки</p>
                </Surface>
              ))}
            </Surface>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* COLORS SECTION */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'colors' && (
        <div>
          <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Палітра кольорів</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {colorPalette.map(color => (
              <Surface key={color.hex} padding="lg">
                <div className="flex items-start gap-4">
                  <div
                    className="w-16 h-16 rounded-[12px] shrink-0 border border-[#e9e9e9]"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div>
                    <p className="font-bold text-[#1f1f1f]">{color.name}</p>
                    <p className="text-[12px] text-[#9a9a9a] font-mono">{color.hex}</p>
                    <p className="text-[12px] text-[#cfcfcf] mt-1">{color.desc}</p>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
