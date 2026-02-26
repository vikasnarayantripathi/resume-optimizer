export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ valid: false, message: "No key provided." });
  }

  // Test key for development
  if (key === "test-vikas-2026") {
    return res.json({ valid: true });
  }

  // Validate Razorpay-generated license key
  if (!key.startsWith("ATSPRO-")) {
    return res.json({ valid: false, message: "Invalid license key format." });
  }

  const keyPart = key.replace("ATSPRO-", "");
  const isValidFormat = /^[A-F0-9]{32}$/.test(keyPart);

  if (!isValidFormat) {
    return res.json({ valid: false, message: "Invalid or corrupted license key." });
  }

  return res.json({ valid: true });
}