import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { optimizedText, licenseKey } = req.body;

  if (!optimizedText || !licenseKey) {
    return res.status(400).json({ error: 'Missing data.' });
  }

  const lines = optimizedText.split('\n');
  const docChildren = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      docChildren.push(new Paragraph({ text: '' }));
      continue;
    }
    const isHeader = (
      (line === line.toUpperCase() && line.length > 2 && line.length < 40 && !/^\d/.test(line)) ||
      (line.endsWith(':') && line.length < 40)
    );
    if (isHeader) {
      docChildren.push(new Paragraph({
        text: line.replace(/:$/, ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 }
      }));
    } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      docChildren.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: line.replace(/^[•\-*]\s*/, ''), size: 22 })]
      }));
    } else {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22 })]
      }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }


cat > api/generate-docx.js << 'EOF'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { optimizedText, licenseKey } = req.body;

  if (!optimizedText || !licenseKey) {
    return res.status(400).json({ error: 'Missing data.' });
  }

  const lines = optimizedText.split('\n');
  const docChildren = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      docChildren.push(new Paragraph({ text: '' }));
      continue;
    }
    const isHeader = (
      (line === line.toUpperCase() && line.length > 2 && line.length < 40 && !/^\d/.test(line)) ||
      (line.endsWith(':') && line.length < 40)
    );
    if (isHeader) {
      docChildren.push(new Paragraph({
        text: line.replace(/:$/, ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 }
      }));
    } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
      docChildren.push(new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: line.replace(/^[•\-*]\s*/, ''), size: 22 })]
      }));
    } else {
      docChildren.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22 })]
      }));
    }
  }
