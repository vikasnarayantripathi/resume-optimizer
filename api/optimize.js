import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

function buildPrompt(jobDescription, resumeText, isPro) {

  return [
    "You are an expert ATS resume optimizer and recruiter.",
    "Respond ONLY with valid JSON. No markdown, no explanation.",
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "RESUME:",
    resumeText,
    "",
    "Return JSON with this structure:",
    "{",
    ' "scoreBefore": number,',
    ' "strengthLevel": "Strong | Moderate | Weak",',
    ' "quickImpression": ["bullet1","bullet2","bullet3"],',
    ' "keywordsFound": ["kw1","kw2"],',
    ' "keywordsMissingTop": ["kw1","kw2","kw3","kw4","kw5"],',
    ' "scoreAfter": number or null,',
    ' "optimizedText": "plain text resume or empty",',
    ' "coverLetter": "professional letter or empty",',
    ' "recruiterNotes": ["note1","note2"]',
    "}",
    "",
    isPro
      ? "User has PRO access. Fill ALL fields completely."
      : "User is FREE. Fill ONLY scoreBefore, strengthLevel, quickImpression, keywordsFound, keywordsMissingTop. Leave other fields empty or null.",
    "",
    "Rules:",
    "- Never invent experience or skills",
    "- Only improve wording/order",
    "- Plain text only"
  ].join("\n");

}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { jobDescription, resumeText } = req.body;

    let licenseKey = (req.body.licenseKey || "").trim().toLowerCase();

    if (!jobDescription || jobDescription.trim().length < 10) {
      return res.status(400).json({ error: "Please provide a job description." });
    }

    if (!resumeText || resumeText.trim().length < 10) {
      return res.status(400).json({ error: "Please provide your resume text." });
    }

    // -------- DETERMINE PRO ACCESS --------

    let isPro = false;

    // test key always works
    if (licenseKey === "test-vikas-2026") {
      isPro = true;
    }

    // optional: gumroad validation if real key entered
    else if (licenseKey) {

      try {

        const gumroadRes = await fetch("https://api.gumroad.com/v2/licenses/verify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            product_id: "6F0E4C97-B72A4E69-A11BF6C4-AF6517E7",
            license_key: licenseKey,
            increment_uses_count: "false"
          })
        });

        const gumroadData = await gumroadRes.json();

        if (gumroadData.success) {
          isPro = true;
        }

      } catch(e){
        console.log("Gumroad check skipped:", e.message);
      }

    }

    console.log("License received:", licenseKey, "PRO:", isPro);

    // -------- PREP INPUT --------

    const jobTrunc    = jobDescription.trim().slice(0, 4000);
    const resumeTrunc = resumeText.trim().slice(0, 6000);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    // -------- CALL AI --------

    const result  = await model.generateContent(
      buildPrompt(jobTrunc, resumeTrunc, isPro)
    );

    const raw     = result.response.text().trim();
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("AI JSON parse failed:", raw);
      return res.status(500).json({ error: "AI returned invalid JSON." });
    }

    // -------- CLEAN OPTIMIZED TEXT --------

    const cleanText = parsed.optimizedText
      ? parsed.optimizedText
          .replace(/#{1,3}\s/g, '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .trim()
      : null;

    // -------- RESPONSE --------

    return res.json({

      isPro,

      scoreBefore: parsed.scoreBefore || null,
      strengthLevel: parsed.strengthLevel || null,
      quickImpression: parsed.quickImpression || [],
      keywordsFound: parsed.keywordsFound || [],
      keywordsMissingTop: parsed.keywordsMissingTop || [],

      scoreAfter: isPro ? parsed.scoreAfter : null,
      optimizedText: isPro ? cleanText : null,
      coverLetter: isPro ? parsed.coverLetter : null,
      recruiterNotes: isPro ? parsed.recruiterNotes : null,

      originalText: resumeTrunc

    });

  } catch (err) {

    console.error("Optimize error:", err);

    return res.status(500).json({
      error: "Optimization failed: " + err.message
    });

  }

}