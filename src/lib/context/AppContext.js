'use client';
// src/lib/context/AppContext.js
import { createContext, useContext, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProjects } from '@/lib/hooks/useProjects';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { projects, loading: projectsLoading } = useProjects(user?.id);

  const value = {
    authLoading,
    projectsLoading,
    signInWithGoogle,
    signOut,
    currentUser: user,
    projects,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
};
