/**
 * Chaos Computer Club India — chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type NotesContext = { notes: boolean; toggle: () => void };

const Ctx = createContext<NotesContext>({ notes: false, toggle: () => {} });

export function NotesModeProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("notes-mode-active", notes);
    document.body.dataset["notes"] = String(notes);
    return () => document.body.classList.remove("notes-mode-active");
  }, [notes]);

  return (
    <Ctx.Provider value={{ notes, toggle: () => setNotes((v) => !v) }}>{children}</Ctx.Provider>
  );
}

export function useNotesMode() {
  return useContext(Ctx);
}
