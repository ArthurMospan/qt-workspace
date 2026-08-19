'use client';
import { AlertTriangle, BarChart2, Flag, TrendingDown, Users, Wallet } from 'lucide-react';
import {
  BarList,
  Card,
  ColumnChart,
  DataTable,
  DetailSection,
  KpiCard,
  Meter,
  Pill,
  SignalList,
  Sparkline,
  TrendChart,
  UserAvatar,
} from '@/components/ui';
import { PreviewBlock } from '../preview';

// The analytics vocabulary. Before this there wasn't one: "how much of each"
// was written five times across four files and no two agreed on the bar height,
// the track colour, or what a full bar meant — one of them multiplied its
// percentage by three "to make small bars visible", which is a chart that lies.
//
// The colours are not chosen by eye either. Three slots, in a fixed order,
// validated for the lightness band, the chroma floor, all-pairs separation
// under protanopia and deuteranopia, and 3:1 against white. `chart-1` carries
// almost everything on its own; the second and third appear only where two or
// three series genuinely share a plot.
const DEMO_DAYS = [
  { label: '1 трав', values: [2, 4] },
  { label: '2 трав', values: [5, 3] },
  { label: '3 трав', values: [3, 6] },
  { label: '4 трав', values: [7, 2] },
  { label: '5 трав', values: [4, 4] },
  { label: '6 трав', values: [6, 5] },
  { label: '7 трав', values: [9, 3] },
];

const DEMO_FLOW = [
  { label: 'Закрито', color: 'var(--color-chart-1)' },
  { label: 'Відкрито', color: 'var(--color-chart-context)' },
];

const DEMO_BURNDOWN = Array.from({ length: 12 }, (_, index) => ({
  label: `${index + 1} трав`,
  value: Math.max(0, 40 - index * 3 - (index % 3)),
  reference: Math.round(40 - (40 / 11) * index),
}));

const DEMO_MEMBERS = [
  { id: 'a', name: 'Артур Моспан', done: 12, open: 4, minutes: 640, focus: 'Переписати імпорт клієнтських даних із YouTrack', state: 'Стабільно' },
  { id: 'b', name: 'Олена Коваль', done: 7, open: 9, minutes: 420, focus: 'Аудит доступів до проєктних дощок', state: 'Високе навантаження' },
  { id: 'c', name: 'Дмитро Гнатюк', done: 3, open: 2, minutes: 95, focus: '', state: 'Стабільно' },
];

