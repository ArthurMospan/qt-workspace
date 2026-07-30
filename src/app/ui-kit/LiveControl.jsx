'use client';

// Renders a raw product control with its own className, so it looks exactly as
// it does on the screen it came from.
//
// Shared by the bypass list and the chat section: both need to show a real
// control rather than describe one, and both must not let it escape its row.

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

export default function LiveControl({ control }) {
  const label = control.text || control.ariaLabel || '';
  const className = containedClassName(control.className);

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
      {/* The audit knows a child element's name, not its shape, so a neutral
          square stands in for an icon at roughly the right size. */}
      {control.childElements.length > 0 && (
        <span className="inline-block h-[13px] w-[13px] rounded-[3px] bg-current opacity-40" aria-hidden />
      )}
      {label}
    </button>
  );
}
