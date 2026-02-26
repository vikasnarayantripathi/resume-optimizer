import PDFDocument from "pdfkit";

export const config = {
  api: { bodyParser: false, responseLimit: false, maxDuration: 30 }
};

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
const DARK    = "#1c1917";

function nukeArtifacts(text) {
  if (!text) return text;
  return text.split("\n").map(line => {
    const t = line.trimStart();
    if (!t) return line;
    const code = t.charCodeAt(0);
    if (code === 0x25) return "- " + t.slice(1).replace(/^[\u00b8\u00b7,.\s]+/, "").trim();
    if (code === 0x00B8) return "- " + t.slice(1).trimStart();
    if ([0x2022,0x2023,0x25B8,0x25BA,0x25CF,0x25C6,0x2043,0x2192,0x25B6].includes(code)) return "- " + t.slice(1).trimStart();
    return line.replace(/%[\u00b8\u00b7,]/g, "");
  }).join("\n");
}

function nukeItem(str) {
  if (!str) return str;
  let s = str.trim();
  s = s.replace(/^[\s]*%[\u00b8\u00b7,.\s]+/, "");
  s = s.replace(/^[\s]*[%\u00b8\u25BA\u2022\u25B8\u25CF\u25C6\u2043\u2192\u25B6\-\u2013]+\s+/, "");
  s = s.replace(/%[\u00b8\u00b7,]/g, "");
  return s.trim();
}

function safeY(doc, needed = 40) {
  if (doc.y + needed > doc.page.height - 55) doc.addPage();
}

function addFooter(doc, label) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const fy = pageH - 30;
  doc.fontSize(7.5).font("Helvetica").fillColor("#b0a89e")
     .text(`ATSCheckPro  ·  ${label || "Resume"}  ·  Confidential`, 50, fy, { align: "center", width: pageW - 100 });
}

function isBulletLine(raw) {
  const s = raw.trimStart();
  if (!s) return false;
  const c = s.charCodeAt(0);
  if (c === 0x25 || c === 0xB8) return true;
  if ([0x2022,0x2023,0x25B8,0x25BA,0x25CF,0x25C6,0x2043,0x2192].includes(c)) return true;
  if ((c === 0x2A || c === 0x2D || c === 0x2013 || c === 0x2014) && s[1] === " ") return true;
  return false;
}

function cleanLine(raw) {
  let s = raw.trimStart();
  while (s.length > 0) {
    const c = s.charCodeAt(0);
    if (c === 0x25) { s = s.slice(1).replace(/^[\u00b8\u00b7,.\s]+/, "").trimStart(); continue; }
    if (c === 0xB8) { s = s.slice(1).trimStart(); continue; }
    if ([0x2022,0x2023,0x25B8,0x25BA,0x25CF,0x25C6,0x2043,0x2192].includes(c)) { s = s.slice(1).trimStart(); continue; }
    if ((c === 0x2D || c === 0x2013 || c === 0x2014) && s[1] === " ") { s = s.slice(2).trimStart(); continue; }
    if (c === 0x2A && s[1] === " ") { s = s.slice(2).trimStart(); continue; }
    break;
  }
  return s.trim();
}

