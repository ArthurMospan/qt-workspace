'use client';

// ─── UI Kit: Title Input ─────────────────────────────────────────────────────
// The page title while it is being edited: type at heading size, no box, a rule
// underneath. It is what an `h1` turns into when you press Редагувати.
//
// Deliberately not a variant of `Input`. `Input` is a filled control — it owns
// `bg-canvas`, a full border and horizontal padding as utilities, and this
// draws none of them. A variant could only try to cancel those with more
// utilities, and Tailwind resolves same-specificity utilities by their order in
// the generated stylesheet rather than the order they are written in the class
// attribute, so `bg-transparent` beating `bg-canvas` would be luck, not design.
// A control with different chrome is a different control.

import React, { forwardRef } from 'react';

const TitleInput = forwardRef(function TitleInput({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`text-[24px] font-bold text-ink tracking-tight bg-transparent border-b-2 border-ink pb-1 outline-none w-full ${className}`.trim()}
      {...props}
    />
  );
});

export default TitleInput;
