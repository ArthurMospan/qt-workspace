'use client';
import { useState } from 'react';
import { Input, Textarea, Select, Checkbox, RadioButton, ToggleSwitch, TimePicker, SearchInput } from '@/components/ui';
import Surface from '@/components/ui/Surface';

export default function FormsTab() {
  const [formStates, setFormStates] = useState({
    checkbox: false,
    radio: 'option1',
    toggle: false,
    textarea: '',
    search: '',
    date: '',
  });

  return (
    <div className="space-y-8">
      {/* Checkboxes */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Checkboxes (3 розміри)</h2>
        <Surface padding="lg" className="space-y-3">
          <Checkbox size="sm" label="Малий checkbox (16px)" checked={formStates.checkbox} onChange={(v) => setFormStates({...formStates, checkbox: v})} />
          <Checkbox size="md" label="Стандартний checkbox (18px)" checked={formStates.checkbox} onChange={(v) => setFormStates({...formStates, checkbox: v})} />
          <Checkbox size="lg" label="Великий checkbox (20px)" checked={formStates.checkbox} onChange={(v) => setFormStates({...formStates, checkbox: v})} />
        </Surface>
      </div>

      {/* Radio Buttons */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Radio Buttons</h2>
        <Surface padding="lg">
          <RadioButton name="demo" options={[{ value: 'option1', label: 'Варіант 1' }, { value: 'option2', label: 'Варіант 2' }, { value: 'option3', label: 'Варіант 3' }]} value={formStates.radio} onChange={(v) => setFormStates({...formStates, radio: v})} layout="vertical" />
        </Surface>
      </div>

      {/* Toggles */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Toggle Switches (3 розміри)</h2>
        <Surface padding="lg" className="space-y-4">
          <ToggleSwitch size="sm" label="Малий (24px)" checked={formStates.toggle} onChange={(v) => setFormStates({...formStates, toggle: v})} />
          <ToggleSwitch size="md" label="Стандартний (32px)" checked={formStates.toggle} onChange={(v) => setFormStates({...formStates, toggle: v})} />
          <ToggleSwitch size="lg" label="Великий (36px)" checked={formStates.toggle} onChange={(v) => setFormStates({...formStates, toggle: v})} />
        </Surface>
      </div>

      {/* Textarea */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Textarea</h2>
        <Surface padding="lg">
          <Textarea placeholder="Введіть текст..." value={formStates.textarea} onChange={(e) => setFormStates({...formStates, textarea: e.target.value})} rows={4} />
        </Surface>
      </div>

      {/* Search Input */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Search Input (36px)</h2>
        <Surface padding="lg">
          <SearchInput placeholder="Введіть для пошуку..." value={formStates.search} onChange={(v) => setFormStates({...formStates, search: v})} />
        </Surface>
      </div>

      {/* Time */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Time Picker (36px)</h2>
        <Surface padding="lg">
          <TimePicker />
        </Surface>
      </div>
    </div>
  );
}
