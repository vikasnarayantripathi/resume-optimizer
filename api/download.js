import PDFDocument from "pdfkit";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
  maxDuration: 30
};

const ACCENT = "#16a34a";
const ACCENT2 = "#15803d";
const TEXT = "#1c1917";
const MUTED = "#78716c";
const LIGHT_GREEN = "#f0fdf4";
const BORDER = "#d4cbbf";

function addFooter(doc, candidateName) {
  const y = doc.page.height - 34;
  doc.moveTo(50, y - 4).lineTo(doc.page.width - 50, y - 4)
     .strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.fontSize(7.5).font("Helvetica").fillColor("#a8a29e")
     .text(
       `${candidateName ? candidateName + "  ·  " : ""}ATSCheckPro Resume Service  ·  Confidential`,
       50, y + 2, { align: "center", width: doc.page.width - 100 }
     );
}

function buildResumePDF(doc, optimizedText, photo, candidateName) {
  const lines = (optimizedText || "").split("\n");
  const name = lines[0]?.trim() || "";
  const pageW = doc.page.width;
  const margin = 50;
  const contentW = pageW - margin * 2;

  // Collect contact lines (lines after name until blank or section)
  let contactLines = [];
  let bodyStart = 1;
  for (let i = 1; i < Math.min(5, lines.length); i++) {
    const l = lines[i].trim();
    if (!l) { bodyStart = i + 1; break; }
    if (l.includes("@") || l.includes("|") || l.includes("+")
        || l.match(/\d{3}[-.\s]\d{3}/) || l.toLowerCase().includes("linkedin")
        || l.toLowerCase().includes("github") || l.startsWith("http")) {
      contactLines.push(l);
      bodyStart = i + 1;
    } else {
      bodyStart = i;
      break;
    }
  }
  const body = lines.slice(bodyStart);

  // ── HEADER ────────────────────────────────────────
  // Top green accent strip
  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  // Photo block — reserve right column only if photo exists
  const hasPhoto = !!photo;
  const nameWidth = hasPhoto ? contentW - 90 : contentW;
  const photoX = pageW - margin - 72;
  const photoY = 22;

  if (hasPhoto) {
    try {
      const imgData = photo.replace(/^data:image\/\w+;base64,/, "");
      // Clip to circle-like square with rounded appearance
      doc.save();
      doc.roundedRect(photoX, photoY, 68, 68, 6).clip();
      doc.image(Buffer.from(imgData, "base64"), photoX, photoY, { width: 68, height: 68 });
      doc.restore();
      // Border around photo
      doc.roundedRect(photoX, photoY, 68, 68, 6)
         .strokeColor(ACCENT).lineWidth(1.5).stroke();
    } catch(e) {}
  }

  // Name
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT)
     .text(name, margin, 22, { width: nameWidth });

  // Contact details
  let cy = 22 + 26;
  if (contactLines.length > 0) {
    let allContacts = [];
    for (const cl of contactLines) {
      if (cl.includes("|")) {
        allContacts.push(...cl.split("|").map(c => c.trim()).filter(Boolean));
      } else {
        allContacts.push(cl.trim());
      }
    }
    doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
       .text(allContacts.slice(0, 5).join("   ·   "), margin, cy, { width: nameWidth, lineGap: 2 });
    cy = doc.y + 6;
  } else {
    cy += 10;
  }

  // Header divider — drawn BELOW both name block and photo
  const dividerY = hasPhoto ? Math.max(cy, photoY + 68 + 8) : cy;
  doc.moveTo(margin, dividerY).lineTo(pageW - margin, dividerY)
     .strokeColor(ACCENT).lineWidth(1.8).stroke();
  doc.y = dividerY + 10;

  // ── BODY ───────────────────────────────────────────
  for (const line of body) {
    const t = line.trim();
    if (!t) { doc.moveDown(0.2); continue; }

    // Section header (ALL CAPS)
    if (t === t.toUpperCase() && t.length > 2 && t.length < 50
        && !/^\d/.test(t) && /[A-Z]/.test(t)) {
      doc.moveDown(0.4);
      const sy = doc.y;
      doc.rect(margin, sy, contentW, 15).fill(LIGHT_GREEN);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2)
         .text(t, margin + 4, sy + 3.5, { characterSpacing: 1.2 });
      doc.y = sy + 19;
      doc.moveDown(0.1);
      continue;
    }

    // Bullet
    if (t.startsWith("-") || t.startsWith("•")) {
      const txt = t.replace(/^[-•]\s*/, "");
      const bY = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor(ACCENT).text("▸", margin + 2, bY + 1.5);
      doc.fontSize(9.5).font("Helvetica").fillColor(TEXT)
         .text(txt, margin + 14, bY, { width: contentW - 14, lineGap: 1.5 });
      doc.moveDown(0.12);
      continue;
    }

    // Job title / company line
    if ((t.includes(" - ") || t.includes(" | ")) && t.length < 100 && !t.includes("@")) {
      doc.moveDown(0.2);
      const parts = t.split(/\s[-|]\s/);
      if (parts.length > 1) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT)
           .text(parts[0], { continued: true });
        doc.fontSize(9).font("Helvetica").fillColor(MUTED)
           .text("  ·  " + parts.slice(1).join(" · "));
      } else {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(TEXT).text(t);
      }
      doc.moveDown(0.1);
      continue;
    }

    doc.fontSize(9.5).font("Helvetica").fillColor(TEXT).text(t, { lineGap: 1.5 });
    doc.moveDown(0.08);
  }

  addFooter(doc, candidateName || name);
}

