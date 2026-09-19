// Gelato-ready PDF assembly for the memorial book — mirrors daybook's
// proven pdf-builder.js structure and safety-margin fix exactly, with
// memorial-specific title/closing text.
//
// Gelato single-file structure: cover spread (p1) + blank endpaper (p2)
// + 32 interior pages + blank endpaper (last) = 35 pages total.
// Cover spread size differs by format (CONFIRMED via Gelato's own
// preflight rejection message / real successful submission):
//   Hardcover — 458.0mm x 246.0mm.
//   Softcover — 417.45mm x 211.2mm.
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs";
import path from "node:path";
import { STORY, fillText } from "./prompts.js";

const MM = 72 / 25.4;

function findAssetFile(subdir, filename) {
  const candidates = [
    path.join(process.cwd(), `netlify/functions/lib/${subdir}`, filename),
    path.join(process.cwd(), `netlify/functions/${subdir}`, filename),
    path.join(process.cwd(), subdir, filename),
    path.join(process.cwd(), filename),
    path.join(`/var/task/netlify/functions/lib/${subdir}`, filename),
    path.join(`/var/task/netlify/functions/${subdir}`, filename),
    path.join(`/var/task/${subdir}`, filename),
    path.join("/var/task", filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Asset file "${filename}" (in ${subdir}/) not found. Tried:\n` + candidates.join("\n"));
}
function findFontFile(filename) { return findAssetFile("fonts", filename); }
function findWashFile(filename) { return findAssetFile("washes", filename); }

const TRIM_IN = 8;
const BLEED_MM = 4;
const PAGE_MM = TRIM_IN * 25.4 + 2 * BLEED_MM;
const PAGE_PT = PAGE_MM * MM;

const HARDCOVER_SPREAD_MM = { w: 458.0, h: 246.0 };
const SOFTCOVER_SPREAD_MM = { w: 417.45, h: 211.2 };

// Same safety philosophy as daybook's proven Gelato fix — 8mm required
// minimum + 4mm extra buffer = 12mm total real-world clearance.
const GELATO_SAFE_MARGIN_PT = 8 * MM + 4 * MM;

const BROWN = rgb(0.35, 0.24, 0.18);
const CREAM = rgb(0.980, 0.965, 0.922);

async function drawWash(pdfDoc, page, washIndex, box) {
  const idx = washIndex % 4;
  const b = box || { x: 0, y: 0, width: PAGE_PT, height: PAGE_PT };
  try {
    const bytes = fs.readFileSync(findWashFile(`wash-${idx}.jpg`));
    const img = await pdfDoc.embedJpg(bytes);
    page.drawImage(img, { x: b.x, y: b.y, width: b.width, height: b.height });
  } catch (err) {
    console.error(`drawWash: failed to embed wash-${idx}.jpg, using flat cream fallback:`, err.message);
    page.drawRectangle({ x: b.x, y: b.y, width: b.width, height: b.height, color: CREAM });
  }
}

async function embedLiftedImage(pdfDoc, imgBytes) {
  try {
    return await pdfDoc.embedJpg(imgBytes);
  } catch (jpgErr) {
    try {
      return await pdfDoc.embedPng(imgBytes);
    } catch (pngErr) {
      console.error("embedLiftedImage: image data unreadable as JPEG or PNG:", jpgErr.message, "/", pngErr.message);
      return null;
    }
  }
}

function drawFullBleedLifted(page, img, liftFraction = 0.88) {
  const drawHeight = PAGE_PT / liftFraction;
  page.drawImage(img, { x: 0, y: 0, width: PAGE_PT, height: drawHeight });
}

function centeredLines(page, lines, font, size, yCenter, color = BROWN) {
  const lead = size * 1.55;
  let y = yCenter + (lead * (lines.length - 1)) / 2;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: PAGE_PT / 2 - w / 2, y, size, font, color });
    y -= lead;
  }
}

// Vertical flow engine — same proven pattern from the Prodigi fix
// (drawVerticalFlow), preventing text/image overlap structurally rather
// than by guessed fixed positions.
function drawVerticalFlow(page, startY, centerX, items) {
  let cursorY = startY;
  for (const item of items) {
    if (item.type === "text") {
      const ascent = item.font.heightAtSize(item.size, { descender: false });
      const baselineY = cursorY - ascent;
      const w = item.font.widthOfTextAtSize(item.text, item.size);
      page.drawText(item.text, { x: centerX - w / 2, y: baselineY, size: item.size, font: item.font, color: item.color || BROWN });
      cursorY -= item.font.heightAtSize(item.size, { descender: true });
    } else if (item.type === "image") {
      const imageBottomY = cursorY - item.height;
      page.drawImage(item.image, { x: centerX - item.width / 2, y: imageBottomY, width: item.width, height: item.height });
      cursorY = imageBottomY;
    }
    cursorY -= item.gapAfter || 0;
  }
  return cursorY;
}

export async function buildBookPdf({ callName, yearsTogether, pronoun, format, images }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const chewyBytes = fs.readFileSync(findFontFile("Chewy-Regular.ttf"));
  const handBytes = fs.readFileSync(findFontFile("PatrickHand-Regular.ttf"));
  const chewy = await pdfDoc.embedFont(chewyBytes, { subset: true });
  const hand = await pdfDoc.embedFont(handBytes, { subset: true });

  // ---------- PAGE 1: cover spread ----------
  const spreadMM = format === "hardcover" ? HARDCOVER_SPREAD_MM : SOFTCOVER_SPREAD_MM;
  const coverW = spreadMM.w * MM;
  const coverH = spreadMM.h * MM;
  const cover = pdfDoc.addPage([coverW, coverH]);
  cover.drawRectangle({ x: 0, y: 0, width: coverW, height: coverH, color: CREAM });

  const frontRegionW = coverW * 0.485;
  const frontX = coverW - frontRegionW;
  const fcx = frontX + frontRegionW / 2;

  const TITLE_GAP_PT = 112;
  const illusSize = coverH - TITLE_GAP_PT;
  const coverImg = await embedLiftedImage(pdfDoc, images["IMG-00"]);
  if (coverImg) {
    cover.drawImage(coverImg, { x: fcx - illusSize / 2, y: 0, width: illusSize, height: illusSize });
  }

  const line1Size = 30, line2Size = 40;
  const ASCENDER_RATIO = 0.82;
  const line1TopY = coverH - GELATO_SAFE_MARGIN_PT;
  const line1BaselineY = line1TopY - line1Size * ASCENDER_RATIO;
  const line2BaselineY = line1BaselineY - line1Size * 1.05 - line2Size * 0.15;

  cover.drawText("A Life Well-Loved", {
    x: fcx - chewy.widthOfTextAtSize("A Life Well-Loved", line1Size) / 2,
    y: line1BaselineY, size: line1Size, font: chewy, color: BROWN,
  });
  const nameYears = yearsTogether ? `${callName} \u00B7 ${yearsTogether}` : callName;
  cover.drawText(nameYears, {
    x: fcx - chewy.widthOfTextAtSize(nameYears, line2Size) / 2,
    y: line2BaselineY, size: line2Size, font: chewy, color: BROWN,
  });

  const bcx = (coverW - frontRegionW) / 2;
  const backLine1 = "Forever in our hearts.";
  cover.drawText(backLine1, { x: bcx - hand.widthOfTextAtSize(backLine1, 13) / 2, y: coverH * 0.62, size: 13, font: hand, color: BROWN });
  cover.drawText(nameYears, { x: bcx - hand.widthOfTextAtSize(nameYears, 13) / 2, y: coverH * 0.62 - 20, size: 13, font: hand, color: BROWN });

  if (images["IMG-16"]) {
    const vignetteImg = await embedLiftedImage(pdfDoc, images["IMG-16"]);
    if (vignetteImg) {
      const vw = coverH * 0.22;
      cover.drawImage(vignetteImg, { x: bcx - vw / 2, y: coverH * 0.30, width: vw, height: vw });
    }
  }

  const credit = "Made with love by Sun Valley Pet";
  const website = "sunvalleypet.com";
  cover.drawText(credit, { x: bcx - hand.widthOfTextAtSize(credit, 10) / 2, y: coverH * 0.16, size: 10, font: hand, color: BROWN });
  cover.drawText(website, { x: bcx - hand.widthOfTextAtSize(website, 10) / 2, y: coverH * 0.16 - 15, size: 10, font: hand, color: BROWN });

  // ---------- PAGE 2: blank endpaper ----------
  pdfDoc.addPage([PAGE_PT, PAGE_PT]);

  // ---------- PAGE 3: title page (flow-based, no overlap possible) ----------
  const titlePage = pdfDoc.addPage([PAGE_PT, PAGE_PT]);
  await drawWash(pdfDoc, titlePage, 0);

  const titleFlowItems = [
    { type: "text", text: "A Life Well-Loved", font: chewy, size: 32, gapAfter: 6 },
    { type: "text", text: nameYears, font: chewy, size: 44, gapAfter: 32 },
  ];
  const vignetteImg16 = images["IMG-16"] ? await embedLiftedImage(pdfDoc, images["IMG-16"]) : null;
  if (vignetteImg16) {
    const vw = PAGE_PT * 0.22;
    titleFlowItems.push({ type: "image", image: vignetteImg16, width: vw, height: vw, gapAfter: 0 });
  }
  drawVerticalFlow(titlePage, PAGE_PT - GELATO_SAFE_MARGIN_PT, PAGE_PT / 2, titleFlowItems);

  const subtitle = "A gentle journey through a life well-loved";
  titlePage.drawText(subtitle, {
    x: PAGE_PT / 2 - hand.widthOfTextAtSize(subtitle, 14) / 2,
    y: PAGE_PT * 0.10, size: 14, font: hand, color: BROWN,
  });

  // ---------- 15 story spreads ----------
  for (let i = 0; i < STORY.length; i++) {
    const moment = STORY[i];
    const filledLines = fillText(moment.lines, callName, pronoun);

    const textPage = pdfDoc.addPage([PAGE_PT, PAGE_PT]);
    await drawWash(pdfDoc, textPage, i % 4);
    centeredLines(textPage, filledLines, hand, 22, PAGE_PT * 0.58);
    textPage.drawText(String(i * 2 + 2), { x: 12, y: 10, size: 11, font: hand, color: BROWN });

    const illusPage = pdfDoc.addPage([PAGE_PT, PAGE_PT]);
    const imgBytes = images[moment.img];
    const img = imgBytes ? await embedLiftedImage(pdfDoc, imgBytes) : null;
    if (img) {
      drawFullBleedLifted(illusPage, img);
    } else {
      illusPage.drawRectangle({ x: 0, y: 0, width: PAGE_PT, height: PAGE_PT, color: CREAM });
    }
  }

  // ---------- closing page (flow-based) ----------
  const closing = pdfDoc.addPage([PAGE_PT, PAGE_PT]);
  await drawWash(pdfDoc, closing, 1);

  const closingFlow = [
    { type: "text", text: "Until We Meet Again", font: chewy, size: 36, gapAfter: 40 },
  ];
  const vignetteClose = images["IMG-16"] ? await embedLiftedImage(pdfDoc, images["IMG-16"]) : null;
  if (vignetteClose) {
    const vw = PAGE_PT * 0.24;
    closingFlow.push({ type: "image", image: vignetteClose, width: vw, height: vw, gapAfter: 34 });
  }
  const footer = yearsTogether ? `${callName} \u00B7 ${yearsTogether} \u00B7 Forever loved.` : `${callName} \u00B7 Forever loved.`;
  closingFlow.push({ type: "text", text: footer, font: hand, size: 13, gapAfter: 20 });
  closingFlow.push({ type: "text", text: "Made with love by Sun Valley Pet \u00B7 sunvalleypet.com", font: hand, size: 12, gapAfter: 0 });

  drawVerticalFlow(closing, PAGE_PT * 0.72, PAGE_PT / 2, closingFlow);

  // ---------- last page: blank endpaper ----------
  pdfDoc.addPage([PAGE_PT, PAGE_PT]);

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
