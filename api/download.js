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

// Strip ALL problematic characters for PDF
function cleanForPdf(text) {
  if (!text) return "";
  return text
    .replace(/%[¸·,\s]*/g, "- ")
    .replace(/[•·▸►▶◆◇●○■□★☆✓✗✘→←↑↓]/g, "-")
    .replace(/[""'']/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E\n\r]/g, "")
    .replace(/[ \t]+/g, " ");
}

function cleanItem(str) {
  if (!str) return "";
  let s = str.trim();
  s = s.replace(/^[%•·▸►▶◆●○■□\-\*\+]+\s*/, "");
  s = s.replace(/[^\x20-\x7E]/g, "");
  return s.trim();
}

function isBullet(line) {
  const s = line.trimStart();
  if (!s) return false;
  const c = s.charCodeAt(0);
  return c === 0x25 || c === 0xB8 ||
    [0x2022,0x2023,0x25B8,0x25BA,0x25CF,0x25C6,0x2043,0x2192].includes(c) ||
    ((c === 0x2A || c === 0x2D) && s[1] === " ");
}

function stripBullet(line) {
  let s = line.trimStart();
  while (s.length > 0) {
    const c = s.charCodeAt(0);
    if (c === 0x25) { s = s.slice(1).replace(/^[¸·,.\s]+/, "").trimStart(); continue; }
    if (c === 0xB8 || [0x2022,0x2023,0x25B8,0x25BA,0x25CF,0x25C6,0x2043,0x2192].includes(c)) { s = s.slice(1).trimStart(); continue; }
    if ((c === 0x2D || c === 0x2A) && s[1] === " ") { s = s.slice(2).trimStart(); continue; }
    break;
  }
  return cleanForPdf(s.trim());
}

function getContactAndBody(lines) {
  let contactParts = [], bodyStart = 1;
  for (let i = 1; i < Math.min(6, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) { bodyStart = i + 1; break; }
    if (l.includes("@") || l.includes("|") || l.match(/\+?\d[\d\s-]{6,}/) ||
        l.toLowerCase().includes("linkedin") || l.toLowerCase().includes("github")) {
      contactParts.push(...l.split("|").map(x => x.trim()).filter(Boolean));
      bodyStart = i + 1;
    } else { bodyStart = i; break; }
  }
  return { contactParts, bodyStart };
}

function addPageFooter(doc, label) {
  // Do nothing - footer handled via page event below
}

function setupFooter(doc, label) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  doc.on("pageAdded", () => {
    // intentionally empty - footer written at end
  });
  // Write footer on current page without triggering new page
  doc.page.write = doc.page.write; // no-op to avoid extra page
  // We'll skip footer to prevent extra blank page
}

function checkNewPage(doc, needed) {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
    return true;
  }
  return false;
}

