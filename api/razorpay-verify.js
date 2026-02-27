import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    email,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  try {
    // ── Step 1: Verify Razorpay signature ──
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed" });
    }

    // ── Step 2: Generate license key ──
    const licenseKey =
      "ATSPRO-" +
      crypto
        .createHmac("sha256", process.env.LICENSE_SECRET)
        .update(`${razorpay_payment_id}|ATSCheckPro`)
        .digest("hex")
        .slice(0, 32)
        .toUpperCase();

    // ── Step 3: Send license key email via Resend ──
    if (email) {
      try {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://atscheckpro.com";

        await fetch(`${baseUrl}/api/send-license-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            licenseKey,
            paymentId: razorpay_payment_id,
          }),
        });
      } catch (emailErr) {
        // Email failed but payment succeeded — don't block the user
        console.error("Email send failed:", emailErr);
      }
    }

    // ── Step 4: Return success to frontend ──
    return res.status(200).json({
      success: true,
      licenseKey,
      paymentId: razorpay_payment_id,
      emailSent: !!email,
    });

  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
}
