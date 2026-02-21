export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key } = req.body;

  if (!key) {
    return res.status(400).json({ valid: false, message: "No key provided." });
  }

  // Allow test key for development
  if (key === "test-vikas-2026") {
    return res.json({ valid: true });
  }

  // Validate real keys against Gumroad
  try {
    const gumroadRes = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_permalink: "cxinw",
        license_key: key,
        increment_uses_count: "false"
      })
    });

    const data = await gumroadRes.json();

    if (data.success) {
      return res.json({ valid: true });
    } else {
      return res.json({ valid: false, message: "Invalid or already used key. Please try again." });
    }

  } catch (err) {
    console.error("Validate key error:", err);
    return res.status(500).json({ valid: false, message: "Network error. Please try again." });
  }
}