import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, CheckSquare, Clock, Hash } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

export default function HoverCard({ type, value, children, members }) {
  const [show, setShow] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show) return;
    
    // For user, data is usually already in members array
    if (type === 'user') {
      const u = members.find(m => (m.name || m.email)?.replace(/\s+/g, '_') === value);
      if (u) setData(u);
      return;
    }

    // For issue, fetch from firestore if not loaded
    if (type === 'issue' && !data) {
      setLoading(true);
      const q = query(collection(db, 'issues'), where('issueKey', '==', value), limit(1));
      getDocs(q).then(snap => {
        if (!snap.empty) {
          setData({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setData({ notFound: true });
        }
        setLoading(false);
      });
    }
  }, [show, type, value, data, members]);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className={`px-1 rounded-sm font-medium cursor-pointer ${
        type === 'user' ? 'bg-[#eef2ff] text-[#6366f1]' : 'bg-[#fdf4ff] text-[#c026d3]'
      }`}>
        {children}
      </span>

      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-[#e9e9e9] rounded-[12px] shadow-xl p-3 text-left">
          {type === 'user' ? (
            data ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <UserAvatar user={data} size={40} />
                  <div>
                    <p className="text-[14px] font-bold text-[#1f1f1f] leading-tight">{data.name || data.email}</p>
                    <p className="text-[11px] text-[#9a9a9a]">{data.role || 'Учасник'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[#9a9a9a] mt-1">
                  <span className={`w-2 h-2 rounded-full ${data.lastActive && (Date.now() - new Date(data.lastActive).getTime() < 120000) ? 'bg-[#10b981]' : 'bg-[#cfcfcf]'}`} />
                  {data.lastActive && (Date.now() - new Date(data.lastActive).getTime() < 120000) ? 'Онлайн' : 'Не в мережі'}
                </div>
              </div>
            ) : (
               <div className="text-[12px] text-[#9a9a9a]">Користувача не знайдено</div>
            )
          ) : (
            // Issue
            loading ? (
              <div className="text-[12px] text-[#9a9a9a] flex items-center justify-center py-2">
                 <div className="w-4 h-4 border-2 border-[#e9e9e9] border-t-[#c026d3] rounded-full animate-spin" />
              </div>
            ) : data && !data.notFound ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-[#c026d3] bg-[#fdf4ff] px-2 py-0.5 rounded-full">{data.issueKey}</span>
                  <span className="text-[10px] font-bold text-[#9a9a9a] bg-[#f0f0f0] px-2 py-0.5 rounded-full">{data.status || data.columnId}</span>
                </div>
                <p className="text-[14px] font-bold text-[#1f1f1f] leading-tight line-clamp-2">{data.title}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f0f0f0]">
                  <div className="flex items-center gap-1">
                    <CheckSquare size={12} className="text-[#9a9a9a]" />
                    <span className="text-[11px] font-medium text-[#1f1f1f]">{data.type || 'Завдання'}</span>
                  </div>
                  {data.dueDate && (
                    <div className="flex items-center gap-1 text-[11px] text-[#9a9a9a]">
                      <Clock size={12} />
                      {data.dueDate.toDate ? data.dueDate.toDate().toLocaleDateString() : new Date(data.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-[#9a9a9a]">Задачу не знайдено</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