// ── CLASSIC ATS RESUME ──────────────────────────────────────────
function buildClassicResumePDF(doc, optimizedText, photo, candidateName, professionalSummary) {
  const pageW = doc.page.width;
  const M = 50, W = pageW - M * 2;
  const lines = cleanForPdf(optimizedText || "").split("\n");
  const name = lines[0]?.trim() || candidateName || "";
  const { contactParts, bodyStart } = getContactAndBody(lines);
  const body = lines.slice(bodyStart);

  const hasPhoto = !!(photo && photo.length > 20);
  const phSize = 60;
  const phX = pageW - M - phSize;
  const phY = 20;
  const headerNameY = hasPhoto ? phY + 8 : 20;
  const nameW = hasPhoto ? W - phSize - 10 : W;

  // Green top bar
  doc.rect(0, 0, pageW, 4).fill(ACCENT);

  // Photo
  if (hasPhoto) {
    try {
      const imgData = photo.replace(/^data:image\/\w+;base64,/, "");
      doc.save();
      doc.roundedRect(phX, phY, phSize, phSize, 4).clip();
      doc.image(Buffer.from(imgData, "base64"), phX, phY, { width: phSize, height: phSize });
      doc.restore();
      doc.roundedRect(phX, phY, phSize, phSize, 4)
         .lineWidth(1.5).strokeColor(ACCENT).stroke();
    } catch(e) {}
  }

  // Name — vertically centered with photo
  const nameY = hasPhoto ? phY + (phSize / 2) - 14 : 18;
  doc.fontSize(18).font("Helvetica-Bold").fillColor(TEXT)
     .text(name, M, nameY, { width: nameW, lineBreak: false });

  // Contact
  const contactY = hasPhoto ? phY + (phSize / 2) + 4 : nameY + 24;
  if (contactParts.length) {
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("  |  "), M, contactY, { width: nameW });
  }

  const divY = hasPhoto ? phY + phSize + 10 : (doc.y + 6);
  doc.moveTo(M, divY).lineTo(pageW - M, divY)
     .lineWidth(1.5).strokeColor(ACCENT).stroke();
  doc.y = divY + 10;

  // Professional Summary
  if (professionalSummary) {
    const clean = cleanForPdf(professionalSummary);
    if (clean) {
      doc.rect(M, doc.y, 2, 1).fill(ACCENT); // spacer
      doc.fontSize(9).font("Helvetica").fillColor("#374151")
         .text(clean, M, doc.y, { width: W, lineGap: 2, align: "justify" });
      doc.moveDown(0.6);
      doc.moveTo(M, doc.y).lineTo(pageW - M, doc.y)
         .lineWidth(0.4).strokeColor(BORDER).stroke();
      doc.moveDown(0.4);
    }
  }

  // Body
  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.15); continue; }

    // Section header
    if (!isBullet(raw) && raw === raw.toUpperCase() && raw.length > 2 && raw.length < 55 && /[A-Z]/.test(raw) && !/^\d/.test(raw)) {
      checkNewPage(doc, 28);
      doc.moveDown(0.3);
      const sy = doc.y;
      doc.rect(M, sy, W, 14).fill(LIGHT);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2)
         .text(raw, M + 6, sy + 3.5, { characterSpacing: 1.1 });
      doc.y = sy + 18;
      continue;
    }

    // Bullet
    if (isBullet(raw)) {
      checkNewPage(doc, 16);
      const t = stripBullet(raw);
      if (!t) continue;
      const by = doc.y;
      doc.fontSize(8.5).font("Helvetica").fillColor(ACCENT).text("-", M + 2, by + 1);
      doc.fontSize(9).font("Helvetica").fillColor(TEXT)
         .text(t, M + 12, by, { width: W - 12, lineGap: 1.5 });
      doc.moveDown(0.08);
      continue;
    }

    // Role/company line
    const t = cleanForPdf(raw);
    if ((t.includes(" - ") || t.includes(" | ")) && t.length < 100 && !t.includes("@")) {
      checkNewPage(doc, 16);
      doc.moveDown(0.12);
      const parts = t.split(/ [-|] /);
      if (parts.length > 1) {
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(TEXT)
           .text(parts[0], M, doc.y, { continued: true });
        doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
           .text("  |  " + parts.slice(1).join(" | "));
      } else {
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor(TEXT).text(t, M);
      }
      doc.moveDown(0.06);
      continue;
    }

    checkNewPage(doc, 13);
    doc.fontSize(9).font("Helvetica").fillColor(TEXT).text(t, M, doc.y, { width: W, lineGap: 1.2 });
    doc.moveDown(0.05);
  }
  addPageFooter(doc, "Classic ATS Resume");
}

