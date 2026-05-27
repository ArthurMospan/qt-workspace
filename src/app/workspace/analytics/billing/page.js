'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { can } from '@/lib/utils/can';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DollarSign, AlertCircle, PieChart, Users, Folder, TrendingUp, Calendar as CalendarIcon, FileText, Clock } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import Link from 'next/link';

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
      const rate = member?.hourlyRate || 0;
      
      const cost = (mins / 60) * rate;

      totalMinutes += mins;
      totalCost += cost;

      if (!byUser[uId]) byUser[uId] = { mins: 0, cost: 0, user: member };
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
  }, [logs, members, projects]);

  if (!isManager) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f9f9f9]">
        <AlertCircle size={48} className="text-[#ef4444] mb-4 opacity-50" />
        <h2 className="text-[20px] font-bold text-[#1f1f1f]">Немає доступу</h2>
        <p className="text-[#9a9a9a] mt-2">Тільки адміністратори можуть бачити фінансову аналітику.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f7f7f7] overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="pt-[32px] mb-[24px] px-[24px] md:px-[40px] shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold text-[#c026d3] uppercase tracking-widest bg-[#fdf4ff] px-2 py-0.5 rounded-full">Фінанси</span>
            </div>
            <h1 className="text-[26px] md:text-[32px] font-bold text-[#1f1f1f] tracking-tight leading-tight">
              Білінг та Витрати
            </h1>
            <p className="text-[#9a9a9a] mt-[4px] text-[14px]">
              Розрахунок вартості розробки на основі відпрацьованих годин
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-white border border-[#e9e9e9] rounded-[12px] p-1 shadow-sm shrink-0">
            <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-bold text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-colors">
              <CalendarIcon size={16} />
              {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
            </button>
          </div>
        </div>
      </div>

      <div className="px-[24px] md:px-[40px] pb-[40px]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-[32px] h-[32px] border-[3px] border-[#e9e9e9] border-t-[#c026d3] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-[16px] border border-[#e9e9e9] p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={80} /></div>
                <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Загальні витрати</h3>
                <p className="text-[36px] font-bold text-[#1f1f1f] tracking-tight">${calculations.totalCost.toFixed(2)}</p>
                <div className="flex items-center gap-1 text-[12px] font-bold text-[#10b981] mt-2">
                  <TrendingUp size={14} /> За вибраний період
                </div>
              </div>
              
              <div className="bg-white rounded-[16px] border border-[#e9e9e9] p-6 shadow-sm">
                <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2 flex items-center gap-2"><Clock size={14}/> Відпрацьовано годин</h3>
                <p className="text-[32px] font-bold text-[#1f1f1f] tracking-tight">{fmtTime(calculations.totalMinutes)}</p>
                <p className="text-[12px] text-[#9a9a9a] mt-2">Базується на таймшитах команди</p>
              </div>

              <div className="bg-[#1f1f1f] rounded-[16px] p-6 shadow-sm text-white flex flex-col justify-between">
                <div>
                  <h3 className="text-[12px] font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2"><PieChart size={14}/> ROI / Рентабельність</h3>
                  <p className="text-[32px] font-bold tracking-tight">В розробці</p>
                </div>
                <p className="text-[12px] text-white/40">Скоро ви зможете додавати доходи за проектами.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* By User */}
              <div className="bg-white rounded-[16px] border border-[#e9e9e9] shadow-sm flex flex-col">
                <div className="p-5 border-b border-[#f0f0f0] flex items-center gap-2">
                  <Users size={16} className="text-[#6366f1]" />
                  <h3 className="text-[15px] font-bold text-[#1f1f1f]">Витрати по команді</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#fafafa]">
                      <tr>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase">Учасник</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase text-right">Час</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase text-right">Ставка</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase text-right">Вартість</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {calculations.byUser.map(u => (
                        <tr key={u.user?.uid || u.user?.id || 'unknown-' + u.mins} className="hover:bg-[#fafafa] transition-colors">
                          <td className="px-5 py-3 flex items-center gap-2">
                            {u.user && <UserAvatar user={u.user} size={24} />}
                            <span className="text-[13px] font-semibold text-[#1f1f1f]">{u.user ? (u.user.name || u.user.email) : 'Невідомо'}</span>
                          </td>
                          <td className="px-5 py-3 text-[13px] font-medium text-[#4a4a4a] text-right">{fmtTime(u.mins)}</td>
                          <td className="px-5 py-3 text-[13px] font-medium text-[#9a9a9a] text-right">${u.user?.hourlyRate || 0}/год</td>
                          <td className="px-5 py-3 text-[13px] font-bold text-[#1f1f1f] text-right">${u.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                      {calculations.byUser.length === 0 && (
                        <tr><td colSpan={4} className="text-center p-6 text-[13px] text-[#9a9a9a]">Немає даних</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* By Project */}
              <div className="bg-white rounded-[16px] border border-[#e9e9e9] shadow-sm flex flex-col">
                <div className="p-5 border-b border-[#f0f0f0] flex items-center gap-2">
                  <Folder size={16} className="text-[#f97316]" />
                  <h3 className="text-[15px] font-bold text-[#1f1f1f]">Витрати по проєктах</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#fafafa]">
                      <tr>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase">Проєкт</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase text-right">Час</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase text-right">Загалом</th>
                        <th className="px-5 py-3 text-[11px] font-bold text-[#9a9a9a] uppercase text-right w-[80px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0]">
                      {calculations.byProject.map(p => (
                        <tr key={p.id} className="hover:bg-[#fafafa] transition-colors">
                          <td className="px-5 py-3">
                            <span className="text-[13px] font-semibold text-[#1f1f1f]">{p.name}</span>
                          </td>
                          <td className="px-5 py-3 text-[13px] font-medium text-[#4a4a4a] text-right">{fmtTime(p.mins)}</td>
                          <td className="px-5 py-3 text-[13px] font-bold text-[#1f1f1f] text-right">${p.cost.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right">
                            {p.id !== 'undefined' && p.id !== null && (
                              <Link 
                                href={`/workspace/analytics/billing/invoice?projectId=${p.id}&start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6366f1] bg-[#eef2ff] hover:bg-[#e0e7ff] px-2 py-1 rounded-[6px] transition-colors"
                              >
                                <FileText size={12} /> Інвойс
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                      {calculations.byProject.length === 0 && (
                        <tr><td colSpan={4} className="text-center p-6 text-[13px] text-[#9a9a9a]">Немає даних</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
