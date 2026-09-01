'use client';

import Image from 'next/image';
import { ChevronRight, Clock3 } from 'lucide-react';
import { Alert, Card, Pill, PlanGate, PlanMark } from '@/components/ui';
import { capabilityAvailability } from '@/lib/utils/plans.mjs';
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
    entities: ['Простори', 'Папки й списки', 'Задачі', 'Підзавдання', 'Коментарі', 'Вкладення', 'Час', 'Користувачі'],
  },
  {
    id: 'asana',
    name: 'Asana',
    logo: '/integrations/asana.svg',
    description: 'Для команд, що працюють із проєктами, секціями та задачами в кількох представленнях.',
    entities: ['Команди', 'Проєкти', 'Секції', 'Задачі', 'Підзавдання', 'Коментарі', 'Вкладення', 'Користувачі'],
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
    entities: ['Команди', 'Проєкти', 'Issues', 'Підзавдання', 'Cycles', 'Зв’язки', 'Коментарі', 'Користувачі'],
  },
  {
    id: 'monday',
    name: 'monday.com',
    logo: '/integrations/monday.svg',
    description: 'Міграція гнучких дошок та колонок із попереднім зіставленням полів.',
    entities: ['Workspaces', 'Дошки', 'Групи', 'Items', 'Subitems', 'Оновлення', 'Файли', 'Користувачі'],
  },
];

// One list of names for the header above this component to title itself with.
// A second copy in the settings page is how «YouTrack» ends up spelled two ways.
export const MIGRATION_SOURCE_TITLES = Object.freeze({
  youtrack: 'YouTrack',
  ...Object.fromEntries(UPCOMING_PROVIDERS.map(provider => [provider.id, provider.name])),
});

