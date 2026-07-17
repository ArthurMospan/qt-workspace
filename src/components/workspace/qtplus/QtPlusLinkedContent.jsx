'use client';
import QtPlusStagesView from './QtPlusStagesView';
import QtPlusChatPanel from './chat/QtPlusChatPanel';

/**
 * Вміст привʼязаної вкладки QuickTeam+: етапи/матеріали ліворуч, чат збоку праворуч.
 * На вузькому екрані (< lg) чат стає під етапами. qtProjectId — id проєкту в порталі.
 * Монтується лише коли portalUser вже автентифікований (гейт у QtPlusProjectTab).
 */
export default function QtPlusLinkedContent({ qtProjectId, portalUser, currentUser }) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 w-full">
        <QtPlusStagesView qtProjectId={qtProjectId} />
      </div>
      <div className="w-full lg:w-[340px] shrink-0">
        <QtPlusChatPanel qtProjectId={qtProjectId} portalUser={portalUser} currentUser={currentUser} />
      </div>
    </div>
  );
}