function buildCoverPDF(doc, coverLetter, candidateName) {
  const pageW = doc.page.width;
  const margin = 72;
  const contentW = pageW - margin * 2;

  // Top accent bar
  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  // Sender info block (top left)
  doc.fontSize(11).font("Helvetica-Bold").fillColor(TEXT)
     .text(candidateName || "Applicant", margin, 24);
  doc.fontSize(8.5).font("Helvetica").fillColor(MUTED)
     .text("Cover Letter", margin, 38);

  // ATSCheckPro branding (top right)
  doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT)
     .text("ATSCheckPro", pageW - margin - 80, 24, { width: 80, align: "right" });
  doc.fontSize(7.5).font("Helvetica").fillColor(MUTED)
     .text("AI Resume Service", pageW - margin - 80, 36, { width: 80, align: "right" });

  // Divider
  doc.moveTo(margin, 54).lineTo(pageW - margin, 54)
     .strokeColor(BORDER).lineWidth(0.5).stroke();

  // Date
  const today = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9.5).font("Helvetica").fillColor(MUTED)
     .text(today, margin, 66, { width: contentW, align: "right" });

  doc.y = 92;

  // Parse and render paragraphs
  const rawText = (coverLetter || "").trim();

  // Split on double newlines first, then single
  let paragraphs = rawText.split(/\n{2,}/).filter(p => p.trim());
  if (paragraphs.length <= 1) {
    paragraphs = rawText.split("\n").filter(p => p.trim());
  }

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim().replace(/\n/g, " ");
    if (!para) continue;

    // Salutation
    if (para.match(/^(Dear|To Whom|To the)/i)) {
      doc.fontSize(10.5).font("Helvetica-Bold").fillColor(TEXT)
         .text(para, margin, doc.y, { width: contentW });
      doc.moveDown(0.9);
      continue;
    }

    // Closing
    if (para.match(/^(Sincerely|Best regards|Warm regards|Respectfully|Thank you|Yours truly)/i)) {
      doc.moveDown(0.6);
      doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
         .text(para, margin, doc.y, { width: contentW });
      doc.moveDown(2.5);
      // Signature line
      doc.moveTo(margin, doc.y).lineTo(margin + 160, doc.y)
         .strokeColor(BORDER).lineWidth(0.8).stroke();
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT)
         .text(candidateName || "", margin);
      continue;
    }

    // Body paragraphs — justified, proper line spacing
    doc.fontSize(10.5).font("Helvetica").fillColor(TEXT)
       .text(para, margin, doc.y, {
         width: contentW,
         align: "justify",
         lineGap: 4,
       });
    doc.moveDown(0.85);
  }

  addFooter(doc, candidateName);
}

