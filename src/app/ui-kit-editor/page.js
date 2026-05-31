'use client';
// UI Kit Live Editor with Component Source Code IDE & Props Editor
// View and EDIT react source code files directly from the browser!
// Fast Refresh (HMR) will instantly apply your code changes across the whole project.

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import DatePicker from '@/components/ui/Forms/DatePicker';
import ToggleSwitch from '@/components/ui/Forms/ToggleSwitch';
import { Textarea } from '@/components/ui/Forms/Textarea';
import Card from '@/components/ui/Layout/Card';
import Dialog from '@/components/ui/Dialog';

import Surface from '@/components/ui/Surface';
import PageLayout from '@/components/ui/PageLayout';
import Spacer from '@/components/ui/Spacer';
import { Copy, RotateCcw, Save, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

// Component definitions with props schema
const COMPONENT_CATALOG = {
  'Button': {
    category: 'Core',
    path: 'src/components/ui/Button.jsx',
    Component: Button,
    defaultProps: {
      children: 'Click me',
      style: 'primary',
      color: 'dark',
      size: 'lg',
      disabled: false,
      loading: false,
    },
    propsSchema: {
      children: { type: 'text', label: 'Text', default: 'Click me' },
      style: { type: 'select', label: 'Style', options: ['primary', 'secondary', 'outline', 'ghost'], default: 'primary' },
      color: { type: 'select', label: 'Color', options: ['dark', 'red'], default: 'dark' },
      size: { type: 'select', label: 'Size', options: ['sm', 'md', 'lg', 'icon'], default: 'lg' },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
      loading: { type: 'checkbox', label: 'Loading', default: false },
    },
    variants: [
      { size: 'lg', color: 'dark', style: 'primary', label: 'Primary Large' },
      { size: 'md', color: 'dark', style: 'primary', label: 'Primary Med' },
      { size: 'sm', color: 'dark', style: 'primary', label: 'Primary Small' },
      { size: 'lg', color: 'red', style: 'primary', label: 'Red Primary' },
      { size: 'lg', color: 'dark', style: 'secondary', label: 'Secondary' },
      { size: 'lg', color: 'dark', style: 'ghost', label: 'Ghost' },
    ],
  },
  'Badge': {
    category: 'Data Display',
    path: 'src/components/ui/Badge.jsx',
    Component: Badge,
    defaultProps: {
      children: 'Label',
      variant: 'default',
    },
    propsSchema: {
      children: { type: 'text', label: 'Text', default: 'Label' },
      variant: { type: 'select', label: 'Variant', options: ['default', 'primary', 'success', 'warning', 'danger'], default: 'default' },
    },
    variants: [
      { variant: 'default', label: 'Default' },
      { variant: 'primary', label: 'Primary' },
      { variant: 'success', label: 'Success' },
      { variant: 'warning', label: 'Warning' },
      { variant: 'danger', label: 'Danger' },
    ],
  },
  'Input': {
    category: 'Forms',
    path: 'src/components/ui/Input.jsx',
    Component: Input,
    defaultProps: {
      placeholder: 'Enter text...',
      disabled: false,
    },
    propsSchema: {
      placeholder: { type: 'text', label: 'Placeholder', default: 'Enter text...' },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
    },
    variants: [
      { placeholder: 'Default input...' },
      { placeholder: 'Disabled input...', disabled: true },
    ],
  },
  'Select': {
    category: 'Forms',
    path: 'src/components/ui/Select.jsx',
    Component: Select,
    defaultProps: {
      placeholder: 'Select option...',
      disabled: false,
    },
    propsSchema: {
      placeholder: { type: 'text', label: 'Placeholder', default: 'Select option...' },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
    },
    variants: [
      {
        placeholder: 'Select priority...',
        options: [
          { value: 'low', label: 'Low', dotColor: '#3b82f6' },
          { value: 'medium', label: 'Medium', dotColor: '#eab308' },
          { value: 'high', label: 'High', dotColor: '#ef4444' }
        ]
      }
    ]
  },
  'Tabs': {
    category: 'Navigation',
    path: 'src/components/ui/Tabs.jsx',
    Component: Tabs,
    defaultProps: {
      activeTab: 'tab1',
    },
    propsSchema: {
      activeTab: { type: 'select', label: 'Active Tab', options: ['tab1', 'tab2', 'tab3'], default: 'tab1' }
    },
    variants: [
      {
        tabs: [
          { id: 'tab1', label: 'Вкладка 1' },
          { id: 'tab2', label: 'Вкладка 2' },
          { id: 'tab3', label: 'Вкладка 3' }
        ],
        activeTab: 'tab1'
      }
    ]
  },
  'DatePicker': {
    category: 'Forms',
    path: 'src/components/ui/Forms/DatePicker.jsx',
    Component: DatePicker,
    defaultProps: {
      placeholder: 'Оберіть дату',
      disabled: false,
      mode: 'single',
    },
    propsSchema: {
      placeholder: { type: 'text', label: 'Placeholder', default: 'Оберіть дату' },
      mode: { type: 'select', label: 'Mode', options: ['single', 'range'], default: 'single' },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
    },
    variants: [
      { placeholder: 'Оберіть одну дату', mode: 'single' },
      { placeholder: 'Оберіть діапазон дат', mode: 'range' }
    ]
  },
  'ToggleSwitch': {
    category: 'Forms',
    path: 'src/components/ui/Forms/ToggleSwitch.jsx',
    Component: ToggleSwitch,
    defaultProps: {
      checked: false,
      label: 'Активувати налаштування',
      disabled: false,
      size: 'md',
    },
    propsSchema: {
      label: { type: 'text', label: 'Label', default: 'Активувати налаштування' },
      size: { type: 'select', label: 'Size', options: ['sm', 'md', 'lg'], default: 'md' },
      checked: { type: 'checkbox', label: 'Checked', default: false },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
    },
    variants: [
      { size: 'sm', label: 'Малий (sm)', checked: true },
      { size: 'md', label: 'Середній (md)', checked: false },
      { size: 'lg', label: 'Великий (lg)', checked: true }
    ]
  },
  'Textarea': {
    category: 'Forms',
    path: 'src/components/ui/Forms/Textarea.jsx',
    Component: Textarea,
    defaultProps: {
      placeholder: 'Введіть опис проєкту...',
      rows: 3,
    },
    propsSchema: {
      placeholder: { type: 'text', label: 'Placeholder', default: 'Введіть опис проєкту...' },
      rows: { type: 'number', label: 'Rows', default: 3 },
    },
    variants: [
      { placeholder: 'Стандартний опис...', rows: 3 },
      { placeholder: 'Велике поле для деталей...', rows: 6 }
    ]
  },
  'Card': {
    category: 'Layout',
    path: 'src/components/ui/Layout/Card.jsx',
    Component: Card,
    defaultProps: {
      children: 'Контент картки',
      variant: 'white',
      padding: 'md',
      interactive: false,
    },
    propsSchema: {
      children: { type: 'text', label: 'Inner Content', default: 'Контент картки' },
      variant: { type: 'select', label: 'Variant', options: ['white', 'gray'], default: 'white' },
      padding: { type: 'select', label: 'Padding', options: ['sm', 'md', 'lg', 'xl'], default: 'md' },
      interactive: { type: 'checkbox', label: 'Interactive (Hover Effect)', default: false },
    },
    variants: [
      { variant: 'white', padding: 'md', children: 'Біла картка (White Card)' },
      { variant: 'gray', padding: 'md', children: 'Сіра панель (Gray Panel)' },
      { variant: 'white', padding: 'lg', interactive: true, children: 'Інтерактивна картка з ефектом ховеру' }
    ]
  },
  'Dialog': {
    category: 'Feedback',
    path: 'src/components/ui/Dialog.jsx',
    Component: Dialog,
    defaultProps: {
      title: 'Підтвердження дії',
      size: 'sm',
      showCloseButton: true,
      children: 'Ви впевнені, що бажаєте зберегти ці зміни?',
    },
    propsSchema: {
      title: { type: 'text', label: 'Modal Title', default: 'Підтвердження дії' },
      children: { type: 'text', label: 'Modal Body text', default: 'Ви впевнені, що бажаєте зберегти ці зміни?' },
      size: { type: 'select', label: 'Size', options: ['sm', 'md', 'lg', 'xl'], default: 'sm' },
      showCloseButton: { type: 'checkbox', label: 'Close Button', default: true },
    },
    variants: [
      { title: 'Мала модалка', size: 'sm', children: 'Контент невеликого вікна' },
      { title: 'Стандартна модалка', size: 'md', children: 'Контент звичайного вікна' }
    ]
  }
};

function PropsEditor({ schema, currentProps, onChange }) {
  return (
    <div className="space-y-4">
      {Object.entries(schema).map(([key, field]) => (
        <div key={key}>
          <label className="block text-[11px] font-bold text-[#9a9a9a] mb-2 uppercase tracking-wider">
            {field.label}
          </label>
          {field.type === 'text' && (
            <input
              type="text"
              value={currentProps[key] || field.default}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full h-[36px] px-3 bg-[#f4f4f5] border border-transparent hover:border-[#ebebeb] rounded-[10px] text-[13px] font-semibold focus:bg-white focus:border-[#1f1f1f] outline-none transition-all"
            />
          )}
          {field.type === 'number' && (
            <input
              type="number"
              value={currentProps[key] || field.default}
              onChange={(e) => onChange(key, parseInt(e.target.value) || 0)}
              className="w-full h-[36px] px-3 bg-[#f4f4f5] border border-transparent hover:border-[#ebebeb] rounded-[10px] text-[13px] font-semibold focus:bg-white focus:border-[#1f1f1f] outline-none transition-all"
            />
          )}
          {field.type === 'checkbox' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={currentProps[key] || field.default}
                onChange={(e) => onChange(key, e.target.checked)}
                className="w-4 h-4 rounded border-[#e9e9e9] text-[#1f1f1f] focus:ring-[#1f1f1f]"
              />
              <span className="text-[13px] font-semibold text-[#1f1f1f]">Активно</span>
            </label>
          )}
          {field.type === 'select' && (
            <select
              value={currentProps[key] || field.default}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full h-[36px] px-3 bg-[#f4f4f5] border border-transparent rounded-[10px] text-[13px] font-semibold focus:bg-white focus:border-[#1f1f1f] outline-none cursor-pointer transition-all"
            >
              {field.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

export default function UIKitEditorPage() {
  const [selectedComp, setSelectedComp] = useState('Button');
  const [props, setProps] = useState({});
  const [liveCode, setLiveCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'success', 'error'
  const [copied, setCopied] = useState(false);
  
  // Custom states for interactive elements in preview
  const [toggleVal, setToggleVal] = useState(false);
  const [dateVal, setDateVal] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch actual code from API when component changes
  useEffect(() => {
    async function fetchCode() {
      setLoadingCode(true);
      setSaveStatus(null);
      try {
        const res = await fetch(`/api/save-component?component=${selectedComp}`);
        const data = await res.json();
        if (data.code) {
          setLiveCode(data.code);
        } else {
          setLiveCode(`// Помилка завантаження коду: ${data.error}`);
        }
      } catch (err) {
        setLiveCode(`// Помилка з'єднання: ${err.message}`);
      }
      setLoadingCode(false);
    }
    fetchCode();
  }, [selectedComp]);

  const compDef = COMPONENT_CATALOG[selectedComp];
  const currentProps = { ...compDef.defaultProps, ...props };

  const handlePropChange = (key, value) => {
    setProps({ ...props, [key]: value });
  };

  const handleResetProps = () => {
    setProps({});
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(liveCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCode = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/save-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component: selectedComp, code: liveCode }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const Comp = compDef.Component;
  const supportsChildren = selectedComp === 'Button' || selectedComp === 'Badge' || selectedComp === 'Card';

  // Render Component with local interactive controls in preview
  const renderPreview = () => {
    if (selectedComp === 'ToggleSwitch') {
      return (
        <ToggleSwitch
          {...currentProps}
          checked={props.checked !== undefined ? currentProps.checked : toggleVal}
          onChange={(val) => {
            setToggleVal(val);
            handlePropChange('checked', val);
          }}
        />
      );
    }

    if (selectedComp === 'DatePicker') {
      return (
        <DatePicker
          {...currentProps}
          value={dateVal}
          onChange={setDateVal}
        />
      );
    }

    if (selectedComp === 'Dialog') {
      return (
        <div className="flex flex-col items-center gap-4">
          <Button onClick={() => setModalOpen(true)}>Відкрити модальне вікно</Button>
          <Dialog
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            {...currentProps}
          >
            {currentProps.children}
          </Dialog>
        </div>
      );
    }

    // Default renderer
    return supportsChildren ? (
      <Comp {...currentProps}>
        {currentProps.children}
      </Comp>
    ) : (
      <Comp {...currentProps} />
    );
  };

  const header = (
    <div className="px-8 py-6">
      <div className="flex items-center gap-[12px] mb-2">
        <h1 className="text-[32px] font-bold text-[#1f1f1f]">UI Kit Live IDE</h1>
        <span className="flex items-center gap-1 text-[11px] font-bold bg-[#e0f2fe] text-[#0369a1] px-2.5 py-1 rounded-full uppercase tracking-wider">
          <Sparkles size={11} /> Live Sync
        </span>
      </div>
      <p className="text-[14px] text-[#9a9a9a]">
        Редагуйте вихідний React-код компонентів прямо в браузері. Зміни миттєво збережуться у файли проєкту та оновлять інтерфейс!
      </p>
    </div>
  );

  return (
    <PageLayout header={header}>
      {/* Component Selector */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {Object.keys(COMPONENT_CATALOG).map(compName => (
          <button
            key={compName}
            onClick={() => {
              setSelectedComp(compName);
              setProps({});
            }}
            className={`px-[16px] h-[36px] rounded-[10px] text-[13px] font-bold transition-all ${
              selectedComp === compName
                ? 'bg-[#1f1f1f] text-white'
                : 'bg-[#f4f4f5] text-[#1f1f1f] hover:bg-[#efefef]'
            }`}
          >
            {compName}
          </button>
        ))}
      </div>

      {/* Main IDE Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
        
        {/* Code Editor Column - 60% (col-span-7) */}
        <div className="xl:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Редактор React-коду</h3>
            <span className="text-[11px] font-semibold text-[#cfcfcf]">{compDef.path}</span>
          </div>

          <Surface padding="0" className="flex flex-col h-[520px] bg-[#1a1a1a] border border-[#2d2d2d] overflow-hidden">
            {/* Editor Top Bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2d2d2d] bg-[#151515] shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyCode}
                  className="px-2.5 py-1 text-[11px] font-bold text-[#9a9a9a] hover:text-white bg-[#252525] hover:bg-[#303030] rounded-md transition-all flex items-center gap-1"
                >
                  <Copy size={12} /> {copied ? 'Скопійовано!' : 'Копіювати'}
                </button>
                <button
                  onClick={handleSaveCode}
                  disabled={loadingCode || saveStatus === 'saving'}
                  className="px-3 py-1 text-[11px] font-bold text-white bg-[#10b981] hover:bg-[#059669] rounded-md transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <Save size={12} /> Зберегти та застосувати
                </button>
              </div>
            </div>

            {/* Code Field */}
            {loadingCode ? (
              <div className="flex-1 flex items-center justify-center text-[#9a9a9a] text-[13px] font-semibold">
                Завантаження коду...
              </div>
            ) : (
              <textarea
                value={liveCode}
                onChange={(e) => setLiveCode(e.target.value)}
                className="flex-1 p-4 bg-[#1a1a1a] text-[#10b981] font-mono text-[12px] leading-relaxed whitespace-pre outline-none resize-none overflow-auto custom-scrollbar border-none focus:ring-0"
                spellCheck="false"
              />
            )}

            {/* Status Footer */}
            {saveStatus && (
              <div className={`px-4 py-2.5 text-[12px] font-bold flex items-center gap-2 shrink-0 border-t ${
                saveStatus === 'saving' ? 'bg-blue-950/40 text-blue-400 border-blue-900/50' :
                saveStatus === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' :
                'bg-red-950/40 text-red-400 border-red-900/50'
              }`}>
                {saveStatus === 'saving' && <>
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Збереження коду у файл та гаряче перезавантаження проєкту...</span>
                </>}
                {saveStatus === 'success' && <>
                  <Check size={14} className="shrink-0" />
                  <span>Успішно збережено! Зміни миттєво застосовані по всьому проєкту.</span>
                </>}
                {saveStatus === 'error' && <>
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Помилка при збереженні коду. Перевірте консоль сервера.</span>
                </>}
              </div>
            )}
          </Surface>
        </div>

        {/* Live Preview & Props Column - 40% (col-span-5) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* Live Preview */}
          <div className="flex flex-col gap-3">
            <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Інтерактивне прев'ю</h3>
            <Surface padding="lg" className="min-h-[200px] flex items-center justify-center bg-white border border-[#e9e9e9] relative overflow-hidden">
              {renderPreview()}
            </Surface>
          </div>

          {/* Interactive Props */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Конфігуратор Props</h3>
              <button
                onClick={handleResetProps}
                className="p-1 hover:bg-[#f4f4f5] text-[#9a9a9a] hover:text-[#1f1f1f] rounded-[8px] transition-colors"
                title="Скинути до стандартних"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <Surface padding="lg" className="border border-[#e9e9e9]">
              <PropsEditor
                schema={compDef.propsSchema}
                currentProps={currentProps}
                onChange={handlePropChange}
              />
            </Surface>
          </div>

        </div>
      </div>

      {/* Grid of presets/variants */}
      {compDef.variants && (
        <div className="mb-8">
          <h3 className="text-[14px] font-bold text-[#1f1f1f] mb-4">Всі пресети та варіанти</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {compDef.variants.map((vProps, idx) => (
              <div key={idx} className="flex flex-col gap-2">
                <Surface padding="md" className="flex items-center justify-center min-h-[80px] bg-[#f4f4f5] border border-[#e9e9e9]">
                  {selectedComp === 'ToggleSwitch' ? (
                    <ToggleSwitch {...vProps} onChange={() => {}} />
                  ) : selectedComp === 'DatePicker' ? (
                    <DatePicker {...vProps} />
                  ) : selectedComp === 'Dialog' ? (
                    <div className="text-[12px] font-bold text-[#9a9a9a]">{vProps.title}</div>
                  ) : supportsChildren ? (
                    <Comp {...vProps}>
                      {vProps.children || vProps.label || 'Компонент'}
                    </Comp>
                  ) : (
                    <Comp {...vProps} />
                  )}
                </Surface>
                <span className="text-[11px] font-bold text-[#9a9a9a] text-center">
                  {vProps.label || `Варіант ${idx + 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
