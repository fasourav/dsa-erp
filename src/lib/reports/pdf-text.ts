// fontkit's Indic shaper is compiled against a global regeneratorRuntime.
import "regenerator-runtime"

import { readFile } from "node:fs/promises"
import path from "node:path"

import fontkit from "@pdf-lib/fontkit"
import {
  PDFArray,
  PDFHexString,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  StandardFonts,
  beginText,
  endText,
  moveText,
  popGraphicsState,
  pushGraphicsState,
  setFillingColor,
  setFontAndSize,
  type Color,
  type PDFDocument,
  type PDFFont,
  type PDFName,
  type PDFPage,
} from "pdf-lib"

type Shaper = ReturnType<typeof fontkit.create>

type Face = {
  pdf: PDFFont
  shaper: Shaper | null
  covers: (codePoint: number) => boolean
}

type Piece = { face: Face; text: string }

type DrawOptions = { x: number; y: number; size: number; color: Color }

export type PdfTextStyle = {
  widthOf: (text: string, size: number) => number
  draw: (page: PDFPage, text: string, options: DrawOptions) => void
}

const fontDir = path.join(process.cwd(), "src", "lib", "reports", "fonts")
const fontNames = {
  latin: "NotoSans-Regular.ttf",
  latinBold: "NotoSans-Bold.ttf",
  bengali: "NotoSansBengali-Regular.ttf",
  bengaliBold: "NotoSansBengali-Bold.ttf",
} as const

type FontKey = keyof typeof fontNames
type LoadedFont = { bytes: Uint8Array; shaper: Shaper }

let loadedFonts: Promise<Record<FontKey, LoadedFont>> | null = null

function loadFonts(): Promise<Record<FontKey, LoadedFont>> {
  loadedFonts ??= (async () => {
    const entries = await Promise.all(
      (Object.keys(fontNames) as FontKey[]).map(async (key) => {
        const bytes = new Uint8Array(await readFile(path.join(fontDir, fontNames[key])))
        return [key, { bytes, shaper: fontkit.create(bytes) }] as const
      }),
    )
    return Object.fromEntries(entries) as Record<FontKey, LoadedFont>
  })().catch((error: unknown) => {
    loadedFonts = null
    throw error
  })
  return loadedFonts
}

// Embeds Noto Sans for Latin text and Noto Sans Bengali for Bangla, so names in either
// script and typographic marks such as the minus sign print as written. Falls back to
// Helvetica (Latin-1 only) if the font files cannot be read.
export async function embedReportFonts(
  document: PDFDocument,
): Promise<{ regular: PdfTextStyle; bold: PdfTextStyle }> {
  let fonts: Record<FontKey, LoadedFont> | null = null
  try {
    fonts = await loadFonts()
  } catch {
    fonts = null
  }

  if (!fonts) {
    const [regular, bold] = await Promise.all([
      document.embedFont(StandardFonts.Helvetica),
      document.embedFont(StandardFonts.HelveticaBold),
    ])
    return { regular: textStyle(standardFace(regular), null), bold: textStyle(standardFace(bold), null) }
  }

  document.registerFontkit(fontkit)
  const embed = async (font: LoadedFont): Promise<Face> => ({
    pdf: await document.embedFont(font.bytes, { subset: true }),
    shaper: font.shaper,
    covers: (codePoint) => font.shaper.hasGlyphForCodePoint(codePoint),
  })
  const [latin, latinBold, bengali, bengaliBold] = await Promise.all([
    embed(fonts.latin),
    embed(fonts.latinBold),
    embed(fonts.bengali),
    embed(fonts.bengaliBold),
  ])
  return { regular: textStyle(latin, bengali), bold: textStyle(latinBold, bengaliBold) }
}

function standardFace(font: PDFFont): Face {
  const charset = new Set(font.getCharacterSet())
  return { pdf: font, shaper: null, covers: (codePoint) => charset.has(codePoint) }
}

const standardFallbacks: Record<string, string> = {
  "\u2212": "-",
  "\u2010": "-",
  "\u2011": "-",
  "\u00a0": " ",
  "\u09f3": "BDT ",
}

