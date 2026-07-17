'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plug, ExternalLink } from 'lucide-react';
import { can } from '@/lib/utils/can';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { usePortalSession } from '@/lib/portal/usePortalSession';
import { usePortalProjects } from '@/lib/portal/usePortalProjects';
import { toPortalProjectOptions, resolveLinkView } from '@/lib/portal/qtplusLinkModel.mjs';
import { linkQtPlusProject, unlinkQtPlusProject } from '@/lib/portal/qtplusProjectLink';
import QtPlusStagesView from '@/components/workspace/qtplus/QtPlusStagesView';

function LinkedRow({ name, stale, readOnly }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Plug size={15} className="text-muted shrink-0" />
        <span className="text-[13px] text-ink font-medium">
          Привʼязано до: <span className="font-semibold">«{name || 'Без назви'}»</span>
        </span>
        {readOnly && <span className="text-[12px] text-muted">(лише для читання)</span>}
      </div>
      {stale && (
        <p className="text-[12px] text-muted pl-[23px]">
          Цей проєкт QuickTeam+ зараз недоступний для вашого акаунта.
        </p>
      )}
    </div>
  );
}

export default function QtPlusProjectTab({ project, orgRole, currentUser, allProjects }) {
  const canManage = can(orgRole, 'edit:project_settings');
  const showToast = useWorkspaceStore((s) => s.showToast);

  const { portalUser, loading: sessionLoading, error: sessionError } = usePortalSession();
  const { projects: portalProjects, loading: projectsLoading } = usePortalProjects(portalUser);

  const [pendingId, setPendingId] = useState('');
  const [saving, setSaving] = useState(false);

  const link = project?.qtplusLink || null;
  const optionsLoaded = Boolean(portalUser) && !projectsLoading && Array.isArray(portalProjects);

  const options = useMemo(() => toPortalProjectOptions(portalProjects), [portalProjects]);
  const otherLinkedIds = useMemo(
    () => (allProjects || [])
      .filter((p) => p.id !== project?.id && p.qtplusLink?.projectId)
      .map((p) => p.qtplusLink.projectId),
    [allProjects, project?.id],
  );
  const view = useMemo(
    () => resolveLinkView({ link, options, otherLinkedIds, optionsLoaded }),
    [link, options, otherLinkedIds, optionsLoaded],
  );

  const selectValue = pendingId || view.selectedId || '';
  const selectOptions = view.options.map((o) => ({
    value: o.id,
    label: o.linkedElsewhere ? `${o.name} (вже привʼязано)` : o.name,
  }));

  const doLink = async () => {
    const chosen = options.find((o) => o.id === selectValue);
    if (!chosen) return;
    setSaving(true);
    try {
      await linkQtPlusProject(project.id, chosen, currentUser?.uid || null);
      setPendingId('');
      showToast('Проєкт QuickTeam+ привʼязано');
    } catch (err) {
      console.error('[qtplus] link failed:', err);
      showToast('Не вдалося привʼязати проєкт', 'error');
    }
    setSaving(false);
  };

  const doUnlink = async () => {
    setSaving(true);
    try {
      await unlinkQtPlusProject(project.id);
      setPendingId('');
      showToast('Проєкт QuickTeam+ відвʼязано');
    } catch (err) {
      console.error('[qtplus] unlink failed:', err);
      showToast('Не вдалося відвʼязати проєкт', 'error');
    }
    setSaving(false);
  };

  // ── Member (read-only). Members only reach this tab when linked; guard anyway. ──
  if (!canManage) {
    if (!view.linked) return null;
    return (
      <div className="flex-1 min-h-[240px] py-6 flex flex-col gap-4">
        <LinkedRow name={view.linkedName} readOnly />
        {portalUser && <QtPlusStagesView qtProjectId={link.projectId} />}
      </div>
    );
  }

  // ── Owner/admin ──
  return (
    <div className="flex-1 min-h-[240px] py-6 max-w-[560px] flex flex-col gap-4">
      {view.linked && <LinkedRow name={view.linkedName} stale={view.staleAccess} />}

      {view.linked ? (
        <div className="flex flex-col gap-3">
          {portalUser && options.length > 0 && (
            <>
              <p className="text-[13px] text-muted">Змінити привʼязку:</p>
              <div className="flex items-center gap-2">
                <Select
                  value={selectValue}
                  onChange={setPendingId}
                  options={selectOptions}
                  placeholder="Оберіть проєкт QuickTeam+"
                />
                <Button
                  style="secondary"
                  size="lg"
                  onClick={doLink}
                  disabled={saving || !selectValue || selectValue === view.linkedId}
                >
                  Змінити
                </Button>
              </div>
            </>
          )}
          <div>
            <Button style="ghost" size="lg" onClick={doUnlink} disabled={saving}>
              Відвʼязати
            </Button>
          </div>
        </div>
      ) : sessionLoading || projectsLoading ? (
        <p className="text-[13px] text-muted">Перевіряємо доступ до QuickTeam+…</p>
      ) : (!portalUser || sessionError === 'not_connected') ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-muted">
            Підключіть свій акаунт QuickTeam+, щоб привʼязати проєкт.
          </p>
          <Link
            href="/settings?section=qtplus"
            className="inline-flex items-center gap-1 text-[13px] text-[#6366f1] font-semibold hover:underline"
          >
            Перейти до Налаштувань <ExternalLink size={12} />
          </Link>
        </div>
      ) : sessionError === 'grant_invalid' ? (
        <p className="text-[13px] text-red-500">
          Підключення застаріло — підключіть QuickTeam+ заново в Налаштуваннях.
        </p>
      ) : sessionError ? (
        <p className="text-[13px] text-muted">Не вдалося зʼєднатися з QuickTeam+. Спробуйте пізніше.</p>
      ) : options.length === 0 ? (
        <p className="text-[13px] text-muted">У вашому акаунті QuickTeam+ немає доступних проєктів.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-muted">
            Оберіть проєкт QuickTeam+, щоб привʼязати його до цього проєкту.
          </p>
          <div className="flex items-center gap-2">
            <Select
              value={selectValue}
              onChange={setPendingId}
              options={selectOptions}
              placeholder="Оберіть проєкт QuickTeam+"
            />
            <Button style="primary" size="lg" onClick={doLink} disabled={saving || !selectValue}>
              Привʼязати
            </Button>
          </div>
        </div>
      )}

      {view.linked && portalUser && <QtPlusStagesView qtProjectId={link.projectId} />}
    </div>
  );
}