export default function ChartsSection() {
  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Показник"
        description="Заголовна цифра екрана: значення, що воно рахує, як змінилось і якої форми була ця зміна. Цифра — пропорційні знаки, не табличні: у tabular кожна цифра завширшки з нуль, і на цьому кеглі «121» виглядає розтягнутим. Сірий чіп іконки не темізується — коли кожна картка обирала власний відтінок, ряд із чотирьох читався як чотири незв’язані віджети."
        filePath="src/components/ui/DataDisplay/KpiCard.jsx"
        component="KpiCard"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={BarChart2} value="18 / 46" label="Робочі задачі" sub="39% виконано" />
          <KpiCard
            icon={TrendingDown}
            value={18}
            label="Закрито за 30 днів"
            trend={24}
            series={[2, 5, 3, 7, 4, 6, 9, 8, 11, 9, 14, 18]}
            sub="проти попереднього періоду"
          />
          <KpiCard icon={Wallet} value="64г" label="Зафіксовано часу" sub="деталі — у Табелі" />
          <KpiCard icon={AlertTriangle} value={3} label="Прострочено" sub="потребують уваги" />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Спарклайн"
        description="Форма нещодавньої історії, розміром зі слово. Без осей, підписів і тултипа — це гліф, а не графік: значення несе цифра над ним, а деталі — графік, на який картка веде."
        filePath="src/components/ui/Charts/Sparkline.jsx"
        component="Sparkline"
      >
        <div className="flex items-center gap-4">
          <Sparkline values={[2, 5, 3, 7, 4, 6, 9, 8, 11, 9, 14, 18]} />
          <Sparkline values={[18, 14, 15, 9, 11, 8, 9, 6, 4, 3, 5, 2]} />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Скільки чого"
        description="Статуси, типи, пріоритети, проєкти, люди — п’ять рукописних версій цього графіка в чотирьох файлах, і жодні дві не збігались. Підпис стоїть над смугою й отримує всю ширину: у фіксованій колонці на 90px обрізалась кожна назва статусу. Смуга масштабується до найбільшого значення — саме це означає «порівняй їх між собою»; `scale=&quot;total&quot;` там, де це справді частки одного цілого. Колір несе смуга, ніколи текст."
        filePath="src/components/ui/Charts/BarList.jsx"
        component="BarList"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <Card preset="borderless" padding="lg">
            <DetailSection icon={BarChart2} title="По статусах">
              <BarList
                items={[
                  { id: 'todo', label: 'До виконання', value: 14, color: '#6b7280' },
                  { id: 'progress', label: 'У роботі', value: 9, color: '#2f6fb0' },
                  { id: 'review', label: 'На перевірці', value: 4, color: '#cf7a22' },
                  { id: 'done', label: 'Готово', value: 19, color: '#0e8f74' },
                ]}
              />
            </DetailSection>
          </Card>
          <Card preset="borderless" padding="lg">
            <DetailSection icon={Flag} title="Куди пішов час" meta="64г">
              <BarList
                scale="total"
                format={minutes => `${Math.round(minutes / 60)}г`}
                items={[
                  { id: 'tasks', label: 'Завдання', value: 2400 },
                  { id: 'meetings', label: 'Мітинги', value: 900, color: 'var(--color-chart-2)', meta: '6 подій' },
                  { id: 'focus', label: 'Фокус-час', value: 540, color: 'var(--color-chart-3)' },
                ]}
              />
            </DetailSection>
          </Card>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Кількість у часі"
        description="Дві серії щонайбільше — далі це не той графік: згорни хвіст або розклади на кілька. Стовпці обмежені по ширині, а не заповнюють свій слот, тож залишок — це повітря; наведення підсвічує всю смугу разом із проміжком, а не 6px позначку в ній. Легенда є завжди, коли серій дві: ідентичність ніколи не тримається на самому кольорі."
        filePath="src/components/ui/Charts/ColumnChart.jsx"
        component="ColumnChart"
        fullWidth
      >
        <Card preset="borderless" padding="lg" className="w-full">
          <DetailSection icon={BarChart2} title="Активність" meta="7 днів">
            <ColumnChart data={DEMO_DAYS} series={DEMO_FLOW} height={130} />
          </DetailSection>
        </Card>
      </PreviewBlock>

      <PreviewBlock
        title="Тренд із опорною лінією"
        description="Пунктир тут — єдиний пунктир у продукті, і він його заслуговує: пунктир означає «розрахунок, а не вимір», що для «рівного темпу» саме так. Сітка й осі пунктиром не бувають ніколи. Точки лежать у власному пікселевому просторі SVG, тому лінія завтовшки рівно стільки, скільки написано — попередня версія розтягувала систему координат і на різних пропорціях малювала то 2px, то волосину."
        filePath="src/components/ui/Charts/TrendChart.jsx"
        component="TrendChart"
        fullWidth
      >
        <Card preset="borderless" padding="lg" className="w-full">
          <DetailSection icon={TrendingDown} title="Скільки роботи лишилось" meta="12 днів">
            <TrendChart data={DEMO_BURNDOWN} valueLabel="Фактично лишилось" referenceLabel="Рівний темп" height={140} />
          </DetailSection>
        </Card>
      </PreviewBlock>

      <PreviewBlock
        title="Частка від межі"
        description="Бюджет годин, прогрес підзавдань. Три такі смуги в продукті мали три незв’язані палітри на одне питання: чорнильна до 70%, потім yellow-400, потім red-500 — поруч зі смугою, яка була emerald на будь-якому значенні. Серйозність лишилась, але говорить словами так само, як кольором: смуга, яка лише червона, каже «погано» всім, крім тих, хто не бачить, що вона червона."
        filePath="src/components/ui/Charts/Meter.jsx"
        component="Meter"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-3">
          <Meter value={0.42} label="Бюджет у нормі" reading="42%" />
          <Meter value={0.78} tone="warning" label="Наближається до межі" reading="78%" />
          <Meter value={0.96} tone="danger" label="Майже вичерпано" reading="96%" />
        </div>
        {/* Без підпису — так смуга стоїть у колонці таблиці, де заголовок
            колонки вже сказав, що вимірюється. Показник усе одно тримається
            правого краю смуги, а не лівого. */}
        <div className="mt-5 grid w-full grid-cols-1 gap-5 sm:grid-cols-3">
          <Meter value={0} reading="Готово: 0/1" height={6} />
          <Meter value={0.5} reading="Готово: 3/6" height={6} />
          <Meter value={1} reading="Готово: 8/8" height={6} />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Таблиця показників"
        description="Аналітика мала три таблиці, і кожну писали з нуля: різні лінійки, різні кеглі заголовків, різні кольори чисел, а одна з них узагалі була шестиколонковою CSS-сіткою, продубльованою двічі. Це справжня <table>, тож скрінрідер отримує таблицю; нижче брейкпоінта кожен рядок згортається в підписаний стос, бо шість колонок на телефоні — це горизонтальний скрол, якого ніхто не знаходить. Значення, яке не є короткою цифрою — назва, смуга, чіп — позначається `wide` і в стосі займає рядок цілком: інакше воно малювалось поверх сусідньої колонки, а власний підпис обрізало до нуля."
        filePath="src/components/ui/DataDisplay/DataTable.jsx"
        component="DataTable"
        fullWidth
      >
        <Card preset="borderless" padding="lg" className="w-full">
          <DetailSection icon={Users} title="Навантаження по виконавцях" meta="3">
            <DataTable
              rows={DEMO_MEMBERS}
              rowKey={row => row.id}
              columns={[
                {
                  id: 'member',
                  header: 'Учасник',
                  lead: true,
                  cell: row => (
                    <span className="flex min-w-0 items-center gap-2">
                      <UserAvatar user={{ id: row.id, name: row.name }} size="sm" />
                      <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{row.name}</span>
                    </span>
                  ),
                },
                {
                  id: 'focus',
                  header: 'Поточний фокус',
                  wide: true,
                  cell: row => (row.focus
                    ? <span className="block truncate text-[12px] font-medium text-ink">{row.focus}</span>
                    : <span className="text-[12px] text-faint">Немає задач у роботі</span>),
                },
                {
                  id: 'progress',
                  header: 'Прогрес',
                  width: '160px',
                  wide: true,
                  cell: row => <Meter value={row.done / (row.done + row.open)} reading={`Готово: ${row.done}/${row.done + row.open}`} height={6} />,
                },
                { id: 'done', header: 'Готово', align: 'right', width: '92px', cell: row => <span className="ui-type-figure text-muted">{row.done}</span> },
                { id: 'time', header: 'Час', align: 'right', width: '92px', cell: row => <span className="ui-type-figure text-ink">{Math.round(row.minutes / 60)}г</span> },
                {
                  id: 'state',
                  header: 'Стан',
                  align: 'right',
                  width: '150px',
                  wide: true,
                  cell: row => (row.state === 'Стабільно'
                    ? <Pill tone="success" size="md">{row.state}</Pill>
                    : <Pill tone="warning" size="md">{row.state}</Pill>),
                },
              ]}
            />
          </DetailSection>
        </Card>
      </PreviewBlock>

      <PreviewBlock
        title="Що потребує уваги"
        description="«Інсайти» й «Увага» були стосами `Alert` — компонента, зробленого, щоб перервати: 16px паддінга, 4px кольорова лінійка збоку, тонована заливка й темний тонований текст. П’ять таких поспіль — це п’ять речей, які кричать одночасно в чотирьох кольорах, на найспокійнішому екрані продукту. Жодна з них нічого не перериває: це показник. Тому — тихий рядок, гліф несе серйозність, цифра несе вагу, а робочий простір, де все гаразд, каже це одним рядком."
        filePath="src/components/ui/Feedback/SignalList.jsx"
        component="SignalList"
        fullWidth
      >
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          <Card preset="borderless" padding="lg">
            <DetailSection icon={AlertTriangle} title="Що потребує уваги">
              <SignalList
                signals={[
                  { id: '1', tone: 'critical', count: 4, title: 'Завдання заблоковані залежностями', description: 'Їх стримують незавершені задачі' },
                  { id: '2', tone: 'critical', count: 3, title: 'Прострочені завдання', description: 'Дедлайн минув, робота відкрита' },
                  { id: '3', tone: 'warning', count: 2, title: 'Без виконавця', description: 'Ніхто не відповідає за результат' },
                  { id: '4', tone: 'info', count: 11, title: 'Без оцінки', description: 'Поза беклогом, але без плану за часом' },
                ]}
              />
            </DetailSection>
          </Card>
          <Card preset="borderless" padding="lg">
            <DetailSection icon={AlertTriangle} title="Що потребує уваги">
              <SignalList signals={[]} emptyText="Нічого термінового — усе під контролем" />
            </DetailSection>
          </Card>
        </div>
      </PreviewBlock>
    </div>
  );
}
