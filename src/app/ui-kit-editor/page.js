'use client';
// UI Kit Live Editor with Component Props Editor
// View source code, edit props interactively, and see live preview
// Supports Button, Badge, Input, and Card with full props configuration

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import Surface from '@/components/ui/Surface';
import PageLayout from '@/components/ui/PageLayout';
import Stack from '@/components/ui/Stack';
import Spacer from '@/components/ui/Spacer';
import { Copy, RotateCcw, Code2 } from 'lucide-react';
import { useState, useEffect } from 'react';

// Component definitions with props schema
const COMPONENT_CATALOG = {
  'Button': {
    category: 'Core',
    path: '@/components/ui/Button',
    Component: Button,
    defaultProps: {
      children: 'Click me',
      variant: 'primary',
      style: 'primary',
      color: 'dark',
      size: 'lg',
      disabled: false,
      loading: false,
    },
    propsSchema: {
      children: { type: 'text', label: 'Text', default: 'Click me' },
      variant: { type: 'select', label: 'Variant', options: ['primary', 'secondary', 'ghost'], default: 'primary' },
      style: { type: 'select', label: 'Style', options: ['primary', 'secondary', 'ghost'], default: 'primary' },
      color: { type: 'select', label: 'Color', options: ['dark', 'blue', 'green', 'red', 'orange', 'purple', 'pink', 'teal', 'yellow'], default: 'dark' },
      size: { type: 'select', label: 'Size', options: ['sm', 'md', 'lg', 'icon'], default: 'lg' },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
      loading: { type: 'checkbox', label: 'Loading', default: false },
    },
    sourceCode: `import { Button } from '@/components/ui/Button';

export function MyButton() {
  return (
    <Button variant="primary" style="primary" color="dark" size="lg">
      Click me
    </Button>
  );
}`,
    variants: [
      { size: 'lg', color: 'dark', style: 'primary', label: 'Primary Large' },
      { size: 'md', color: 'dark', style: 'primary', label: 'Primary Med' },
      { size: 'sm', color: 'dark', style: 'primary', label: 'Primary Small' },
      { size: 'lg', color: 'blue', style: 'primary', label: 'Blue Primary' },
      { size: 'lg', color: 'green', style: 'primary', label: 'Green Primary' },
      { size: 'lg', color: 'dark', style: 'secondary', label: 'Secondary' },
      { size: 'lg', color: 'dark', style: 'ghost', label: 'Ghost' },
      { size: 'icon', color: 'dark', style: 'primary', label: 'Icon' },
    ],
  },
  'Badge': {
    category: 'Data Display',
    path: '@/components/ui/Badge',
    Component: Badge,
    defaultProps: {
      children: 'Label',
      variant: 'default',
    },
    propsSchema: {
      children: { type: 'text', label: 'Text', default: 'Label' },
      variant: { type: 'select', label: 'Variant', options: ['default', 'primary', 'success', 'warning', 'danger'], default: 'default' },
    },
    sourceCode: `import { Badge } from '@/components/ui/Badge';

export function MyBadge() {
  return <Badge variant="default">Label</Badge>;
}`,
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
    path: '@/components/ui/Input',
    Component: Input,
    defaultProps: {
      placeholder: 'Enter text...',
      disabled: false,
    },
    propsSchema: {
      placeholder: { type: 'text', label: 'Placeholder', default: 'Enter text...' },
      disabled: { type: 'checkbox', label: 'Disabled', default: false },
    },
    sourceCode: `import { Input } from '@/components/ui/Input';

export function MyInput() {
  return <Input placeholder="Enter text..." />;
}`,
    variants: [
      { placeholder: 'Default' },
      { placeholder: 'Focused', className: 'focus:ring-2' },
      { placeholder: 'Disabled', disabled: true },
      { placeholder: 'With error' },
    ],
  },
};

