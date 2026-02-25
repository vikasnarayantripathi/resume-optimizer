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

// Check if we need a new page before writing a block
function safeY(doc, needed = 40) {
  const bottomLimit = doc.page.height - 80; // leave room for footer
  if (doc.y + needed > bottomLimit) {
    doc.addPage();
  }
}

// Inline footer — called right before doc.end() at current y position
function addFooter(doc) {
  // We need to write footer at a known position — use absolute positioning
  // We don't use page.height trick anymore; just write at current y
  const pageW = doc.page.width;
  const fy = doc.page.height - 40;
  doc.moveTo(50, fy).lineTo(pageW - 50, fy)
     .strokeColor(BORDER).lineWidth(0.4).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#a8a29e")
     .text("ATSCheckPro  ·  AI Resume Service  ·  Confidential",
       50, fy + 6, { align: "center", width: pageW - 100 });
}

// ─── RESUME ────────────────────────────────────────────────────────────────
function buildResumePDF(doc, optimizedText, photo, candidateName) {
  const lines    = (optimizedText || "").split("\n");
  const pageW    = doc.page.width;
  const margin   = 50;
  const contentW = pageW - margin * 2;
  const name     = lines[0]?.trim() || candidateName || "";

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

  // Photo — right side
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

  // Name + contact
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT)
     .text(name, margin, 18, { width: nameW });
  let contactY = 44;
  if (contactParts.length) {
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("   ·   "), margin, contactY, { width: nameW, lineGap: 2 });
    contactY = doc.y + 4;
  }

  // Divider drawn BELOW photo
  const divY = hasPhoto ? Math.max(contactY + 4, phY + 66 + 10) : contactY + 4;
  doc.moveTo(margin, divY).lineTo(pageW - margin, divY)
     .strokeColor(ACCENT).lineWidth(1.8).stroke();
  doc.y = divY + 10;

  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.2); continue; }
    const isBullet = /^[%¸►•\-–—▸*]/.test(raw);
    const t = raw.replace(/^[%¸►•\-–—▸*]+\s*/, "").trim();

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

    if (isBullet) {
      safeY(doc, 20);
      const bY = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("▸", margin + 2, bY + 1.5);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(t, margin + 14, bY, { width: contentW - 14, lineGap: 1.5 });
      doc.moveDown(0.12);
      continue;
    }

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
  const nameNormal = (candidateName || "").trim();
  const nameUpper  = nameNormal.toUpperCase();

  doc.rect(0, 0, pageW, 5).fill(ACCENT);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT)
     .text(nameNormal || "Applicant", margin, 22);
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

  // Clean AI junk
  const cleanLines = (coverLetter || "").split("\n").filter(line => {
    const t = line.trim();
    if (!t) return true;
    if (nameUpper && t.toUpperCase() === nameUpper) return false;
    if (/^\[.*\]$/.test(t)) return false;
    if (/^[A-Za-z\s]+[|]\s*[\w.+%-]+@/.test(t)) return false;
    if (/^[\w\s,.-]+\s+[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i.test(t)) return false;
    return true;
  });

  const cleanText = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  let paragraphs  = cleanText.split(/\n{2,}/).filter(p => p.trim());
  if (paragraphs.length <= 2) paragraphs = cleanText.split("\n").filter(p => p.trim());

  let closingDone = false;
  for (const para of paragraphs) {
    const p = para.trim().replace(/\n/g, " ");
    if (!p || closingDone) continue;

    if (/^(Dear|To Whom|To the)/i.test(p)) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT)
         .text(p, margin, doc.y, { width: contentW });
      doc.moveDown(1);
      continue;
    }

    if (/^(Sincerely|Best regards|Warm regards|Respectfully|Thank you|Yours)/i.test(p)) {
      closingDone = true;
      safeY(doc, 80);
      doc.moveDown(0.8);
      const escName = nameNormal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const closingWord = p.replace(new RegExp(",?\\s*" + escName + ".*$","i"),"").trim() || p;
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
         .text(closingWord.endsWith(",") ? closingWord : closingWord + ",", margin, doc.y, { width: contentW });
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
    "responsible","candidate","ability","skills","great","well","new","best",
    "please","would","could","also","want","require","required","preferred"]);

  const cleanKW = (report?.keywords || []).filter(k =>
    k && k.length > 2 && !STOP.has(k.toLowerCase()) && /[a-zA-Z]/.test(k)
  );

  doc.rect(0, 0, pageW, 5).fill(ACCENT);
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
    { label:"BEFORE",    value: score+"/100",
      sub: score >= 75 ? "Strong" : score >= 60 ? "Moderate" : "Weak",
      color: scoreColor, bg:"#fafaf9", border:BORDER },
    { label:"AFTER OPT.", value: scoreAfter+"/100",
      sub:"Projected",   color:ACCENT,   bg:LIGHT,     border:ACCENT },
    { label:"IMPROVEMENT", value: "+"+improvement,
      sub:"points",      color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe" }
  ];
  boxes.forEach((b, i) => {
    const bx = margin + i * (boxW + 10);
    doc.rect(bx, bY, boxW, 58).fill(b.bg);
    doc.rect(bx, bY, boxW, 58).stroke(b.border).lineWidth(0.8);
    doc.rect(bx, bY, boxW, 4).fill(b.color);
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(MUTED)
       .text(b.label, bx, bY + 10, { width: boxW, align:"center", characterSpacing:0.6 });
    doc.fontSize(18).font("Helvetica-Bold").fillColor(b.color)
       .text(b.value, bx, bY + 22, { width: boxW, align:"center" });
    doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
       .text(b.sub, bx, bY + 46, { width: boxW, align:"center" });
  });
  doc.y = bY + 68;

  // Assessment strip
  const strength = score >= 75 ? "Strong ATS Match" : score >= 60 ? "Moderate Match" : "Needs Improvement";
  const asBg = score >= 75 ? LIGHT : score >= 60 ? "#fffbeb" : "#fef2f2";
  doc.rect(margin, doc.y, contentW, 20).fill(asBg);
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
     .text("Overall Assessment:", margin + 10, doc.y + 5, { continued:true });
  doc.font("Helvetica-Bold").fillColor(scoreColor).text("  " + strength);
  doc.y += 26;

  function section(title) {
    safeY(doc, 50);
    doc.moveDown(0.4);
    const sy = doc.y;
    doc.rect(margin, sy, contentW, 16).fill(LIGHT);
    doc.moveTo(margin, sy).lineTo(margin, sy + 16)
       .strokeColor(ACCENT).lineWidth(3).stroke();
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2)
       .text(title, margin + 10, sy + 4, { characterSpacing:0.8 });
    doc.y = sy + 22;
  }

  if (report?.impression?.length) {
    section("RECRUITER IMPRESSION");
    for (const item of report.impression) {
      safeY(doc, 22);
      const iy = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("→", margin + 4, iy + 1);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(item, margin + 18, iy, { width: contentW - 18, lineGap: 2 });
      doc.moveDown(0.35);
    }
  }

  if (cleanKW.length) {
    section("MISSING KEYWORDS — ADD TO YOUR RESUME");
    let kx = margin + 4, ky = doc.y;
    const tagH = 14;
    for (const kw of cleanKW) {
      const tw = doc.widthOfString(kw, { fontSize:8 }) + 14;
      if (kx + tw > pageW - margin) { kx = margin + 4; ky += tagH + 5; }
      if (ky + tagH > doc.page.height - 70) {
        doc.addPage(); doc.y = 50; ky = doc.y; kx = margin + 4;
      }
      doc.rect(kx, ky, tw, tagH).fill("#fee2e2");
      doc.rect(kx, ky, tw, tagH).stroke("#fca5a5").lineWidth(0.5);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#991b1b").text(kw, kx + 7, ky + 3);
      kx += tw + 5;
    }
    doc.y = ky + tagH + 10;
  }

  if (report?.notes?.length) {
    section("IMPROVEMENT NOTES");
    for (let i = 0; i < report.notes.length; i++) {
      safeY(doc, 26);
      const note = report.notes[i];
      const ny = doc.y;
      if (i % 2 === 0) doc.rect(margin, ny, contentW, 20).fill("#fafaf9");
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ACCENT)
         .text((i + 1) + ".", margin + 5, ny + 3);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(note, margin + 20, ny + 3, { width: contentW - 22, lineGap: 2 });
      doc.moveDown(0.5);
    }
  }
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error:"Method not allowed" });
  try {
    const { type, optimizedText, coverLetter, report, photo, candidateName } = req.body;

    if (!type) return res.status(400).json({ error: "Missing type" });

    // Simple doc — no bufferPages, no flushPages, just clean single-page-at-a-time
    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });

    // Stream directly to response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ATSCheckPro-${type}.pdf"`);
    doc.pipe(res);

    if      (type === "resume") buildResumePDF(doc, optimizedText, photo, candidateName);
    else if (type === "cover")  buildCoverPDF(doc, coverLetter, candidateName);
    else if (type === "report") buildReportPDF(doc, report, candidateName);

    // Add footer on last (current) page
    addFooter(doc);

    doc.end();

  } catch(e) {
    console.error("Download error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
}
