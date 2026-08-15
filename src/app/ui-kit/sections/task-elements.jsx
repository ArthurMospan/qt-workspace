'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { AttributeTrigger, UserAvatar, AttachmentRow, BulkActionBar, TimeLogRow, TimeTrackingControl, MarkdownEditor, MarkdownViewer, AttachmentViewer, TitleInput, DescriptionPlaceholder, IssueLinkRow, SelectableChip } from '@/components/ui';
import { Settings2, Check, Tag as TagIcon, Users } from 'lucide-react';
import { PreviewBlock } from '../preview';

// The task surface's own elements, the way chat has its own. Everything here
// used to be markup inside IssueDetail, CreateTaskModal or the markdown files —
// 28 hand-written controls, the second largest hole in "the kit is the source"
// after chat. The state lives in this function body on purpose: coverage is
// measured by finding `<Component` inside the section's own body, so moving a
// preview into a helper would read as uncovered.
export default function TaskElementsSection() {
  const demoUser = { id: 'kit-arthur', name: 'Артур Моспан' };
  const demoAttachment = { id: 'a1', name: 'onboarding-v2.png', size: 218112, url: '' };
  const [title, setTitle] = useState('Переробити онбординг');
  const [pickedAssignee, setPickedAssignee] = useState(true);
  const [pickedLabel, setPickedLabel] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [markdown, setMarkdown] = useState('## Опис\n\nПерший екран лишаємо, **другий** переробляємо.\n\n- [x] Зібрати макети\n- [ ] Погодити копірайт');
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="Назва завдання в режимі редагування"
        description="Заголовок, у який можна писати: розмір h1, без коробки, з лінійкою знизу. Навмисно не варіант Input — той малює заливку, рамку й падінги утилітами, а тут їх немає; варіант міг би тільки намагатися їх скасувати, і виграв би той клас, який Tailwind згенерував пізніше, а не той, що написаний останнім."
        filePath="src/components/ui/Forms/TitleInput.jsx"
        component="TitleInput"
        fullWidth
      >
        <TitleInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Назва завдання..." />
      </PreviewBlock>

      <PreviewBlock
        title="Порожній опис"
        description="Підказка, яка водночас є кнопкою «почати редагувати». Не TextAction: там кожен розмір semibold, а тут 13px звичайної ваги, курсив і згасання faint→muted."
        filePath="src/components/ui/TaskManagement/DescriptionPlaceholder.jsx"
        component="DescriptionPlaceholder"
        fullWidth
      >
        <DescriptionPlaceholder onClick={() => {}}>
          Натисни Редагувати щоб додати опис...
        </DescriptionPlaceholder>
      </PreviewBlock>

      <PreviewBlock
        title="Опис завдання — дві шкали читання"
        description="md — панель попереднього перегляду в редакторі, lg — опис завдання, який читають. Раніше друге задавалося className на місці виклику, і половина того перевизначення не діяла: розмір застосовувався, а міжрядковий інтервал — ні, бо базовий leading-relaxed генерується пізніше за leading-7."
        filePath="src/components/ui/DataDisplay/MarkdownViewer.jsx"
        component="MarkdownViewer"
        fullWidth
      >
        <div className="grid gap-[16px] md:grid-cols-2">
          <div className="flex flex-col gap-[8px]">
            <span className="font-mono text-[9px] font-bold text-[#1f1f1f]">size=&quot;md&quot; · 14px</span>
            <MarkdownViewer content={markdown} size="md" />
          </div>
          <div className="flex flex-col gap-[8px]">
            <span className="font-mono text-[9px] font-bold text-[#1f1f1f]">size=&quot;lg&quot; · 15px</span>
            <MarkdownViewer content={markdown} size="lg" />
          </div>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Редактор опису"
        description="Панель інструментів, три режими (редагування / поруч / перегляд), повний екран і вкладення. Жив у src/components і був єдиним великим полем вводу продукту, якого каталог не показував."
        filePath="src/components/ui/Forms/MarkdownEditor.jsx"
        component="MarkdownEditor"
        fullWidth
      >
        <MarkdownEditor value={markdown} onChange={setMarkdown} minHeight="180px" />
      </PreviewBlock>

      <PreviewBlock
        title="Трекінг часу"
        description="22px квадрат пуску/зупинки і сума поруч, яка сама є кнопкою відкриття журналу. Єдине місце в продукті, де контрол червоніє, щоб сказати «йде запис»."
        filePath="src/components/ui/TaskManagement/TimeTrackingControl.jsx"
        component="TimeTrackingControl"
        fullWidth
      >
        <div className="flex items-center gap-[24px]">
          <TimeTrackingControl
            running={timerRunning}
            onToggle={() => setTimerRunning(v => !v)}
            onOpen={() => {}}
            spentLabel={timerRunning ? '1г 12хв' : '48хв'}
            estimateLabel="4г"
          />
          <span className="text-[10px] text-[#cfcfcf]">натисніть, щоб побачити стан «йде запис»</span>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Тригери у смузі атрибутів"
        description="Дві форми одного компонента. variant=&quot;details&quot; — власний контрол смуги, що відкриває поля, які міняють рідше; condensed стискає його з 42 до 28px разом зі скролом шапки. variant=&quot;cell&quot; — комірка атрибута, яка сама відкриває поповер: у календаря таких дві, і вони писалися руками в класі кіту, тобто хром був кітовий, а кнопка ні. Натиснутий вигляд належить лише details — комірка фарбує свій підпис і своє значення сама."
        filePath="src/components/ui/Layout/TaskAttributesPanel.jsx"
        component="AttributeTrigger"
        fullWidth
      >
        <div className="flex flex-wrap items-end gap-[16px]">
          {[[false, false, 'details'], [false, true, 'details · натиснутий'], [true, false, 'details · condensed']].map(([condensed, active, role]) => (
            <div key={role} className="flex w-[120px] flex-col items-center gap-[6px]">
              <AttributeTrigger variant="details" condensed={condensed} active={active} aria-label="Деталі завдання">
                <Settings2 size={14} />
                <span>Деталі</span>
              </AttributeTrigger>
              <span className="text-[9px] text-[#cfcfcf]">{role}</span>
            </div>
          ))}
          {[[false, 'cell'], [true, 'cell · condensed']].map(([condensed, role]) => (
            <div key={role} className="flex w-[150px] flex-col items-center gap-[6px]">
              <div className="w-full rounded-[10px] bg-canvas p-1.5">
                <AttributeTrigger variant="cell" condensed={condensed} aria-label="Учасники події">
                  <span className="block h-[14px] overflow-hidden text-[10px] font-bold uppercase leading-[14px] tracking-wider text-muted">Учасники</span>
                  <span className="flex items-center text-[13px] font-medium text-ink"><Users size={13} className="mr-1.5 shrink-0 text-muted" />3 учасників</span>
                </AttributeTrigger>
              </div>
              <span className="text-[9px] text-[#cfcfcf]">{role}</span>
            </div>
          ))}
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Запис у журналі часу"
        description="Хто списав, скільки, коли, і пара редагувати/видалити, що зʼявляється на наведення. Довго здавалося, що таких списків два з різним виглядом — другий лежав під {false && …} і не рендерився роками."
        filePath="src/components/ui/TaskManagement/TimeLogRow.jsx"
        component="TimeLogRow"
        fullWidth
      >
        <div className="flex flex-col gap-[8px]">
          <TimeLogRow
            member={demoUser}
            spentLabel="1г 30хв"
            dateLabel="12 травня"
            description="Зібрав макети й звів до одного файлу"
            canEdit
            onEdit={() => {}}
            onDelete={() => {}}
          />
          <TimeLogRow member={{ name: 'Олена Коваль' }} spentLabel="45хв" dateLabel="12 травня" />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Вкладення завдання"
        description="Уся зона від мініатюри до назви відкриває файл і підсвічується разом; завантаження та видалення лишаються окремими діями."
        filePath="src/components/ui/TaskManagement/AttachmentRow.jsx"
        component="AttachmentRow"
        fullWidth
      >
        <AttachmentRow
          attachment={demoAttachment}
          onOpen={() => setViewerOpen(true)}
          onDelete={() => {}}
          onDownload={() => {}}
        />
      </PreviewBlock>

      <PreviewBlock
        title="Масові дії із завданнями"
        description="Плаваюча панель зʼявляється після вибору карток і тримає статус, відповідального та пріоритет в одному передбачуваному місці. На реальній дошці вона закріплена над нижнім краєм."
        filePath="src/components/ui/TaskManagement/BulkActionBar.jsx"
        component="BulkActionBar"
        fullWidth
      >
        <div className="relative min-h-[88px] overflow-hidden rounded-[12px] bg-canvas [&_.ui-bulk-actions]:!absolute">
          <BulkActionBar
            count={4}
            statusOptions={[{ value: 'todo', label: 'До виконання', color: '#6b7280' }]}
            memberOptions={[{ value: 'kit-arthur', label: 'Артур Моспан', user: demoUser }]}
            priorityOptions={[{ value: 'medium', label: 'Середній' }]}
            onApply={() => {}}
            onClear={() => {}}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Перегляд вкладення"
        description="Повноекранний перегляд із масштабуванням, завантаженням і відкриттям оригіналу. Відкривається поверх сторінки — закрийте на Esc або хрестиком."
        filePath="src/components/ui/AttachmentViewer.jsx"
        component="AttachmentViewer"
        fullWidth
      >
        <Button style="secondary" size="sm" onClick={() => setViewerOpen(true)}>Відкрити перегляд</Button>
        {viewerOpen && (
          <AttachmentViewer
            attachment={{ name: 'brief.pdf', url: 'data:application/pdf;base64,', type: 'application/pdf' }}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </PreviewBlock>

      <PreviewBlock
        title="Звʼязок між задачами"
        description="Тип звʼязку, задача, на яку він вказує, і відвʼязування на наведення. Тут же виходить назовні позначка «Потребує перевірки» — старий звʼязок «підзавдання», напрямок якого не відновлюється автоматично."
        filePath="src/components/ui/TaskManagement/IssueLinkRow.jsx"
        component="IssueLinkRow"
        fullWidth
      >
        <div className="flex flex-col gap-[6px]">
          <IssueLinkRow label="Блокує" onRemove={() => {}}>
            <span className="text-[13px] font-semibold text-ink truncate">
              <span className="text-muted font-medium mr-1 uppercase">QT-128</span>
              Перевірити копірайт другого екрана
            </span>
          </IssueLinkRow>
          <IssueLinkRow label="Повʼязано" requiresReview onRemove={() => {}}>
            <span className="text-[13px] font-semibold text-ink truncate">
              <span className="text-muted font-medium mr-1 uppercase">QT-77</span>
              Старий імпорт із YouTrack
            </span>
          </IssueLinkRow>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Чіпи вибору"
        description="Натискний чіп: виконавець на новій задачі, мітка на новій задачі. Це перемикач, а не посилання — стан несе aria-pressed, тож вибране й невибране це два стани одного контрола. Мітка бере колір із бази під час рендера, чого не виражає жоден клас."
        filePath="src/components/ui/Forms/SelectableChip.jsx"
        component="SelectableChip"
        fullWidth
      >
        <div className="flex flex-wrap items-center gap-[8px]">
          <SelectableChip shape="person" selected={pickedAssignee} onClick={() => setPickedAssignee(v => !v)}>
            <span aria-hidden="true"><UserAvatar user={demoUser} size="xs" /></span>
            <span className="max-w-[180px] truncate">Артур Моспан</span>
            {pickedAssignee && <Check size={12} className="shrink-0" />}
          </SelectableChip>
          <SelectableChip shape="person" selected={false} onClick={() => {}}>
            <span aria-hidden="true"><UserAvatar user={{ name: 'Олена Коваль' }} size="xs" /></span>
            <span className="max-w-[180px] truncate">Олена Коваль</span>
          </SelectableChip>
          <SelectableChip shape="label" selected={pickedLabel} tone="#2563eb" onClick={() => setPickedLabel(v => !v)}>
            <TagIcon size={10} className="shrink-0 opacity-70" />
            дизайн
          </SelectableChip>
          <SelectableChip shape="label" selected={false} onClick={() => {}}>
            <TagIcon size={10} className="shrink-0 opacity-70" />
            беклог
          </SelectableChip>
        </div>
      </PreviewBlock>
    </div>
  );
}