// ── CLASSIC ATS RESUME PDF ────────────────────────────
function buildClassicResumePDF(doc, optimizedText, photo, candidateName, professionalSummary, coreCompetencies, technicalSkills) {
  const lines = (optimizedText || "").split("\n");
  const pageW = doc.page.width;
  const M = 50, W = pageW - M * 2;
  const name = (lines[0] || "").trim() || candidateName || "";

  let contactParts = [], bodyStart = 1;
  for (let i = 1; i < Math.min(6, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) { bodyStart = i + 1; break; }
    if (l.includes("@") || l.includes("|") || l.match(/\+?\d[\d\s-]{6,}/)
        || l.toLowerCase().includes("linkedin") || l.toLowerCase().includes("github")) {
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
      doc.image(Buffer.from(imgData, "base64"), phX, phY, { width: 66, height: 66 });
      doc.restore();
      doc.roundedRect(phX, phY, 66, 66, 5).strokeColor(ACCENT).lineWidth(1.5).stroke();
    } catch(e) {}
  }

  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT).text(name, M, 18, { width: nameW });
  let contactY = 44;
  if (contactParts.length) {
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("   ·   "), M, contactY, { width: nameW, lineGap: 2 });
    contactY = doc.y + 4;
  }
  const divY = hasPhoto ? Math.max(contactY + 4, phY + 66 + 10) : contactY + 4;
  doc.moveTo(M, divY).lineTo(pageW - M, divY).strokeColor(ACCENT).lineWidth(1.8).stroke();
  doc.y = divY + 10;

  // Professional Summary if available
  if (professionalSummary) {
    doc.rect(M, doc.y, W, 3).fill(LIGHT);
    doc.y += 3;
    doc.fontSize(9).font("Helvetica").fillColor("#374151")
       .text(professionalSummary, M, doc.y, { width: W, lineGap: 3, align: "justify" });
    doc.moveDown(0.8);
    doc.moveTo(M, doc.y).lineTo(pageW - M, doc.y).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveDown(0.5);
  }

  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.2); continue; }
    const bullet = isBulletLine(raw);
    const t = bullet ? cleanLine(raw) : raw;
    if (!t) continue;

    if (!bullet && t === t.toUpperCase() && t.length > 2 && t.length < 55 && /[A-Z]/.test(t) && !/^\d/.test(t)) {
      safeY(doc, 30);
      doc.moveDown(0.35);
      const sy = doc.y;
      doc.rect(M, sy, W, 15).fill(LIGHT);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2).text(t, M + 5, sy + 3.5, { characterSpacing: 1.2 });
      doc.y = sy + 19;
      continue;
    }

    if (bullet) {
      safeY(doc, 18);
      const by = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("-", M + 2, by + 1.5);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, M + 14, by, { width: W - 14, lineGap: 1.5 });
      doc.moveDown(0.1);
      continue;
    }

    if ((t.includes(" - ") || t.includes(" – ") || t.includes(" | ")) && t.length < 100 && !t.includes("@")) {
      safeY(doc, 18);
      doc.moveDown(0.15);
      const parts = t.split(/\s[–\-|]\s/);
      if (parts.length > 1) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(parts[0], { continued: true });
        doc.fontSize(9).font("Helvetica").fillColor(MUTED).text("  ·  " + parts.slice(1).join(" · "));
      } else {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(t);
      }
      doc.moveDown(0.08);
      continue;
    }

    safeY(doc, 14);
    doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, { lineGap: 1.5 });
    doc.moveDown(0.06);
  }
  addFooter(doc, "Classic ATS Resume");
}