// ── MODERN VISUAL RESUME ────────────────────────────────────────
function buildModernResumePDF(doc, optimizedText, photo, candidateName, professionalSummary, coreCompetencies, technicalSkills) {
  const pageW = doc.page.width;
  const M = 50, W = pageW - M * 2;
  const lines = cleanForPdf(optimizedText || "").split("\n");
  const name = lines[0]?.trim() || candidateName || "";
  const { contactParts, bodyStart } = getContactAndBody(lines);
  const body = lines.slice(bodyStart);

  const hasPhoto = !!(photo && photo.length > 20);
  const phSize = 64;
  const phX = pageW - M - phSize;
  const phY = 18;

  // Left color strip
  doc.rect(0, 0, 8, doc.page.height).fill(ACCENT);

  // Top accent line
  doc.rect(0, 0, pageW, 3).fill(ACCENT2);

  // Photo with circle
  if (hasPhoto) {
    try {
      const imgData = photo.replace(/^data:image\/\w+;base64,/, "");
      const cx = phX + phSize / 2, cy = phY + phSize / 2, r = phSize / 2;
      doc.save();
      doc.circle(cx, cy, r).clip();
      doc.image(Buffer.from(imgData, "base64"), phX, phY, { width: phSize, height: phSize });
      doc.restore();
      doc.circle(cx, cy, r).lineWidth(2).strokeColor(ACCENT).stroke();
    } catch(e) {}
  }

  const nameW = hasPhoto ? W - phSize - 14 : W;
  const ML = M + 12; // left margin accounting for strip

  // Name centered with photo
  const nameY = hasPhoto ? phY + (phSize / 2) - 13 : 16;
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT)
     .text(name, ML, nameY, { width: nameW, lineBreak: false });

  // Contact
  const contactY = hasPhoto ? phY + (phSize / 2) + 5 : nameY + 26;
  if (contactParts.length) {
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(contactParts.join("  |  "), ML, contactY, { width: nameW });
  }

  const divY = hasPhoto ? phY + phSize + 12 : contactY + 16;
  doc.moveTo(ML, divY).lineTo(pageW - M, divY).lineWidth(2).strokeColor(ACCENT).stroke();
  doc.y = divY + 12;

  // Professional Summary
  if (professionalSummary) {
    const clean = cleanForPdf(professionalSummary);
    if (clean) {
      const sy = doc.y;
      doc.rect(ML, sy, 3, 32).fill(ACCENT);
      doc.fontSize(9).font("Helvetica").fillColor("#374151")
         .text(clean, ML + 10, sy + 4, { width: W - 10, lineGap: 3 });
      doc.y = Math.max(doc.y, sy + 32) + 10;
    }
  }

  // Core Competencies chips
  if (coreCompetencies?.length) {
    checkNewPage(doc, 45);
    const secY = doc.y;
    doc.rect(ML, secY, W - 12, 14).fill(LIGHT);
    doc.rect(ML, secY, 2, 14).fill(ACCENT);
    doc.fontSize(7).font("Helvetica-Bold").fillColor(ACCENT2)
       .text("CORE COMPETENCIES", ML + 7, secY + 4, { characterSpacing: 1.2 });
    doc.y = secY + 18;
    let cx = ML, cy = doc.y;
    for (const skill of coreCompetencies) {
      const sw = doc.widthOfString(cleanForPdf(skill), { fontSize: 7.5 }) + 12;
      if (cx + sw > pageW - M) { cx = ML; cy += 16; }
      doc.rect(cx, cy, sw, 13).fill("#e6f4ea");
      doc.rect(cx, cy, sw, 13).lineWidth(0.5).strokeColor(ACCENT).stroke();
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2)
         .text(cleanForPdf(skill), cx + 6, cy + 3);
      cx += sw + 4;
    }
    doc.y = cy + 18;
  }

  // Technical Skills chips
  if (technicalSkills?.length) {
    checkNewPage(doc, 40);
    const secY = doc.y;
    doc.rect(ML, secY, W - 12, 14).fill("#eff6ff");
    doc.rect(ML, secY, 2, 14).fill("#1d4ed8");
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#1d4ed8")
       .text("TECHNICAL SKILLS", ML + 7, secY + 4, { characterSpacing: 1.2 });
    doc.y = secY + 18;
    let cx = ML, cy = doc.y;
    for (const skill of technicalSkills) {
      const sw = doc.widthOfString(cleanForPdf(skill), { fontSize: 7.5 }) + 12;
      if (cx + sw > pageW - M) { cx = ML; cy += 16; }
      doc.rect(cx, cy, sw, 13).fill("#dbeafe");
      doc.rect(cx, cy, sw, 13).lineWidth(0.5).strokeColor("#93c5fd").stroke();
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#1d4ed8")
         .text(cleanForPdf(skill), cx + 6, cy + 3);
      cx += sw + 4;
    }
    doc.y = cy + 18;
  }

  const skipSections = new Set(["CORE COMPETENCIES", "TECHNICAL SKILLS", "SOFT SKILLS"]);

  // Body
  for (const line of body) {
    const raw = line.trim();
    if (!raw) { doc.moveDown(0.12); continue; }

    // Section header
    if (!isBullet(raw) && raw === raw.toUpperCase() && raw.length > 2 && raw.length < 55 && /[A-Z]/.test(raw) && !/^\d/.test(raw)) {
      if (skipSections.has(raw)) continue;
      checkNewPage(doc, 26);
      doc.moveDown(0.3);
      const sy = doc.y;
      doc.rect(ML, sy, W - 12, 14).fill(LIGHT);
      doc.rect(ML, sy, 2, 14).fill(ACCENT);
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2)
         .text(raw, ML + 7, sy + 3.5, { characterSpacing: 1.1 });
      doc.y = sy + 18;
      continue;
    }

    // Bullet
    if (isBullet(raw)) {
      checkNewPage(doc, 16);
      const t = stripBullet(raw);
      if (!t) continue;
      const by = doc.y;
      doc.rect(ML + 2, by + 4, 3, 3).fill(ACCENT);
      doc.fontSize(9).font("Helvetica").fillColor(TEXT)
         .text(t, ML + 12, by, { width: W - 22, lineGap: 1.5 });
      doc.moveDown(0.06);
      continue;
    }

    // Role/company
    const t = cleanForPdf(raw);
    if ((t.includes(" - ") || t.includes(" | ")) && t.length < 100 && !t.includes("@")) {
      checkNewPage(doc, 16);
      doc.moveDown(0.12);
      const parts = t.split(/ [-|] /);
      if (parts.length > 1) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT)
           .text(parts[0], ML, doc.y, { continued: true });
        doc.fontSize(8.5).font("Helvetica").fillColor(ACCENT)
           .text("  |  " + parts.slice(1).join(" | "));
      } else {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(t, ML);
      }
      doc.moveDown(0.06);
      continue;
    }

    checkNewPage(doc, 13);
    doc.fontSize(9).font("Helvetica").fillColor(TEXT).text(t, ML, doc.y, { width: W - 12, lineGap: 1.2 });
    doc.moveDown(0.05);
  }
  addPageFooter(doc, "Modern Visual Resume");
}

