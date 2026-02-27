import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, licenseKey, paymentId } = req.body;

  if (!email || !licenseKey) {
    return res.status(400).json({ error: "Missing email or license key" });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "ATSCheckPro <support@atscheckpro.com>",
      to: [email],
      subject: "🎉 Your ATSCheckPro License Key — Lifetime Access Unlocked!",
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Your ATSCheckPro License Key</title>
</head>
<body style="margin:0;padding:0;background:#f5f2ee;font-family:'Helvetica Neue',Arial,sans-serif">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ee;padding:40px 0">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

          <!-- Header -->
          <tr>
            <td style="background:#1c1917;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#16a34a">ATSCheckPro</p>
              <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;font-weight:900;color:#f5f2ee;letter-spacing:-0.5px">Your License Key is Ready! 🎉</h1>
              <p style="margin:12px 0 0;font-size:14px;color:rgba(255,255,255,0.45);font-weight:300">Lifetime access to AI-powered resume optimization</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px">

              <!-- Greeting -->
              <p style="margin:0 0 24px;font-size:16px;color:#1c1917;line-height:1.6">Hi there,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#57534e;line-height:1.75;font-weight:300">
                Thank you for your purchase! Your payment was successful and your <strong style="color:#1c1917">lifetime license key</strong> is ready. Copy it below and paste it into the app to unlock all premium features.
              </p>

              <!-- License Key Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
                <tr>
                  <td style="background:#f5f2ee;border:2px dashed #16a34a;border-radius:12px;padding:28px;text-align:center">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#78716c">Your License Key</p>
                    <p style="margin:0 0 12px;font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#1c1917;letter-spacing:2px;word-break:break-all">${licenseKey}</p>
                    <p style="margin:0;font-size:12px;color:#78716c">Copy this key and paste it in the app to activate</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px">
                <tr>
                  <td align="center">
                    <a href="https://atscheckpro.com/app" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;text-decoration:none;letter-spacing:0.3px">
                      Open ATSCheckPro →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- How to Use -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background:#f5f2ee;border-radius:12px;padding:24px">
                <tr>
                  <td style="padding:24px">
                    <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#78716c">How to activate</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #ede9e4">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:28px;height:28px;background:#1c1917;border-radius:50%;text-align:center;vertical-align:middle">
                                <span style="font-size:12px;font-weight:700;color:#f5f2ee">1</span>
                              </td>
                              <td style="padding-left:12px;font-size:14px;color:#57534e">Go to <a href="https://atscheckpro.com/app" style="color:#16a34a;font-weight:600">atscheckpro.com/app</a></td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #ede9e4">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:28px;height:28px;background:#1c1917;border-radius:50%;text-align:center;vertical-align:middle">
                                <span style="font-size:12px;font-weight:700;color:#f5f2ee">2</span>
                              </td>
                              <td style="padding-left:12px;font-size:14px;color:#57534e">Upload your resume and paste the job description</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #ede9e4">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:28px;height:28px;background:#1c1917;border-radius:50%;text-align:center;vertical-align:middle">
                                <span style="font-size:12px;font-weight:700;color:#f5f2ee">3</span>
                              </td>
                              <td style="padding-left:12px;font-size:14px;color:#57534e">Click <strong>Unlock Full Analysis</strong> → enter your license key</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:28px;height:28px;background:#16a34a;border-radius:50%;text-align:center;vertical-align:middle">
                                <span style="font-size:12px;font-weight:700;color:#ffffff">✓</span>
                              </td>
                              <td style="padding-left:12px;font-size:14px;color:#57534e">All premium features unlocked — download your optimized PDF!</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Unlocked -->
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#78716c">What you've unlocked</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
                <tr>
                  <td width="50%" style="padding:6px 8px 6px 0;font-size:13px;color:#57534e">✅ AI Resume Rewrite</td>
                  <td width="50%" style="padding:6px 0 6px 8px;font-size:13px;color:#57534e">✅ Cover Letter Generator</td>
                </tr>
                <tr>
                  <td width="50%" style="padding:6px 8px 6px 0;font-size:13px;color:#57534e">✅ Interview Probability</td>
                  <td width="50%" style="padding:6px 0 6px 8px;font-size:13px;color:#57534e">✅ Job Fit Score</td>
                </tr>
                <tr>
                  <td width="50%" style="padding:6px 8px 6px 0;font-size:13px;color:#57534e">✅ Salary-Impact Keywords</td>
                  <td width="50%" style="padding:6px 0 6px 8px;font-size:13px;color:#57534e">✅ Classic + Modern PDF</td>
                </tr>
                <tr>
                  <td width="50%" style="padding:6px 8px 6px 0;font-size:13px;color:#57534e">✅ Lifetime Access</td>
                  <td width="50%" style="padding:6px 0 6px 8px;font-size:13px;color:#57534e">✅ No Renewals Ever</td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #ede9e4;margin:0 0 28px"/>

              <!-- Support -->
              <p style="margin:0 0 8px;font-size:14px;color:#57534e;line-height:1.7">
                💡 <strong style="color:#1c1917">Save this email</strong> — your license key is here if you ever need it again.
              </p>
              <p style="margin:0 0 8px;font-size:14px;color:#57534e;line-height:1.7">
                🐛 Having trouble? Reply to this email or contact us at <a href="mailto:support@atscheckpro.com" style="color:#16a34a;font-weight:600">support@atscheckpro.com</a>
              </p>
              <p style="margin:0;font-size:14px;color:#57534e;line-height:1.7">
                ⭐ Loving ATSCheckPro? Share your experience on LinkedIn — we'd love to hear your success story!
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1c1917;border-radius:0 0 16px 16px;padding:24px 40px;text-align:center">
              <p style="margin:0 0 8px;font-family:Georgia,serif;font-size:16px;font-weight:700;color:#f5f2ee">ATS<span style="color:#16a34a">Check</span>Pro</p>
              <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.3)">Beat the ATS. Land the Interview.</p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2)">
                Payment ID: ${paymentId || "N/A"} &nbsp;·&nbsp;
                <a href="https://atscheckpro.com/privacy" style="color:rgba(255,255,255,0.3);text-decoration:none">Privacy</a> &nbsp;·&nbsp;
                <a href="https://atscheckpro.com/terms" style="color:rgba(255,255,255,0.3);text-decoration:none">Terms</a> &nbsp;·&nbsp;
                <a href="https://atscheckpro.com/refund" style="color:rgba(255,255,255,0.3);text-decoration:none">Refund Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ error: "Failed to send email" });
    }

    return res.status(200).json({ success: true, emailId: data.id });

  } catch (err) {
    console.error("Send email error:", err);
    return res.status(500).json({ error: "Email sending failed" });
  }
}
