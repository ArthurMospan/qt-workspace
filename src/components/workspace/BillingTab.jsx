'use client';
// src/components/workspace/BillingTab.jsx
// Invoice calculator for web agencies:
//   - Select issues (checkbox) to include in invoice
//   - Per-member hourly rate (role-based presets)
//   - Manual price override per issue
//   - Discount (%) + Tax (%)
//   - Invoice preview & print
//   - Save invoices to Firestore
import { useState, useMemo, useCallback, useRef } from 'react';
import { useProjectAllTimeLogs } from '@/lib/hooks/useProjectAllTimeLogs';
import { useAppContext } from '@/lib/context/AppContext';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, query, where, onSnapshot, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { useEffect } from 'react';
import UserAvatar from '@/components/UserAvatar';
import {
  Receipt, Settings2, ChevronDown, ChevronUp, Check, Copy, Printer,
  Plus, Trash2, Clock, DollarSign, Percent, Save, Eye, EyeOff,
  FileText, X, RefreshCw, AlertCircle, CheckSquare, Square,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';

// ── Defaults ─────────────────────────────────────────────────────────

const DEFAULT_RATE_PRESETS = [
  { id: 'designer',  label: 'Designer',    rate: 50,  currency: 'USD' },
  { id: 'developer', label: 'Developer',   rate: 80,  currency: 'USD' },
  { id: 'pm',        label: 'PM',          rate: 60,  currency: 'USD' },
  { id: 'qa',        label: 'QA',          rate: 45,  currency: 'USD' },
  { id: 'copywriter',label: 'Copywriter',  rate: 40,  currency: 'USD' },
];

const COL_LABEL = {
  backlog: 'Backlog', todo: 'To Do', 'in-progress': 'In Progress',
  'code-review': 'Code Review', qa: 'QA', 'client-approval': 'Client Approval', done: 'Done',
};
const COL_COLOR = {
  backlog:'#9a9a9a', todo:'#6366f1', 'in-progress':'#0891b2',
  'code-review':'#d97706', qa:'#7c3aed', 'client-approval':'#db2777', done:'#10b981',
};
const TYPE_COLOR = {
  epic:'#8b5cf6', feature:'#0891b2', task:'#059669', bug:'#dc2626',
};

const CURRENCIES = ['USD','EUR','UAH','GBP','PLN'];

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
  return `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*900+100)}`;
}

