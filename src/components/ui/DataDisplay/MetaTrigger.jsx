'use client';

// ─── UI Kit: Meta Trigger ────────────────────────────────────────────────────
// A label, a face and a name, in a row that opens a popover — "Автор: ⬤ Артур",
// "Організатор: ⬤ Олена". It sits in the metadata strip under a title.
//
// Its chrome already lived in the kit as `[data-ui-control='identity-meta-trigger']`
// in globals.css, but the three-element markup that uses it did not, so the task
// page, the calendar page and the catalogue each retyped it — and the catalogue's
// copy was a hand-made lookalike rather than the thing itself. The class stays
// where it is; this owns the markup that goes with it.

import React from 'react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';

export default function MetaTrigger({ label, user, name, className = '', ...props }) {
  return (
    <button
      type="button"
      data-ui-control="identity-meta-trigger"
      className={`ui-native-control ${className}`.trim()}
      {...props}
    >
      <span>{label}</span>
      <UserAvatar user={user} size="xs" />
      <span className="font-semibold text-ink">{name}</span>
    </button>
  );
}
