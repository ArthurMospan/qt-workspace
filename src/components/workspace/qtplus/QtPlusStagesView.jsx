'use client';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui';
import { usePortalStages } from '@/lib/portal/usePortalStages';
import { usePortalStageMaterials } from '@/lib/portal/usePortalStageMaterials';
import { stageProgress, defaultStageId, canAccessStage } from '@/lib/portal/qtplusStageModel.mjs';
import StageStepper from './StageStepper';
import MaterialGrid from './MaterialGrid';
import MediaLightbox from './MediaLightbox';

/**
 * Те, що стоїть замість матеріалів: очікування, відмова або порожній етап.
 *
 * Раніше це був абзац із `py-4` — він приклеювався до лівого верхнього кута
 * панелі заввишки 520 пікселів, під смугою етапів, і читався як обірваний
 * підпис до неї, а не як відповідь про весь блок. Відповідь про порожній блок
 * стоїть посеред нього.
 */
function StagePlaceholder({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 text-center">
      <p className="max-w-[320px] text-[13px] text-muted">{children}</p>
    </div>
  );
}

function StageLoading({ label }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <LoadingSpinner size="md" label={label} />
    </div>
  );
}

function StageMaterials({ stageId, onOpen }) {
  const { materials, loading, error } = usePortalStageMaterials(stageId);

  if (loading) return <StageLoading label="Завантажуємо матеріали…" />;
  if (error) {
    return (
      <StagePlaceholder>
        {error === 'no_access'
          ? 'Немає доступу до матеріалів.'
          : 'Не вдалося завантажити матеріали. Спробуйте пізніше.'}
      </StagePlaceholder>
    );
  }
  if (materials.length === 0) return <StagePlaceholder>У цьому етапі ще немає матеріалів.</StagePlaceholder>;
  return <MaterialGrid materials={materials} onOpen={onOpen} />;
}

/**
 * Етапи проєкту QuickTeam+ і матеріали обраного етапу.
 *
 * Шапка приходить згори, але малюється тут, бо тільки тут відомий прогрес: він
 * стоїть біля назви проєкту, а не окремим рядком під смугою етапів. Тому `header`
 * може бути функцією — їй передається готовий вузол прогресу.
 */
export default function QtPlusStagesView({ qtProjectId, header = null }) {
  const { stages, loading, error } = usePortalStages(qtProjectId);
  // undefined = ще не рахували; null = порахували, доступного етапу немає (усі todo)
  const [selectedId, setSelectedId] = useState(undefined);
  const [lightbox, setLightbox] = useState(null);

  // Рахуємо етап за замовчуванням, поки поточний вибір недійсний: на першому
  // завантаженні або якщо обраний етап зник із живого оновлення. Чинний вибір
  // користувача не чіпаємо — саме тому перевіряємо наявність етапу в списку, а
  // не окремий прапорець. queueMicrotask — синхронний setState у тілі ефекту тут
  // є помилкою лінта (react-hooks/set-state-in-effect), патерн з useProjects.js.
  useEffect(() => {
    if (!stages.length) return;
    if (selectedId && stages.some((s) => s.id === selectedId)) return;
    queueMicrotask(() => setSelectedId(defaultStageId(stages)));
  }, [stages, selectedId]);

  const hasStages = !loading && !error && stages.length > 0;
  const { done, total, percent } = hasStages ? stageProgress(stages) : { done: 0, total: 0, percent: 0 };
  const selected = hasStages ? stages.find((s) => s.id === selectedId) || null : null;

  const progress = hasStages ? (
    <span className="shrink-0 text-[12px] text-muted" title={`Завершено ${done} з ${total} етапів`}>
      Прогрес: {percent}% ({done}/{total})
    </span>
  ) : null;

  const headerNode = typeof header === 'function' ? header(progress) : header;

  let body;
  if (loading) {
    body = <StageLoading label="Завантажуємо етапи…" />;
  } else if (error) {
    body = (
      <StagePlaceholder>
        {error === 'no_access'
          ? 'Немає доступу до цього проєкту QuickTeam+ вашим акаунтом.'
          : 'Не вдалося завантажити етапи. Спробуйте пізніше.'}
      </StagePlaceholder>
    );
  } else if (stages.length === 0) {
    body = <StagePlaceholder>Ще немає етапів.</StagePlaceholder>;
  } else if (selectedId === undefined) {
    body = <StageLoading label="Завантажуємо етапи…" />;
  } else if (!selected) {
    body = <StagePlaceholder>Роботу над проєктом ще не розпочато.</StagePlaceholder>;
  } else if (!canAccessStage(selected)) {
    body = <StagePlaceholder>Етап ще не розпочато.</StagePlaceholder>;
  } else {
    body = <StageMaterials stageId={selected.id} onOpen={setLightbox} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {headerNode && <div className="px-4 pb-3 pt-4">{headerNode}</div>}
      {hasStages && <StageStepper stages={stages} activeId={selectedId} onSelect={setSelectedId} />}
      {/* Колонка, а не просто скролпорт: заглушка займає всю висоту, що лишилась,
          і центрується в ній, а сітка матеріалів як була, так і лишається зверху. */}
      <div className="hide-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3">{body}</div>

      <MediaLightbox view={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
