'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CircleHelp,
  FileText,
  Headphones,
  History,
  Info,
  Mail,
  MessageCircle,
  Newspaper,
  ShieldCheck,
} from 'lucide-react';
import { Button, ContextMenu, Dialog } from '@/components/ui';
import WorkspaceInfoCenter from '@/components/WorkspaceInfoCenter';
import { ONEB_SUPPORT_CONTACTS } from '@/lib/content/supportContacts.mjs';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function WorkspaceHelpMenu({ collapsed = false }) {
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
    { label: `Версія ${APP_VERSION}`, icon: Info, onClick: () => setInfoPane('versions') },
    { isDivider: true },
    // A contract needs an address that can be linked, printed and cited, so
    // these three stay full pages.
    { label: 'Умови користування', icon: ShieldCheck, onClick: () => router.push('/terms') },
    { label: 'Конфіденційність', icon: ShieldCheck, onClick: () => router.push('/privacy') },
    { label: 'Публічна оферта', icon: FileText, onClick: () => router.push('/offer') },
  ];

  return (
    <>
      {/* A quiet 32px square, not a full-width rail item: help is the least
          urgent thing in the sidebar and a slab as wide as «Налаштування» read
          as another destination. Expanded, the square is centred on the same
          axis as the navigation icons (20px + half an 18px glyph); collapsed,
          it centres in the rail like everything else. */}
      <div className={`shrink-0 flex pb-[10px] ${collapsed ? 'justify-center px-0' : 'pl-[13px] pr-[8px]'}`}>
        <ContextMenu
          className="flex items-center"
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

      <WorkspaceInfoCenter
        pane={infoPane}
        onPaneChange={setInfoPane}
        onClose={() => setInfoPane(null)}
      />

      <Dialog
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        title="Підтримка"
        description="Оберіть перевірений офіційний канал підтримки OneB."
        size="sm"
        presentation="dialog"
      >
        <div className="flex flex-col gap-[8px]">
          {ONEB_SUPPORT_CONTACTS.map(contact => (
            <Button
              key={contact.id}
              style="secondary"
              size="lg"
              icon={contact.id === 'email' ? Mail : MessageCircle}
              onClick={() => {
                if (contact.href.startsWith('mailto:')) window.location.href = contact.href;
                else openExternal(contact.href);
              }}
              className="w-full justify-start"
            >
              {contact.label} · {contact.value}
            </Button>
          ))}
          <button
            type="button"
            onClick={() => { setSupportOpen(false); setInfoPane('versions'); }}
            className="mt-[4px] flex items-center justify-center gap-[6px] text-[11px] font-medium text-muted hover:text-ink"
          >
            <History size={12} />
            QuickTeam {APP_VERSION}
          </button>
        </div>
      </Dialog>
    </>
  );
}
