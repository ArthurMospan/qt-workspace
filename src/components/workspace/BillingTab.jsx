'use client';
// src/components/workspace/BillingTab.jsx
// Invoice calculator: form/tasks on the left, always-visible summary rail on
// the right. Chrome matches the rest of the analytics tabs (no dark shell).
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useProjectAllTimeLogs } from '@/lib/hooks/useProjectAllTimeLogs';
import { useAppContext } from '@/lib/context/AppContext';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, query, where, onSnapshot, serverTimestamp, doc, getDoc,
} from 'firebase/firestore';
import UserAvatar from '@/components/UserAvatar';
import { Copy, Printer, Clock, Save, Eye } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import {
  Button, Surface, LoadingSpinner, Input, Textarea, Tabs, Checkbox,
  Dialog, Card, Alert, PriorityBadge,
} from '@/components/ui';
import { useWorkflowConfig, DEFAULT_TYPES } from '@/lib/hooks/useWorkflowConfig';

// ── Defaults ─────────────────────────────────────────────────────────

const TYPE_META = Object.fromEntries(DEFAULT_TYPES.map(t => [t.id, t]));

const COL_LABEL = {
  backlog: 'Backlog', todo: 'To Do', 'in-progress': 'In Progress',
  'code-review': 'Code Review', qa: 'QA', 'client-approval': 'Client Approval', done: 'Done',
};

const CURRENCIES = ['USD', 'EUR', 'UAH', 'GBP', 'PLN'];

// ── Helpers ───────────────────────────────────────────────────────────

