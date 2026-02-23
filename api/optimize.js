import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

function buildPrompt(jobDescription, resumeText, isPro) {

  return `
You are an expert ATS resume optimizer.

Return ONLY valid JSON.

Structure:

{
 "scoreBefore": number,
 "strengthLevel": "Strong | Moderate | Weak",
 "quickImpression": ["bullet","bullet","bullet"],
 "keywordsFound": ["kw"],
 "keywordsMissingTop": ["kw"],
 "scoreAfter": number,
 "optimizedText": "plain text",
 "coverLetter": "text",
 "recruiterNotes": ["note"]
}

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

${isPro
? "USER HAS PRO ACCESS. Fill ALL fields completely including optimizedText, scoreAfter, coverLetter, recruiterNotes."
: "USER IS FREE. Fill ONLY scoreBefore, strengthLevel, quickImpression, keywordsFound, keywordsMissingTop. Leave optimizedText empty and scoreAfter null."
}

Scoring rules:
- Base score on keyword match percentage.
- Same resume and job must always produce very similar score.
- Round scoreBefore and scoreAfter to nearest integer.
- Do not randomize scores.

Rules:
- Never invent fake experience
- Plain text only
`;

}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const jobDescription = req.body.jobDescription || "";
    const resumeText     = req.body.resumeText || "";

    let licenseKey = (req.body.licenseKey || "").trim().toLowerCase();

    if (jobDescription.length < 10) {
      return res.status(400).json({ error: "Missing job description" });
    }

    if (resumeText.length < 10) {
      return res.status(400).json({ error: "Missing resume text" });
    }

    // -------- PRO ACCESS --------

    const isPro = licenseKey === "test-vikas-2026";
    console.log("License:", licenseKey, "isPro:", isPro);

    // -------- GEMINI --------

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 20
      }
    });

    const result = await model.generateContent(
      buildPrompt(jobDescription.slice(0,4000), resumeText.slice(0,6000), isPro)
    );

    const raw = result.response.text().trim();
    const jsonStr = raw.replace(/^```json/i,'').replace(/```$/,'').trim();

    let parsed;

    try {
      parsed = JSON.parse(jsonStr);
    } catch(e){
      console.error("JSON FAIL:", raw);
      return res.status(500).json({ error:"AI JSON parse failed" });
    }

    // -------- ROUND SCORES --------

    const scoreBefore = parsed.scoreBefore ? Math.round(parsed.scoreBefore) : null;
    const scoreAfter  = parsed.scoreAfter  ? Math.round(parsed.scoreAfter)  : null;

    return res.json({

      isPro,

      scoreBefore,
      strengthLevel: parsed.strengthLevel || null,
      quickImpression: parsed.quickImpression || [],
      keywordsFound: parsed.keywordsFound || [],
      keywordsMissingTop: parsed.keywordsMissingTop || [],

      scoreAfter: isPro ? scoreAfter : null,
      optimizedText: isPro ? parsed.optimizedText : null,
      coverLetter: isPro ? parsed.coverLetter : null,
      recruiterNotes: isPro ? parsed.recruiterNotes : null,

      originalText: resumeText

    });

  } catch(err){

    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      error: "Server error: " + err.message
    });

  }

}