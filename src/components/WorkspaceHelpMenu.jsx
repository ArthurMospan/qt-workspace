'use client';

import { useState } from 'react';
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
import Tooltip from '@/components/ui/Navigation/Tooltip';

// Kept in sync with package.json. A client component cannot read that server
// file at runtime, and importing the JSON makes the UI Kit source scanner try
// to parse package metadata as JSX.
const APP_VERSION = '0.1.0';

const ONEB_LINKS = {
  help: 'https://oneb.app/',
  terms: 'https://oneb.app/terms-of-service',
  offer: 'https://oneb.app/offer',
  news: 'https://oneb.app/news',
  versions: 'https://oneb.app/news/history-of-versions',
};

function openExternal(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function WorkspaceHelpMenu({ collapsed = false }) {
  const [supportOpen, setSupportOpen] = useState(false);
  const items = [
    { label: 'Написати у підтримку', icon: Headphones, onClick: () => setSupportOpen(true) },
    { isDivider: true },
    { label: 'Довідка', icon: BookOpen, onClick: () => openExternal(ONEB_LINKS.help) },
    { label: 'Умови та конфіденційність', icon: ShieldCheck, onClick: () => openExternal(ONEB_LINKS.terms) },
    { label: 'Публічна оферта', icon: FileText, onClick: () => openExternal(ONEB_LINKS.offer) },
    { isDivider: true },
    { label: 'Новини', icon: Newspaper, onClick: () => openExternal(ONEB_LINKS.news) },
    { label: `Версія ${APP_VERSION}`, icon: Info, onClick: () => openExternal(ONEB_LINKS.versions) },
  ];

  return (
    <>
      <div className="shrink-0 px-[8px] pb-[8px]">
        <ContextMenu
          className="block w-full"
          dropdownClassName="w-[260px]"
          trigger={(
            <Tooltip content={collapsed ? 'Допомога' : null} position="right" className="block w-full">
              <button
                type="button"
                className={`flex h-[36px] w-full items-center rounded-[10px] transition-colors ${collapsed ? 'justify-center' : 'gap-[16px] px-[12px]'}`}
                style={{ color: 'var(--sb-muted)' }}
                onMouseEnter={event => {
                  event.currentTarget.style.backgroundColor = 'var(--sb-hover)';
                  event.currentTarget.style.color = 'var(--sb-text)';
                }}
                onMouseLeave={event => {
                  event.currentTarget.style.backgroundColor = 'transparent';
                  event.currentTarget.style.color = 'var(--sb-muted)';
                }}
                aria-label="Допомога та інформація"
              >
                <CircleHelp size={17} className="shrink-0" />
                {!collapsed && <span className="text-[12px] font-medium">Допомога</span>}
              </button>
            </Tooltip>
          )}
          items={items}
        />
      </div>

      <Dialog
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        title="Підтримка"
        description="Оберіть зручний канал. Контакти Telegram і Viber додамо після запуску підтримки."
        size="sm"
        presentation="dialog"
      >
        <div className="flex flex-col gap-[8px]">
          <Button
            style="secondary"
            size="lg"
            icon={Mail}
            onClick={() => { window.location.href = 'mailto:sale@oneb.app'; }}
            className="w-full justify-start"
          >
            Email · sale@oneb.app
          </Button>
          <Button style="secondary" size="lg" icon={MessageCircle} disabled className="w-full justify-start">
            Telegram · контакт скоро
          </Button>
          <Button style="secondary" size="lg" icon={MessageCircle} disabled className="w-full justify-start">
            Viber · контакт скоро
          </Button>
          <button
            type="button"
            onClick={() => openExternal(ONEB_LINKS.versions)}
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
