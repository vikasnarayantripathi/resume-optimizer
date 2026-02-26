const crypto = require("crypto");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  try {
    // Step 1: Verify the payment is genuine (not fake)
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // Step 2: Generate a license key for this user
    const licenseKey = crypto
      .createHmac("sha256", process.env.LICENSE_SECRET)
      .update(`${razorpay_payment_id}|ATSCheckPro`)
      .digest("hex")
      .slice(0, 32)
      .toUpperCase();

    res.status(200).json({
      success: true,
      licenseKey: `ATSPRO-${licenseKey}`,
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
};