// ── Sub-components ────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-[36px] h-[20px] rounded-full transition-colors ${value ? 'bg-[#1f1f1f]' : 'bg-[#e0e0e0]'}`}>
      <span className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-all ${value ? 'left-[18px]' : 'left-[2px]'}`} />
    </button>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">{children}</p>
      {action}
    </div>
  );
}

// ── Rate card row ─────────────────────────────────────────────────────

function RateRow({ uid, member, rate, onRateChange, preset, onPresetChange, currency }) {
  return (
    <div className="flex items-center gap-3 py-[10px] border-b border-[#f0f0f0] last:border-0">
      <UserAvatar user={member} size={28} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#1f1f1f] truncate">{member?.name || member?.email || uid}</p>
        <Select
          value={preset}
          onChange={val => {
            const p = DEFAULT_RATE_PRESETS.find(r => r.id === val);
            onPresetChange(val);
            if (p) onRateChange(p.rate);
          }}
          options={[
            { value: '', label: 'Роль...' },
            ...DEFAULT_RATE_PRESETS.map(p => ({ value: p.id, label: p.label }))
          ]}
          placeholder="Роль..."
          className="w-[100px] mt-[2px]"
          dropdownClassName="w-[140px]"
        />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] text-[#9a9a9a]">{currency}/г</span>
        <input
          type="number"
          min={0}
          value={rate}
          onChange={e => onRateChange(Number(e.target.value))}
          className="w-[60px] text-[13px] font-semibold bg-[#f7f7f7] border border-[#e9e9e9] rounded-[6px] px-2 py-[4px] outline-none focus:border-[#1f1f1f] text-right"
        />
      </div>
    </div>
  );
}

// ── Issue row ─────────────────────────────────────────────────────────

function IssueRow({ issue, checked, onCheck, timeLogs, rates, members, manualPrice, onManualPrice, currency, useManual, onUseManual }) {
  const issueLogs = timeLogs[issue.id] || { totalMinutes: 0, byUser: {} };

  // Calculate auto price: sum per-user (minutes/60 * rate)
  const autoPrice = useMemo(() => {
    let total = 0;
    Object.entries(issueLogs.byUser).forEach(([uid, minutes]) => {
      const rate = rates[uid] ?? 0;
      total += (minutes / 60) * rate;
    });
    // If no time logged but estimate exists → use estimate
    if (total === 0 && issue.estimateMinutes) {
      // Find primary assignee rate
      const uid = issue.assigneeIds?.[0];
      const rate = uid ? (rates[uid] ?? 0) : 0;
      total = (issue.estimateMinutes / 60) * rate;
    }
    return total;
  }, [issueLogs, rates, issue]);

  const price = useManual ? (manualPrice ?? 0) : autoPrice;
  const type = issue.type || 'task';

  return (
    <div className={`flex items-start gap-3 py-[11px] border-b border-[#f0f0f0] last:border-0 transition-colors ${!checked ? 'opacity-50' : ''}`}>
      {/* Checkbox */}
      <button onClick={onCheck} className="mt-[2px] shrink-0 text-[#1f1f1f]">
        {checked ? <CheckSquare size={15} /> : <Square size={15} className="text-[#cfcfcf]" />}
      </button>

      {/* Issue info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-[2px]">
          <span className="text-[10px] font-bold text-[#9a9a9a]">{issue.issueKey}</span>
          <span className="text-[10px] font-semibold px-[6px] py-[1px] rounded-full"
            style={{ background: TYPE_COLOR[type] + '18', color: TYPE_COLOR[type] }}>
            {type}
          </span>
          <span className="text-[10px] font-semibold px-[6px] py-[1px] rounded-full"
            style={{ background: COL_COLOR[issue.columnId] + '18', color: COL_COLOR[issue.columnId] }}>
            {COL_LABEL[issue.columnId]}
          </span>
        </div>
        <p className="text-[13px] font-medium text-[#1f1f1f] leading-snug">{issue.title}</p>

        {/* Time breakdown */}
        {issueLogs.totalMinutes > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {Object.entries(issueLogs.byUser).map(([uid, min]) => {
              const m = members.find(me => (me.id || me.uid) === uid);
              return (
                <span key={uid} className="text-[10px] text-[#9a9a9a] flex items-center gap-1">
                  <Clock size={9} />
                  {m?.name || uid.slice(0,6)}: {fmtMin(min)}
                  {rates[uid] ? ` · ${fmtMoney((min/60)*rates[uid], currency)}` : ''}
                </span>
              );
            })}
          </div>
        )}
        {issueLogs.totalMinutes === 0 && issue.estimateMinutes && (
          <span className="text-[10px] text-[#cfcfcf] flex items-center gap-1 mt-1">
            <Clock size={9} /> Оцінка: {fmtMin(issue.estimateMinutes)}
          </span>
        )}
        {issueLogs.totalMinutes === 0 && !issue.estimateMinutes && (
          <span className="text-[10px] text-[#cfcfcf] mt-1 block">Часу не списано, немає оцінки</span>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <button onClick={onUseManual} title={useManual ? 'Перейти на авто' : 'Ввести вручну'}
            className={`text-[10px] px-2 py-[2px] rounded-full transition-colors ${useManual ? 'bg-[#1f1f1f] text-white' : 'bg-[#f0f0f0] text-[#9a9a9a] hover:bg-[#e9e9e9]'}`}>
            {useManual ? 'ручна' : 'авто'}
          </button>
        </div>
        {useManual ? (
          <input
            type="number"
            min={0}
            step="0.01"
            value={manualPrice ?? ''}
            onChange={e => onManualPrice(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="0.00"
            className="w-[90px] text-[13px] font-bold bg-[#f7f7f7] border border-[#e9e9e9] rounded-[6px] px-2 py-[4px] outline-none focus:border-[#1f1f1f] text-right"
          />
        ) : (
          <span className={`text-[14px] font-bold ${price > 0 ? 'text-[#1f1f1f]' : 'text-[#cfcfcf]'}`}>
            {price > 0 ? fmtMoney(price, currency) : '—'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Invoice Preview ───────────────────────────────────────────────────

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[20px] w-full max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f0f0f0]">
          <p className="text-[14px] font-bold text-[#1f1f1f]">Попередній перегляд рахунку</p>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-[7px] text-[12px] font-medium bg-[#f7f7f7] hover:bg-[#f0f0f0] rounded-[8px] transition-colors">
              <Copy size={12} /> Копіювати текст
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-[7px] text-[12px] font-medium bg-[#1f1f1f] text-white hover:bg-[#303030] rounded-[8px] transition-colors">
              <Printer size={12} /> Друкувати / PDF
            </button>
            <button onClick={onClose} className="p-[7px] text-[#9a9a9a] hover:bg-[#f7f7f7] rounded-[8px]">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Invoice content */}
        <div className="flex-1 overflow-y-auto">
          <div ref={printRef} className="px-8 py-8 max-w-[640px] mx-auto">
            {/* Invoice header */}
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-[28px] font-black text-[#1f1f1f] tracking-tight">РАХУНОК</h1>
                <p className="text-[14px] font-semibold text-[#9a9a9a]">{invoice.number}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[#9a9a9a]">Дата виставлення</p>
                <p className="text-[15px] font-bold text-[#1f1f1f]">{invoice.date}</p>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1">Від</p>
                <p className="text-[13px] font-semibold text-[#1f1f1f]">{invoice.fromName || 'Ваша агенція'}</p>
                {invoice.fromDetails && <p className="text-[12px] text-[#9a9a9a] mt-1 whitespace-pre-line">{invoice.fromDetails}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1">Кому</p>
                <p className="text-[13px] font-semibold text-[#1f1f1f]">{invoice.clientName || '—'}</p>
                {invoice.clientDetails && <p className="text-[12px] text-[#9a9a9a] mt-1 whitespace-pre-line">{invoice.clientDetails}</p>}
              </div>
            </div>

            {/* Project */}
            <div className="bg-[#f7f7f7] rounded-[10px] px-4 py-3 mb-6">
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider">Проєкт</p>
              <p className="text-[13px] font-semibold text-[#1f1f1f] mt-[2px]">{project?.name}</p>
            </div>

            {/* Items table */}
            <table className="w-full mb-2" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider pb-2 border-b-2 border-[#1f1f1f]">Послуга</th>
                  <th className="text-center text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider pb-2 border-b-2 border-[#1f1f1f] w-[90px]">Час</th>
                  <th className="text-right text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider pb-2 border-b-2 border-[#1f1f1f] w-[100px]">Сума</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-3 border-b border-[#f0f0f0]">
                      <p className="text-[13px] font-medium text-[#1f1f1f]">{item.title}</p>
                      <p className="text-[10px] text-[#9a9a9a]">{item.key} · {item.status}</p>
                    </td>
                    <td className="py-3 border-b border-[#f0f0f0] text-center text-[12px] text-[#9a9a9a]">
                      {item.minutes > 0 ? fmtMin(item.minutes) : '—'}
                    </td>
                    <td className="py-3 border-b border-[#f0f0f0] text-right text-[13px] font-semibold text-[#1f1f1f]">
                      {fmtMoney(item.price, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex flex-col items-end gap-1 mt-4">
              <div className="flex justify-between w-[240px]">
                <span className="text-[12px] text-[#9a9a9a]">Підсумок</span>
                <span className="text-[13px] font-medium text-[#1f1f1f]">{fmtMoney(invoice.subtotal, invoice.currency)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between w-[240px]">
                  <span className="text-[12px] text-[#9a9a9a]">Знижка ({invoice.discountPct}%)</span>
                  <span className="text-[13px] font-medium text-green-600">−{fmtMoney(invoice.discount, invoice.currency)}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div className="flex justify-between w-[240px]">
                  <span className="text-[12px] text-[#9a9a9a]">ПДВ ({invoice.taxPct}%)</span>
                  <span className="text-[13px] font-medium text-[#1f1f1f]">+{fmtMoney(invoice.tax, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between w-[240px] border-t border-[#1f1f1f] pt-2 mt-1">
                <span className="text-[13px] font-bold text-[#1f1f1f]">До оплати</span>
                <span className="text-[18px] font-black text-[#1f1f1f]">{fmtMoney(invoice.total, invoice.currency)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-8 pt-6 border-t border-[#f0f0f0]">
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Примітки</p>
                <p className="text-[12px] text-[#4a4a4a] whitespace-pre-line">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────

export default function BillingTab({ issues = [], members = [], project, projectId }) {
  const { currentUser, activeOrgId } = useAppContext();
  const { byIssue, loading: logsLoading } = useProjectAllTimeLogs(projectId);

  // ── Rate settings per member
  const [memberRates,   setMemberRates]   = useState({}); // { uid: number }
  const [memberPresets, setMemberPresets] = useState({}); // { uid: presetId }

  // ── Issue selection
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [manualPrices, setManualPrices] = useState({}); // { issueId: number|null }
  const [useManualMap, setUseManualMap] = useState({}); // { issueId: bool }

  // ── Invoice meta
  const [currency,       setCurrency]       = useState('USD');
  const [discountPct,    setDiscountPct]    = useState(0);
  const [taxPct,         setTaxPct]         = useState(0);
  const [clientName,     setClientName]     = useState('');
  const [clientDetails,  setClientDetails]  = useState('');
  const [fromName,       setFromName]       = useState('');
  const [fromDetails,    setFromDetails]    = useState('');
  const [notes,          setNotes]          = useState('');

  // ── UI state
  const [showRates,     setShowRates]     = useState(true);
  const [showMeta,      setShowMeta]      = useState(false);
  const [showPreview,   setShowPreview]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [filterType,    setFilterType]    = useState('all');
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Collect unique member uids from issues (assignees who have time logs or are assigned)
  const billingMembers = useMemo(() => {
    const uids = new Set();
    issues.forEach(iss => {
      (iss.assigneeIds || []).forEach(uid => uids.add(uid));
    });
    Object.values(byIssue).forEach(data => {
      Object.keys(data.byUser).forEach(uid => uids.add(uid));
    });
    return [...uids].map(uid => members.find(m => (m.id || m.uid) === uid) || { id: uid, uid, name: uid.slice(0,8) });
  }, [issues, byIssue, members]);

  // Initialize checked ids on load (check all by default)
  useEffect(() => {
    if (issues.length > 0 && checkedIds.size === 0) {
      setCheckedIds(new Set(issues.map(i => i.id)));
    }
  }, [issues.length]); // eslint-disable-line

  // Load saved invoices
  useEffect(() => {
    if (!projectId || !activeOrgId) { setLoadingHistory(false); return; }
    const q = query(
      collection(db, 'invoices'),
      where('projectId', '==', projectId),
      where('organizationId', '==', activeOrgId),
    );
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setSavedInvoices(docs);
      setLoadingHistory(false);
    }, () => setLoadingHistory(false));
    return () => unsub();
  }, [projectId, activeOrgId]);

  // ── Filtered issues ──
  const filteredIssues = useMemo(() => {
    return issues.filter(iss => {
      if (filterStatus !== 'all' && iss.columnId !== filterStatus) return false;
      if (filterType   !== 'all' && iss.type    !== filterType)   return false;
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
        status: COL_LABEL[iss.columnId] || iss.columnId,
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

  const checkedCount   = checkedIds.size;
  const uncheckedCount = issues.length - checkedCount;
  const statusOptions  = [...new Set(issues.map(i => i.columnId))];
  const typeOptions    = [...new Set(issues.map(i => i.type || 'task'))];

  const totalLoggedMin = [...checkedIds].reduce((sum, id) => sum + (byIssue[id]?.totalMinutes || 0), 0);

  return (
    <div className="flex-1 overflow-hidden flex bg-[#f7f7f7]">

      {/* ── LEFT: Settings + Issues ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* ── Rate Cards ─────────────────────────────────────────────── */}
        <div className="bg-white border border-[#e9e9e9] rounded-[14px] mb-4 overflow-hidden">
          <button
            onClick={() => setShowRates(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#fafafa] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={14} className="text-[#9a9a9a]" />
              <p className="text-[13px] font-semibold text-[#1f1f1f]">Ставки виконавців</p>
              <span className="text-[11px] text-[#9a9a9a]">— {currency}/год</span>
            </div>
            {showRates ? <ChevronUp size={14} className="text-[#9a9a9a]" /> : <ChevronDown size={14} className="text-[#9a9a9a]" />}
          </button>

          {showRates && (
            <div className="px-5 pb-4 border-t border-[#f0f0f0]">
              {/* Presets */}
              <div className="pt-3 pb-2">
                <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Швидкі пресети</p>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_RATE_PRESETS.map(preset => (
                    <button key={preset.id}
                      onClick={() => {
                        const newRates = { ...memberRates };
                        billingMembers.forEach(m => { newRates[m.id || m.uid] = preset.rate; });
                        setMemberRates(newRates);
                      }}
                      className="text-[11px] font-medium px-3 py-[5px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-full hover:border-[#1f1f1f] transition-colors"
                    >
                      {preset.label}: {preset.rate} {currency}/г
                    </button>
                  ))}
                </div>
              </div>

              {billingMembers.length === 0 ? (
                <p className="text-[12px] text-[#cfcfcf] py-3">Учасників з часом немає</p>
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
                    />
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ── Invoice Meta ─────────────────────────────────────────────── */}
        <div className="bg-white border border-[#e9e9e9] rounded-[14px] mb-4 overflow-hidden">
          <button
            onClick={() => setShowMeta(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#fafafa] transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[#9a9a9a]" />
              <p className="text-[13px] font-semibold text-[#1f1f1f]">Деталі рахунку</p>
              {clientName && <span className="text-[11px] text-[#9a9a9a]">— {clientName}</span>}
            </div>
            {showMeta ? <ChevronUp size={14} className="text-[#9a9a9a]" /> : <ChevronDown size={14} className="text-[#9a9a9a]" />}
          </button>

          {showMeta && (
            <div className="px-5 pb-5 border-t border-[#f0f0f0] pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1 block">Клієнт (назва)</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="ТОВ «Компанія»"
                  className="w-full text-[13px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] px-3 py-[7px] outline-none focus:border-[#1f1f1f]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1 block">Ваша агенція</label>
                <input value={fromName} onChange={e => setFromName(e.target.value)}
                  placeholder="Назва вашої компанії"
                  className="w-full text-[13px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] px-3 py-[7px] outline-none focus:border-[#1f1f1f]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1 block">Реквізити клієнта</label>
                <textarea value={clientDetails} onChange={e => setClientDetails(e.target.value)}
                  rows={3} placeholder="ЄДРПОУ, адреса..."
                  className="w-full text-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] px-3 py-[7px] outline-none focus:border-[#1f1f1f] resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1 block">Ваші реквізити</label>
                <textarea value={fromDetails} onChange={e => setFromDetails(e.target.value)}
                  rows={3} placeholder="ЄДРПОУ, IBAN, адреса..."
                  className="w-full text-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] px-3 py-[7px] outline-none focus:border-[#1f1f1f] resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-1 block">Примітки</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  rows={2} placeholder="Умови оплати, терміни..."
                  className="w-full text-[12px] bg-[#f7f7f7] border border-[#e9e9e9] rounded-[8px] px-3 py-[7px] outline-none focus:border-[#1f1f1f] resize-none" />
              </div>
            </div>
          )}
        </div>

        {/* ── Issues list ──────────────────────────────────────────────── */}
        <div className="bg-white border border-[#e9e9e9] rounded-[14px] overflow-hidden mb-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#f0f0f0] flex-wrap">
            <p className="text-[13px] font-semibold text-[#1f1f1f] shrink-0">
              Задачі <span className="text-[#9a9a9a] font-normal">({checkedCount} обрано з {issues.length})</span>
            </p>

            {/* Select all / none */}
            <button onClick={() => setCheckedIds(new Set(filteredIssues.map(i => i.id)))}
              className="text-[11px] font-medium text-[#6366f1] hover:underline">Всі</button>
            <button onClick={() => setCheckedIds(new Set())}
              className="text-[11px] font-medium text-[#9a9a9a] hover:underline">Жодну</button>
            <button onClick={() => setCheckedIds(new Set(issues.filter(i => i.columnId === 'done').map(i => i.id)))}
              className="text-[11px] font-medium text-[#10b981] hover:underline">Тільки Done</button>

            {/* Filters */}
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={filterStatus}
                onChange={val => setFilterStatus(val)}
                options={[
                  { value: 'all', label: 'Всі статуси' },
                  ...statusOptions.map(s => ({ value: s, label: COL_LABEL[s] || s }))
                ]}
                className="w-[130px]"
              />
              <Select
                value={filterType}
                onChange={val => setFilterType(val)}
                options={[
                  { value: 'all', label: 'Всі типи' },
                  ...typeOptions.map(t => ({ value: t, label: t }))
                ]}
                className="w-[120px]"
              />
            </div>
          </div>

          {/* List */}
          <div className="px-5">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#cfcfcf]">Задач немає</div>
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

        {/* ── History ──────────────────────────────────────────────────── */}
        {savedInvoices.length > 0 && (
          <div className="bg-white border border-[#e9e9e9] rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f0f0f0]">
              <p className="text-[13px] font-semibold text-[#1f1f1f]">Збережені рахунки ({savedInvoices.length})</p>
            </div>
            {savedInvoices.slice(0, 5).map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-[12px] border-b border-[#f0f0f0] last:border-0">
                <div>
                  <p className="text-[12px] font-semibold text-[#1f1f1f]">{inv.number}</p>
                  <p className="text-[11px] text-[#9a9a9a]">{inv.date} · {inv.items?.length} задач</p>
                </div>
                <span className="text-[13px] font-bold text-[#1f1f1f]">{fmtMoney(inv.total, inv.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Summary panel ─────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 border-l border-[#e9e9e9] bg-white flex flex-col">

        {/* Currency + header */}
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-[#1f1f1f]">Рахунок</p>
            <Select
              value={currency}
              onChange={val => setCurrency(val)}
              options={CURRENCIES.map(c => ({ value: c, label: c }))}
              className="w-[80px]"
            />
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#f7f7f7] rounded-[10px] p-3">
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Задач</p>
              <p className="text-[20px] font-bold text-[#1f1f1f]">{checkedCount}</p>
            </div>
            <div className="bg-[#f7f7f7] rounded-[10px] p-3">
              <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide">Списано</p>
              <p className="text-[20px] font-bold text-[#1f1f1f]">{fmtMin(totalLoggedMin)}</p>
            </div>
          </div>
        </div>

        {/* Discount & Tax */}
        <div className="px-5 py-4 border-b border-[#f0f0f0]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-[#1f1f1f] flex items-center gap-2">
                <Percent size={13} className="text-[#9a9a9a]" /> Знижка %
              </label>
              <input type="number" min={0} max={100} value={discountPct}
                onChange={e => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-[64px] text-[13px] font-bold bg-[#f7f7f7] border border-[#e9e9e9] rounded-[7px] px-2 py-[5px] outline-none focus:border-[#1f1f1f] text-right" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-[#1f1f1f] flex items-center gap-2">
                <Percent size={13} className="text-[#9a9a9a]" /> ПДВ %
              </label>
              <input type="number" min={0} max={100} value={taxPct}
                onChange={e => setTaxPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-[64px] text-[13px] font-bold bg-[#f7f7f7] border border-[#e9e9e9] rounded-[7px] px-2 py-[5px] outline-none focus:border-[#1f1f1f] text-right" />
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-b border-[#f0f0f0] flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="text-[12px] text-[#9a9a9a]">Підсумок</span>
            <span className="text-[13px] font-medium text-[#1f1f1f]">{fmtMoney(subtotal, currency)}</span>
          </div>
          {discountPct > 0 && (
            <div className="flex justify-between">
              <span className="text-[12px] text-[#9a9a9a]">Знижка ({discountPct}%)</span>
              <span className="text-[13px] font-medium text-green-600">−{fmtMoney(discount, currency)}</span>
            </div>
          )}
          {taxPct > 0 && (
            <div className="flex justify-between">
              <span className="text-[12px] text-[#9a9a9a]">ПДВ ({taxPct}%)</span>
              <span className="text-[13px] font-medium text-[#1f1f1f]">+{fmtMoney(tax, currency)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-[#f0f0f0]">
            <span className="text-[13px] font-bold text-[#1f1f1f]">До оплати</span>
            <span className="text-[22px] font-black text-[#1f1f1f] leading-none">{fmtMoney(total, currency)}</span>
          </div>
        </div>

        {/* Warning if no rates */}
        {billingMembers.length > 0 && Object.keys(memberRates).length === 0 && (
          <div className="mx-5 mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-100 rounded-[10px] px-3 py-3">
            <AlertCircle size={13} className="text-yellow-600 mt-[1px] shrink-0" />
            <p className="text-[11px] text-yellow-700">Встановіть ставки виконавців щоб розрахувати вартість</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-5 py-4 flex flex-col gap-2 mt-auto">
          <button
            onClick={() => setShowPreview(true)}
            disabled={checkedCount === 0}
            className="flex items-center justify-center gap-2 w-full py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-semibold hover:bg-[#303030] transition-colors disabled:opacity-40"
          >
            <Eye size={14} /> Переглянути рахунок
          </button>
          <button
            onClick={saveInvoice}
            disabled={saving || checkedCount === 0}
            className="flex items-center justify-center gap-2 w-full py-[10px] bg-[#f7f7f7] border border-[#e9e9e9] text-[#1f1f1f] rounded-[10px] text-[13px] font-semibold hover:bg-[#f0f0f0] transition-colors disabled:opacity-40"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Зберегти чернетку
          </button>
        </div>
      </div>

      {/* ── Invoice preview modal ─────────────────────────────────── */}
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
