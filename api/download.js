import PDFDocument from "pdfkit";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    maxDuration: 30
  }
};

// Manually parse JSON body from raw stream — works reliably on Vercel
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

const ACCENT  = "#16a34a";
const ACCENT2 = "#15803d";
const TEXT    = "#1c1917";
const MUTED   = "#78716c";
const LIGHT   = "#f0fdf4";
const BORDER  = "#d4cbbf";

function safeY(doc, needed = 40) {
  if (doc.y + needed > doc.page.height - 55) doc.addPage();
}

function addFooter(doc) {
  const pageW = doc.page.width;
  safeY(doc, 20);
  doc.moveDown(0.6);
  doc.moveTo(50, doc.y).lineTo(pageW - 50, doc.y)
     .strokeColor(BORDER).lineWidth(0.4).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#b0a89e")
     .text("ATSCheckPro  ·  AI Resume Service  ·  Confidential",
           50, doc.y + 5, { align:"center", width: pageW - 100 });
}

function cleanLine(raw) {
  return raw
    .replace(/^[\s]*[%][¸·,.\-•►▸*○●◆◦‣⁃→\s]+/, "")
    .replace(/^[\s]*[•►▸◦‣⁃○●◆→]+\s*/, "")
    .replace(/^[\s]*[-–—]\s+/, "")
    .trim();
}

function isBulletLine(raw) {
  return /^[\s]*[%¸►•\-–—▸*○●◆◦‣⁃→]/.test(raw)
    || /^[\s]*%[\s¸·,.\-]/.test(raw);
}

// ─── RESUME ────────────────────────────────────────────────────────────────
function buildResumePDF(doc, optimizedText, photo, candidateName) {
  const lines = (optimizedText || "").split("\n");
  const pageW = doc.page.width;
  const M     = 50;
  const W     = pageW - M * 2;
  const name  = lines[0]?.trim() || candidateName || "";

  let contactParts = [];
  let bodyStart = 1;
  for (let i = 1; i < Math.min(6, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) { bodyStart = i + 1; break; }
    if (l.includes("@") || l.includes("|") || l.match(/\+?\d[\d\s\-]{6,}/)
        || l.toLowerCase().includes("linkedin") || l.toLowerCase().includes("github")
        || l.toLowerCase().includes("http")) {
      contactParts.push(...l.split("|").map(x => x.trim()).filter(Boolean));
      bodyStart = i + 1;
    } else { bodyStart = i; break; }
  }
  const body = lines.slice(bodyStart);

  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  const hasPhoto = !!photo;
  const nameW = hasPhoto ? W - 88 : W;
  const phX = pageW - M - 70, phY = 18;

  if (hasPhoto) {
    try {
      const imgData = photo.replace(/^data:image\/\w+;base64,/, "");
      doc.save();
      doc.roundedRect(phX, phY, 66, 66, 5).clip();
      doc.image(Buffer.from(imgData, "base64"), phX, phY, { width:66, height:66 });
      doc.restore();
      doc.roundedRect(phX, phY, 66, 66, 5).strokeColor(ACCENT).lineWidth(1.5).stroke();
    } catch(e) {}
  }

  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT)
     .text(name, M, 18, { width: nameW });

  let contactY = 44;
  if (contactParts.length) {
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("   ·   "), M, contactY, { width: nameW, lineGap:2 });
    contactY = doc.y + 4;
  }

  const divY = hasPhoto ? Math.max(contactY + 4, phY + 66 + 10) : contactY + 4;
  doc.moveTo(M, divY).lineTo(pageW - M, divY)
     .strokeColor(ACCENT).lineWidth(1.8).stroke();
  doc.y = divY + 10;

  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.2); continue; }

    const bullet = isBulletLine(raw);
    const t      = bullet ? cleanLine(raw) : raw.trim();
    if (!t) continue;

    if (!bullet && t === t.toUpperCase() && t.length > 2 && t.length < 55 && /[A-Z]/.test(t)) {
      safeY(doc, 30);
      doc.moveDown(0.35);
      const sy = doc.y;
      doc.rect(M, sy, W, 15).fill(LIGHT);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2)
         .text(t, M + 5, sy + 3.5, { characterSpacing:1.2 });
      doc.y = sy + 19;
      continue;
    }

    if (bullet) {
      safeY(doc, 18);
      const by = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("▸", M + 2, by + 1.5);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(t, M + 14, by, { width: W - 14, lineGap:1.5 });
      doc.moveDown(0.1);
      continue;
    }

    if ((t.includes(" - ") || t.includes(" – ") || t.includes(" | "))
        && t.length < 100 && !t.includes("@")) {
      safeY(doc, 18);
      doc.moveDown(0.15);
      const parts = t.split(/\s[–\-|]\s/);
      if (parts.length > 1) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(parts[0], { continued:true });
        doc.fontSize(9).font("Helvetica").fillColor(MUTED).text("  ·  " + parts.slice(1).join(" · "));
      } else {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(t);
      }
      doc.moveDown(0.08);
      continue;
    }

    safeY(doc, 14);
    doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, { lineGap:1.5 });
    doc.moveDown(0.06);
  }

  addFooter(doc);
}

