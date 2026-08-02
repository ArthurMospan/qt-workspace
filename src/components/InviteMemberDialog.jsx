'use client';

import { useEffect, useState } from 'react';
import { Check, Mail, Shield, UserRound } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Label from '@/components/ui/Forms/Label';
import OptionCard from '@/components/ui/Forms/OptionCard';
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
            {ROLE_OPTIONS.map(option => (
              <OptionCard
                key={option.value}
                selected={role === option.value}
                icon={option.icon}
                title={option.label}
                description={option.description}
                onClick={() => setRole(option.value)}
              />
            ))}
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
                size="md"
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