// Props editor component
function PropsEditor({ schema, currentProps, onChange }) {
  return (
    <div className="space-y-4">
      {Object.entries(schema).map(([key, field]) => (
        <div key={key}>
          <label className="block text-[12px] font-bold text-[#9a9a9a] mb-2 uppercase">
            {field.label}
          </label>
          {field.type === 'text' && (
            <input
              type="text"
              value={currentProps[key] || field.default}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full h-[36px] px-3 bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] text-[13px] focus:border-[#1f1f1f] outline-none"
            />
          )}
          {field.type === 'number' && (
            <input
              type="number"
              value={currentProps[key] || field.default}
              onChange={(e) => onChange(key, parseInt(e.target.value))}
              className="w-full h-[36px] px-3 bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] text-[13px] focus:border-[#1f1f1f] outline-none"
            />
          )}
          {field.type === 'checkbox' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentProps[key] || field.default}
                onChange={(e) => onChange(key, e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-[13px] text-[#1f1f1f]">Enabled</span>
            </label>
          )}
          {field.type === 'select' && (
            <select
              value={currentProps[key] || field.default}
              onChange={(e) => onChange(key, e.target.value)}
              className="w-full h-[36px] px-3 bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] text-[13px] focus:border-[#1f1f1f] outline-none cursor-pointer"
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

// Live preview component
function ComponentPreview({ component: CompDef, props }) {
  const Comp = CompDef.Component;
  // Check if component accepts children (e.g., Button, Badge do; Input does not)
  const supportsChildren = CompDef.path !== '@/components/ui/Input';

  return (
    <Surface padding="lg" className="min-h-[300px] flex items-center justify-center bg-white">
      {supportsChildren ? (
        <Comp {...props}>
          {props.children}
        </Comp>
      ) : (
        <Comp {...props} />
      )}
    </Surface>
  );
}

// All variants grid
function VariantsGrid({ component: CompDef }) {
  const Comp = CompDef.Component;
  const variants = CompDef.variants || [];
  const supportsChildren = CompDef.path !== '@/components/ui/Input';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {variants.map((variant, idx) => (
        <div key={idx} className="flex flex-col gap-2">
          <Surface padding="sm" className="flex items-center justify-center min-h-[60px] bg-white">
            {supportsChildren ? (
              <Comp {...variant}>
                {variant.children || variant.label || 'Variant'}
              </Comp>
            ) : (
              <Comp {...variant} />
            )}
          </Surface>
          <span className="text-[11px] text-[#9a9a9a] text-center">
            {variant.label || `Var ${idx + 1}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function UIKitEditorPage() {
  const [selectedComp, setSelectedComp] = useState('Button');
  const [props, setProps] = useState({});
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ui-kit-editor-props');
    if (saved) {
      try {
        setProps(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load props:', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('ui-kit-editor-props', JSON.stringify(props));
  }, [props]);

  const compDef = COMPONENT_CATALOG[selectedComp];
  const currentProps = { ...compDef.defaultProps, ...props };

  const handlePropChange = (key, value) => {
    setProps({ ...props, [key]: value });
  };

  const handleReset = () => {
    setProps({});
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(compDef.sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const header = (
    <div className="px-8 py-6">
      <h1 className="text-[32px] font-bold text-[#1f1f1f] mb-2">UI Kit Editor</h1>
      <p className="text-[14px] text-[#9a9a9a]">
        Interactive component library. View source code, edit props, and see live preview
      </p>
    </div>
  );

  return (
    <PageLayout header={header}>
      {/* Component Selector */}
      <div className="mb-8 flex gap-2 flex-wrap">
        {Object.keys(COMPONENT_CATALOG).map(compName => (
          <button
            key={compName}
            onClick={() => {
              setSelectedComp(compName);
              setProps({});
            }}
            className={`px-4 py-2 rounded-[10px] text-[13px] font-bold transition-all ${
              selectedComp === compName
                ? 'bg-[#1f1f1f] text-white'
                : 'bg-[#f7f7f7] text-[#1f1f1f] hover:bg-[#efefef]'
            }`}
          >
            {compName}
          </button>
        ))}
      </div>

      {/* Main Editor Layout: Code (40%) | Props (30%) | Preview (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
        {/* Code Panel - 40% (col-span-4) */}
        <div className="lg:col-span-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#9a9a9a] uppercase">Source Code</h3>
            <button
              onClick={() => setShowCode(!showCode)}
              className="p-2 hover:bg-[#f7f7f7] rounded-[8px] transition-colors"
              title="Toggle code visibility"
            >
              <Code2 size={16} className="text-[#9a9a9a]" />
            </button>
          </div>

          {showCode ? (
            <Surface padding="0" className="flex flex-col h-[500px] bg-[#1f1f1f]">
              <pre className="flex-1 p-4 overflow-auto font-mono text-[11px] text-[#10b981] leading-relaxed whitespace-pre-wrap break-words">
{compDef.sourceCode}
              </pre>
              <div className="flex gap-2 p-4 border-t border-[#333] bg-[#0a0a0a] rounded-b-[16px]">
                <button
                  onClick={handleCopyCode}
                  className="p-2 hover:bg-[#1f1f1f] rounded-[8px] text-[#9a9a9a] hover:text-[#10b981] transition-colors"
                  title="Copy code"
                >
                  <Copy size={16} />
                </button>
                <span className="ml-auto text-[11px] text-[#666]">
                  {copied ? 'Copied!' : 'JSX'}
                </span>
              </div>
            </Surface>
          ) : (
            <Surface padding="lg" className="bg-[#f7f7f7] text-[#9a9a9a] text-[13px] h-[500px] flex items-center justify-center">
              <div className="text-center">
                <p>Click the code icon to view source</p>
                <p className="text-[12px] mt-1">File: {compDef.path}</p>
              </div>
            </Surface>
          )}
        </div>

        {/* Props Editor - 30% (col-span-3) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-[#9a9a9a] uppercase">Props</h3>
            <button
              onClick={handleReset}
              className="p-2 hover:bg-[#f7f7f7] rounded-[8px] transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw size={16} className="text-[#9a9a9a]" />
            </button>
          </div>

          <Surface padding="lg" className="h-[500px] overflow-y-auto">
            <PropsEditor
              schema={compDef.propsSchema}
              currentProps={currentProps}
              onChange={handlePropChange}
            />
          </Surface>
        </div>

        {/* Live Preview - 30% (col-span-3) */}
        <div className="lg:col-span-3">
          <h3 className="text-[14px] font-bold text-[#9a9a9a] mb-3 uppercase">Preview</h3>
          <ComponentPreview component={compDef} props={currentProps} />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#e9e9e9] my-8" />

      {/* All Variants Grid */}
      <div className="mb-8">
        <h3 className="text-[14px] font-bold text-[#1f1f1f] mb-6">All Variants</h3>
        <VariantsGrid component={compDef} />
      </div>

      {/* Documentation */}
      <Spacer size="lg" />
      <Surface padding="lg" className="bg-[#f7f7f7]">
        <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-4">How to Use</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-[12px] font-bold text-[#9a9a9a] mb-2">1. Select Component</p>
            <p className="text-[13px] text-[#1f1f1f]">Choose from the available UI components at the top</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#9a9a9a] mb-2">2. Edit Props</p>
            <p className="text-[13px] text-[#1f1f1f]">Change prop values in the middle panel. Updates happen in real-time</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#9a9a9a] mb-2">3. See Preview</p>
            <p className="text-[13px] text-[#1f1f1f]">Component renders instantly on the right with your selected props</p>
          </div>
          <div>
            <p className="text-[12px] font-bold text-[#9a9a9a] mb-2">4. View Variants</p>
            <p className="text-[13px] text-[#1f1f1f]">Scroll down to see all available component variants</p>
          </div>
        </div>
        <Spacer size="md" />
        <p className="text-[12px] text-[#9a9a9a]">
          Props are saved in localStorage and will persist across sessions. Use the reset button to restore defaults.
        </p>
      </Surface>
    </PageLayout>
  );
}
