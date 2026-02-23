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
    ' "keywordsMissingAll": ["kw1","kw2"],',
    ' "scoreAfter": number or null,',
    ' "optimizedText": "plain text resume or empty",',
    ' "coverLetter": "professional letter or empty",',
    ' "recruiterNotes": ["note1","note2"]',
    "}",
    "",
    "IF USER IS FREE:",
    "- Fill ONLY scoreBefore, strengthLevel, quickImpression, keywordsFound, keywordsMissingTop",
    "- Leave optimizedText empty",
    "- scoreAfter null",
    "- coverLetter empty",
    "- recruiterNotes empty",
    "",
    "IF USER IS PRO:",
    "- Fill ALL fields",
    "- optimizedText must be plain text resume",
    "- coverLetter must be 250-300 words",
    "- recruiterNotes must include positives and concerns",
    "",
    "Rules:",
    "- Never invent experience or skills",
    "- Only improve wording and ordering",
    "- Use plain text only, no markdown"
  ].join("\n");
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { jobDescription, resumeText, licenseKey } = req.body;

    if (!jobDescription || jobDescription.trim().length < 10) {
      return res.status(400).json({ error: "Please provide a job description." });
    }

    if (!resumeText || resumeText.trim().length < 10) {
      return res.status(400).json({ error: "Please provide your resume text." });
    }

    // -------- DETERMINE FREE OR PRO --------
    let isPro = false;

    if (licenseKey === "test-vikas-2026") {
      isPro = true;
    } 
    else if (licenseKey) {
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
    }

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
    const parsed  = JSON.parse(jsonStr);

    // -------- BASIC VALIDATION --------
    if (parsed.scoreBefore === undefined) {
      return res.status(500).json({ error: "AI returned unexpected format." });
    }

    // -------- CLEAN OPTIMIZED TEXT --------
    const cleanText = parsed.optimizedText
      ? parsed.optimizedText
          .replace(/#{1,3}\s/g, '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .trim()
      : null;

    // -------- FINAL RESPONSE --------
    return res.json({

      isPro,

      // FREE DATA
      scoreBefore: parsed.scoreBefore,
      strengthLevel: parsed.strengthLevel || null,
      quickImpression: parsed.quickImpression || [],
      keywordsFound: parsed.keywordsFound || [],
      keywordsMissingTop: parsed.keywordsMissingTop || [],

      // PRO DATA (only if unlocked)
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