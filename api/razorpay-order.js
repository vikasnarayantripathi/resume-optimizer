const Razorpay = require("razorpay");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { country, finalPrice } = req.body;

  const isIndia = country === "IN";

  // Use passed finalPrice (after coupon) or default price
  let amount, currency;

  if (isIndia) {
    currency = "INR";
    const price = finalPrice || 399;
    amount = Math.round(price * 100); // paise
  } else {
    currency = "USD";
    const price = finalPrice || 8.90;
    amount = Math.round(price * 100); // cents
  }

  try {
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `rcpt_${Date.now()}`,
      notes: {
        product: "ATSCheckPro License",
        country: country || "global",
      },
    });

    res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
}