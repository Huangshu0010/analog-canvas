import { useState } from "react";

export function useEditorPanels(
  initialLibraryOpen: boolean,
  initialCompact: boolean,
) {
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(initialLibraryOpen);
  const [compactLayout, setCompactLayout] = useState(initialCompact);
  const [compactLibraryPanelOpen, setCompactLibraryPanelOpen] = useState(false);
  const [leftPanelMode, setLeftPanelMode] = useState<"library" | "examples">(
    "library",
  );
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  return {
    libraryPanelOpen,
    setLibraryPanelOpen,
    compactLayout,
    setCompactLayout,
    compactLibraryPanelOpen,
    setCompactLibraryPanelOpen,
    leftPanelMode,
    setLeftPanelMode,
    selectionOpen,
    setSelectionOpen,
    helpOpen,
    setHelpOpen,
    aboutOpen,
    setAboutOpen,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
  };
}
