import { createContext, useContext } from 'react';

export const MemoContext = createContext(null);

export function useMemoData() {
  const value = useContext(MemoContext);
  if (!value) throw new Error('useMemoData must be used inside MemoProvider');
  return value;
}
