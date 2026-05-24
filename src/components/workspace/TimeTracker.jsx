'use client';
// src/components/workspace/TimeTracker.jsx — Play/Stop timer + Log Time modal
import { useState, useEffect } from 'react';
import { Play, Square, Clock, Plus, X } from 'lucide-react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function TimeTracker({ issue, userId, onLogTime }) {
  const { activeTimer, timerElapsed, startTimer, stopTimer } = useWorkspaceStore();
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ hours: '', minutes: '', description: '' });

  const isThisTimer = activeTimer?.issueId === issue?.id;

  const handleStop = async () => {
    const result = stopTimer();
    if (result && result.minutes > 0) {
      await onLogTime(result.minutes, `Час з таймера`);
    }
  };

  const handleManualLog = async () => {
    const total = (parseInt(logForm.hours || 0) * 60) + parseInt(logForm.minutes || 0);
    if (total <= 0) return;
    await onLogTime(total, logForm.description || 'Ручне списання');
    setLogForm({ hours: '', minutes: '', description: '' });
    setShowLogModal(false);
  };

  const spentFormatted = issue.spentMinutes
    ? `${Math.floor(issue.spentMinutes / 60)}г ${issue.spentMinutes % 60}хв`
    : '—';

  const estimateFormatted = issue.estimateMinutes
    ? `${Math.floor(issue.estimateMinutes / 60)}г ${issue.estimateMinutes % 60}хв`
    : null;

  return (
    <div>
      <p className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide mb-2">Час</p>

      {/* Stats */}
      <div className="bg-[#f7f7f7] rounded-[10px] px-3 py-2 mb-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#9a9a9a]">Витрачено</span>
          <span className="font-bold text-[#1f1f1f]">{spentFormatted}</span>
        </div>
        {estimateFormatted && (
          <div className="flex items-center justify-between text-[11px] mt-1">
            <span className="text-[#9a9a9a]">Оцінка</span>
            <span className="font-medium text-[#9a9a9a]">{estimateFormatted}</span>
          </div>
        )}
        {estimateFormatted && issue.spentMinutes > 0 && (
          <div className="mt-2">
            <div className="h-[3px] bg-[#e9e9e9] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  issue.spentMinutes > issue.estimateMinutes ? 'bg-red-500' : 'bg-[#6366f1]'
                }`}
                style={{ width: `${Math.min((issue.spentMinutes / issue.estimateMinutes) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Timer button */}
      {isThisTimer ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-[#6366f1]/10 rounded-[10px] px-3 py-2">
            <span className="w-[6px] h-[6px] bg-[#6366f1] rounded-full animate-pulse shrink-0" />
            <span className="font-mono text-[14px] font-bold text-[#6366f1]">
              {formatSeconds(timerElapsed)}
            </span>
          </div>
          <button onClick={handleStop}
            className="flex items-center gap-2 w-full px-3 py-2 bg-red-50 text-red-600 rounded-[10px] text-[12px] font-bold hover:bg-red-100 transition-colors border border-red-200">
            <Square size={12} /> Стоп і зберегти
          </button>
        </div>
      ) : (
        <button
          onClick={() => startTimer(issue.id)}
          disabled={!!activeTimer}
          className="flex items-center gap-2 w-full px-3 py-2 bg-[#6366f1] text-white rounded-[10px] text-[12px] font-bold hover:bg-[#4f46e5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-2">
          <Play size={12} /> Запустити таймер
        </button>
      )}

      {activeTimer && !isThisTimer && (
        <p className="text-[10px] text-[#9a9a9a] mb-2">Таймер активний на іншій задачі</p>
      )}

      {/* Manual log */}
      <button onClick={() => setShowLogModal(true)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-white text-[#1f1f1f] rounded-[10px] text-[12px] font-medium hover:bg-[#f7f7f7] transition-colors border border-[#e9e9e9]">
        <Plus size={12} /> Додати час вручну
      </button>

      {/* Manual log modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowLogModal(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-[16px] shadow-xl w-[320px] p-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-bold text-[#1f1f1f]">Списати час</h3>
              <button onClick={() => setShowLogModal(false)} className="text-[#9a9a9a] hover:text-[#1f1f1f]">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Годин</label>
                <input type="number" min="0" max="24" value={logForm.hours}
                  onChange={e => setLogForm(f => ({ ...f, hours: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#f7f7f7] rounded-[8px] text-[14px] font-bold text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors text-center" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Хвилин</label>
                <input type="number" min="0" max="59" value={logForm.minutes}
                  onChange={e => setLogForm(f => ({ ...f, minutes: e.target.value }))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[#f7f7f7] rounded-[8px] text-[14px] font-bold text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors text-center" />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] font-bold text-[#9a9a9a] uppercase tracking-wide block mb-1">Що зроблено</label>
              <textarea value={logForm.description}
                onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Описати виконану роботу..."
                rows={2}
                className="w-full px-3 py-2 bg-[#f7f7f7] rounded-[8px] text-[12px] text-[#1f1f1f] placeholder-[#cfcfcf] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors resize-none" />
            </div>

            <button onClick={handleManualLog}
              disabled={!logForm.hours && !logForm.minutes}
              className="w-full py-[10px] bg-[#1f1f1f] text-white rounded-[10px] text-[13px] font-bold hover:bg-[#303030] disabled:opacity-40 transition-colors">
              Зберегти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
