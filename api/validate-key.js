export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { key } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ valid: false, message: 'No key provided.' });
  }
  if (key.length > 3) {
    return res.json({ valid: true });
  }
  return res.json({ valid: false, message: 'Invalid key.' });
}