function buildReportPDF(doc, report, candidateName) {
  const score = report?.score || 0;
  const scoreAfter = report?.scoreAfter || Math.min(score + 8, 95);
  const improvement = scoreAfter - score;
  const pageW = doc.page.width;
  const margin = 50;
  const contentW = pageW - margin * 2;

  // Top accent bar
  doc.rect(0, 0, pageW, 5).fill(ACCENT);

  // Title block
  doc.fontSize(20).font("Helvetica-Bold").fillColor(TEXT)
     .text("ATS Resume Report", margin, 22);

  if (candidateName) {
    doc.fontSize(11).font("Helvetica").fillColor(MUTED)
       .text("Prepared for: " + candidateName, margin, 48);
  }

  const dateStr = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  doc.fontSize(9).font("Helvetica").fillColor(MUTED)
     .text(dateStr, margin, candidateName ? 62 : 48);

  // Header divider
  const divY = candidateName ? 80 : 66;
  doc.moveTo(margin, divY).lineTo(pageW - margin, divY)
     .strokeColor(ACCENT).lineWidth(1.5).stroke();
  doc.y = divY + 14;

  // ── SCORE BOXES ────────────────────────────────────
  const boxW = (contentW - 20) / 3;
  const bY = doc.y;
  const scoreBoxes = [
    { label: "BEFORE OPTIMIZATION", value: score + "/100",
      sub: score >= 75 ? "Strong" : score >= 60 ? "Moderate" : "Weak",
      color: score >= 75 ? ACCENT : score >= 60 ? "#d97706" : "#dc2626",
      bg: "#fafaf9", border: BORDER },
    { label: "AFTER OPTIMIZATION", value: scoreAfter + "/100",
      sub: "Projected", color: ACCENT, bg: LIGHT_GREEN, border: ACCENT },
    { label: "IMPROVEMENT", value: "+" + improvement,
      sub: "points gained", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" }
  ];

  scoreBoxes.forEach((b, i) => {
    const bx = margin + i * (boxW + 10);
    doc.rect(bx, bY, boxW, 60).fill(b.bg);
    doc.rect(bx, bY, boxW, 60).stroke(b.border).lineWidth(1);
    doc.rect(bx, bY, boxW, 3).fill(b.color);
    doc.fontSize(6.5).font("Helvetica-Bold").fillColor(MUTED)
       .text(b.label, bx, bY + 10, { width: boxW, align: "center", characterSpacing: 0.8 });
    doc.fontSize(20).font("Helvetica-Bold").fillColor(b.color)
       .text(b.value, bx, bY + 22, { width: boxW, align: "center" });
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
       .text(b.sub, bx, bY + 46, { width: boxW, align: "center" });
  });
  doc.y = bY + 74;

  // Overall assessment
  const strength = score >= 75 ? "Strong ATS Match" : score >= 60 ? "Moderate Match" : "Needs Improvement";
  const strengthColor = score >= 75 ? ACCENT : score >= 60 ? "#d97706" : "#dc2626";
  doc.rect(margin, doc.y, contentW, 22).fill(score >= 75 ? LIGHT_GREEN : score >= 60 ? "#fffbeb" : "#fef2f2");
  doc.fontSize(9).font("Helvetica").fillColor(MUTED)
     .text("Overall Assessment:", margin + 10, doc.y + 6, { continued: true });
  doc.font("Helvetica-Bold").fillColor(strengthColor).text("  " + strength);
  doc.y += 32;

  // ── SECTION HELPER ──────────────────────────────────
  function section(title, icon) {
    doc.moveDown(0.4);
    const sy = doc.y;
    doc.rect(margin, sy, contentW, 16).fill(LIGHT_GREEN);
    doc.moveTo(margin, sy).lineTo(margin, sy + 16).strokeColor(ACCENT).lineWidth(2.5).stroke();
    doc.fontSize(8).font("Helvetica-Bold").fillColor(ACCENT2)
       .text((icon ? icon + "  " : "") + title, margin + 8, sy + 4, { characterSpacing: 0.8 });
    doc.y = sy + 22;
  }

  // ── RECRUITER IMPRESSION ────────────────────────────
  if (report?.impression?.length) {
    section("RECRUITER IMPRESSION");
    for (const item of report.impression) {
      const iy = doc.y;
      doc.fontSize(8.5).font("Helvetica").fillColor(ACCENT).text("→", margin + 4, iy + 1.5);
      doc.fontSize(10).font("Helvetica").fillColor(TEXT)
         .text(item, margin + 16, iy, { width: contentW - 16, lineGap: 2 });
      doc.moveDown(0.35);
    }
  }

  // ── MISSING KEYWORDS ───────────────────────────────
  if (report?.keywords?.length) {
    section("MISSING KEYWORDS — ADD TO YOUR RESUME");
    // Render as tag-like items
    let kx = margin + 4;
    let ky = doc.y;
    const tagH = 14;
    for (const kw of report.keywords) {
      const tw = doc.widthOfString(kw, { fontSize: 8 }) + 14;
      if (kx + tw > pageW - margin) { kx = margin + 4; ky += tagH + 5; }
      doc.rect(kx, ky, tw, tagH).fill("#fee2e2").stroke("#fca5a5").lineWidth(0.5);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#991b1b").text(kw, kx + 7, ky + 3);
      kx += tw + 6;
    }
    doc.y = ky + tagH + 10;
  }

  // ── IMPROVEMENT NOTES ──────────────────────────────
  if (report?.notes?.length) {
    section("IMPROVEMENT NOTES");
    for (let i = 0; i < report.notes.length; i++) {
      const note = report.notes[i];
      const ny = doc.y;
      doc.rect(margin, ny, contentW, 1).fill(i % 2 === 0 ? "#fafaf9" : "white");
      doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ACCENT)
         .text(`${i + 1}.`, margin + 4, ny + 2);
      doc.fontSize(10).font("Helvetica").fillColor(TEXT)
         .text(note, margin + 18, ny, { width: contentW - 18, lineGap: 2 });
      doc.moveDown(0.4);
    }
  }

  addFooter(doc, candidateName);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { type, optimizedText, coverLetter, report, photo, candidateName } = req.body;
    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", chunk => chunks.push(chunk));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ATSCheckPro-${type}.pdf"`);
    if (type === "resume") buildResumePDF(doc, optimizedText, photo, candidateName);
    else if (type === "cover") buildCoverPDF(doc, coverLetter, candidateName);
    else if (type === "report") buildReportPDF(doc, report, candidateName);
    doc.end();
    await new Promise(resolve => doc.on("end", resolve));
    const buffer = Buffer.concat(chunks);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch(e) {
    console.error("Download error:", e);
    res.status(500).json({ error: e.message });
  }
}
