import React from 'react';
import { Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

export default function VelocityTab({ issues, projects }) {
  // Simple velocity shell
  const doneIssues = issues.filter(i => i.columnId === 'done');
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;
  
  const recentDone = doneIssues.filter(i => {
    const t = i.updatedAt?.toMillis?.() ?? 0;
    return t > weekAgo;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-transparent px-[32px] pt-[20px] pb-16">
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-[#f7f7f7] rounded-[24px] p-6 text-center">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap size={24} />
          </div>
          <p className="text-[36px] font-bold text-[#1f1f1f] leading-none mb-2">{recentDone.length}</p>
          <p className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wide">Задач закрито за тиждень</p>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#f7f7f7] rounded-[24px] p-6 text-center">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-[36px] font-bold text-[#1f1f1f] leading-none mb-2">{doneIssues.length}</p>
          <p className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wide">Всього закрито</p>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#f7f7f7] rounded-[24px] p-6 text-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-[36px] font-bold text-[#1f1f1f] leading-none mb-2">{issues.length > 0 ? Math.round((doneIssues.length / issues.length) * 100) : 0}%</p>
          <p className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wide">Відсоток успішності</p>
        </div>

        {/* Detailed Chart Area */}
        <div className="md:col-span-3 bg-[#f7f7f7] rounded-[24px] p-8 mt-2">
          <h3 className="text-[16px] font-bold text-[#1f1f1f] mb-4">Останні закриті задачі</h3>
          {recentDone.length === 0 ? (
            <p className="text-[13px] text-[#9a9a9a]">За останній тиждень задач не було закрито.</p>
          ) : (
            <ul className="divide-y divide-[#f0f0f0]">
              {recentDone.slice(0, 10).map(issue => {
                const p = projects.find(proj => proj.id === issue.projectId);
                return (
                  <li key={issue.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="text-[13px] font-bold text-[#1f1f1f]">{issue.title}</p>
                      <p className="text-[11px] text-[#9a9a9a]">{p?.name || 'Проєкт'}</p>
                    </div>
                    <span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-[6px]">Done</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
