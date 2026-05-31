'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { Printer, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';

function fmtTime(minutes) {
  if (!minutes) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function InvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const { activeOrgId, activeOrg } = useAppContext();
  const { members } = useOrganization();

  const [project, setProject] = useState(null);
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
    if (!activeOrgId || !projectId || !startParam || !endParam) return;

    const start = new Date(startParam);
    const end = new Date(endParam);

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch project
        const pSnap = await getDoc(doc(db, 'projects', projectId));
        if (pSnap.exists()) {
          setProject(pSnap.data());
        } else {
          setProject({ name: 'Невідомий проєкт' });
        }

        // Fetch logs
        const q = query(
          collection(db, 'timeLogs'),
          where('organizationId', '==', activeOrgId),
          where('projectId', '==', projectId),
          where('loggedAt', '>=', Timestamp.fromDate(start)),
          where('loggedAt', '<=', Timestamp.fromDate(end))
        );
        const lSnap = await getDocs(q);
        setLogs(lSnap.docs.map(d => d.data()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeOrgId, projectId, startParam, endParam]);

  const calculations = useMemo(() => {
    let totalCost = 0;
    let totalMinutes = 0;
    const byUser = {};

    logs.forEach(log => {
      const mins = log.spentMinutes || 0;
      const uId = log.userId;
      
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
    });

    return {
      totalCost,
      totalMinutes,
      items: Object.values(byUser).sort((a, b) => b.cost - a.cost)
    };
  }, [logs, members, positions]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const invoiceDate = new Date().toLocaleDateString('uk-UA');
  const invoiceNumber = `INV-${new Date().getTime().toString().slice(-6)}`;

  return (
    <div className="flex-1 overflow-y-auto bg-[#f9f9f9] print:bg-white flex justify-center py-10 print:py-0">
      
      {/* Floating Toolbar (Hidden on print) */}
      <div className="fixed top-6 right-8 flex gap-3 print:hidden z-50">
        <Button onClick={() => router.back()} style="secondary" size="md" icon={ArrowLeft}>
          Назад
        </Button>
        <Button onClick={handlePrint} style="primary" size="md" icon={Printer}>
          Друкувати PDF
        </Button>
      </div>

      {/* A4 Document Container */}
      <div className="w-full max-w-[800px] bg-white print:shadow-none shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-[2px] p-12 print:p-0 min-h-[1122px]">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-16 border-b border-[#f0f0f0] pb-8">
          <div>
            <h1 className="text-[32px] font-bold text-[#1f1f1f] tracking-tight mb-1">ІНВОЙС</h1>
            <p className="text-[14px] text-[#9a9a9a]">#{invoiceNumber}</p>
          </div>
          <div className="text-right text-[13px] text-[#4a4a4a] leading-relaxed">
            <p className="font-bold text-[16px] text-[#1f1f1f] mb-2">{activeOrg?.name || 'QuickTeam Org'}</p>
            <p>вул. Технологічна, 42</p>
            <p>м. Київ, Україна</p>
            <p>hello@quickteam.me</p>
          </div>
        </div>

        {/* Bill To & Details */}
        <div className="flex justify-between mb-16">
          <div>
            <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-widest mb-3">Виставлено для:</p>
            <p className="font-bold text-[16px] text-[#1f1f1f] mb-1">Клієнт Проєкту</p>
            <p className="text-[14px] text-[#4a4a4a] max-w-[250px]">Проєкт: <span className="font-bold">{project?.name}</span></p>
          </div>
          <div className="text-right text-[14px] text-[#4a4a4a]">
            <div className="flex justify-between gap-12 mb-2">
              <span className="font-bold text-[#9a9a9a]">Дата виставлення:</span>
              <span className="font-bold text-[#1f1f1f]">{invoiceDate}</span>
            </div>
            <div className="flex justify-between gap-12 mb-2">
              <span className="font-bold text-[#9a9a9a]">Період:</span>
              <span className="text-[#1f1f1f]">{new Date(startParam).toLocaleDateString('uk-UA')} - {new Date(endParam).toLocaleDateString('uk-UA')}</span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-16">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-[#1f1f1f]">
                <th className="py-3 text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide">Опис робіт (Розробник)</th>
                <th className="py-3 text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide text-right">Години</th>
                <th className="py-3 text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide text-right">Ставка</th>
                <th className="py-3 text-[12px] font-bold text-[#1f1f1f] uppercase tracking-wide text-right">Сума</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {calculations.items.map(item => (
                <tr key={item.user?.uid || Math.random()}>
                  <td className="py-4">
                    <p className="text-[14px] font-bold text-[#1f1f1f]">{item.user?.name || item.user?.email || 'Невідомий спеціаліст'}</p>
                    <p className="text-[12px] text-[#9a9a9a]">
                      {positions.find(p => p.id === item.user?.positionId)?.label || item.user?.role || 'Розробка'}
                    </p>
                  </td>
                  <td className="py-4 text-right text-[14px] text-[#4a4a4a]">{fmtTime(item.mins)}</td>
                  <td className="py-4 text-right text-[14px] text-[#4a4a4a]">${item.resolvedRate || 0}/год</td>
                  <td className="py-4 text-right text-[14px] font-bold text-[#1f1f1f]">${item.cost.toFixed(2)}</td>
                </tr>
              ))}
              {calculations.items.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#9a9a9a] text-[13px]">Немає відпрацьованого часу за цей період</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-[300px]">
            <div className="flex justify-between py-3 border-b border-[#f0f0f0]">
              <span className="text-[14px] text-[#4a4a4a]">Всього годин:</span>
              <span className="text-[14px] font-bold text-[#1f1f1f]">{fmtTime(calculations.totalMinutes)}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-[#f0f0f0]">
              <span className="text-[14px] text-[#4a4a4a]">Податок (0%):</span>
              <span className="text-[14px] font-bold text-[#1f1f1f]">$0.00</span>
            </div>
            <div className="flex justify-between py-4 bg-[#f9f9f9] px-4 mt-2 rounded-[8px]">
              <span className="text-[16px] font-bold text-[#1f1f1f] uppercase">До сплати:</span>
              <span className="text-[20px] font-bold text-[#6366f1]">${calculations.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-20 pt-8 border-t border-[#f0f0f0] text-[12px] text-[#9a9a9a] leading-relaxed">
          <p className="font-bold text-[#1f1f1f] mb-1">Умови оплати</p>
          <p>Оплата здійснюється протягом 14 банківських днів з моменту виставлення рахунку. У разі виникнення питань, будь ласка, зв'яжіться з нами за адресою hello@quickteam.me.</p>
        </div>

      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="p-10">Завантаження...</div>}>
      <InvoiceContent />
    </Suspense>
  );
}
