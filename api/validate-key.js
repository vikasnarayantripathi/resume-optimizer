export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { key } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ valid: false, message: 'No key provided.' });
  }

  // Test key for development only
  if (key === 'test-vikas-2026') {
    return res.json({ valid: true, usesRemaining: 999 });
  }

  try {
    const gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: process.env.GUMROAD_PRODUCT_ID,
        license_key: key.trim(),
        increment_uses_count: 'false'
      })
    });
    const data = await gumroadRes.json();
    if (data.success && data.purchase && !data.purchase.refunded) {
      return res.json({ valid: true, usesRemaining: data.uses_remaining ?? 999 });
    } else {
      return res.json({ valid: false, message: 'Invalid key. Purchase at quimztech.gumroad.com/l/cxinw' });
    }
  } catch (err) {
    return res.status(500).json({ valid: false, message: 'Verification failed. Try again.' });
  }
}