function isBengali(codePoint: number): boolean {
  return (codePoint >= 0x0980 && codePoint <= 0x09ff) || codePoint === 0x0964 || codePoint === 0x0965
}

function isJoiner(codePoint: number): boolean {
  return codePoint === 0x200c || codePoint === 0x200d || codePoint === 0x25cc
}

function textStyle(latin: Face, bengali: Face | null): PdfTextStyle {
  const pieces = (text: string): Piece[] => {
    const out: Piece[] = []
    const add = (face: Face, value: string) => {
      const last = out[out.length - 1]
      if (last && last.face === face) last.text += value
      else out.push({ face, text: value })
    }
    for (const raw of text) {
      const char = raw.charCodeAt(0) < 0x20 ? " " : raw
      const codePoint = char.codePointAt(0) ?? 0x3f
      const last = out[out.length - 1]
      if (char === " " && last) {
        last.text += char
      } else if (bengali && (isBengali(codePoint) || (isJoiner(codePoint) && last?.face === bengali))) {
        add(bengali, char)
      } else if (latin.covers(codePoint)) {
        add(latin, char)
      } else if (bengali?.covers(codePoint)) {
        add(bengali, char)
      } else {
        const fallback = latin.shaper ? "?" : standardFallbacks[char] ?? "?"
        for (const piece of fallback) add(latin, latin.covers(piece.codePointAt(0) ?? 0) ? piece : "?")
      }
    }
    return out
  }

  const pieceWidth = (piece: Piece, size: number): number => {
    const shaper = piece.face.shaper
    if (!shaper) return piece.face.pdf.widthOfTextAtSize(piece.text, size)
    const run = shaper.layout(piece.text)
    const units = run.positions.reduce((sum, position) => sum + position.xAdvance, 0)
    return (units * size) / shaper.unitsPerEm
  }

  return {
    widthOf: (text, size) => pieces(text).reduce((sum, piece) => sum + pieceWidth(piece, size), 0),
    draw: (page, text, options) => {
      let x = options.x
      for (const piece of pieces(text)) {
        drawPiece(page, piece, { ...options, x })
        x += pieceWidth(piece, options.size)
      }
    },
  }
}

const fontKeys = new WeakMap<PDFPage, Map<PDFFont, PDFName>>()

function fontKey(page: PDFPage, font: PDFFont): PDFName {
  let keys = fontKeys.get(page)
  if (!keys) {
    keys = new Map()
    fontKeys.set(page, keys)
  }
  let key = keys.get(font)
  if (!key) {
    key = page.node.newFontDictionary(font.name, font.ref)
    keys.set(font, key)
  }
  return key
}

// pdf-lib's drawText applies the font's substitutions (conjuncts, vowel reordering) but
// drops mark positioning, which puts Bangla vowel signs and reph on the wrong letter.
// Draw the shaped glyphs with TJ so each glyph keeps its offset and advance.
function drawPiece(page: PDFPage, piece: Piece, { x, y, size, color }: DrawOptions) {
  const { face, text } = piece
  const shaper = face.shaper
  const encoded = shaper ? face.pdf.encodeText(text).asString() : ""
  const run = shaper?.layout(text)
  if (!shaper || !run || encoded.length !== run.glyphs.length * 4) {
    page.drawText(text, { x, y, size, font: face.pdf, color })
    return
  }

  const scale = 1000 / shaper.unitsPerEm
  const glyphs = PDFArray.withContext(page.doc.context)
  let hex = ""
  let shift = 0
  const pushShift = () => {
    const value = Math.round(shift * 100) / 100
    shift = 0
    if (value === 0) return
    if (hex) glyphs.push(PDFHexString.of(hex))
    hex = ""
    glyphs.push(PDFNumber.of(value))
  }

  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index]
    shift -= position.xOffset * scale
    pushShift()
    hex += encoded.slice(index * 4, index * 4 + 4)
    shift += (position.xOffset + glyph.advanceWidth - position.xAdvance) * scale
  })
  if (hex) glyphs.push(PDFHexString.of(hex))

  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setFillingColor(color),
    setFontAndSize(fontKey(page, face.pdf), size),
    moveText(x, y),
    PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [glyphs]),
    endText(),
    popGraphicsState(),
  )
}
