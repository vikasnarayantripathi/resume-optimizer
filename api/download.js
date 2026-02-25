import PDFDocument from "pdfkit";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
  maxDuration: 30
};

const ACCENT  = "#16a34a";
const ACCENT2 = "#15803d";
const TEXT    = "#1c1917";
const MUTED   = "#78716c";
const LIGHT   = "#f0fdf4";
const BORDER  = "#d4cbbf";

// Footer is written per-page via bufferPages loop — NOT inline
function writeFooter(doc, pageIndex, name) {
  doc.switchToPage(pageIndex);
  const pageH = doc.page.height;
  const pageW = doc.page.width;
  doc.moveTo(50, pageH - 38).lineTo(pageW - 50, pageH - 38)
     .strokeColor(BORDER).lineWidth(0.4).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#a8a29e")
     .text(
       (name ? name + "  ·  " : "") + "ATSCheckPro  ·  Confidential",
       50, pageH - 30, { align: "center", width: pageW - 100 }
     );
}

// Safe write — if we're near the bottom, add a new page first
function safeY(doc, neededHeight = 40) {
  if (doc.y + neededHeight > doc.page.height - 50) {
    doc.addPage();
  }
}

// ─── RESUME ────────────────────────────────────────────────────────────────
function buildResumePDF(doc, optimizedText, photo) {
  const lines    = (optimizedText || "").split("\n");
  const pageW    = doc.page.width;
  const margin   = 50;
  const contentW = pageW - margin * 2;

  const name = lines[0]?.trim() || "";
  let contactParts = [];
  let bodyStart = 1;
  for (let i = 1; i < Math.min(5, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) { bodyStart = i + 1; break; }
    if (l.includes("@") || l.includes("|") || l.match(/\+?\d[\d\s\-]{7,}/)
        || l.toLowerCase().includes("linkedin") || l.toLowerCase().includes("github")) {
      contactParts.push(...l.split("|").map(x => x.trim()).filter(Boolean));
      bodyStart = i + 1;
    } else { bodyStart = i; break; }
  }
  const body = lines.slice(bodyStart);

  // Green top strip
  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  // Photo
  const hasPhoto = !!photo;
  const nameW = hasPhoto ? contentW - 90 : contentW;
  const phX = pageW - margin - 70, phY = 18;
  if (hasPhoto) {
    try {
      const imgData = photo.replace(/^data:image\/\w+;base64,/, "");
      doc.save();
      doc.roundedRect(phX, phY, 66, 66, 5).clip();
      doc.image(Buffer.from(imgData, "base64"), phX, phY, { width: 66, height: 66 });
      doc.restore();
      doc.roundedRect(phX, phY, 66, 66, 5).strokeColor(ACCENT).lineWidth(1.5).stroke();
    } catch(e) {}
  }

  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT).text(name, margin, 18, { width: nameW });

  let contactY = 44;
  if (contactParts.length) {
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("   ·   "), margin, contactY, { width: nameW, lineGap: 2 });
    contactY = doc.y + 4;
  }

  const divY = hasPhoto ? Math.max(contactY + 4, phY + 66 + 10) : contactY + 4;
  doc.moveTo(margin, divY).lineTo(pageW - margin, divY)
     .strokeColor(ACCENT).lineWidth(1.8).stroke();
  doc.y = divY + 10;

  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.2); continue; }
    const isBullet = /^[%¸►•\-–—▸*]/.test(raw);
    const t = raw.replace(/^[%¸►•\-–—▸*]+\s*/, "").trim();

    // Section header
    if (t === t.toUpperCase() && t.length > 2 && t.length < 55
        && !/^\d/.test(t) && /[A-Z]/.test(t) && !isBullet) {
      safeY(doc, 30);
      doc.moveDown(0.35);
      const sy = doc.y;
      doc.rect(margin, sy, contentW, 15).fill(LIGHT);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2)
         .text(t, margin + 5, sy + 3.5, { characterSpacing: 1.2 });
      doc.y = sy + 19; doc.moveDown(0.1);
      continue;
    }

    // Bullet
    if (isBullet) {
      safeY(doc, 20);
      const bY = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("▸", margin + 2, bY + 1.5);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(t, margin + 14, bY, { width: contentW - 14, lineGap: 1.5 });
      doc.moveDown(0.12);
      continue;
    }

    // Job title / company
    if ((t.includes(" - ") || t.includes(" – ") || t.includes(" | "))
        && t.length < 100 && !t.includes("@")) {
      safeY(doc, 20);
      doc.moveDown(0.2);
      const parts = t.split(/\s[–\-|]\s/);
      if (parts.length > 1) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(parts[0], { continued: true });
        doc.fontSize(9).font("Helvetica").fillColor(MUTED).text("  ·  " + parts.slice(1).join(" · "));
      } else {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(t);
      }
      doc.moveDown(0.1);
      continue;
    }

    safeY(doc, 16);
    doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, { lineGap: 1.5 });
    doc.moveDown(0.08);
  }
}