// ── MODERN VISUAL RESUME PDF ─────────────────────────
function buildModernResumePDF(doc, optimizedText, photo, candidateName, professionalSummary, coreCompetencies, technicalSkills) {
  const lines = (optimizedText || "").split("\n");
  const pageW = doc.page.width;
  const M = 50, W = pageW - M * 2;
  const name = (lines[0] || "").trim() || candidateName || "";

  let contactParts = [], bodyStart = 1;
  for (let i = 1; i < Math.min(6, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) { bodyStart = i + 1; break; }
    if (l.includes("@") || l.includes("|") || l.match(/\+?\d[\d\s-]{6,}/)
        || l.toLowerCase().includes("linkedin") || l.toLowerCase().includes("github")) {
      contactParts.push(...l.split("|").map(x => x.trim()).filter(Boolean));
      bodyStart = i + 1;
    } else { bodyStart = i; break; }
  }
  const body = lines.slice(bodyStart);

  // ── Header: green accent bar + name ──
  doc.rect(0, 0, pageW, 4).fill(ACCENT);

  const hasPhoto = !!photo;
  const nameW = hasPhoto ? W - 80 : W;
  const phX = pageW - M - 62, phY = 14;

  // Photo circle
  if (hasPhoto) {
    try {
      const imgData = photo.replace(/^data:image\/\w+;base64,/, "");
      doc.save();
      doc.circle(phX + 30, phY + 30, 30).clip();
      doc.image(Buffer.from(imgData, "base64"), phX, phY, { width: 60, height: 60 });
      doc.restore();
      doc.circle(phX + 30, phY + 30, 30).strokeColor(ACCENT).lineWidth(2).stroke();
    } catch(e) {}
  }

  // Name in dark color
  doc.fontSize(22).font("Helvetica-Bold").fillColor("#1c1917").text(name, M, 16, { width: nameW });

  // Contact line
  let contactY = 44;
  if (contactParts.length) {
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("  ·  "), M, contactY, { width: nameW });
    contactY = doc.y + 4;
  }

  const divY = hasPhoto ? Math.max(contactY + 4, phY + 64) : contactY + 4;
  // Green accent underline
  doc.rect(M, divY, W, 2).fill(ACCENT);
  doc.y = divY + 12;

  // Professional Summary
  if (professionalSummary) {
    const sy = doc.y;
    doc.rect(M, sy, 3, 36).fill(ACCENT);
    doc.fontSize(9).font("Helvetica").fillColor("#374151")
       .text(professionalSummary, M + 12, sy + 4, { width: W - 12, lineGap: 3 });
    doc.y = Math.max(doc.y, sy + 36) + 10;
  }

  // Core Competencies
  if (coreCompetencies?.length) {
    safeY(doc, 45);
    const secY = doc.y;
    doc.rect(M, secY, W, 14).fill(LIGHT);
    doc.rect(M, secY, 3, 14).fill(ACCENT);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(ACCENT2)
       .text("CORE COMPETENCIES", M + 8, secY + 4, { characterSpacing: 1.2 });
    doc.y = secY + 19;
    let cx = M, cy = doc.y;
    for (const skill of coreCompetencies) {
      const sw = doc.widthOfString(skill, { fontSize: 7.5 }) + 12;
      if (cx + sw > pageW - M) { cx = M; cy += 17; }
      doc.rect(cx, cy, sw, 13).fill("#e7f5ea");
      doc.rect(cx, cy, sw, 13).stroke(ACCENT).lineWidth(0.5);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2).text(skill, cx + 6, cy + 3);
      cx += sw + 4;
    }
    doc.y = cy + 19;
  }

  // Technical Skills
  if (technicalSkills?.length) {
    safeY(doc, 40);
    const secY = doc.y;
    doc.rect(M, secY, W, 14).fill("#eff6ff");
    doc.rect(M, secY, 3, 14).fill("#1d4ed8");
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#1d4ed8")
       .text("TECHNICAL SKILLS", M + 8, secY + 4, { characterSpacing: 1.2 });
    doc.y = secY + 19;
    let cx = M, cy = doc.y;
    for (const skill of technicalSkills) {
      const sw = doc.widthOfString(skill, { fontSize: 7.5 }) + 12;
      if (cx + sw > pageW - M) { cx = M; cy += 17; }
      doc.rect(cx, cy, sw, 13).fill("#dbeafe");
      doc.rect(cx, cy, sw, 13).stroke("#93c5fd").lineWidth(0.5);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#1d4ed8").text(skill, cx + 6, cy + 3);
      cx += sw + 4;
    }
    doc.y = cy + 19;
  }

  // Body content
  const skipSections = new Set(["CORE COMPETENCIES","TECHNICAL SKILLS","SOFT SKILLS"]);
  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.15); continue; }
    const bullet = isBulletLine(raw);
    const t = bullet ? cleanLine(raw) : raw;
    if (!t) continue;

    if (!bullet && t === t.toUpperCase() && t.length > 2 && t.length < 55 && /[A-Z]/.test(t) && !/^\d/.test(t)) {
      if (skipSections.has(t)) continue;
      safeY(doc, 28);
      doc.moveDown(0.3);
      const sy = doc.y;
      doc.rect(M, sy, W, 14).fill(LIGHT);
      doc.rect(M, sy, 3, 14).fill(ACCENT);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2).text(t, M + 8, sy + 3.5, { characterSpacing: 1.2 });
      doc.y = sy + 18;
      continue;
    }

    if (bullet) {
      safeY(doc, 16);
      const by = doc.y;
      doc.rect(M + 2, by + 4, 4, 4).fill(ACCENT);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, M + 14, by, { width: W - 14, lineGap: 1.5 });
      doc.moveDown(0.08);
      continue;
    }

    if ((t.includes(" - ") || t.includes(" – ") || t.includes(" | ")) && t.length < 100 && !t.includes("@")) {
      safeY(doc, 18);
      doc.moveDown(0.15);
      const parts = t.split(/\s[–\-|]\s/);
      if (parts.length > 1) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1c1917").text(parts[0], M, doc.y, { continued: true });
        doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("  ·  " + parts.slice(1).join(" · "));
      } else {
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#1c1917").text(t);
      }
      doc.moveDown(0.08);
      continue;
    }

    safeY(doc, 14);
    doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, { lineGap: 1.5 });
    doc.moveDown(0.05);
  }
  addFooter(doc, "Modern Visual Resume");
}