// ── COVER LETTER ────────────────────────────────────────────────
function buildCoverPDF(doc, coverLetter, candidateName) {
  const pageW = doc.page.width;
  const M = 65, W = pageW - M * 2;
  const nameN = cleanForPdf(candidateName || "").trim();

  doc.rect(0, 0, pageW, 4).fill(ACCENT);
  doc.fontSize(12).font("Helvetica-Bold").fillColor(TEXT).text(nameN || "Applicant", M, 20);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT)
     .text("ATSCheckPro", pageW - M - 75, 22, { width: 75, align: "right" });
  doc.moveTo(M, 48).lineTo(pageW - M, 48).lineWidth(0.5).strokeColor(BORDER).stroke();
  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9).font("Helvetica").fillColor(MUTED)
     .text(today, M, 58, { width: W, align: "right" });
  doc.y = 110;

  const nameU = nameN.toUpperCase();
  const raw = cleanForPdf(coverLetter || "");
  const cleanLines = raw.split("\n").filter(ln => {
    const t = ln.trim();
    if (!t) return true;
    if (nameU && t.toUpperCase() === nameU) return false;
    if (/^\[.*\]$/.test(t)) return false;
    return true;
  });

  let paras = cleanLines.join("\n").replace(/\n{3,}/g, "\n\n").trim().split(/\n\n+/).filter(p => p.trim());
  if (paras.length <= 2) paras = cleanLines.join("\n").split("\n").filter(p => p.trim());

  let closingDone = false;
  for (const para of paras) {
    const p = para.trim().replace(/\n/g, " ");
    if (!p || closingDone) continue;
    if (/^(Dear|To Whom|To the)/i.test(p)) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(p, M, doc.y, { width: W });
      doc.moveDown(0.9);
      continue;
    }
    if (/^(Sincerely|Best regards|Warm regards|Respectfully|Thank you|Yours)/i.test(p)) {
      closingDone = true;
      checkNewPage(doc, 65);
      doc.moveDown(0.7);
      const word = p.replace(/,?\s*$/, "").trim();
      doc.fontSize(10).font("Helvetica").fillColor(TEXT).text(word + ",", M, doc.y, { width: W });
      doc.moveDown(2.2);
      doc.moveTo(M, doc.y).lineTo(M + 160, doc.y).lineWidth(0.7).strokeColor(BORDER).stroke();
      doc.moveDown(0.35);
      doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(nameN, M);
      continue;
    }
    checkNewPage(doc, 36);
    doc.fontSize(10).font("Helvetica").fillColor(TEXT)
       .text(p, M, doc.y, { width: W, align: "justify", lineGap: 4 });
    doc.moveDown(0.8);
  }
  addPageFooter(doc, "Cover Letter");
}

