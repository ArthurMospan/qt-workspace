'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  FileText,
  Headphones,
  History,
  Info,
  Mail,
  Newspaper,
  ShieldCheck,
} from 'lucide-react';
import { Button, ContextMenu, Dialog, ListRow } from '@/components/ui';
import WorkspaceInfoCenter from '@/components/WorkspaceInfoCenter';
import { BRAND_COLORS, TelegramMark, ViberMark } from '@/lib/design/brandMarks';
import { ONEB_SUPPORT_CONTACTS } from '@/lib/content/supportContacts.mjs';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

// How each support channel presents itself: its own logo on a wash of its own
// colour, and what pressing the row will actually do. Mail has no brand of its
// own — the letter is drawn in the product's ink so the three rows still read
// as one list rather than two logos and an orphan.
const SUPPORT_CHANNELS = {
  email: {
    Mark: ({ size }) => <Mail size={size - 2} strokeWidth={1.9} className="text-ink" />,
    tint: 'rgba(31, 31, 31, 0.06)',
    action: 'Відкрити поштову програму',
  },
  telegram: {
    Mark: TelegramMark,
    tint: `${BRAND_COLORS.telegram}1f`,
    action: 'Відкрити Telegram',
  },
  viber: {
    Mark: ViberMark,
    tint: `${BRAND_COLORS.viber}1f`,
    action: 'Відкрити Viber',
  },
};

function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Довідка, підтримка, новини та правові документи — один список пунктів і одні
 * діалоги за ними. Рейка на десктопі вішає їх на кебаб; мобільна шторка «Ще»
 * малює ті самі пункти рядками, а `overlays` тримає біля себе, а не всередині
 * шторки, яка закривається від першого ж дотику.
 */
export function useWorkspaceHelp() {
  const router = useRouter();
  const [supportOpen, setSupportOpen] = useState(false);
  // Help, news and versions read in place. They used to navigate to a separate
  // public shell — another header, another nav, another "Увійти" — which threw
  // away whatever the user had on screen to answer a question about it.
  // See `WorkspaceInfoCenter` for why the legal documents still do not.
  const [infoPane, setInfoPane] = useState(null);
  const items = [
    { label: 'Написати у підтримку', icon: Headphones, onClick: () => setSupportOpen(true) },
    { isDivider: true },
    { label: 'Довідка', icon: BookOpen, onClick: () => setInfoPane('help') },
    { label: 'Новини', icon: Newspaper, onClick: () => setInfoPane('news') },
    { isDivider: true },
    // A contract needs an address that can be linked, printed and cited, so
    // these three stay full pages.
    { label: 'Умови користування', icon: ShieldCheck, onClick: () => router.push('/terms') },
    { label: 'Конфіденційність', icon: ShieldCheck, onClick: () => router.push('/privacy') },
    { label: 'Публічна оферта', icon: FileText, onClick: () => router.push('/offer') },
  ];

  const overlays = (
    <>
      <WorkspaceInfoCenter
        pane={infoPane}
        onPaneChange={setInfoPane}
        onClose={() => setInfoPane(null)}
      />

      <Dialog
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        title="Підтримка"
        description="Офіційні канали OneB — напишіть у той, що зручніший."
        size="sm"
        presentation="dialog"
      >
        <div className="flex flex-col gap-[8px]">
          <div className="overflow-hidden rounded-[14px] border border-line divide-y divide-line">
            {ONEB_SUPPORT_CONTACTS.map(contact => {
              const channel = SUPPORT_CHANNELS[contact.id] || SUPPORT_CHANNELS.email;
              const Mark = channel.Mark;
              return (
                <ListRow
                  key={contact.id}
                  density="roomy"
                  title={channel.action}
                  onClick={() => {
                    if (contact.href.startsWith('mailto:')) window.location.href = contact.href;
                    else openExternal(contact.href);
                  }}
                  className="flex items-center gap-[12px]"
                >
                  <span
                    aria-hidden
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
                    style={{ background: channel.tint }}
                  >
                    <Mark size={22} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-bold text-ink">{contact.label}</span>
                    <span className="truncate text-[12px] font-medium text-muted">{contact.value}</span>
                  </span>
                  <ArrowUpRight size={16} className="ml-auto shrink-0 text-faint" />
                </ListRow>
              );
            })}
          </div>
          {/* The build, for a support conversation that needs it. It used to
              be a link into a changelog written for whoever built the product;
              the number is the only part of that anybody was ever asked for. */}
          <p className="mt-[4px] flex items-center justify-center gap-[6px] text-[11px] font-medium text-muted">
            <History size={12} />
            QuickTeam {APP_VERSION}
          </p>
        </div>
      </Dialog>
    </>
  );

  return { items, overlays };
}

export default function WorkspaceHelpMenu({ collapsed = false }) {
  const { items, overlays } = useWorkspaceHelp();

  return (
    <>
      {/* A quiet 32px square, not a full-width rail item: help is the least
          urgent thing in the sidebar and a slab as wide as «Налаштування» read
          as another destination. Expanded, the square is centred on the same
          axis as the navigation icons (20px + half an 18px glyph); collapsed,
          it centres in the rail like everything else. */}
      <div className={`shrink-0 flex pb-[10px] ${collapsed ? 'justify-center px-0' : 'pl-[13px] pr-[8px]'}`}>
        <ContextMenu
          dropdownClassName="w-[260px]"
          trigger={(
            <Button
              style="ghost"
              size="icon"
              icon={CircleHelp}
              composition="sidebar-help-action"
              data-sidebar-collapsed={collapsed ? 'true' : 'false'}
              aria-label="Допомога та інформація"
              title="Допомога та інформація"
            />
          )}
          items={items}
        />
      </div>

      {overlays}
    </>
  );
}
