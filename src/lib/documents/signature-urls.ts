import type { DocumentModel, SignLine } from "@/lib/documents/setc/types"

function mapLines(model: DocumentModel, map: (line: SignLine) => SignLine): DocumentModel {
  if (model.kind === "rfq") {
    return {
      ...model,
      doc: {
        ...model.doc,
        signatures: model.doc.signatures.map(map),
        vendorSignature: model.doc.vendorSignature ? map(model.doc.vendorSignature) : model.doc.vendorSignature,
      },
    }
  }
  return { ...model, doc: { ...model.doc, signatures: model.doc.signatures.map(map) } } as DocumentModel
}

export const attachSignatureUrls = (model: DocumentModel, urls: Record<string, string>) =>
  mapLines(model, (line) => ({ ...line, imageUrl: line.imagePath ? (urls[line.imagePath] ?? null) : null }))

export const stripSignatureImages = (model: DocumentModel) =>
  mapLines(model, (line) => ({ ...line, imagePath: null, imageUrl: null }))

export const signatureImagePaths = (model: DocumentModel) =>
  model.doc.signatures.flatMap((line) => (line.imagePath ? [line.imagePath] : []))
