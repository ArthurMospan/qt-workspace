'use client';
import QtPlusStagesView from './QtPlusStagesView';
import QtPlusChatPanel from './chat/QtPlusChatPanel';

/**
 * Вміст привʼязаної вкладки QuickTeam+: етапи/матеріали ліворуч, чат збоку праворуч.
 * На вузькому екрані (< lg) чат стає під етапами. qtProjectId — id проєкту в порталі.
 * Монтується лише коли portalUser вже автентифікований (гейт у QtPlusProjectTab).
 */
export default function QtPlusLinkedContent({ qtProjectId, portalUser, currentUser, header = null }) {
  return (
    <div className="grid min-h-[520px] grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-h-[520px] min-w-0 flex-col gap-4 rounded-[16px] bg-canvas p-4">
        {header}
        <QtPlusStagesView qtProjectId={qtProjectId} />
      </div>
      <aside className="h-[520px] min-h-[440px] w-full overflow-hidden rounded-[16px] bg-canvas lg:sticky lg:top-[140px] lg:h-[min(620px,calc(100vh-180px))]">
        <QtPlusChatPanel qtProjectId={qtProjectId} portalUser={portalUser} currentUser={currentUser} embedded />
      </aside>
    </div>
  );
}
