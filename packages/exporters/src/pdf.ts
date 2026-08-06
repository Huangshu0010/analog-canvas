import { PDFDocument } from "pdf-lib";

import type { Rect } from "@icm/model";

import { EXPORT_VERSION } from "./index.js";
import type { RasterExport } from "./index.js";

export async function createPdfFromPng(
  png: RasterExport,
  bounds: Rect,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Interactive Circuit Maker schematic");
  pdf.setAuthor("Interactive Circuit Maker");
  pdf.setCreator(`Interactive Circuit Maker exporter ${EXPORT_VERSION}`);
  pdf.setProducer(`Interactive Circuit Maker exporter ${EXPORT_VERSION}`);
  const fixedDate = new Date("2000-01-01T00:00:00.000Z");
  pdf.setCreationDate(fixedDate);
  pdf.setModificationDate(fixedDate);
  const widthPoints = bounds.width * 0.75;
  const heightPoints = bounds.height * 0.75;
  const page = pdf.addPage([widthPoints, heightPoints]);
  const image = await pdf.embedPng(png.bytes);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: widthPoints,
    height: heightPoints,
  });
  return pdf.save({ useObjectStreams: false, addDefaultPage: false });
}
