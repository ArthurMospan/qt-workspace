'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkspaceAnalytics } from '@/lib/hooks/useWorkspaceAnalytics';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import WorkloadTab from '@/components/workspace/WorkloadTab';
import FilterBar from '@/components/ui/FilterBar';
import {
  EmptyState,
  LoadingSpinner,
  Segmented,
  Surface,
} from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import {
  filterTeamIssues,
  filterTeamTimeLogs,
} from '@/lib/utils/teamAnalytics.mjs';

const PERIOD_OPTIONS = [7, 14, 30, 90].map(days => ({ value: days, label: `${days}д` }));

function memberName(member) {
  return member?.name || member?.displayName || member?.email || 'Працівник';
}

export default function MemberAnalyticsPage() {
  const { memberId } = useParams();
  const router = useRouter();
  const { projects = [] } = useAppContext();
  const { members = [] } = useOrganization();
  const { issues, timeLogs, loading } = useWorkspaceAnalytics(projects.map(project => project.id));
  const { events, loading: calendarLoading } = useCalendarEvents();
  const [projectFilters, setProjectFilters] = useState([]);
  const [period, setPeriod] = useState(30);

  const member = members.find(item => (item.id || item.uid) === memberId);
  const visibleProjects = useMemo(
    () => projects.filter(project => (
      projectFilters.length === 0 || projectFilters.includes(project.id)
    )),
    [projectFilters, projects],
  );
  const memberIssues = useMemo(
    () => filterTeamIssues(issues, projectFilters, memberId),
    [issues, memberId, projectFilters],
  );
  const memberTimeLogs = useMemo(
    () => filterTeamTimeLogs(timeLogs, projectFilters, memberId),
    [memberId, projectFilters, timeLogs],
  );

  useEffect(() => {
    useWorkspaceStore.setState({
      breadcrumbs: [
        { label: 'Аналітика', href: '/analytics' },
        { label: 'Команда', href: '/analytics?tab=workload' },
        { label: memberName(member), href: null },
      ],
    });
    return () => useWorkspaceStore.setState({ breadcrumbs: [] });
  }, [member]);

  if (loading || calendarLoading) {
    return (
      <div className="flex min-h-[360px] flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex min-h-[440px] flex-1 items-center justify-center bg-white">
        <EmptyState
          icon={Users}
          title="Працівника не знайдено"
          description="Можливо, він більше не входить до організації."
          action="Повернутися до команди"
          onAction={() => router.push('/analytics?tab=workload')}
        />
      </div>
    );
  }

  return (
    <div className="custom-scrollbar h-full flex-1 overflow-y-auto overflow-x-hidden bg-transparent">
      <div className="workspace-page-layout min-h-full pb-[120px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-ink">Дані працівника</p>
            <p className="mt-0.5 text-[10px] text-muted">Фільтри застосовуються до всіх розділів сторінки</p>
          </div>
          <FilterBar>
            <MultiSelect
              value={projectFilters}
              onChange={setProjectFilters}
              options={projects.map(project => ({ value: project.id, label: project.name }))}
              placeholder="Всі проєкти"
              searchPlaceholder="Пошук проєкту…"
              className="w-[210px]"
              variant="ghost"
            />
            <span className="mx-0.5 h-4 w-px shrink-0 bg-line" />
            <Segmented
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
            />
          </FilterBar>
        </div>

        <Surface variant="panel" padding="lg" className="min-h-[520px] flex-1">
          <WorkloadTab
            members={members}
            issues={memberIssues}
            timeLogs={memberTimeLogs}
            events={events}
            projects={visibleProjects}
            period={period}
            selectedMemberId={memberId}
            standaloneDetail
            onSelectMember={() => router.push('/analytics?tab=workload')}
          />
        </Surface>
      </div>
    </div>
  );
}
