export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, country } = req.body;

  if (!code) {
    return res.status(400).json({ valid: false, message: "No code provided." });
  }

  // Read coupon codes from Vercel env var
  // Format in Vercel: TECHGURU20:20,LAUNCH50:50,VIKAS30:30
  const raw = process.env.COUPON_CODES || "";

  if (!raw) {
    return res.json({ valid: false, message: "Invalid promo code." });
  }

  // Parse all codes into a map
  const coupons = {};
  raw.split(",").forEach(pair => {
    const [k, v] = pair.trim().split(":");
    if (k && v) coupons[k.toUpperCase()] = parseInt(v);
  });

  const discount = coupons[code.toUpperCase().trim()];

  if (!discount) {
    return res.json({ valid: false, message: "Invalid promo code." });
  }

  // Calculate final prices after discount
  const isIndia = country === "IN";
  const baseINR = 399;
  const baseUSD = 8.90;

  const finalINR = Math.round(baseINR - (baseINR * discount / 100));
  const finalUSD = Math.round((baseUSD - (baseUSD * discount / 100)) * 100) / 100;

  return res.json({
    valid: true,
    discount,
    finalPrice: isIndia ? finalINR : finalUSD,
    currency: isIndia ? "INR" : "USD",
    message: `${discount}% off applied!`
  });
}