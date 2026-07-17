'use client';
import { useEffect, useState } from 'react';
import { usePortalStages } from '@/lib/portal/usePortalStages';
import { usePortalStageMaterials } from '@/lib/portal/usePortalStageMaterials';
import { stageProgress, defaultStageId } from '@/lib/portal/qtplusStageModel.mjs';
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
  const [selectedId, setSelectedId] = useState(null);
  const [touched, setTouched] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Початковий етап рахуємо, коли етапи приїхали, і лише доки користувач сам
  // нічого не обрав. queueMicrotask — бо react-hooks/set-state-in-effect
  // забороняє синхронний setState у тілі ефекту (патерн useProjects.js).
  useEffect(() => {
    if (touched || !stages.length) return;
    queueMicrotask(() => setSelectedId(defaultStageId(stages)));
  }, [stages, touched]);

  const handleSelect = (id) => {
    setTouched(true);
    setSelectedId(id);
  };

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

      {selected ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink font-semibold truncate">{selected.label || 'Без назви'}</span>
            <span className="text-[12px] text-muted shrink-0">Прогрес: {percent}% ({done}/{total})</span>
          </div>
          <StageMaterials stageId={selected.id} onOpen={setLightbox} />
        </>
      ) : (
        <p className="text-[13px] text-muted py-4">Роботу над проєктом ще не розпочато.</p>
      )}

      <MediaLightbox view={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