function UpcomingProviderCard({ provider }) {
  return (
    <Card preset="borderless" padding="lg" className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <div data-ui-surface="local" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white">
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
            <h3 className="ui-type-card-title text-ink">{provider.name}</h3>
            <Pill icon={Clock3} size="lg">У планах</Pill>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">{provider.description}</p>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
          Заплановане покриття
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {provider.entities.map(entity => (
            <Pill key={entity} appearance="outline" size="sm" weight="medium">
              {entity}
            </Pill>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Data migration sources, and the one open source's importer.
 *
 * Which source is open is the caller's state, not this component's. Integrations
 * put their «Усі інтеграції» control in the section header, above the title;
 * this held its own selection and drew its own «Усі джерела» button inside the
 * body, below the title — the same navigation in two places, at two heights,
 * on two screens that are otherwise the same screen. The settings page owns
 * both now and renders one header.
 *
 * @param {string} props.selectedProviderId Which source is open; empty is the list.
 * @param {(providerId: string) => void} props.onSelectProvider Opens a source.
 * @param {string} props.currentUserId Who is reading — an import is driven only by the person who started it.
 * @param {boolean} props.isOrganizationOwner Whether they may stop an import somebody else started.
 */
export default function DataMigrationSettings({
  organizationId,
  currentUserId = '',
  isOrganizationOwner = false,
  members = [],
  projects = [],
  showToast,
  selectedProviderId = '',
  onSelectProvider,
  // The capability this screen needs, when the plan does not include it.
  // Empty when it does — the list draws each source's own status instead.
  lockedCapabilityId = '',
  // Стан джерела читає шапка секції над цим компонентом — так само, як у
  // «Інтеграціях». Тут він лише проходить наскрізь.
  onSourceStatus,
}) {
  const selectedProvider = UPCOMING_PROVIDERS.find(provider => provider.id === selectedProviderId);

  if (!selectedProviderId) {
    const providers = [
      {
        id: 'youtrack',
        name: 'YouTrack',
        logo: '/integrations/youtrack.svg',
        description: 'Керований імпорт проєктів, задач, людей та історії.',
        status: 'Готово',
        ready: true,
      },
      ...UPCOMING_PROVIDERS.map(provider => ({
        ...provider,
        status: 'У планах',
        ready: false,
      })),
    ];
    return (
      <div className="flex flex-col gap-[8px]">
        {providers.map(provider => (
          <Card
            key={provider.id}
            preset="bordered"
            padding="md"
            interactive
            onClick={() => onSelectProvider?.(provider.id)}
          >
            <div className="flex items-center gap-[12px]">
              <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] border border-line bg-white">
                <Image src={provider.logo} alt="" width={30} height={30} className="h-[28px] w-[28px] object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-ink">{provider.name}</span>
                <span className="mt-[2px] block truncate text-[11px] text-muted">{provider.description}</span>
              </span>
              {/* Корона означає рівно одне: «між вами і цим стоїть тариф».
                  Вона стояла на всіх сімох рядках, бо `lockedCapabilityId`
                  питався першим — і шість джерел, яких не існує, обіцяли себе
                  кожному, хто дивиться на прайс. Клієнт купував тариф заради
                  Jira, ClickUp, Asana, Trello, Linear і monday.com, а
                  отримував YouTrack.

                  Для джерела «У планах» тариф не є перешкодою: перешкода в
                  тому, що його ще не написано, і покупка цього не змінює. Тож
                  готовність питається першою, а корона лишається там, де вона
                  правдива — на єдиному джерелі, яке тариф справді відмикає.
                  Саме це стверджував коментар, що тут стояв; код стверджував
                  протилежне і ховав готовність саме тоді, коли за неї платять. */}
              {!provider.ready ? (
                <Pill tone="neutral" appearance="soft-outline" size="md">{provider.status}</Pill>
              ) : lockedCapabilityId ? (
                <PlanMark
                  capabilityId={lockedCapabilityId}
                  label={capabilityAvailability(lockedCapabilityId)}
                />
              ) : (
                // Та сама гама, що й у списку інтеграцій поруч: «Готово» —
                // стан, а не успіх, тож воно біле на ink, а не зелене.
                <Pill tone="dark" size="md">{provider.status}</Pill>
              )}
              <ChevronRight size={16} className="shrink-0 text-faint" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Той самий аргумент, що й у списку вище, лише на екран глибше: за стіною
  // тарифу стояла картка джерела, якого не існує. Пропозиція заплатити за
  // «Заплановане покриття» — обіцянка, якої продукт не виконає, тож її тут
  // немає: сторінка каже «У планах» і не бере грошей за план.
  if (selectedProvider) {
    return <UpcomingProviderCard provider={selectedProvider} />;
  }

  return (
    <PlanGate capabilityId="data-import">
      <div className="flex flex-col gap-[16px]">
        {/* Стіна тексту над екраном пішла.
            Тут стояла картка з заголовком «Перехід у QuickTeam без ручного
            відтворення роботи», абзацом під ним і трьома «запобіжниками» —
            «Спочатку аналіз», «Зіставлення людей», «Без дублів». Усі три
            описували те, що екран нижче робить сам і показує кнопками:
            «Знайти проєкти», «Зіставити», «Перевірити імпорт». Пояснювати
            наперед те, що людина зараз побачить, — це не допомога, а ще один
            екран перед екраном.

            Те, чого екран НЕ робить, лишилось: чого перенести не можна — це
            єдине, чого з самого інтерфейсу не видно. */}
        <YouTrackImportCard
          key={organizationId}
          organizationId={organizationId}
          currentUserId={currentUserId}
          isOrganizationOwner={isOrganizationOwner}
          members={members}
          projects={projects}
          showToast={showToast}
          onStatus={onSourceStatus}
        />

        <Alert
          variant="warning"
          description="Автоматизації, права доступу, ролі адміністраторів, API-ключі, білінг і налаштування сторонніх інтеграцій не можна безпечно перенести один в один. Перед запуском кожного імпорту QuickTeam покаже, що буде перенесено, зіставлено або пропущено."
        />
      </div>
    </PlanGate>
  );
}
