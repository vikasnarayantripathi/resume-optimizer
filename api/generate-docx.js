export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { optimizedText, licenseKey } = req.body || {};
  if (!optimizedText || !licenseKey) {
    return res.status(400).json({ error: 'Missing data.' });
  }
  const lines = optimizedText.split('\n');
  let rtf = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs22 ';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { rtf += '\\par '; continue; }
    const safe = line.replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}');
    const isHeader = (line === line.toUpperCase() && line.length > 2 && line.length < 40 && !/^\d/.test(line)) || (line.endsWith(':') && line.length < 40);
    if (isHeader) {
      rtf += `\\par\\b ${safe}\\b0\\par `;
    } else if (/^[*\-•]/.test(line)) {
      rtf += `\\par\\li360 - ${safe.replace(/^[*\-•]\s*/,'')}\\li0 `;
    } else {
      rtf += `\\par ${safe} `;
    }
  }
  rtf += '}';
  const buffer = Buffer.from(rtf, 'utf8');
  res.setHeader('Content-Type', 'application/msword');
  res.setHeader('Content-Disposition', 'attachment; filename="optimized-resume.doc"');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}
