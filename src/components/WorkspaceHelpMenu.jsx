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
import { ONEB_SUPPORT_CONTACTS } from '@/lib/content/supportContacts.mjs';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function WorkspaceHelpMenu({ collapsed = false }) {
  const router = useRouter();
  const [supportOpen, setSupportOpen] = useState(false);
  const items = [
    { label: 'Написати у підтримку', icon: Headphones, onClick: () => setSupportOpen(true) },
    { isDivider: true },
    { label: 'Довідка', icon: BookOpen, onClick: () => router.push('/help') },
    { label: 'Умови користування', icon: ShieldCheck, onClick: () => router.push('/terms') },
    { label: 'Конфіденційність', icon: ShieldCheck, onClick: () => router.push('/privacy') },
    { label: 'Публічна оферта', icon: FileText, onClick: () => router.push('/offer') },
    { isDivider: true },
    { label: 'Новини', icon: Newspaper, onClick: () => router.push('/news') },
    { label: `Версія ${APP_VERSION}`, icon: Info, onClick: () => router.push('/versions') },
  ];

  return (
    <>
      <div className="shrink-0 px-[8px] pb-[8px]">
        <ContextMenu
          className="flex h-[40px] w-full items-center"
          dropdownClassName="w-[260px]"
          trigger={(
            <Button
              style="ghost"
              size="lg"
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
            onClick={() => router.push('/versions')}
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