// ─── COVER LETTER ──────────────────────────────────────────────────────────
function buildCoverPDF(doc, coverLetter, candidateName) {
  const pageW = doc.page.width;
  const M     = 72;
  const W     = pageW - M * 2;
  const nameN = (candidateName || "").trim();
  const nameU = nameN.toUpperCase();

  doc.rect(0, 0, pageW, 5).fill(ACCENT);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT).text(nameN || "Applicant", M, 22);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT)
     .text("ATSCheckPro", pageW - M - 80, 24, { width:80, align:"right" });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
     .text("AI Resume Service", pageW - M - 80, 36, { width:80, align:"right" });
  doc.moveTo(M, 50).lineTo(pageW - M, 50).strokeColor(BORDER).lineWidth(0.5).stroke();

  const today = new Date().toLocaleDateString("en-US",
    { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9.5).font("Helvetica").fillColor(MUTED)
     .text(today, M, 62, { width:W, align:"right" });
  doc.y = 88;

  const cleanLines = (coverLetter || "").split("\n").filter(ln => {
    const t = ln.trim();
    if (!t) return true;
    if (nameU && t.toUpperCase() === nameU) return false;
    if (/^\[.*\]$/.test(t)) return false;
    if (/[|]\s*[\w.+%-]+@/.test(t)) return false;
    if (/^[\w\s,.-]+\s+[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i.test(t) && !t.startsWith("Dear")) return false;
    return true;
  });

  let paras = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
               .split(/\n{2,}/).filter(p => p.trim());
  if (paras.length <= 2) paras = cleanLines.join("\n").split("\n").filter(p => p.trim());

  let closingDone = false;
  for (const para of paras) {
    const p = para.trim().replace(/\n/g, " ");
    if (!p || closingDone) continue;

    if (/^(Dear|To Whom|To the)/i.test(p)) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(p, M, doc.y, { width:W });
      doc.moveDown(1);
      continue;
    }

    if (/^(Sincerely|Best regards|Warm regards|Respectfully|Thank you|Yours)/i.test(p)) {
      closingDone = true;
      safeY(doc, 70);
      doc.moveDown(0.8);
      const esc  = nameN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const word = p.replace(new RegExp(",?\\s*" + esc + ".*$", "i"), "").trim() || p;
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
         .text(word.endsWith(",") ? word : word + ",", M, doc.y, { width:W });
      doc.moveDown(2.5);
      doc.moveTo(M, doc.y).lineTo(M + 170, doc.y).strokeColor(BORDER).lineWidth(0.8).stroke();
      doc.moveDown(0.4);
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(nameN, M);
      continue;
    }

    safeY(doc, 38);
    doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
       .text(p, M, doc.y, { width:W, align:"justify", lineGap:4 });
    doc.moveDown(0.9);
  }

  addFooter(doc);
}

