import { lazy } from "react";

export const LazyCellManagerDialog = lazy(() =>
  import("../features/hierarchy/cell-manager-dialog").then((module) => ({
    default: module.CellManagerDialog,
  })),
);

export const LazyNetlistPreflightDialog = lazy(() =>
  import("../features/netlist-export/netlist-preflight-dialog").then(
    (module) => ({ default: module.NetlistPreflightDialog }),
  ),
);

export const LazyPublishGalleryDialog = lazy(() =>
  import("../features/editor-shell/publish-gallery-dialog").then((module) => ({
    default: module.PublishGalleryDialog,
  })),
);

export const LazyVersionHistoryDialog = lazy(() =>
  import("../components/version-history-dialog").then((module) => ({
    default: module.VersionHistoryDialog,
  })),
);

export const LazyEditorHelpDialog = lazy(() =>
  import("../components/editor-help-dialog").then((module) => ({
    default: module.EditorHelpDialog,
  })),
);

export const LazyReplaceGuardDialog = lazy(() =>
  import("../components/replace-guard-dialog").then((module) => ({
    default: module.ReplaceGuardDialog,
  })),
);

export const LazyRecentRecoveryDialog = lazy(() =>
  import("../components/recent-recovery-dialog").then((module) => ({
    default: module.RecentRecoveryDialog,
  })),
);

export const LazyProjectSearchDialog = lazy(() =>
  import("../features/search/project-search-dialog").then((module) => ({
    default: module.ProjectSearchDialog,
  })),
);

export const LazyInstanceTableDialog = lazy(() =>
  import("../features/properties/instance-table-dialog").then((module) => ({
    default: module.InstanceTableDialog,
  })),
);

export const LazyInsertComponentDialog = lazy(() =>
  import("../features/component-insert/insert-component-dialog").then(
    (module) => ({ default: module.InsertComponentDialog }),
  ),
);

export const LazyConnectAgentPanel = lazy(() =>
  import("../agent/connect-agent-panel").then((module) => ({
    default: module.ConnectAgentPanel,
  })),
);

export const LazyAgentPropertiesSection = lazy(() =>
  import("../agent/connect-agent-panel").then((module) => ({
    default: module.AgentPropertiesSection,
  })),
);
