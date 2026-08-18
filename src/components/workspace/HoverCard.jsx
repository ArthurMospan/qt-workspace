'use client';

// The `@name` in a message: a chip that opens the person's profile, and a card
// that says who they are while you point at it.
//
// It used to serve tasks too, through a second branch with its own Firestore
// lookup and its own preview. A task mention shows its title outright now
// (`IssueMentionChip`), so there is nothing left to hover for and nothing left
// here that is not about a person.

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { formatLastSeenUk, isPresenceOnline } from '@/lib/utils/presence.mjs';
import { useAppContext } from '@/lib/context/AppContext';

/**
 * The one shape a mention has, whoever it names. `IssueMentionChip` and the
 * task chat's `MentionText` wear the same one, so a mentioned task and a
 * mentioned person read alike in a sentence.
 *
 * Two of these declarations are load-bearing rather than decorative, and both
 * are why a sentence used to step where a chip appeared in it:
 *
 *   • `leading-none` with a fixed height. The chip inherits the message body's
 *     `leading-relaxed`, so its own words carried a 23px line box inside a 23px
 *     one and the padding went on top — a 27px chip on a 23px line. Every line
 *     that mentioned anybody stood taller than the lines around it.
 *   • `align-middle`, on the chip *and* on whatever wraps it. An inline-flex box
 *     whose first item is an avatar has no text baseline to offer, so a
 *     baseline-aligned wrapper hangs the chip from the bottom of that avatar —
 *     which is what lifted the words inside it clear of the sentence they
 *     belong to.
 *
 * @param {boolean} options.dark On a dark bubble — the task chat's own messages.
 * @param {boolean} options.interactive Whether it answers to a pointer; a chip
 *   that only names somebody must not offer a hover state it cannot honour.
 */
export function mentionChipClass({ dark = false, interactive = true } = {}) {
  return [
    'inline-flex h-[22px] max-w-full items-center gap-1 whitespace-nowrap rounded-full px-1.5',
    'align-middle text-[13px] font-semibold leading-none',
    dark ? 'bg-white/15 text-white' : 'bg-black/[0.07] text-ink',
    interactive
      ? `cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 ${
        dark
          ? 'hover:bg-white/25 focus-visible:ring-white/40'
          : 'hover:bg-black/[0.12] focus-visible:ring-ink/20'
      }`
      : '',
  ].filter(Boolean).join(' ');
}

export const MENTION_CHIP = mentionChipClass();

const ORGANIZATION_ROLE_LABELS = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
};

function findMember(members, value) {
  const normalizedValue = decodeURIComponent(String(value || ''))
    .replace(/^@/, '')
    .replace(/_/g, ' ')
    .trim()
    .toLocaleLowerCase('uk-UA');

  return (members || []).find(member => {
    const candidates = [
      member.id,
      member.uid,
      member.name,
      member.displayName,
      member.email,
    ].filter(Boolean);
    return candidates.some(candidate =>
      String(candidate).replace(/_/g, ' ').trim().toLocaleLowerCase('uk-UA') === normalizedValue
    );
  });
}

/**
 * A mentioned person, as a chip with a card behind it.
 *
 * @param {'user'} props.type Kept so a call site says what it is naming; a task is `IssueMentionChip`.
 * @param {string} props.value The name written after the `@`.
 * @param {object[]} props.members Everyone in the organization, which is where the name resolves from.
 * @param {React.ReactNode} props.children What the chip shows — a face and a name.
 */
export default function HoverCard({ type = 'user', value, children, members }) {
  const { currentUser } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // No lookup: the organization's members are already on the page, which is why
  // this half never needed a request and the task half did.
  const member = findMember(members, value);

  const openUser = () => {
    const userId = member?.id || member?.uid;
    if (!userId) {
      setShow(true);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('member', userId);
    setShow(false);
    router.push(`${pathname}?${params.toString()}`);
  };

  const currentUserId = currentUser?.id || currentUser?.uid;
  const memberId = member?.id || member?.uid;
  const isOnline = Boolean(member && (
    memberId === currentUserId
    || member.online === true
    || isPresenceOnline(member.lastActive, now)
  ));
  const subtitle = member?.positionName
    || member?.title
    || ORGANIZATION_ROLE_LABELS[member?.role]
    || 'Учасник';

  return (
    <span
      // `align-middle` here as well as on the chip: this wrapper is the box the
      // sentence actually aligns, and left on its baseline it hung the whole
      // chip from the bottom edge of the avatar inside it.
      className="relative inline-block align-middle"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        onClick={openUser}
        title={`Відкрити профіль ${member?.name || value}`}
        className={MENTION_CHIP}
        data-mention={type}
      >
        {children}
      </button>

      {show && (
        <span data-ui-surface="local" className="absolute bottom-full left-1/2 z-50 mb-2 block w-64 -translate-x-1/2 rounded-[12px] border border-line bg-white p-3 text-left shadow-xl">
          {member ? (
            <span className="flex flex-col gap-2">
              <span className="flex items-center gap-3">
                <UserAvatar user={member} size="lg" />
                <span className="block">
                  <span className="block text-[14px] font-bold leading-tight text-ink">{member.name || member.email}</span>
                  <span className="block text-[11px] text-muted">{subtitle}</span>
                </span>
              </span>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-[#10b981]' : 'bg-faint'}`} />
                {formatLastSeenUk(member.lastActive, { now, online: isOnline })}
              </span>
            </span>
          ) : (
            <span className="block text-[12px] text-muted">Користувача не знайдено</span>
          )}
        </span>
      )}
    </span>
  );
}