function fmtMin(min) {
  if (!min) return '0г';
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? (m > 0 ? `${h}г ${m}хв` : `${h}г`) : `${m}хв`;
}
function fmtMoney(amount, currency) {
  if (typeof amount !== 'number') return '—';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
function fmtDate(d = new Date()) {
  return new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
function invoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`;
}

// ── Field Component matching TaskDetailPanel ──────────────────────────

function Field({ label, children }) {
  return (
    <div className="w-full">
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wide mb-2">{label}</label>
      {children}
    </div>
  );
}

// ── Rate row component ────────────────────────────────────────────────

function RateRow({ uid, member, rate, onRateChange, preset, onPresetChange, currency, positions = [] }) {
  return (
    <div className="flex items-center gap-3 py-[10px] border-b border-[#f0f0f0] last:border-0">
      <UserAvatar user={member} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-ink truncate">{member?.name || member?.email || uid}</p>
        <Select
          value={preset || member?.positionId || ''}
          onChange={val => {
            const p = positions.find(r => r.id === val);
            onPresetChange(val);
            if (p) onRateChange(p.hourlyRate);
          }}
          options={[
            { value: '', label: 'Посада...' },
            ...positions.map(p => ({ value: p.id, label: p.label }))
          ]}
          placeholder="Посада..."
          className="w-[120px] mt-[2px]"
          dropdownClassName="w-[160px]"
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[12px] text-muted font-semibold">{currency}/г</span>
        <input
          type="number"
          min={0}
          value={rate}
          onChange={e => onRateChange(Number(e.target.value))}
          className="w-[60px] h-[32px] text-[13px] font-semibold bg-canvas border-0 rounded-[8px] px-2 outline-none focus:bg-[#efefef] text-right"
        />
      </div>
    </div>
  );
}

// ── Issue row component ───────────────────────────────────────────────

function IssueRow({ issue, checked, onCheck, timeLogs, rates, members, manualPrice, onManualPrice, currency, useManual, onUseManual }) {
  const issueLogs = useMemo(
    () => timeLogs[issue.id] || { totalMinutes: 0, byUser: {} },
    [timeLogs, issue.id],
  );

  // Calculate auto price: sum per-user (minutes/60 * rate)
  const autoPrice = useMemo(() => {
    let total = 0;
    Object.entries(issueLogs.byUser).forEach(([uid, minutes]) => {
      const rate = rates[uid] ?? 0;
      total += (minutes / 60) * rate;
    });
    // If no time logged but estimate exists → use estimate
    if (total === 0 && issue.estimateMinutes) {
      const uid = issue.assigneeIds?.[0];
      const rate = uid ? (rates[uid] ?? 0) : 0;
      total = (issue.estimateMinutes / 60) * rate;
    }
    return total;
  }, [issueLogs, rates, issue]);

  const price = useManual ? (manualPrice ?? 0) : autoPrice;
  const type = issue.type || 'task';

  return (
    <div 
      onClick={onCheck}
      className={`bg-white border border-[#efefef] hover:border-[#dfdfdf] rounded-[18px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.02)] cursor-pointer select-none ${
        !checked ? 'opacity-65 bg-[#fafafa]/50' : ''
      }`}
    >
      <div className="flex items-start gap-[12px] min-w-0 flex-1">
        <div className="mt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <Checkbox checked={checked} onChange={onCheck} />
        </div>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-[8px] flex-wrap">
            <span className="text-[10px] font-bold text-muted bg-[#f5f5f5] px-2 py-0.5 rounded tracking-wide">
              {issue.issueKey || 'TASK'}
            </span>
            <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full" style={{ color: TYPE_META[type]?.color || '#059669', background: (TYPE_META[type]?.color || '#059669') + '18' }}>
              {TYPE_META[type]?.label || type}
            </span>
            <PriorityBadge priority={issue.priority} />
          </div>

          <h4 className="text-[14px] font-bold text-[#1a1a1a] mt-1 truncate">
            {issue.title}
          </h4>

          {issueLogs.totalMinutes > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(issueLogs.byUser).map(([uid, min]) => {
                const m = members.find(me => (me.id || me.uid) === uid);
                return (
                  <div key={uid} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted bg-canvas px-2 py-0.5 rounded-full">
                    <Clock size={10} />
                    <span>{m?.name || uid.slice(0, 6)}: {fmtMin(min)}</span>
                    {rates[uid] ? (
                      <span className="text-ink font-bold">({fmtMoney((min / 60) * rates[uid], currency)})</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            issue.estimateMinutes ? (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-muted mt-1.5">
                <Clock size={11} />
                <span>Оцінка: {fmtMin(issue.estimateMinutes)}</span>
              </div>
            ) : (
              <span className="text-[11px] text-faint italic mt-1 block">Часу не списано, немає оцінки</span>
            )
          )}
        </div>
      </div>

      <div 
        className="flex items-center gap-4 shrink-0 justify-between sm:justify-end"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-end gap-1">
          <div>
            <button 
              onClick={onUseManual} 
              title={useManual ? 'Перейти на авто' : 'Ввести вручну'}
              className={`text-[10px] font-bold px-2 py-[2.5px] rounded-full transition-colors uppercase tracking-wider ${
                useManual ? 'bg-ink text-white' : 'bg-canvas text-muted hover:bg-[#efefef]'
              }`}
            >
              {useManual ? 'ручна' : 'авто'}
            </button>
          </div>
          {useManual ? (
            <Input
              type="number"
              min={0}
              step="0.01"
              value={manualPrice ?? ''}
              onChange={e => onManualPrice(e.target.value === '' ? null : Number(e.target.value))}
              placeholder="0.00"
              className="w-[90px] h-[32px] text-right"
            />
          ) : (
            <span className={`text-[14px] font-bold ${price > 0 ? 'text-ink' : 'text-faint'}`}>
              {price > 0 ? fmtMoney(price, currency) : '—'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Invoice Preview Component ─────────────────────────────────────────

function InvoicePreview({ invoice, project, org, onClose }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${invoice.number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Inter, -apple-system, sans-serif; color: #1f1f1f; padding: 48px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 32px; font-weight: 800; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a9a9a; padding: 8px 0; border-bottom: 2px solid #1f1f1f; }
          td { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; vertical-align: top; }
          .total-row td { border-bottom: none; font-weight: 700; font-size: 15px; padding-top: 16px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .meta-block p { font-size: 13px; color: #4a4a4a; line-height: 1.6; }
          .meta-block strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a9a9a; margin-bottom: 4px; }
          .grand { font-size: 28px; font-weight: 800; text-align: right; margin-top: 16px; }
          .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: #f0f0f0; color: #4a4a4a; }
          @media print { body { padding: 24px; } }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleCopy = () => {
    const lines = [
      `РАХУНОК ${invoice.number}`,
      `Дата: ${invoice.date}`,
      `Клієнт: ${invoice.clientName || org?.name || '—'}`,
      `Проєкт: ${project?.name}`,
      '',
      'Послуги:',
      ...invoice.items.map(i => `  ${i.title} (${i.key}) — ${fmtMoney(i.price, invoice.currency)}`),
      '',
      `Підсумок: ${fmtMoney(invoice.subtotal, invoice.currency)}`,
      invoice.discount > 0 ? `Знижка (${invoice.discountPct}%): -${fmtMoney(invoice.discount, invoice.currency)}` : '',
      invoice.tax > 0 ? `ПДВ (${invoice.taxPct}%): +${fmtMoney(invoice.tax, invoice.currency)}` : '',
      `До оплати: ${fmtMoney(invoice.total, invoice.currency)}`,
    ].filter(l => l !== '').join('\n');
    navigator.clipboard.writeText(lines);
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title="Попередній перегляд рахунку"
      size="md"
      footer={
        <>
          <Button onClick={handleCopy} style="secondary" size="md" icon={Copy}>Копіювати</Button>
          <Button onClick={handlePrint} style="primary" size="md" icon={Printer}>Друкувати</Button>
        </>
      }
    >
          <div ref={printRef} className="px-2 py-3 max-w-[640px] mx-auto">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-[28px] font-black text-ink tracking-tight">РАХУНОК</h1>
                <p className="text-[14px] font-semibold text-muted">{invoice.number}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-muted">Дата виставлення</p>
                <p className="text-[15px] font-bold text-ink">{invoice.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Від</p>
                <p className="text-[13px] font-semibold text-ink">{invoice.fromName || 'Ваша агенція'}</p>
                {invoice.fromDetails && <p className="text-[12px] text-muted mt-1 whitespace-pre-line">{invoice.fromDetails}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Кому</p>
                <p className="text-[13px] font-semibold text-ink">{invoice.clientName || '—'}</p>
                {invoice.clientDetails && <p className="text-[12px] text-muted mt-1 whitespace-pre-line">{invoice.clientDetails}</p>}
              </div>
            </div>

            <div className="bg-canvas rounded-[10px] px-4 py-3 mb-6">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Проєкт</p>
              <p className="text-[13px] font-semibold text-ink mt-[2px]">{project?.name}</p>
            </div>

            <table className="w-full mb-2" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-muted uppercase tracking-wider pb-2 border-b-2 border-ink">Послуга</th>
                  <th className="text-center text-[10px] font-bold text-muted uppercase tracking-wider pb-2 border-b-2 border-ink w-[90px]">Час</th>
                  <th className="text-right text-[10px] font-bold text-muted uppercase tracking-wider pb-2 border-b-2 border-ink w-[100px]">Сума</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 border-b border-[#f0f0f0]">
                      <p className="text-[13px] font-medium text-ink">{item.title}</p>
                      <p className="text-[10px] text-muted">{item.key} · {item.status}</p>
                    </td>
                    <td className="py-3 border-b border-[#f0f0f0] text-center text-[12px] text-muted">
                      {item.minutes > 0 ? fmtMin(item.minutes) : '—'}
                    </td>
                    <td className="py-3 border-b border-[#f0f0f0] text-right text-[13px] font-semibold text-ink">
                      {fmtMoney(item.price, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col items-end gap-1 mt-4">
              <div className="flex justify-between w-[240px]">
                <span className="text-[12px] text-muted">Підсумок</span>
                <span className="text-[13px] font-medium text-ink">{fmtMoney(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between w-[240px]">
                  <span className="text-[12px] text-muted">Знижка ({invoice.discountPct}%)</span>
                  <span className="text-[13px] font-medium text-green-600">−{fmtMoney(invoice.discount, invoice.currency)}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div className="flex justify-between w-[240px]">
                  <span className="text-[12px] text-muted">ПДВ ({invoice.taxPct}%)</span>
                  <span className="text-[13px] font-medium text-ink">+{fmtMoney(invoice.tax, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between w-[240px] border-t border-ink pt-2 mt-1">
                <span className="text-[13px] font-bold text-ink">До оплати</span>
                <span className="text-[18px] font-black text-ink">{fmtMoney(invoice.total, invoice.currency)}</span>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-8 pt-6 border-t border-[#f0f0f0]">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Примітки</p>
                <p className="text-[12px] text-[#4a4a4a] whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
          </div>
    </Dialog>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────

export default function BillingTab({ issues = [], members = [], project, projectId }) {
  const { currentUser, activeOrgId } = useAppContext();
  const { byIssue, loading: logsLoading } = useProjectAllTimeLogs(projectId);
  const { statuses, doneStatusIds } = useWorkflowConfig();
  // Status labels come from the live workflow config (fall back to legacy map).
  const statusLabelOf = (id) => statuses.find(s => s.id === id)?.label || COL_LABEL[id] || id;

  // ── Rate settings per member
  const [memberRates, setMemberRates] = useState({}); // { uid: number }
  const [memberPresets, setMemberPresets] = useState({}); // { uid: presetId }

  // ── Issue selection
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [manualPrices, setManualPrices] = useState({}); // { issueId: number|null }
  const [useManualMap, setUseManualMap] = useState({}); // { issueId: bool }

  // ── Invoice meta
  const [currency, setCurrency] = useState('USD');
  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [clientName, setClientName] = useState('');
  const [clientDetails, setClientDetails] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromDetails, setFromDetails] = useState('');
  const [notes, setNotes] = useState('');

  // ── UI state
  const [tab, setTab] = useState('details'); // 'details' | 'issues' | 'history'
  const [saving, setSaving] = useState(false);
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [positions, setPositions] = useState([]);

  // Load positions
  useEffect(() => {
    if (!activeOrgId) return;
    const ref = doc(db, 'organizations', activeOrgId, 'settings', 'workflow');
    getDoc(ref).then(snap => {
      if (snap.exists() && snap.data().positions) {
        setPositions(snap.data().positions);
      }
    }).catch(console.error);
  }, [activeOrgId]);

  // Collect unique member uids from issues
  const billingMembers = useMemo(() => {
    const uids = new Set();
    issues.forEach(iss => {
      (iss.assigneeIds || []).forEach(uid => uids.add(uid));
    });
    Object.values(byIssue).forEach(data => {
      Object.keys(data.byUser).forEach(uid => uids.add(uid));
    });
    return [...uids].map(uid => members.find(m => (m.id || m.uid) === uid) || { id: uid, uid, name: uid.slice(0, 8) });
  }, [issues, byIssue, members]);

  // Initialize checked ids on load (check all by default)
  useEffect(() => {
    if (issues.length > 0 && checkedIds.size === 0) {
      queueMicrotask(() => setCheckedIds(new Set(issues.map(i => i.id))));
    }
  }, [issues.length]); // eslint-disable-line

  // Initialize rates based on member profiles and positions
  useEffect(() => {
    if (billingMembers.length > 0 && Object.keys(memberRates).length === 0) {
      const initialRates = {};
      const initialPresets = {};
      billingMembers.forEach(m => {
        const uid = m.id || m.uid;
        let rate = m.hourlyRate || 0;
        if (m.positionId && !rate) {
          const pos = positions.find(p => p.id === m.positionId);
          if (pos) rate = pos.hourlyRate || 0;
        }
        initialRates[uid] = rate;
        if (m.positionId) {
          initialPresets[uid] = m.positionId;
        }
      });
      queueMicrotask(() => {
        setMemberRates(initialRates);
        setMemberPresets(initialPresets);
      });
    }
  }, [billingMembers, positions, memberRates]);

  // Load saved invoices
  useEffect(() => {
    if (!projectId || !activeOrgId) return;
    const q = query(
      collection(db, 'invoices'),
      where('projectId', '==', projectId),
      where('organizationId', '==', activeOrgId),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setSavedInvoices(docs);
    });
    return () => unsub();
  }, [projectId, activeOrgId]);

  // ── Filtered issues ──
  const filteredIssues = useMemo(() => {
    return issues.filter(iss => {
      if (filterStatus !== 'all' && iss.columnId !== filterStatus) return false;
      if (filterType !== 'all' && iss.type !== filterType) return false;
      return true;
    });
  }, [issues, filterStatus, filterType]);

  // ── Compute per-issue price ──
  const computePrice = useCallback((issue) => {
    if (useManualMap[issue.id]) return manualPrices[issue.id] ?? 0;
    const issueLogs = byIssue[issue.id] || { byUser: {} };
    let total = 0;
    Object.entries(issueLogs.byUser).forEach(([uid, minutes]) => {
      total += (minutes / 60) * (memberRates[uid] ?? 0);
    });
    if (total === 0 && issue.estimateMinutes) {
      const uid = issue.assigneeIds?.[0];
      total = (issue.estimateMinutes / 60) * (memberRates[uid] ?? 0);
    }
    return total;
  }, [byIssue, memberRates, useManualMap, manualPrices]);

  // ── Summary ──
  const { subtotal, discount, tax, total } = useMemo(() => {
    let sub = 0;
    [...checkedIds].forEach(id => {
      const iss = issues.find(i => i.id === id);
      if (iss) sub += computePrice(iss);
    });
    const disc = sub * (discountPct / 100);
    const taxAmt = (sub - disc) * (taxPct / 100);
    return { subtotal: sub, discount: disc, tax: taxAmt, total: sub - disc + taxAmt };
  }, [checkedIds, issues, computePrice, discountPct, taxPct]);

  // ── Build invoice object ──
  const buildInvoice = () => ({
    number: invoiceNumber(),
    date: fmtDate(),
    currency,
    clientName, clientDetails,
    fromName, fromDetails,
    notes,
    discountPct, taxPct,
    discount, tax, subtotal, total,
    items: [...checkedIds].map(id => {
      const iss = issues.find(i => i.id === id);
      if (!iss) return null;
      return {
        key: iss.issueKey,
        title: iss.title,
        status: statusLabelOf(iss.columnId),
        minutes: byIssue[iss.id]?.totalMinutes || iss.estimateMinutes || 0,
        price: computePrice(iss),
      };
    }).filter(Boolean),
  });

  // ── Save invoice ──
  const saveInvoice = async () => {
    if (!checkedIds.size) return;
    setSaving(true);
    try {
      const inv = buildInvoice();
      await addDoc(collection(db, 'invoices'), {
        ...inv,
        projectId,
        organizationId: activeOrgId,
        createdBy: currentUser?.uid || currentUser?.id || null,
        status: 'draft',
        createdAt: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const checkedCount = checkedIds.size;
  const statusOptions = [...new Set(issues.map(i => i.columnId))];
  const typeOptions = [...new Set(issues.map(i => i.type || 'task'))];
  const totalLoggedMin = [...checkedIds].reduce((sum, id) => sum + (byIssue[id]?.totalMinutes || 0), 0);

  const showPreviewModal = () => setShowPreview(true);

  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="w-full pb-16 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* LEFT: invoice form & task selection */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-w-0">
          <Tabs
            tabs={[
              { id: 'details', label: 'Деталі' },
              { id: 'issues', label: `Завдання (${checkedCount}/${issues.length})` },
              { id: 'history', label: `Історія (${savedInvoices.length})` },
            ]}
            activeTab={tab}
            onTabChange={setTab}
          />

          {tab === 'details' && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Клієнт (назва)">
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="ТОВ «Компанія»" />
                </Field>
                <Field label="Ваша агенція">
                  <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="Назва вашої компанії" />
                </Field>
                <Field label="Реквізити клієнта">
                  <Textarea value={clientDetails} onChange={e => setClientDetails(e.target.value)} placeholder="ЄДРПОУ, адреса..." rows={3} />
                </Field>
                <Field label="Ваші реквізити">
                  <Textarea value={fromDetails} onChange={e => setFromDetails(e.target.value)} placeholder="ЄДРПОУ, IBAN, адреса..." rows={3} />
                </Field>
              </div>

              <Field label="Примітки">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Умови оплати, терміни..." rows={2} />
              </Field>

              {/* Rates section */}
              <Field label="Ставки виконавців">
                <Surface variant="panel" padding="none" className="overflow-hidden border border-line rounded-2xl">
                  {positions.length > 0 && (
                    <div className="px-4 pt-3 pb-2 bg-[#fafafa]">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Швидкі пресети</p>
                      <div className="flex flex-wrap gap-1.5">
                        {positions.map(preset => (
                          <Button key={preset.id}
                            onClick={() => {
                              const newRates = { ...memberRates };
                              billingMembers.forEach(m => { newRates[m.id || m.uid] = preset.hourlyRate; });
                              setMemberRates(newRates);
                            }}
                            style="secondary"
                            size="sm"
                          >
                            {preset.label}: {preset.hourlyRate} {currency}/г
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="px-4 py-2 divide-y divide-[#f0f0f0]">
                    {billingMembers.length === 0 ? (
                      <p className="text-[12px] text-faint py-3 text-center">Учасників з часом немає</p>
                    ) : (
                      billingMembers.map(m => {
                        const uid = m.id || m.uid;
                        return (
                          <RateRow
                            key={uid}
                            uid={uid}
                            member={m}
                            rate={memberRates[uid] ?? 0}
                            onRateChange={v => setMemberRates(p => ({ ...p, [uid]: v }))}
                            preset={memberPresets[uid] || ''}
                            onPresetChange={v => setMemberPresets(p => ({ ...p, [uid]: v }))}
                            currency={currency}
                            positions={positions}
                          />
                        );
                      })
                    )}
                  </div>
                </Surface>
              </Field>

            </div>
          )}

          {tab === 'issues' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 flex-wrap pb-2 border-b border-line">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-ink">Завдання:</span>
                  <span className="text-[12px] text-muted">({checkedCount} обрано)</span>
                </div>
                
                <div className="flex gap-1">
                  <Button style="ghost" size="sm" onClick={() => setCheckedIds(new Set(filteredIssues.map(i => i.id)))}>Всі</Button>
                  <Button style="ghost" size="sm" onClick={() => setCheckedIds(new Set())}>Жодну</Button>
                  <Button style="ghost" size="sm" onClick={() => setCheckedIds(new Set(issues.filter(i => doneStatusIds.includes(i.columnId)).map(i => i.id)))}>Done</Button>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <Select
                    value={filterStatus}
                    onChange={val => setFilterStatus(val)}
                    options={[
                      { value: 'all', label: 'Всі статуси' },
                      ...statusOptions.map(s => ({ value: s, label: statusLabelOf(s) }))
                    ]}
                    className="w-[120px]"
                  />
                  <Select
                    value={filterType}
                    onChange={val => setFilterType(val)}
                    options={[
                      { value: 'all', label: 'Всі типи' },
                      ...typeOptions.map(t => ({ value: t, label: t }))
                    ]}
                    className="w-[110px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : filteredIssues.length === 0 ? (
                  <div className="py-12 text-center text-[13px] text-faint font-semibold">Задач немає</div>
                ) : (
                  filteredIssues.map(iss => (
                    <IssueRow
                      key={iss.id}
                      issue={iss}
                      checked={checkedIds.has(iss.id)}
                      onCheck={() => setCheckedIds(prev => {
                        const next = new Set(prev);
                        next.has(iss.id) ? next.delete(iss.id) : next.add(iss.id);
                        return next;
                      })}
                      timeLogs={byIssue}
                      rates={memberRates}
                      members={members}
                      manualPrice={manualPrices[iss.id] ?? null}
                      onManualPrice={v => setManualPrices(p => ({ ...p, [iss.id]: v }))}
                      currency={currency}
                      useManual={useManualMap[iss.id] ?? false}
                      onUseManual={() => setUseManualMap(p => ({ ...p, [iss.id]: !p[iss.id] }))}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="flex flex-col gap-3">
              {savedInvoices.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-faint font-semibold">Немає збережених рахунків</div>
              ) : (
                savedInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-4 border border-line rounded-2xl bg-[#fafafa]">
                    <div>
                      <p className="text-[13px] font-bold text-ink">{inv.number}</p>
                      <p className="text-[11px] text-muted font-medium mt-1">{inv.date} · {inv.items?.length} завдань</p>
                    </div>
                    <span className="text-[14px] font-black text-ink">{fmtMoney(inv.total, inv.currency)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* RIGHT: always-visible invoice summary rail */}
        <Card variant="gray" padding="lg" className="lg:col-span-1 flex flex-col gap-4">
          <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider">
            Рахунок · {project?.name || 'Проєкт'}
          </h3>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Валюта">
              <Select
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map(c => ({ value: c, label: c }))}
              />
            </Field>
            <Field label="Знижка %">
              <Input type="number" min={0} max={100} value={discountPct}
                onChange={e => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))} />
            </Field>
            <Field label="ПДВ %">
              <Input type="number" min={0} max={100} value={taxPct}
                onChange={e => setTaxPct(Math.min(100, Math.max(0, Number(e.target.value))))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-[12px] p-3 border border-line">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wide">Обрано завдань</p>
              <p className="text-[18px] font-bold text-ink mt-[2px]">
                {checkedCount}<span className="text-[12px] text-faint font-semibold"> / {issues.length}</span>
              </p>
            </div>
            <div className="bg-white rounded-[12px] p-3 border border-line">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wide">Списано часу</p>
              <p className="text-[18px] font-bold text-ink mt-[2px]">{fmtMin(totalLoggedMin)}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Підсумок</span>
              <span className="font-bold text-ink">{fmtMoney(subtotal, currency)}</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">Знижка ({discountPct}%)</span>
                <span className="font-bold text-green-600">−{fmtMoney(discount, currency)}</span>
              </div>
            )}
            {taxPct > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">ПДВ ({taxPct}%)</span>
                <span className="font-bold text-ink">+{fmtMoney(tax, currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-[#e4e4e4] items-center">
              <span className="text-[13px] font-bold text-ink">До оплати</span>
              <span className="text-[20px] font-black text-ink">{fmtMoney(total, currency)}</span>
            </div>
          </div>

          {billingMembers.length > 0 && Object.values(memberRates).every(r => !r) && (
            <Alert
              variant="warning"
              title="Встановіть ставки виконавців"
              description="Без ставок вартість завдань буде нульовою"
            />
          )}

          <div className="flex flex-col gap-2 mt-1">
            <Button
              onClick={showPreviewModal}
              disabled={checkedCount === 0}
              style="primary"
              size="lg"
              icon={Eye}
              className="w-full"
            >
              Переглянути рахунок
            </Button>
            <Button
              onClick={saveInvoice}
              disabled={saving || checkedCount === 0}
              style="secondary"
              size="lg"
              icon={saving ? null : Save}
              className="w-full"
            >
              {saving && <LoadingSpinner size="sm" className="mr-2 inline" />}
              Зберегти чернетку
            </Button>
          </div>
        </Card>
      </div>

      {/* Invoice preview modal */}
      {showPreview && (
        <InvoicePreview
          invoice={buildInvoice()}
          project={project}
          org={{ name: fromName }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
