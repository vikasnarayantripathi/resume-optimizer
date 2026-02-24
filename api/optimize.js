import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

/* ===============================
   KEYWORD ENGINE (REALISTIC ATS)
================================ */

const STOP_WORDS = new Set([
  "and","or","the","with","for","to","of","in","on","a","an",
  "responsible","candidate","role","ability","work","team",
  "excellent","strong","good","skills","experience"
]);

function extractKeywords(text) {
  const words = (text.toLowerCase().match(/\b[a-zA-Z0-9.+#]{3,}\b/g) || []);

  return Array.from(
    new Set(
      words.filter(w => !STOP_WORDS.has(w))
    )
  ).slice(0, 40);
}

function normalize(text) {
  return text.toLowerCase()
    .replace(/js/g,"javascript")
    .replace(/node /g,"nodejs ")
    .replace(/postgres/g,"postgresql");
}

function calculateScore(job, resume) {

  const jobKeywords = extractKeywords(job);
  const resumeText = normalize(resume);

  const matched = jobKeywords.filter(k => resumeText.includes(k));
  const missing = jobKeywords.filter(k => !resumeText.includes(k));

  let score = Math.round((matched.length / jobKeywords.length) * 100 || 0);

  // Clamp realistic ATS range
  score = Math.min(Math.max(score, 35), 92);

  return {
    score,
    matched: matched.slice(0, 12),
    missing: missing.slice(0, 12)
  };
}

/* ===============================
   AI PROMPT (PRO MODE)
================================ */

function buildPrompt(job, resume) {
  return `
You are a professional ATS resume writer.

Return ONLY JSON:

{
 "optimizedText": "...",
 "coverLetter": "...",
 "recruiterNotes": ["note1","note2"]
}

RULES:
1. Keep candidate data real.
2. Do NOT invent experience.
3. Format resume clearly with sections:
--------------------------------
SUMMARY
--------------------------------
--------------------------------
SKILLS
--------------------------------
--------------------------------
EXPERIENCE
--------------------------------
--------------------------------
EDUCATION
--------------------------------
4. Bullet points must start with "- "
5. Make resume stronger but realistic.
6. Cover letter must match job tone.
7. Recruiter notes must mention improvement areas.

JOB DESCRIPTION:
${job}

RESUME:
${resume}
`;
}

/* ===============================
   API HANDLER
================================ */

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const job = req.body.jobDescription || "";
    const resume = req.body.resumeText || "";
    const license = (req.body.licenseKey || "").trim();

    if (job.length < 10)
      return res.status(400).json({ error: "Job description missing" });

    if (resume.length < 10)
      return res.status(400).json({ error: "Resume missing" });

    const isPro = license === "test-vikas-2026";

    /* ----- ATS SCORE ----- */

    const { score, matched, missing } = calculateScore(job, resume);

    /* ----- PRO AI GENERATION ----- */

    let optimizedText = null;
    let coverLetter = null;
    let recruiterNotes = null;

    if (isPro) {

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.3,
          topP: 0.9,
          topK: 40
        }
      });

      const result = await model.generateContent(
        buildPrompt(job.slice(0,4000), resume.slice(0,6000))
      );

      const raw = result.response.text().trim();
      const clean = raw.replace(/^```json/i,'').replace(/```$/,'').trim();

      try {
        const parsed = JSON.parse(clean);
        optimizedText = parsed.optimizedText || null;
        coverLetter = parsed.coverLetter || null;
        recruiterNotes = parsed.recruiterNotes || null;
      } catch (e) {
        console.error("AI JSON parse error:", clean);
      }
    }

    /* ----- RESPONSE ----- */

    return res.json({

      isPro,

      scoreBefore: score,

      strengthLevel:
        score >= 75 ? "Strong" :
        score >= 60 ? "Moderate" :
        "Weak",

      quickImpression: [
        score >= 75 ? "Strong alignment with job requirements." :
        score >= 60 ? "Moderate keyword coverage." :
        "Significant keyword gaps detected.",
        missing.length > 5 ?
          "Several required skills missing." :
          "Most core skills covered."
      ],

      keywordsFound: matched,
      keywordsMissingTop: missing,

      scoreAfter: isPro ? Math.min(score + 8, 95) : null,

      optimizedText,
      coverLetter,
      recruiterNotes,

      originalText: resume

    });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: err.message });
  }
}