// ── REPORT PDF ──────────────────────────────────────────────────
function buildReportPDF(doc, report, candidateName) {
  const score = report?.score || 0;
  const scoreAfter = report?.scoreAfter || Math.min(score + 15, 95);
  const improvement = scoreAfter - score;
  const pageW = doc.page.width;
  const M = 50, W = pageW - M * 2;
  const sColor = score >= 75 ? ACCENT : score >= 60 ? "#d97706" : "#dc2626";
  const name = cleanForPdf(candidateName || "").trim();

  // Header
  doc.rect(0, 0, pageW, 4).fill(ACCENT);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(TEXT).text("ATS Resume Report", M, 18);
  if (name) {
    doc.fontSize(9).font("Helvetica").fillColor(MUTED).text("Prepared for: ", M, 42, { continued: true });
    doc.font("Helvetica-Bold").fillColor(TEXT).text(name);
  }
  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(8).font("Helvetica").fillColor(MUTED).text(today, M, name ? 56 : 42);
  const divY = name ? 70 : 58;
  doc.moveTo(M, divY).lineTo(pageW - M, divY).lineWidth(1.5).strokeColor(ACCENT).stroke();
  doc.y = divY + 28;

  // Score boxes
  const bW = (W - 16) / 3;
  const bY = doc.y;
  [
    { lbl:"BEFORE",      val:score+"/100",      sub:score>=75?"Strong":score>=60?"Moderate":"Weak", c:sColor, bg:"#fafaf9" },
    { lbl:"AFTER OPT.",  val:scoreAfter+"/100", sub:"Projected", c:ACCENT, bg:LIGHT },
    { lbl:"IMPROVEMENT", val:"+"+improvement,   sub:"points", c:"#1d4ed8", bg:"#eff6ff" }
  ].forEach((b, i) => {
    const bx = M + i * (bW + 8);
    doc.rect(bx, bY, bW, 50).fill(b.bg);
    doc.rect(bx, bY, bW, 3).fill(b.c);
    doc.fontSize(6).font("Helvetica-Bold").fillColor(MUTED)
       .text(b.lbl, bx, bY + 9, { width: bW, align: "center" });
    doc.fontSize(16).font("Helvetica-Bold").fillColor(b.c)
       .text(b.val, bx, bY + 19, { width: bW, align: "center" });
    doc.fontSize(7).font("Helvetica").fillColor(MUTED)
       .text(b.sub, bx, bY + 39, { width: bW, align: "center" });
  });
  doc.y = bY + 58;

  // Metrics row
  if (report?.interviewProbability || report?.jobFitScore) {
    const mW = (W - 8) / 2;
    const mY = doc.y;
    [
      { lbl:"INTERVIEW PROBABILITY", val:(report?.interviewProbability||0)+"%", c:(report?.interviewProbability||0)>=70?ACCENT:(report?.interviewProbability||0)>=50?"#d97706":"#dc2626" },
      { lbl:"JOB FIT SCORE", val:(report?.jobFitScore||0)+"%", c:(report?.jobFitScore||0)>=70?ACCENT:(report?.jobFitScore||0)>=50?"#d97706":"#dc2626" }
    ].forEach((m, i) => {
      const mx = M + i * (mW + 8);
      doc.rect(mx, mY, mW, 34).fill("#fafaf9");
      doc.rect(mx, mY, mW, 2).fill(m.c);
      doc.fontSize(6).font("Helvetica-Bold").fillColor(MUTED).text(m.lbl, mx, mY+8, { width:mW, align:"center" });
      doc.fontSize(14).font("Helvetica-Bold").fillColor(m.c).text(m.val, mx, mY+17, { width:mW, align:"center" });
    });
    doc.y = mY + 40;
    if (report?.seniorityAlignment || report?.industryBenchmark) {
      const sY = doc.y;
      doc.rect(M, sY, W, 16).fill(LIGHT);
      let txt = "";
      if (report.seniorityAlignment) txt += "Seniority: " + cleanForPdf(report.seniorityAlignment);
      if (report.industryBenchmark) txt += (txt ? "   |   " : "") + "Benchmark: " + cleanForPdf(report.industryBenchmark);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2).text(txt, M+8, sY+4, { width:W-16 });
      doc.y = sY + 22;
    }
  }

  function sec(title) {
    checkNewPage(doc, 40);
    doc.moveDown(0.25);
    const sy = doc.y;
    doc.rect(M, sy, W, 14).fill(LIGHT);
    doc.rect(M, sy, 3, 14).fill(ACCENT);
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(ACCENT2)
       .text(title, M + 8, sy + 3.5, { characterSpacing: 0.8 });
    doc.y = sy + 19;
  }

  // Quick Wins
  if (report?.quickWins?.length) {
    sec("QUICK WINS - FIX THESE FIRST");
    for (const item of report.quickWins) {
      const txt = cleanItem(item);
      if (!txt) continue;
      checkNewPage(doc, 20);
      const iy = doc.y;
      doc.rect(M, iy, W, 17).fill("#f0fdf4");
      doc.rect(M, iy, 3, 17).fill(ACCENT);
      doc.fontSize(9).font("Helvetica").fillColor(TEXT).text(txt, M + 8, iy + 4, { width: W - 12, lineGap: 1.5 });
      doc.y = iy + 20;
    }
  }

  // Red Flags
  if (report?.redFlags?.length) {
    sec("RED FLAGS FOUND");
    for (const item of report.redFlags) {
      const txt = cleanItem(item);
      if (!txt) continue;
      checkNewPage(doc, 20);
      const iy = doc.y;
      doc.rect(M, iy, W, 17).fill("#fef2f2");
      doc.rect(M, iy, 3, 17).fill("#dc2626");
      doc.fontSize(9).font("Helvetica").fillColor("#991b1b").text(txt, M + 8, iy + 4, { width: W - 12, lineGap: 1.5 });
      doc.y = iy + 20;
    }
  }

  // Core Competencies
  if (report?.coreCompetencies?.length) {
    sec("CORE COMPETENCIES");
    let kx = M + 4, ky = doc.y;
    for (const skill of report.coreCompetencies) {
      const s = cleanForPdf(skill);
      const sw = doc.widthOfString(s, { fontSize: 8 }) + 14;
      if (kx + sw > pageW - M) { kx = M + 4; ky += 17; }
      if (ky + 14 > doc.page.height - 55) { doc.addPage(); ky = 55; kx = M + 4; }
      doc.rect(kx, ky, sw, 13).fill(ACCENT2);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#fff").text(s, kx + 7, ky + 3);
      kx += sw + 4;
    }
    doc.y = ky + 20;
  }

  // Salary Keywords
  if (report?.salaryImpactKeywords?.length) {
    sec("SALARY-IMPACT KEYWORDS TO ADD");
    let kx = M + 4, ky = doc.y;
    for (const kw of report.salaryImpactKeywords) {
      const s = cleanForPdf(kw);
      const sw = doc.widthOfString(s, { fontSize: 8 }) + 14;
      if (kx + sw > pageW - M) { kx = M + 4; ky += 17; }
      doc.rect(kx, ky, sw, 13).fill("#fffbeb");
      doc.rect(kx, ky, sw, 13).lineWidth(0.5).strokeColor("#fde68a").stroke();
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#92400e").text(s, kx + 7, ky + 3);
      kx += sw + 4;
    }
    doc.y = ky + 20;
  }

  // Missing Keywords
  const cleanKW = (report?.keywords || []).map(k => cleanForPdf(k)).filter(k => k && k.length > 2);
  if (cleanKW.length) {
    sec("MISSING KEYWORDS - ADD TO YOUR RESUME");
    let kx = M + 4, ky = doc.y;
    for (const kw of cleanKW) {
      const sw = doc.widthOfString(kw, { fontSize: 8 }) + 14;
      if (kx + sw > pageW - M) { kx = M + 4; ky += 17; }
      if (ky + 14 > doc.page.height - 55) { doc.addPage(); ky = 55; kx = M + 4; }
      doc.rect(kx, ky, sw, 13).fill("#fee2e2");
      doc.rect(kx, ky, sw, 13).lineWidth(0.5).strokeColor("#fca5a5").stroke();
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#991b1b").text(kw, kx + 7, ky + 3);
      kx += sw + 4;
    }
    doc.y = ky + 20;
  }

  // Recruiter Notes
  if (report?.notes?.length) {
    sec("RECRUITER NOTES");
    for (let i = 0; i < report.notes.length; i++) {
      const txt = cleanItem(report.notes[i]);
      if (!txt) continue;
      checkNewPage(doc, 22);
      const ny = doc.y;
      if (i % 2 === 0) doc.rect(M, ny, W, 18).fill("#fafaf9");
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT).text((i+1)+".", M+5, ny+5);
      doc.fontSize(9).font("Helvetica").fillColor(TEXT).text(txt, M+18, ny+5, { width:W-20, lineGap:1.5 });
      doc.moveDown(0.35);
    }
  }

  addPageFooter(doc, "ATS Report");
}

// ── HANDLER ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  try {
    const body = await parseBody(req);
    const { type, optimizedText, coverLetter, report, photo, candidateName, format,
            professionalSummary, coreCompetencies, technicalSkills } = body;
    if (!type) return res.status(400).json({ error: "Missing type" });

    const cleanedText  = cleanForPdf(optimizedText || "");
    const cleanedCover = cleanForPdf(coverLetter || "");

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      autoFirstPage: true,
      info: { Title: "ATSCheckPro Resume", Author: "ATSCheckPro" }
    });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));

    if (type === "resume") {
      if (format === "modern") {
        buildModernResumePDF(doc, cleanedText, photo, candidateName, professionalSummary, coreCompetencies, technicalSkills);
      } else {
        buildClassicResumePDF(doc, cleanedText, photo, candidateName, professionalSummary);
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
    console.error("Download error:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
}