// ─── COVER LETTER ──────────────────────────────────────────────────────────
function buildCoverPDF(doc, coverLetter, candidateName) {
  const pageW    = doc.page.width;
  const margin   = 72;
  const contentW = pageW - margin * 2;

  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT)
     .text(candidateName || "Applicant", margin, 22);

  doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT)
     .text("ATSCheckPro", pageW - margin - 80, 24, { width: 80, align: "right" });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
     .text("AI Resume Service", pageW - margin - 80, 36, { width: 80, align: "right" });

  doc.moveTo(margin, 50).lineTo(pageW - margin, 50)
     .strokeColor(BORDER).lineWidth(0.5).stroke();

  const today = new Date().toLocaleDateString("en-US",
    { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9.5).font("Helvetica").fillColor(MUTED)
     .text(today, margin, 62, { width: contentW, align: "right" });

  doc.y = 88;

  // Clean AI output — strip junk lines
  const nameUpper  = (candidateName || "").toUpperCase().trim();
  const nameNormal = (candidateName || "").trim();
  const cleanLines = (coverLetter || "").split("\n").filter(line => {
    const t = line.trim();
    if (!t) return true;
    if (t.toUpperCase() === nameUpper && nameUpper.length > 2) return false;
    if (/^\[.*\]$/.test(t)) return false;
    if (/^[A-Za-z\s]+[|]\s*[\w.+%-]+@/.test(t)) return false;
    if (/^[\w\s,.-]+\s+[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i.test(t)) return false;
    return true;
  });

  const cleanText = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  let paragraphs = cleanText.split(/\n{2,}/).filter(p => p.trim());
  if (paragraphs.length <= 2) paragraphs = cleanText.split("\n").filter(p => p.trim());

  let closingDone = false;

  for (const para of paragraphs) {
    const p = para.trim().replace(/\n/g, " ");
    if (!p || closingDone) continue;

    if (/^(Dear|To Whom|To the)/i.test(p)) {
      safeY(doc, 20);
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT)
         .text(p, margin, doc.y, { width: contentW });
      doc.moveDown(1);
      continue;
    }

    if (/^(Sincerely|Best regards|Warm regards|Respectfully|Thank you|Yours)/i.test(p)) {
      closingDone = true;
      safeY(doc, 80);
      doc.moveDown(0.8);
      const closingWord = p.replace(new RegExp(",?\\s*" + nameNormal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ".*$", "i"), "").trim() || p;
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
         .text(closingWord + (closingWord.endsWith(",") ? "" : ","), margin, doc.y, { width: contentW });
      doc.moveDown(2.5);
      doc.moveTo(margin, doc.y).lineTo(margin + 170, doc.y)
         .strokeColor(BORDER).lineWidth(0.8).stroke();
      doc.moveDown(0.4);
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(nameNormal, margin);
      continue;
    }

    safeY(doc, 40);
    doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
       .text(p, margin, doc.y, { width: contentW, align: "justify", lineGap: 4 });
    doc.moveDown(0.9);
  }
}

