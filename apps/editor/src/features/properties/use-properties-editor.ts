import { useState } from "react";

export interface InstancePropertyDraft {
  instanceId: string | null;
  parameters: Record<string, string>;
  x: string;
  y: string;
  rotation: "0" | "90" | "180" | "270";
}

const EMPTY_INSTANCE_PROPERTY_DRAFT: InstancePropertyDraft = {
  instanceId: null,
  parameters: {},
  x: "",
  y: "",
  rotation: "0",
};

/** Flat owner for property panel draft state. Persistence stays injected. */
export function usePropertiesEditor() {
  const [netLabelDraft, setNetLabelDraft] = useState("");
  const [netLabelEditorOpen, setNetLabelEditorOpen] = useState(false);
  const [instancePropertyDraft, setInstancePropertyDraft] =
    useState<InstancePropertyDraft>(EMPTY_INSTANCE_PROPERTY_DRAFT);

  return {
    instancePropertyDraft,
    netLabelDraft,
    netLabelEditorOpen,
    setInstancePropertyDraft,
    setNetLabelDraft,
    setNetLabelEditorOpen,
  };
}
