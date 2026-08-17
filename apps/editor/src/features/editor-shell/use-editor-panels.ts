import { useEffect, useState } from "react";

export interface UseEditorPanelsOptions {
  initialLibraryOpen: boolean;
  initialCompact: boolean;
  compactMediaQuery: string;
  libraryStorageKey: string;
}

/** Flat owner of responsive shell-panel state and Library persistence. */
export function useEditorPanels(options: UseEditorPanelsOptions) {
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(
    options.initialLibraryOpen,
  );
  const [compactLayout, setCompactLayout] = useState(options.initialCompact);
  const [compactLibraryPanelOpen, setCompactLibraryPanelOpen] = useState(false);
  const [leftPanelMode, setLeftPanelMode] = useState<"library" | "examples">(
    "library",
  );
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mediaQuery = window.matchMedia(options.compactMediaQuery);
    const updateCompactLayout = (): void => {
      setCompactLayout(mediaQuery.matches);
      if (mediaQuery.matches) setCompactLibraryPanelOpen(false);
    };
    updateCompactLayout();
    mediaQuery.addEventListener("change", updateCompactLayout);
    return () => mediaQuery.removeEventListener("change", updateCompactLayout);
  }, [options.compactMediaQuery]);

  useEffect(() => {
    if (compactLayout && selectionOpen) setCompactLibraryPanelOpen(false);
  }, [compactLayout, selectionOpen]);

  const persistLibraryOpen = (open: boolean): void => {
    try {
      window.localStorage.setItem(options.libraryStorageKey, String(open));
    } catch {
      // Library visibility stays usable when browser storage is unavailable.
    }
  };

  const showLeftPanel = (mode: "library" | "examples"): void => {
    setLeftPanelMode(mode);
    if (compactLayout) {
      setCompactLibraryPanelOpen(true);
      setSelectionOpen(false);
      return;
    }
    setLibraryPanelOpen(true);
    persistLibraryOpen(true);
  };

  const toggleLibraryPanel = (): void => {
    if (leftPanelMode === "examples") {
      showLeftPanel("library");
      return;
    }
    if (compactLayout) {
      setCompactLibraryPanelOpen((current) => {
        const next = !current;
        if (next) setSelectionOpen(false);
        return next;
      });
      return;
    }
    setLibraryPanelOpen((current) => {
      const next = !current;
      persistLibraryOpen(next);
      return next;
    });
  };

  return {
    aboutOpen,
    compactLayout,
    compactLibraryPanelOpen,
    helpOpen,
    leftPanelMode,
    libraryPanelOpen,
    searchOpen,
    searchQuery,
    selectionOpen,
    setAboutOpen,
    setCompactLayout,
    setCompactLibraryPanelOpen,
    setHelpOpen,
    setLeftPanelMode,
    setLibraryPanelOpen,
    setSearchOpen,
    setSearchQuery,
    setSelectionOpen,
    showLeftPanel,
    toggleLibraryPanel,
  };
}
