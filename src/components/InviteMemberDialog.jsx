'use client';

import { useEffect, useState } from 'react';
import { Check, Mail, Shield, UserRound } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Label from '@/components/ui/Forms/Label';
import Tabs from '@/components/ui/Tabs';
import InviteLinkSection from '@/components/InviteLinkSection';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';

const ROLE_OPTIONS = [
  {
    value: 'member',
    label: 'Учасник',
    description: 'Працює із завданнями та проєктами, спілкується з командою.',
    icon: UserRound,
  },
  {
    value: 'admin',
    label: 'Адміністратор',
    description: 'Керує командою, процесами та налаштуваннями організації.',
    icon: Shield,
  },
];

export default function InviteMemberDialog({ isOpen, onClose, inviteMember }) {
  const { currentUser } = useAppContext();
  const showToast = useWorkspaceStore(state => state.showToast);
  const [tab, setTab] = useState('email');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setTab('email');
      setEmail('');
      setRole('member');
      setSent(false);
    });
  }, [isOpen]);

  const handleInvite = async event => {
    event.preventDefault();
    if (!email.trim() || inviting) return;
    setInviting(true);
    try {
      const uid = currentUser?.id || currentUser?.uid;
      const result = await inviteMember(email.trim().toLowerCase(), uid, role);
      setSent(true);
      showToast(result.type === 'added_directly' ? 'Учасника додано до команди' : 'Запрошення надіслано', 'success');
      setTimeout(() => {
        setEmail('');
        setSent(false);
      }, 1800);
    } catch (error) {
      showToast(error.message || 'Не вдалося надіслати запрошення', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Запросити нового учасника"
      size="lg"
      bodyPadding="invite"
    >
      <div className="flex flex-col gap-6">
        <section>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted">Роль у команді</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map(option => {
              const Icon = option.icon;
              const active = role === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRole(option.value)}
                  className={`flex items-start gap-3 rounded-[16px] border-2 p-4 text-left transition-all ${active ? 'border-ink bg-canvas' : 'border-transparent bg-canvas hover:bg-[#efefef]'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${active ? 'bg-ink text-white' : 'bg-white text-muted'}`}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-ink">{option.label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-muted">{option.description}</span>
                  </span>
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${active ? 'bg-ink text-white' : 'border border-[#cfcfcf]'}`}>
                    {active && <Check size={12} />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <Tabs
          tabs={[
            { id: 'email', label: 'Електронна пошта', icon: Mail },
            { id: 'link', label: 'Посилання та QR' },
          ]}
          activeTab={tab}
          onTabChange={setTab}
          className="w-full [&>button]:flex-1"
        />

        {tab === 'email' ? (
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <Label>Email учасника</Label>
            <div className="relative">
              <Input
                autoFocus
                size="lg"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="name@example.com"
                composition="invite-field"
              />
              <Button
                type="submit"
                style="primary"
                size="md"
                loading={inviting}
                disabled={!email.trim() || inviting}
                className={`absolute bottom-[6px] right-[6px] top-[6px] ${sent ? '!bg-emerald-500' : ''}`}
                icon={sent ? Check : null}
              >
                {sent ? 'Надіслано' : 'Запросити'}
              </Button>
            </div>
            <p className="text-[11px] leading-5 text-muted">
              Людина отримає лист із безпечним входом до вашої команди.
            </p>
          </form>
        ) : (
          <InviteLinkSection role={role} />
        )}
      </div>
    </Dialog>
  );
}
