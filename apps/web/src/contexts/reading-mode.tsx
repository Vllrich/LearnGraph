"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ReadingModeContextType = {
  readingMode: boolean;
  setReadingMode: (v: boolean) => void;
};

const ReadingModeContext = createContext<ReadingModeContextType>({
  readingMode: false,
  setReadingMode: () => {},
});

export function ReadingModeProvider({
  children,
  defaultReadingMode = false,
}: {
  children: ReactNode;
  defaultReadingMode?: boolean;
}) {
  const [readingMode, setReadingMode] = useState(defaultReadingMode);
  return (
    <ReadingModeContext.Provider value={{ readingMode, setReadingMode }}>
      {children}
    </ReadingModeContext.Provider>
  );
}

export function useReadingMode() {
  return useContext(ReadingModeContext);
}
