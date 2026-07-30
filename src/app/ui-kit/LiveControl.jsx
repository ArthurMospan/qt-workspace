'use client';

// Renders a real product control with its own className, so it looks exactly
// as it does on the screen it came from.
//
// The first version showed a grey square where the icon should be and printed
// whatever text fragment it found, which made a row impossible to recognise —
// the whole point was to answer "which button is this?". The audit records the
// icon component's name, and those names are lucide icons, so the real icon is
// rendered instead of a placeholder.

import {
  ArchiveRestore, ArrowLeft, Check, ChevronRight, ChevronsUpDown, Download,
  LogOut, Menu, MoreVertical, PanelLeftClose, PanelLeftOpen, Pencil, Plus,
  Settings2, Tag, Trash2, X, ZoomIn, ZoomOut, Square,
} from 'lucide-react';

const ICONS = {
  ArchiveRestore, ArrowLeft, Check, ChevronRight, ChevronsUpDown, Download,
  LogOut, Menu, MoreVertical, PanelLeftClose, PanelLeftOpen, Pencil, Plus,
  Settings2, Trash2, X, ZoomIn, ZoomOut,
  TagIcon: Tag,
};

// Classes that take an element out of the document flow. Rendering them is not
// a preview, it is a trap: `absolute inset-0` on a file-card overlay escaped
// its row, covered the page and swallowed every click. The chrome that
// identifies the control — colour, radius, padding, type — is kept; only what
// would let it leave its cell is dropped.
const ESCAPES_ROW = /^(?:fixed|absolute|sticky|inset-|top-|bottom-|left-|right-|z-|translate-|-translate-|w-full|h-full|min-h-screen|w-screen|h-screen)/;

export function containedClassName(className) {
  return String(className || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !ESCAPES_ROW.test(token.replace(/^[a-z-]+:/, '')))
    .join(' ');
}

// What this control is, in words, when it has no visible label.
export function controlIdentity(control) {
  if (control.text) return control.text;
  if (control.ariaLabel) return control.ariaLabel;
  const icon = control.childElements.find(name => ICONS[name]);
  if (icon) return `іконка ${icon}`;
  if (control.childElements.includes('UserAvatar')) return 'аватар';
  return control.tag;
}

// Dark control chrome needs a dark backdrop to read, light needs light.
export function backdropFor(control) {
  return /(?:bg-white\/|text-white|bg-black\/|\/10|\/20)/.test(control.className || '')
    ? 'bg-[#1f1f1f]'
    : 'bg-[#fafafa]';
}

export default function LiveControl({ control }) {
  const label = control.text || control.ariaLabel || '';
  const className = containedClassName(control.className);
  const iconNames = control.childElements.filter(name => ICONS[name]);

  if (control.tag === 'input') {
    return <input className={className} placeholder={label || 'input'} readOnly />;
  }
  if (control.tag === 'textarea') {
    return <textarea className={className} placeholder={label || 'textarea'} readOnly rows={2} />;
  }
  if (control.tag === 'select') {
    return <select className={className}><option>{label || 'select'}</option></select>;
  }

  return (
    <button type="button" className={className} onClick={event => event.preventDefault()}>
      {iconNames.map(name => {
        const Icon = ICONS[name];
        return <Icon key={name} size={14} aria-hidden />;
      })}
      {/* A button whose only child was an avatar or a nested component still
          needs something to occupy the space it reserves on the real screen. */}
      {iconNames.length === 0 && control.childElements.includes('UserAvatar') && (
        <span className="inline-block h-[20px] w-[20px] rounded-full bg-current opacity-30" aria-hidden />
      )}
      {iconNames.length === 0 && !label && control.childElements.length > 0 && (
        <Square size={13} aria-hidden className="opacity-30" />
      )}
      {label}
    </button>
  );
}
