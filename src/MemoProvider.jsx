import { useEffect, useMemo, useState } from 'react';
import { MemoContext } from './memo-context.js';
import { SEED_NOTES } from './data/seedNotes.js';

const STORAGE_KEY = 'shiguang-memo-notes-v1';

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length > 0 ? saved : SEED_NOTES;
  } catch {
    return SEED_NOTES;
  }
}

export default function MemoProvider({ children }) {
  const [notes, setNotes] = useState(loadNotes);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const value = useMemo(() => ({
    notes,
    addNote(note) {
      setNotes(current => [note, ...current]);
    },
    addNotes(newNotes) {
      setNotes(current => [...newNotes, ...current]);
    },
    resetNotes() {
      setNotes(SEED_NOTES);
    },
  }), [notes]);

  return <MemoContext.Provider value={value}>{children}</MemoContext.Provider>;
}
