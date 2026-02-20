export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { optimizedText, licenseKey } = req.body || {};
  if (!optimizedText || !licenseKey) {
    return res.status(400).json({ error: 'Missing data.' });
  }
  const lines = optimizedText.split('\n');
  let rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss Calibri;}}\\f0\\fs22\\sa120\n';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { rtf += '\\par\n'; continue; }
    const safe = line
      .replace(/\\/g, '')
      .replace(/\{/g, '')
      .replace(/\}/g, '');
    const isHeader = (line === line.toUpperCase() && line.length > 2 && line.length < 50) || (line.endsWith(':') && line.length < 50);
    if (isHeader) {
      rtf += '{\\b\\fs26 ' + safe + '}\\par\n';
    } else if (/^[*\-]/.test(line)) {
      rtf += '\\tab - ' + safe.replace(/^[*\-]\s*/, '') + '\\par\n';
    } else {
      rtf += safe + '\\par\n';
    }
  }
  rtf += '}';
  const buffer = Buffer.from(rtf, 'latin1');
  res.setHeader('Content-Type', 'application/rtf');
  res.setHeader('Content-Disposition', 'attachment; filename="optimized-resume.rtf"');
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}