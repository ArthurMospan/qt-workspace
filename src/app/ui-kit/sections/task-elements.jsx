'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { AttributeTrigger, UserAvatar, AttachmentRow, TimeLogRow, TimeTrackingControl, MarkdownEditor, MarkdownViewer, AttachmentViewer, TitleInput, DescriptionPlaceholder, IssueLinkRow, SelectableChip } from '@/components/ui';
import { Settings2, Check, Tag as TagIcon } from 'lucide-react';
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
        title="Тригер «Деталі» у смузі атрибутів"
        description="Відкриває поля, які міняють рідше — пріоритет і тип. Хром був у кіті ще раніше, а кнопка, що його носить, писалася на місці виклику, тож єдине, що можна було переплутати, — натиснутий вигляд — жило поза кітом. condensed стискає висоту з 42 до 28px разом зі скролом шапки."
        filePath="src/components/ui/Layout/TaskAttributesPanel.jsx"
        component="AttributeTrigger"
        fullWidth
      >
        <div className="flex flex-wrap items-center gap-[16px]">
          {[[false, false, 'звичайний'], [false, true, 'натиснутий'], [true, false, 'condensed']].map(([condensed, active, role]) => (
            <div key={role} className="flex w-[120px] flex-col items-center gap-[6px]">
              <AttributeTrigger condensed={condensed} active={active} aria-label="Деталі завдання">
                <Settings2 size={14} />
                <span>Деталі</span>
              </AttributeTrigger>
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
        description="Мініатюра, назва з розміром, завантаження й видалення в одному рядку — чотири рукописні контроли, найщільніша латка нативної розмітки на цій поверхні."
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
