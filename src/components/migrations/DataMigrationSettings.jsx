'use client';

import Image from 'next/image';
import {
  AlertTriangle,
  Clock3,
  DatabaseBackup,
  ScanSearch,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Card } from '@/components/ui';
import YouTrackImportCard from '@/components/integrations/YouTrackImportCard';

const UPCOMING_PROVIDERS = [
  {
    id: 'jira',
    name: 'Jira',
    logo: '/integrations/jira.svg',
    description: 'Для команд із розвиненими workflow, епіками, спринтами та обліком часу.',
    entities: ['Проєкти', 'Задачі й епіки', 'Спринти', 'Коментарі', 'Вкладення', 'Worklogs', 'Користувачі'],
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    logo: '/integrations/clickup.svg',
    description: 'Перенесення ієрархії Spaces, Folders і Lists у зрозумілу структуру QuickTeam.',
    entities: ['Простори', 'Папки й списки', 'Задачі', 'Підзадачі', 'Коментарі', 'Вкладення', 'Час', 'Користувачі'],
  },
  {
    id: 'asana',
    name: 'Asana',
    logo: '/integrations/asana.svg',
    description: 'Для команд, що працюють із проєктами, секціями та задачами в кількох представленнях.',
    entities: ['Команди', 'Проєкти', 'Секції', 'Задачі', 'Підзадачі', 'Коментарі', 'Вкладення', 'Користувачі'],
  },
  {
    id: 'trello',
    name: 'Trello',
    logo: '/integrations/trello.svg',
    description: 'Дошки стають проєктами, списки — статусами, а картки — задачами QuickTeam.',
    entities: ['Дошки', 'Списки', 'Картки', 'Чеклісти', 'Коментарі', 'Вкладення', 'Учасники'],
  },
  {
    id: 'linear',
    name: 'Linear',
    logo: '/integrations/linear.svg',
    description: 'Перехід для продуктових і технічних команд зі збереженням циклів та зв’язків.',
    entities: ['Команди', 'Проєкти', 'Issues', 'Підзадачі', 'Cycles', 'Зв’язки', 'Коментарі', 'Користувачі'],
  },
  {
    id: 'monday',
    name: 'monday.com',
    logo: '/integrations/monday.svg',
    description: 'Міграція гнучких дошок та колонок із попереднім зіставленням полів.',
    entities: ['Workspaces', 'Дошки', 'Групи', 'Items', 'Subitems', 'Оновлення', 'Файли', 'Користувачі'],
  },
];

const SAFEGUARDS = [
  {
    icon: ScanSearch,
    title: 'Спочатку аналіз',
    description: 'Показуємо склад і обсяг даних до першого запису в QuickTeam.',
  },
  {
    icon: UsersRound,
    title: 'Зіставлення людей',
    description: 'Кожного автора й виконавця можна прив’язати до учасника або лишити зовнішнім.',
  },
  {
    icon: ShieldCheck,
    title: 'Без дублів',
    description: 'Повторний запуск продовжує імпорт за зовнішніми ID, а не створює копії.',
  },
];

function UpcomingProviderCard({ provider }) {
  return (
    <Card variant="white" padding="lg" className="flex h-full flex-col !border-none">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white">
          <Image
            src={provider.logo}
            alt={`${provider.name} logo`}
            width={30}
            height={30}
            className="h-[28px] w-[28px] object-contain"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-ink">{provider.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f2f7] px-2 py-1 text-[10px] font-semibold text-muted">
              <Clock3 size={11} />
              У планах
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{provider.description}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-[#f0f0f0] pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
          Заплановане покриття
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {provider.entities.map(entity => (
            <span
              key={entity}
              className="rounded-full border border-line bg-canvas px-2 py-1 text-[10px] font-medium text-muted"
            >
              {entity}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function DataMigrationSettings({
  organizationId,
  members = [],
  projects = [],
  showToast,
}) {
  return (
    <div className="space-y-8">
      <Card variant="white" padding="lg" className="overflow-hidden !border-none">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-ink text-white">
            <DatabaseBackup size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-ink">Перехід у QuickTeam без ручного відтворення роботи</p>
            <p className="mt-1 max-w-[760px] text-[12px] leading-relaxed text-muted">
              Це одноразове перенесення даних, а не постійна інтеграція. Після перевірки можна
              імпортувати вибрані проєкти, зіставити людей і продовжити перерваний процес.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-[#f0f0f0] pt-5 md:grid-cols-3">
          {SAFEGUARDS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-2.5">
              <Icon size={16} className="mt-0.5 shrink-0 text-[#10b981]" />
              <div>
                <p className="text-[11px] font-bold text-ink">{title}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-bold text-ink">Доступно зараз</h3>
            <p className="mt-0.5 text-[11px] text-muted">Повний керований імпорт із попередньою перевіркою.</p>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-[#0b8f67]">
            1 джерело готове
          </span>
        </div>

        <YouTrackImportCard
          key={organizationId}
          organizationId={organizationId}
          members={members}
          projects={projects}
          showToast={showToast}
          presentation="migration"
        />
      </section>

      <section>
        <div className="mb-3">
          <h3 className="text-[15px] font-bold text-ink">Наступні джерела</h3>
          <p className="mt-0.5 max-w-[760px] text-[11px] leading-relaxed text-muted">
            Додаємо провайдери окремо: для кожного потрібні власні правила полів, статусів,
            ієрархії та користувачів. Так міграція не перетвориться на ненадійний універсальний CSV.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {UPCOMING_PROVIDERS.map(provider => (
            <UpcomingProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <p className="text-[11px] leading-relaxed text-amber-900">
          Автоматизації, права доступу, ролі адміністраторів, API-ключі, білінг і налаштування
          сторонніх інтеграцій не можна безпечно перенести один в один. Перед запуском кожного
          імпорту QuickTeam окремо покаже, що буде перенесено, зіставлено або пропущено.
        </p>
      </div>
    </div>
  );
}