// ── COVER LETTER PDF ──────────────────────────────────
function buildCoverPDF(doc, coverLetter, candidateName) {
  const pageW = doc.page.width;
  const M = 72, W = pageW - M * 2;
  const nameN = (candidateName || "").trim();

  doc.rect(0, 0, pageW, 5).fill(ACCENT);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(TEXT).text(nameN || "Applicant", M, 22);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT).text("ATSCheckPro", pageW - M - 80, 24, { width: 80, align: "right" });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED).text("AI Resume Service", pageW - M - 80, 36, { width: 80, align: "right" });
  doc.moveTo(M, 50).lineTo(pageW - M, 50).strokeColor(BORDER).lineWidth(0.5).stroke();
  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9.5).font("Helvetica").fillColor(MUTED).text(today, M, 62, { width: W, align: "right" });
  doc.y = 88;

  const nameU = nameN.toUpperCase();
  const cleanLines = (coverLetter || "").split("\n").filter(ln => {
    const t = ln.trim();
    if (!t) return true;
    if (nameU && t.toUpperCase() === nameU) return false;
    if (/^\[.*\]$/.test(t)) return false;
    if (/[|]\s*[\w.+%-]+@/.test(t)) return false;
    if (/^[\w\s,.-]+\s+[\w.+%-]+@[\w.-]+\.[a-z]{2,}/i.test(t) && !t.startsWith("Dear")) return false;
    return true;
  });

  let paras = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim().split(/\n{2,}/).filter(p => p.trim());
  if (paras.length <= 2) paras = cleanLines.join("\n").split("\n").filter(p => p.trim());

  let closingDone = false;
  for (const para of paras) {
    const p = para.trim().replace(/\n/g, " ");
    if (!p || closingDone) continue;
    if (/^(Dear|To Whom|To the)/i.test(p)) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(p, M, doc.y, { width: W });
      doc.moveDown(1);
      continue;
    }
    if (/^(Sincerely|Best regards|Warm regards|Respectfully|Thank you|Yours)/i.test(p)) {
      closingDone = true;
      safeY(doc, 70);
      doc.moveDown(0.8);
      const esc = nameN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const word = p.replace(new RegExp(",?\\s*" + esc + ".*$", "i"), "").trim() || p;
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT).text(word.endsWith(",") ? word : word + ",", M, doc.y, { width: W });
      doc.moveDown(2.5);
      doc.moveTo(M, doc.y).lineTo(M + 170, doc.y).strokeColor(BORDER).lineWidth(0.8).stroke();
      doc.moveDown(0.4);
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT).text(nameN, M);
      continue;
    }
    safeY(doc, 38);
    doc.fontSize(10.5).font("Helvetica").fillColor(TEXT).text(p, M, doc.y, { width: W, align: "justify", lineGap: 4 });
    doc.moveDown(0.9);
  }
  addFooter(doc, "Cover Letter");
}

