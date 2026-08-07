import {
  createEmptyDocument,
  deriveStableId,
} from "../../packages/model/dist/index.js";

function hierarchicalSymbolId(document) {
  const cellName = document.sourceBinding?.cellName;
  return cellName
    ? deriveStableId("hierarchical-symbol", cellName.toLowerCase())
    : null;
}

function scopedName(path, localName) {
  return path.length === 0 ? localName : `${path.join("__")}__${localName}`;
}

export function flattenDocument(project, sourceDocumentName, flatDocumentName) {
  const source = project.documents.find(
    (document) => document.name === sourceDocumentName,
  );
  if (!source) {
    throw new Error(`Flatten source Document ${sourceDocumentName} is missing`);
  }

  const childBySymbolId = new Map(
    project.documents.flatMap((document) => {
      const symbolId = hierarchicalSymbolId(document);
      return symbolId ? [[symbolId, document]] : [];
    }),
  );
  const flat = createEmptyDocument(
    deriveStableId("document", flatDocumentName),
    flatDocumentName,
  );
  flat.sourceStatus = "connectivity-modified";
  flat.presentation = structuredClone(source.presentation);
  flat.ports = source.ports.map((port) => ({
    ...structuredClone(port),
    position: null,
  }));

  const flatNetById = new Map();
  const addFlatNet = (sourceNet, name, portIds = []) => {
    const id = deriveStableId("net", flat.id, name);
    const existing = flatNetById.get(id);
    if (existing) return existing;
    const created = {
      id,
      name,
      scope: sourceNet.scope,
      terminals: [],
      ports: [...portIds],
    };
    flat.nets.push(created);
    flatNetById.set(id, created);
    return created;
  };

  const topBindings = new Map();
  for (const net of source.nets) {
    const created = addFlatNet(net, net.name ?? net.id, net.ports);
    topBindings.set(net.id, created.id);
  }

  const expand = (document, path, inheritedBindings) => {
    const localBindings = new Map(inheritedBindings);
    for (const net of document.nets) {
      if (localBindings.has(net.id)) continue;
      const name = scopedName(path, net.name ?? net.id);
      localBindings.set(net.id, addFlatNet(net, name).id);
    }

    for (const instance of document.instances) {
      const child = childBySymbolId.get(instance.symbolId);
      if (child) {
        const childBindings = new Map();
        for (const childPort of child.ports) {
          const parentNet = document.nets.find((net) =>
            net.terminals.some(
              (terminal) =>
                terminal.instanceId === instance.id &&
                terminal.pinName === childPort.name,
            ),
          );
          const childNet = child.nets.find((net) =>
            net.ports.includes(childPort.id),
          );
          if (!parentNet || !childNet) {
            throw new Error(
              `Cannot bind ${[...path, instance.id].join("/")}.${childPort.name}`,
            );
          }
          const flatNetId = localBindings.get(parentNet.id);
          if (!flatNetId) {
            throw new Error(`Parent Net ${parentNet.id} has no flat binding`);
          }
          childBindings.set(childNet.id, flatNetId);
        }
        expand(child, [...path, instance.id], childBindings);
        continue;
      }

      const flatInstanceId = scopedName(path, instance.id);
      flat.instances.push({
        ...structuredClone(instance),
        id: flatInstanceId,
        placement: null,
      });
      for (const net of document.nets) {
        const flatNetId = localBindings.get(net.id);
        const flatNet = flatNetId ? flatNetById.get(flatNetId) : null;
        if (!flatNet) throw new Error(`Local Net ${net.id} has no flat target`);
        for (const terminal of net.terminals.filter(
          (candidate) => candidate.instanceId === instance.id,
        )) {
          flatNet.terminals.push({
            instanceId: flatInstanceId,
            pinName: terminal.pinName,
          });
        }
      }
    }
  };

  expand(source, [], topBindings);
  return flat;
}

export function appendFlattenedDocument(
  project,
  sourceDocumentName,
  flatDocumentName,
) {
  if (
    project.documents.some((document) => document.name === flatDocumentName)
  ) {
    throw new Error(`Flat Document ${flatDocumentName} already exists`);
  }
  const flat = flattenDocument(project, sourceDocumentName, flatDocumentName);
  project.documents.push(flat);
  return flat;
}