// ─── ATS REPORT ────────────────────────────────────────────────────────────
function buildReportPDF(doc, report, candidateName) {
  const score      = report?.score || 0;
  const scoreAfter = report?.scoreAfter || Math.min(score + 15, 95);
  const improvement = scoreAfter - score;
  const pageW      = doc.page.width;
  const M          = 50;
  const W          = pageW - M * 2;
  const sColor     = score >= 75 ? ACCENT : score >= 60 ? "#d97706" : "#dc2626";

  const STOP = new Set([
    // True grammar/filler words ONLY — never filter skill or tech terms
    "and","or","the","with","for","to","of","in","on","a","an","is","are","was",
    "will","be","been","have","has","this","that","you","your","we","our","their",
    "they","it","its","by","as","at","from","about","which","who","when","where",
    "not","but","also","just","more","any","all","such","both","each","than","then",
    "so","yet","nor","too","very","here","there","what","how","do","did","get","got",
    "let","may","can","would","could","should","must","need","please","want","apply"
  ]);

  const cleanKW = (report?.keywords || [])
    .filter(k => k && k.length > 2 && !STOP.has(k.toLowerCase()) && /[a-zA-Z]/.test(k));

  doc.rect(0, 0, pageW, 5).fill(ACCENT);
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT).text("ATS Resume Report", M, 20);
  if (candidateName) {
    doc.fontSize(10).font("Helvetica").fillColor(MUTED)
       .text("Prepared for: ", M, 46, { continued:true });
    doc.font("Helvetica-Bold").fillColor(TEXT).text(candidateName);
  }
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
     .text(new Date().toLocaleDateString("en-US",
       { year:"numeric", month:"long", day:"numeric" }), M, candidateName ? 60 : 46);
  const divY = candidateName ? 76 : 62;
  doc.moveTo(M, divY).lineTo(pageW - M, divY).strokeColor(ACCENT).lineWidth(1.5).stroke();
  doc.y = divY + 12;

  const bW = (W - 16) / 3;
  const bY = doc.y;
  [
    { lbl:"BEFORE",      val: score+"/100",
      sub: score>=75?"Strong":score>=60?"Moderate":"Weak", c:sColor, bg:"#fafaf9", br:BORDER },
    { lbl:"AFTER OPT.",  val: scoreAfter+"/100",
      sub:"Projected",   c:ACCENT, bg:LIGHT, br:ACCENT },
    { lbl:"IMPROVEMENT", val: "+"+improvement,
      sub:"points",      c:"#1d4ed8", bg:"#eff6ff", br:"#bfdbfe" }
  ].forEach((b, i) => {
    const bx = M + i * (bW + 8);
    doc.rect(bx, bY, bW, 54).fill(b.bg);
    doc.rect(bx, bY, bW, 54).stroke(b.br).lineWidth(0.7);
    doc.rect(bx, bY, bW, 3).fill(b.c);
    doc.fontSize(6).font("Helvetica-Bold").fillColor(MUTED)
       .text(b.lbl, bx, bY + 9, { width:bW, align:"center", characterSpacing:0.5 });
    doc.fontSize(17).font("Helvetica-Bold").fillColor(b.c)
       .text(b.val, bx, bY + 19, { width:bW, align:"center" });
    doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
       .text(b.sub, bx, bY + 42, { width:bW, align:"center" });
  });
  doc.y = bY + 62;

  const strength = score>=75?"Strong ATS Match":score>=60?"Moderate Match":"Needs Improvement";
  doc.rect(M, doc.y, W, 19).fill(score>=75?LIGHT:score>=60?"#fffbeb":"#fef2f2");
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
     .text("Overall Assessment:", M+8, doc.y+5, { continued:true });
  doc.font("Helvetica-Bold").fillColor(sColor).text("  "+strength);
  doc.y += 24;

  function sec(title) {
    safeY(doc, 45);
    doc.moveDown(0.3);
    const sy = doc.y;
    doc.rect(M, sy, W, 15).fill(LIGHT);
    doc.moveTo(M, sy).lineTo(M, sy+15).strokeColor(ACCENT).lineWidth(2.5).stroke();
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2)
       .text(title, M+9, sy+4, { characterSpacing:0.7 });
    doc.y = sy + 20;
  }

  if (report?.impression?.length) {
    sec("RECRUITER IMPRESSION");
    for (const item of report.impression) {
      safeY(doc, 20);
      const iy = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("→", M+4, iy+1);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(item, M+18, iy, { width:W-18, lineGap:2 });
      doc.moveDown(0.3);
    }
  }

  if (cleanKW.length) {
    sec("MISSING KEYWORDS — ADD TO YOUR RESUME");
    let kx = M + 4, ky = doc.y;
    const tH = 14;
    for (const kw of cleanKW) {
      const tw = doc.widthOfString(kw, { fontSize:8 }) + 14;
      if (kx + tw > pageW - M) { kx = M + 4; ky += tH + 5; }
      if (ky + tH > doc.page.height - 60) { doc.addPage(); ky = 50; kx = M + 4; }
      doc.rect(kx, ky, tw, tH).fill("#fee2e2");
      doc.rect(kx, ky, tw, tH).stroke("#fca5a5").lineWidth(0.5);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#991b1b").text(kw, kx+7, ky+3);
      kx += tw + 5;
    }
    doc.y = ky + tH + 10;
  }

  if (report?.notes?.length) {
    sec("IMPROVEMENT NOTES");
    for (let i = 0; i < report.notes.length; i++) {
      safeY(doc, 24);
      const ny = doc.y;
      if (i%2===0) doc.rect(M, ny, W, 20).fill("#fafaf9");
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ACCENT)
         .text((i+1)+".", M+5, ny+3);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(report.notes[i], M+20, ny+3, { width:W-22, lineGap:2 });
      doc.moveDown(0.45);
    }
  }

  addFooter(doc);
}

// ─── HANDLER ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error:"Method not allowed" });
  try {
    const body = await parseBody(req);
    const { type, optimizedText, coverLetter, report, photo, candidateName } = body;
    if (!type) {
      return res.status(400).json({ error:"Missing type" });
    }

    const doc = new PDFDocument({ margin:50, size:"A4", autoFirstPage:true });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));

    if      (type==="resume") buildResumePDF(doc, optimizedText, photo, candidateName);
    else if (type==="cover")  buildCoverPDF(doc, coverLetter, candidateName);
    else if (type==="report") buildReportPDF(doc, report, candidateName);

    doc.end();

    await new Promise((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);
    });

    const buffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ATSCheckPro-${type}.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.status(200).send(buffer);

  } catch(e) {
    console.error("Download error:", e);
    if (!res.headersSent) res.status(500).json({ error:e.message });
  }
}
