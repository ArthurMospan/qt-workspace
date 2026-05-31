'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { can } from '@/lib/utils/can';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DollarSign, AlertCircle, PieChart, Users, Folder, TrendingUp, Calendar as CalendarIcon, FileText, Clock } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';
import { Button, Card, KpiCard, Table, DatePicker, PageLayout, LoadingSpinner } from '@/components/ui';


const formatDate = (d) => {
  if (!d) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

function fmtTime(minutes) {
  if (!minutes) return '0хв';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}хв`;
  if (m === 0) return `${h}г`;
  return `${h}г ${m}хв`;
}

function getStartOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function BillingDashboard() {
  const { activeOrgId, orgRole, projects } = useAppContext();
  const { members } = useOrganization();
  const isManager = can(orgRole, 'manage:team');

  const [dateRange, setDateRange] = useState({
    start: getStartOfMonth(),
    end: new Date()
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    if (!activeOrgId) return;
    const ref = doc(db, 'organizations', activeOrgId, 'settings', 'workflow');
    getDoc(ref).then(snap => {
      if (snap.exists() && snap.data().positions) {
        setPositions(snap.data().positions);
      }
    }).catch(console.error);
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeOrgId || !isManager) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const endBoundary = new Date(dateRange.end);
    endBoundary.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, 'timeLogs'),
      where('organizationId', '==', activeOrgId),
      where('loggedAt', '>=', Timestamp.fromDate(dateRange.start)),
      where('loggedAt', '<=', Timestamp.fromDate(endBoundary))
    );

    getDocs(q).then(snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [activeOrgId, dateRange, isManager]);

  // Calculations
  const calculations = useMemo(() => {
    let totalCost = 0;
    let totalMinutes = 0;

    const byUser = {};
    const byProject = {};

    logs.forEach(log => {
      const mins = log.spentMinutes || 0;
      const uId = log.userId;
      const pId = log.projectId;
      
      const member = members.find(m => (m.id || m.uid) === uId);
      let rate = member?.hourlyRate || 0;
      if (member?.positionId && !rate) {
        const pos = positions.find(p => p.id === member.positionId);
        if (pos) rate = pos.hourlyRate || 0;
      }
      
      const cost = (mins / 60) * rate;

      totalMinutes += mins;
      totalCost += cost;

      if (!byUser[uId]) byUser[uId] = { mins: 0, cost: 0, user: member, resolvedRate: rate };
      byUser[uId].mins += mins;
      byUser[uId].cost += cost;

      if (!byProject[pId]) {
        const proj = projects.find(p => p.id === pId);
        byProject[pId] = { id: pId, mins: 0, cost: 0, name: proj ? proj.name : 'Видалений проєкт' };
      }
      byProject[pId].mins += mins;
      byProject[pId].cost += cost;
    });

    return {
      totalCost,
      totalMinutes,
      byUser: Object.values(byUser).sort((a, b) => b.cost - a.cost),
      byProject: Object.values(byProject).sort((a, b) => b.cost - a.cost)
    };
  }, [logs, members, projects, positions]);

  if (!isManager) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-8">
        <AlertCircle size={48} className="text-[#ef4444] mb-4 opacity-50" />
        <h2 className="text-[20px] font-bold text-[#1f1f1f]">Немає доступу</h2>
        <p className="text-[#9a9a9a] mt-2">Тільки адміністратори можуть бачити фінансову аналітику.</p>
      </div>
    );
  }

  // Prep Team/Members Table Headers and Rows
  const teamHeaders = ['Учасник', 'Час', 'Ставка', 'Вартість'];
  const teamRows = calculations.byUser.map(u => [
    <div key="member" className="flex items-center gap-2">
      {u.user && <UserAvatar user={u.user} size={24} />}
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold text-[#1f1f1f]">{u.user ? (u.user.name || u.user.email) : 'Невідомо'}</span>
        {u.user?.positionId && (
          <span className="text-[12px] text-[#9a9a9a] font-normal">
            {positions.find(p => p.id === u.user.positionId)?.label}
          </span>
        )}
      </div>
    </div>,
    <div key="time" className="text-right font-medium text-[#4a4a4a]">{fmtTime(u.mins)}</div>,
    <div key="rate" className="text-right font-medium text-[#9a9a9a]">${u.resolvedRate || 0}/год</div>,
    <div key="cost" className="text-right font-bold text-[#1f1f1f]">${u.cost.toFixed(2)}</div>
  ]);

  // Prep Projects Table Headers and Rows
  const projectHeaders = ['Проєкт', 'Час', 'Загалом', ''];
  const projectRows = calculations.byProject.map(p => [
    <span key="name" className="text-[13px] font-semibold text-[#1f1f1f]">{p.name}</span>,
    <div key="time" className="text-right font-medium text-[#4a4a4a]">{fmtTime(p.mins)}</div>,
    <div key="cost" className="text-right font-bold text-[#1f1f1f]">${p.cost.toFixed(2)}</div>,
    <div key="action" className="text-right flex justify-end">
      {p.id !== 'undefined' && p.id !== null && (
        <Link 
          href={`/workspace/analytics/billing/invoice?projectId=${p.id}&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`}
          passHref
          legacyBehavior
        >
          <Button size="sm" variant="secondary" icon={FileText}>
            Інвойс
          </Button>
        </Link>
      )}
    </div>
  ]);

  const pageHeader = (
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-col">
        <h1 className="text-[24px] font-bold text-[#1f1f1f]">Білінг та Витрати</h1>
        <p className="text-[13px] text-[#9a9a9a] mt-1">Фінансова аналітика та витрати за період</p>
      </div>
      <div className="w-[240px]">
        <DatePicker
          mode="range"
          startDate={formatDate(dateRange.start)}
          endDate={formatDate(dateRange.end)}
          onDateRangeChange={(startStr, endStr) => {
            if (startStr && endStr) {
              setDateRange({
                start: new Date(startStr),
                end: new Date(endStr)
              });
            }
          }}
          placeholder="Оберіть період"
        />
      </div>
    </div>
  );

  return (
    <PageLayout header={<div className="px-[32px] py-[20px]">{pageHeader}</div>}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="flex flex-col gap-[24px]">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
            <KpiCard
              icon={DollarSign}
              label="Загальні витрати"
              value={`$${calculations.totalCost.toFixed(2)}`}
              color="#10b981"
              sub="За вибраний період"
            />
            
            <KpiCard
              icon={Clock}
              label="Відпрацьовано годин"
              value={fmtTime(calculations.totalMinutes)}
              color="#6366f1"
              sub="На основі таймшитів команди"
            />

            <KpiCard
              icon={PieChart}
              label="ROI / Рентабельність"
              value="В розробці"
              color="#f97316"
              sub="Скоро буде додано доходи"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
            {/* By User */}
            <div className="flex flex-col gap-[12px]">
              <div className="flex items-center gap-2 px-1">
                <Users size={16} className="text-[#6366f1]" />
                <h2 className="text-[18px] font-bold text-[#1f1f1f]">Витрати по команді</h2>
              </div>
              <Table variant="backlog" headers={teamHeaders} rows={teamRows} />
            </div>

            {/* By Project */}
            <div className="flex flex-col gap-[12px]">
              <div className="flex items-center gap-2 px-1">
                <Folder size={16} className="text-[#f97316]" />
                <h2 className="text-[18px] font-bold text-[#1f1f1f]">Витрати по проєктах</h2>
              </div>
              <Table variant="backlog" headers={projectHeaders} rows={projectRows} />
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
