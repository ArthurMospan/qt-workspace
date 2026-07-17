'use client';
import { useEffect, useState } from 'react';
import { usePortalStages } from '@/lib/portal/usePortalStages';
import { usePortalStageMaterials } from '@/lib/portal/usePortalStageMaterials';
import { stageProgress, defaultStageId, canAccessStage } from '@/lib/portal/qtplusStageModel.mjs';
import StageStepper from './StageStepper';
import MaterialGrid from './MaterialGrid';
import MediaLightbox from './MediaLightbox';

function Spinner() {
  return <div className="w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin" />;
}

function StageMaterials({ stageId, onOpen }) {
  const { materials, loading, error } = usePortalStageMaterials(stageId);

  if (loading) return <div className="py-4"><Spinner /></div>;
  if (error) {
    return (
      <p className="text-[13px] text-muted py-4">
        {error === 'no_access'
          ? 'Немає доступу до матеріалів.'
          : 'Не вдалося завантажити матеріали. Спробуйте пізніше.'}
      </p>
    );
  }
  if (materials.length === 0) return <p className="text-[13px] text-muted py-4">У цьому етапі ще немає матеріалів.</p>;
  return <MaterialGrid materials={materials} onOpen={onOpen} />;
}

export default function QtPlusStagesView({ qtProjectId }) {
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

  const handleSelect = setSelectedId;

  if (loading) return <div className="py-4"><Spinner /></div>;
  if (error) {
    return (
      <p className="text-[13px] text-muted py-4">
        {error === 'no_access'
          ? 'Немає доступу до цього проєкту QuickTeam+ вашим акаунтом.'
          : 'Не вдалося завантажити етапи. Спробуйте пізніше.'}
      </p>
    );
  }
  if (stages.length === 0) return <p className="text-[13px] text-muted py-4">Ще немає етапів.</p>;

  const { done, total, percent } = stageProgress(stages);
  const selected = stages.find((s) => s.id === selectedId) || null;

  return (
    <div className="flex flex-col gap-3">
      <StageStepper stages={stages} activeId={selectedId} onSelect={handleSelect} />

      {selectedId === undefined ? (
        <div className="py-4"><Spinner /></div>
      ) : selected ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink font-semibold truncate">{selected.label || 'Без назви'}</span>
            <span className="text-[12px] text-muted shrink-0">Прогрес: {percent}% ({done}/{total})</span>
          </div>
          {canAccessStage(selected) ? (
            <StageMaterials stageId={selected.id} onOpen={setLightbox} />
          ) : (
            <p className="text-[13px] text-muted py-4">Етап ще не розпочато.</p>
          )}
        </>
      ) : (
        <p className="text-[13px] text-muted py-4">Роботу над проєктом ще не розпочато.</p>
      )}

      <MediaLightbox view={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
