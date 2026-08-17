import { useEffect, useState } from "react";
import type { MutableRefObject } from "react";

export interface UseEditorPanelsOptions {
  initialCompact: boolean;
  compactMediaQuery: string;
  libraryStorageKey: string;
  helpButtonRef: MutableRefObject<HTMLButtonElement | null>;
  helpCloseRef: MutableRefObject<HTMLButtonElement | null>;
  aboutButtonRef: MutableRefObject<HTMLButtonElement | null>;
  aboutCloseRef: MutableRefObject<HTMLButtonElement | null>;
}

/** Flat owner of responsive shell-panel state and Library persistence. */
export function useEditorPanels(options: UseEditorPanelsOptions) {
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(options.libraryStorageKey) !== "false";
    } catch {
      return true;
    }
  });
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
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [agentDetailsOpen, setAgentDetailsOpen] = useState(false);
  const [agentStatusDismissed, setAgentStatusDismissed] = useState(false);

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

  useEffect(() => {
    if (helpOpen) options.helpCloseRef.current?.focus();
  }, [helpOpen]);

  useEffect(() => {
    if (aboutOpen) options.aboutCloseRef.current?.focus();
  }, [aboutOpen]);

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

  const closeHelp = (): void => {
    setHelpOpen(false);
    requestAnimationFrame(() => options.helpButtonRef.current?.focus());
  };

  const closeAbout = (): void => {
    setAboutOpen(false);
    requestAnimationFrame(() => options.aboutButtonRef.current?.focus());
  };

  const closeSearch = (): void => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  return {
    aboutOpen,
    agentDetailsOpen,
    agentPanelOpen,
    agentStatusDismissed,
    closeAbout,
    closeHelp,
    closeSearch,
    compactLayout,
    compactLibraryPanelOpen,
    helpOpen,
    leftPanelMode,
    libraryPanelOpen,
    searchOpen,
    searchQuery,
    selectionOpen,
    setAboutOpen,
    setAgentDetailsOpen,
    setAgentPanelOpen,
    setAgentStatusDismissed,
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
