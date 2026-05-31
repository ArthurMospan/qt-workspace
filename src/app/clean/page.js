'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { useAppContext } from '@/lib/context/AppContext';

export default function CleanDbPage() {
  const [log, setLog] = useState('');
  const { currentUser } = useAppContext();

  const handleWipe = async () => {
    if (!currentUser) {
      setLog('Помилка: Ви повинні бути авторизовані, щоб виконати цю дію.\n');
      return;
    }
    
    setLog('Починаю очищення бази даних...\n');
    const cols = [
      'organizations', 'orgMemberships', 'projects', 'tasks', 
      'issues', 'sprints', 'timeLogs', 'issueLinks', 'presence', 
      'invitations', 'users'
    ];
    
    for (const c of cols) {
      try {
        const snap = await getDocs(collection(db, c));
        let count = 0;
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
          count++;
        }
        setLog(prev => prev + `Видалено ${count} документів з колекції ${c}\n`);
      } catch (err) {
        setLog(prev => prev + `Помилка в колекції ${c}: ${err.message}\n`);
      }
    }
    
    // Clear localStorage 
    localStorage.removeItem('qt_active_org_id');
    setLog(prev => prev + 'ГОТОВО. Базу даних очищено, localStorage скинуто. Тепер ви можете закрити цю сторінку.\n');
  };

  return (
    <div className="p-10 max-w-3xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-4 text-[#1f1f1f]">Очищення Бази Даних (Wipe DB)</h1>
      <p className="mb-6 text-[#9a9a9a]">
        Ця сторінка створена тимчасово для повного очищення бази даних від тестових даних (організацій, проєктів, задач тощо).
      </p>
      
      {!currentUser ? (
        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg">
          Будь ласка, спочатку увійдіть в систему (перейдіть на /login), щоб отримати права на видалення даних, а потім поверніться сюди.
        </div>
      ) : (
        <button 
          onClick={handleWipe} 
          className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg shadow transition-colors"
        >
          🚨 ВИДАЛИТИ ВСІ ОРГАНІЗАЦІЇ ТА ДАНІ 🚨
        </button>
      )}
      
      {log && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-2">Лог виконання:</h2>
          <pre className="bg-[#f5f5f5] p-4 rounded-lg text-sm font-mono overflow-auto whitespace-pre-wrap border border-[#e9e9e9]">
            {log}
          </pre>
        </div>
      )}
    </div>
  );
}