// ── REPORT PDF (PREMIUM) ──────────────────────────────
function buildReportPDF(doc, report, candidateName) {
  const score = report?.score || 0;
  const scoreAfter = report?.scoreAfter || Math.min(score + 15, 95);
  const improvement = scoreAfter - score;
  const pageW = doc.page.width;
  const M = 50, W = pageW - M * 2;
  const sColor = score >= 75 ? ACCENT : score >= 60 ? "#d97706" : "#dc2626";

  const STOP = new Set(["and","or","the","with","for","to","of","in","on","a","an","is","are","was","will","be","been","have","has","this","that","you","your","we","our","their","they","it","its","by","as","at","from","about","which","who","when","where","not","but","also","just","more","any","all","such","both","each","than","then","so","yet","nor","too","very","here","there","what","how","do","did","get","got","let","may","can","would","could","should","must","need","please","want","apply"]);
  const cleanKW = (report?.keywords || []).filter(k => k && k.length > 2 && !STOP.has(k.toLowerCase()) && /[a-zA-Z]/.test(k));

  // Header
  doc.rect(0, 0, pageW, 5).fill(ACCENT);
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT).text("ATS Resume Report", M, 20);
  if (candidateName) {
    doc.fontSize(10).font("Helvetica").fillColor(MUTED).text("Prepared for: ", M, 46, { continued: true });
    doc.font("Helvetica-Bold").fillColor(TEXT).text(candidateName);
  }
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
     .text(new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }), M, candidateName ? 60 : 46);
  const divY = candidateName ? 76 : 62;
  doc.moveTo(M, divY).lineTo(pageW - M, divY).strokeColor(ACCENT).lineWidth(1.5).stroke();
  doc.y = divY + 12;

  // Score boxes
  const bW = (W - 16) / 3;
  const bY = doc.y;
  [
    { lbl:"BEFORE",      val:score+"/100",      sub:score>=75?"Strong":score>=60?"Moderate":"Weak", c:sColor,    bg:"#fafaf9", br:BORDER     },
    { lbl:"AFTER OPT.",  val:scoreAfter+"/100", sub:"Projected",   c:ACCENT,    bg:LIGHT,    br:ACCENT     },
    { lbl:"IMPROVEMENT", val:"+"+improvement,   sub:"points",      c:"#1d4ed8", bg:"#eff6ff", br:"#bfdbfe" }
  ].forEach((b, i) => {
    const bx = M + i * (bW + 8);
    doc.rect(bx, bY, bW, 54).fill(b.bg);
    doc.rect(bx, bY, bW, 54).stroke(b.br).lineWidth(0.7);
    doc.rect(bx, bY, bW, 3).fill(b.c);
    doc.fontSize(6).font("Helvetica-Bold").fillColor(MUTED).text(b.lbl, bx, bY+9, { width:bW, align:"center", characterSpacing:0.5 });
    doc.fontSize(17).font("Helvetica-Bold").fillColor(b.c).text(b.val, bx, bY+19, { width:bW, align:"center" });
    doc.fontSize(7.5).font("Helvetica").fillColor(MUTED).text(b.sub, bx, bY+42, { width:bW, align:"center" });
  });
  doc.y = bY + 62;

  // Metrics row
  if (report?.interviewProbability || report?.jobFitScore) {
    const mY = doc.y;
    const mW = (W - 8) / 2;
    [
      { lbl:"INTERVIEW PROBABILITY", val:(report?.interviewProbability||"—")+"%", c: (report?.interviewProbability||0)>=70?ACCENT:(report?.interviewProbability||0)>=50?"#d97706":"#dc2626" },
      { lbl:"JOB FIT SCORE",         val:(report?.jobFitScore||"—")+"%",          c: (report?.jobFitScore||0)>=70?ACCENT:(report?.jobFitScore||0)>=50?"#d97706":"#dc2626" }
    ].forEach((m, i) => {
      const mx = M + i * (mW + 8);
      doc.rect(mx, mY, mW, 38).fill("#fafaf9");
      doc.rect(mx, mY, mW, 38).stroke(BORDER).lineWidth(0.5);
      doc.fontSize(6).font("Helvetica-Bold").fillColor(MUTED).text(m.lbl, mx, mY+6, { width:mW, align:"center", characterSpacing:0.5 });
      doc.fontSize(16).font("Helvetica-Bold").fillColor(m.c).text(m.val, mx, mY+16, { width:mW, align:"center" });
    });
    doc.y = mY + 46;

    // Seniority + Benchmark
    if (report?.seniorityAlignment || report?.industryBenchmark) {
      const sY = doc.y;
      doc.rect(M, sY, W, 18).fill(LIGHT);
      let txt = "";
      if (report?.seniorityAlignment) txt += `Seniority: ${report.seniorityAlignment}`;
      if (report?.industryBenchmark) txt += (txt ? "   ·   " : "") + `Benchmark: ${report.industryBenchmark}`;
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ACCENT2).text(txt, M + 8, sY + 5, { width: W - 16 });
      doc.y = sY + 24;
    }
  }

  function sec(title, color) {
    safeY(doc, 45);
    doc.moveDown(0.3);
    const sy = doc.y;
    doc.rect(M, sy, W, 15).fill(color || LIGHT);
    doc.moveTo(M, sy).lineTo(M, sy+15).strokeColor(ACCENT).lineWidth(2.5).stroke();
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2).text(title, M+9, sy+4, { characterSpacing:0.7 });
    doc.y = sy + 20;
  }

  // Quick Wins
  if (report?.quickWins?.length) {
    sec("⚡ QUICK WINS — FIX THESE FIRST");
    for (const item of report.quickWins) {
      safeY(doc, 20);
      const iy = doc.y;
      const txt = nukeItem(item);
      if (!txt) continue;
      doc.rect(M, iy, W, 18).fill("#f0fdf4");
      doc.rect(M, iy, 3, 18).fill(ACCENT);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(ACCENT).text("⚡", M+6, iy+4);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(txt, M+20, iy+4, { width:W-24, lineGap:2 });
      doc.y = iy + 22;
    }
  }

  // Red Flags
  if (report?.redFlags?.length) {
    sec("🚩 RED FLAGS FOUND");
    for (const item of report.redFlags) {
      safeY(doc, 20);
      const iy = doc.y;
      const txt = nukeItem(item);
      if (!txt) continue;
      doc.rect(M, iy, W, 18).fill("#fef2f2");
      doc.rect(M, iy, 3, 18).fill("#dc2626");
      doc.fontSize(9.5).font("Helvetica").fillColor("#991b1b").text(txt, M+10, iy+4, { width:W-14, lineGap:2 });
      doc.y = iy + 22;
    }
  }

  // Core Competencies
  if (report?.coreCompetencies?.length) {
    sec("CORE COMPETENCIES");
    let kx = M+4, ky = doc.y;
    for (const skill of report.coreCompetencies) {
      const tw = doc.widthOfString(skill, { fontSize:8 }) + 14;
      if (kx + tw > pageW - M) { kx = M+4; ky += 18; }
      if (ky + 14 > doc.page.height - 60) { doc.addPage(); ky = 50; kx = M+4; }
      doc.rect(kx, ky, tw, 14).fill(DARK);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#f5f2ee").text(skill, kx+7, ky+3);
      kx += tw+5;
    }
    doc.y = ky + 22;
  }

  // Salary Impact Keywords
  if (report?.salaryImpactKeywords?.length) {
    sec("💰 SALARY-IMPACT KEYWORDS TO ADD");
    let kx = M+4, ky = doc.y;
    for (const kw of report.salaryImpactKeywords) {
      const tw = doc.widthOfString(kw, { fontSize:8 }) + 14;
      if (kx + tw > pageW - M) { kx = M+4; ky += 18; }
      doc.rect(kx, ky, tw, 14).fill("#fffbeb");
      doc.rect(kx, ky, tw, 14).stroke("#fde68a").lineWidth(0.5);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#92400e").text("💰 " + kw, kx+7, ky+3);
      kx += tw+5;
    }
    doc.y = ky + 22;
  }

  // Missing Keywords
  if (cleanKW.length) {
    sec("MISSING KEYWORDS — ADD TO YOUR RESUME");
    let kx = M+4, ky = doc.y;
    for (const kw of cleanKW) {
      const tw = doc.widthOfString(kw, { fontSize:8 }) + 14;
      if (kx + tw > pageW - M) { kx = M+4; ky += 18; }
      if (ky + 14 > doc.page.height - 60) { doc.addPage(); ky = 50; kx = M+4; }
      doc.rect(kx, ky, tw, 14).fill("#fee2e2");
      doc.rect(kx, ky, tw, 14).stroke("#fca5a5").lineWidth(0.5);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#991b1b").text(kw, kx+7, ky+3);
      kx += tw+5;
    }
    doc.y = ky + 22;
  }

  // Recruiter Notes
  if (report?.notes?.length) {
    sec("RECRUITER NOTES & IMPROVEMENT TIPS");
    for (let i = 0; i < report.notes.length; i++) {
      safeY(doc, 24);
      const ny = doc.y;
      const noteText = nukeItem(report.notes[i]);
      if (!noteText) continue;
      if (i%2===0) doc.rect(M, ny, W, 20).fill("#fafaf9");
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ACCENT).text((i+1)+".", M+5, ny+5);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(noteText, M+20, ny+5, { width:W-22, lineGap:2 });
      doc.moveDown(0.45);
    }
  }

  addFooter(doc, "ATS Report");
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = await parseBody(req);
    const { type, optimizedText, coverLetter, report, photo, candidateName, format,
            professionalSummary, coreCompetencies, technicalSkills } = body;
    if (!type) return res.status(400).json({ error: "Missing type" });

    const cleanedText  = nukeArtifacts(optimizedText);
    const cleanedCover = nukeArtifacts(coverLetter);

    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));

    if (type === "resume") {
      if (format === "modern") {
        buildModernResumePDF(doc, cleanedText, photo, candidateName, professionalSummary, coreCompetencies, technicalSkills);
      } else {
        buildClassicResumePDF(doc, cleanedText, photo, candidateName, professionalSummary, coreCompetencies, technicalSkills);
      }
    } else if (type === "cover") {
      buildCoverPDF(doc, cleanedCover, candidateName);
    } else if (type === "report") {
      buildReportPDF(doc, report, candidateName);
    }

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
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
}