// ─── ATS REPORT ────────────────────────────────────────────────────────────
function buildReportPDF(doc, report, candidateName) {
  const score      = report?.score || 0;
  const scoreAfter = report?.scoreAfter || Math.min(score + 15, 95);
  const improvement = scoreAfter - score;
  const pageW      = doc.page.width;
  const margin     = 50;
  const contentW   = pageW - margin * 2;
  const scoreColor = score >= 75 ? ACCENT : score >= 60 ? "#d97706" : "#dc2626";

  const STOP = new Set(["job","description","the","and","or","with","for","to","of",
    "in","on","a","an","is","are","was","will","be","been","have","has","this","that",
    "you","your","we","our","their","they","it","its","by","as","at","from","about",
    "which","who","when","where","ensure","looking","need","must","should","can",
    "may","able","work","working","role","position","team","using","use","used",
    "experience","company","including","strong","good","excellent","apply",
    "responsible","candidate","ability","skills","description","great","well",
    "new","best","please","would","could","also","want","require","required"]);

  const cleanKW = (report?.keywords || []).filter(k =>
    k && k.length > 2 && !STOP.has(k.toLowerCase()) && /[a-zA-Z]/.test(k)
  );

  // Top strip
  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  // Title
  doc.fontSize(22).font("Helvetica-Bold").fillColor(TEXT).text("ATS Resume Report", margin, 20);
  if (candidateName) {
    doc.fontSize(11).font("Helvetica").fillColor(MUTED)
       .text("Prepared for:  ", margin, 48, { continued: true });
    doc.font("Helvetica-Bold").fillColor(TEXT).text(candidateName);
  }
  const dateStr = new Date().toLocaleDateString("en-US",
    { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9).font("Helvetica").fillColor(MUTED)
     .text(dateStr, margin, candidateName ? 64 : 48);

  const divY = candidateName ? 80 : 66;
  doc.moveTo(margin, divY).lineTo(pageW - margin, divY)
     .strokeColor(ACCENT).lineWidth(1.5).stroke();
  doc.y = divY + 14;

  // Score boxes
  const boxW = (contentW - 20) / 3;
  const bY   = doc.y;
  const boxes = [
    { label:"BEFORE OPTIMIZATION", value: score+"/100",
      sub: score >= 75 ? "Strong" : score >= 60 ? "Moderate" : "Weak",
      color: scoreColor, bg:"#fafaf9", border:BORDER },
    { label:"AFTER OPTIMIZATION",  value: scoreAfter+"/100",
      sub:"Projected", color:ACCENT, bg:LIGHT, border:ACCENT },
    { label:"IMPROVEMENT",         value: "+"+improvement,
      sub:"points gained", color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe" }
  ];
  boxes.forEach((b, i) => {
    const bx = margin + i * (boxW + 10);
    doc.rect(bx, bY, boxW, 62).fill(b.bg);
    doc.rect(bx, bY, boxW, 62).stroke(b.border).lineWidth(0.8);
    doc.rect(bx, bY, boxW, 4).fill(b.color);
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(MUTED)
       .text(b.label, bx, bY + 12, { width: boxW, align:"center", characterSpacing:0.6 });
    doc.fontSize(20).font("Helvetica-Bold").fillColor(b.color)
       .text(b.value, bx, bY + 24, { width: boxW, align:"center" });
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(b.sub, bx, bY + 50, { width: boxW, align:"center" });
  });
  doc.y = bY + 78;

  // Overall assessment
  const strength = score >= 75 ? "Strong ATS Match" : score >= 60 ? "Moderate Match" : "Needs Improvement";
  const asBg = score >= 75 ? LIGHT : score >= 60 ? "#fffbeb" : "#fef2f2";
  doc.rect(margin, doc.y, contentW, 22).fill(asBg);
  doc.fontSize(9).font("Helvetica").fillColor(MUTED)
     .text("Overall Assessment:", margin + 10, doc.y + 6, { continued:true });
  doc.font("Helvetica-Bold").fillColor(scoreColor).text("  " + strength);
  doc.y += 30;

  function section(title) {
    safeY(doc, 50);
    doc.moveDown(0.4);
    const sy = doc.y;
    doc.rect(margin, sy, contentW, 16).fill(LIGHT);
    doc.moveTo(margin, sy).lineTo(margin, sy + 16)
       .strokeColor(ACCENT).lineWidth(3).stroke();
    doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2)
       .text(title, margin + 10, sy + 4, { characterSpacing:0.8 });
    doc.y = sy + 22;
  }

  // Recruiter impression
  if (report?.impression?.length) {
    section("RECRUITER IMPRESSION");
    for (const item of report.impression) {
      safeY(doc, 25);
      const iy = doc.y;
      doc.fontSize(9.5).font("Helvetica").fillColor(ACCENT).text("→", margin + 4, iy + 1);
      doc.fontSize(10).font("Helvetica").fillColor(TEXT)
         .text(item, margin + 18, iy, { width: contentW - 18, lineGap: 2 });
      doc.moveDown(0.4);
    }
  }

  // Missing keywords as tags
  if (cleanKW.length) {
    section("MISSING KEYWORDS — ADD TO YOUR RESUME");
    let kx = margin + 4, ky = doc.y;
    const tagH = 15;
    for (const kw of cleanKW) {
      const tw = doc.widthOfString(kw, { fontSize:8.5 }) + 16;
      // Wrap to next line if overflows
      if (kx + tw > pageW - margin) { kx = margin + 4; ky += tagH + 6; }
      // New page if tag row overflows page
      if (ky + tagH > doc.page.height - 60) {
        doc.addPage(); ky = doc.y; kx = margin + 4;
      }
      doc.rect(kx, ky, tw, tagH).fill("#fee2e2");
      doc.rect(kx, ky, tw, tagH).stroke("#fca5a5").lineWidth(0.5);
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#991b1b")
         .text(kw, kx + 8, ky + 3.5);
      kx += tw + 6;
    }
    doc.y = ky + tagH + 12;
  }

  // Improvement notes
  if (report?.notes?.length) {
    section("IMPROVEMENT NOTES");
    for (let i = 0; i < report.notes.length; i++) {
      safeY(doc, 28);
      const note = report.notes[i];
      const ny = doc.y;
      if (i % 2 === 0) doc.rect(margin, ny, contentW, 22).fill("#fafaf9");
      doc.fontSize(9).font("Helvetica-Bold").fillColor(ACCENT)
         .text((i + 1) + ".", margin + 5, ny + 4);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(note, margin + 20, ny + 4, { width: contentW - 22, lineGap: 2 });
      doc.moveDown(0.55);
    }
  }
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error:"Method not allowed" });
  try {
    const { type, optimizedText, coverLetter, report, photo, candidateName } = req.body;

    const doc = new PDFDocument({
      margin: 50,
      size: "A4",
      bufferPages: true,   // lets us iterate pages to add footer
      autoFirstPage: true
    });

    const chunks = [];
    doc.on("data", c => chunks.push(c));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ATSCheckPro-${type}.pdf"`);

    if      (type === "resume") buildResumePDF(doc, optimizedText, photo, candidateName);
    else if (type === "cover")  buildCoverPDF(doc, coverLetter, candidateName);
    else if (type === "report") buildReportPDF(doc, report, candidateName);

    // Add footer to every page AFTER content is written
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      writeFooter(doc, i, candidateName);
    }

    doc.flushPages();
    doc.end();

    await new Promise(r => doc.on("end", r));
    const buffer = Buffer.concat(chunks);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);

  } catch(e) {
    console.error("Download error:", e);
    res.status(500).json({ error: e.message });
  }
}

function writeFooter(doc, pageIndex, name) {
  doc.switchToPage(pageIndex);
  const pageH = doc.page.height;
  const pageW = doc.page.width;
  doc.moveTo(50, pageH - 38).lineTo(pageW - 50, pageH - 38)
     .strokeColor(BORDER).lineWidth(0.4).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#a8a29e")
     .text(
       (name ? name + "  ·  " : "") + "ATSCheckPro  ·  Confidential",
       50, pageH - 30, { align: "center", width: pageW - 100 }
     );
}
