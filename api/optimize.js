import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

function buildPrompt(jobDescription, resumeText) {
  return [
    "You are an expert resume writer and ATS optimization specialist. You MUST respond with ONLY a valid JSON object. No intro text, no explanation, no markdown, just the raw JSON object starting with { and ending with }.",
    "",
    "Analyze this resume against the job description and produce an optimized version.",
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "ORIGINAL RESUME:",
    resumeText,
    "",
    "Respond with ONLY valid JSON using this exact structure:",
    "{",
    '  "scoreBefore": <integer 0-100>,',
    '  "scoreAfter": <integer 0-100>,',
    '  "keywordsFound": ["keyword1", "keyword2"],',
    '  "keywordsMissing": ["keyword1", "keyword2"],',
    '  "keywordsAdded": <integer>,',
    '  "optimizedText": "<full optimized resume>"',
    "}",
    "",
    "Rules:",
    "1. Reorder bullet points so most relevant ones appear first",
    "2. Naturally integrate missing keywords where they truthfully apply",
    "3. Strengthen weak bullets with stronger action verbs",
    "4. Do NOT fabricate jobs, degrees, or skills",
    "5. Keep the same resume structure and sections",
    "6. Make the summary strongly mirror the job language",
    "7. Only enhance, never invent",
    "8. Use ONLY the actual content from the original resume — never use placeholder text like [Your Name] or [Company Name]",
"9. If information is present in the original resume, use it exactly as provided", 
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

    if (!licenseKey) {
      return res.status(401).json({ error: "No license key provided." });
    }

    // Allow test key for development
    if (licenseKey !== "test-vikas-2026") {
      // Validate real keys against Gumroad
      const gumroadRes = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_permalink: "cxinw",
          license_key: licenseKey,
          increment_uses_count: "false"
        })
      });
      const gumroadData = await gumroadRes.json();
      if (!gumroadData.success) {
        return res.status(403).json({ error: "Invalid or already used license key." });
      }
    }

    const jobTrunc    = jobDescription.trim().slice(0, 4000);
    const resumeTrunc = resumeText.trim().slice(0, 6000);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result  = await model.generateContent(buildPrompt(jobTrunc, resumeTrunc));
    const raw     = result.response.text().trim();
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed  = JSON.parse(jsonStr);

    const required = ["scoreBefore", "scoreAfter", "keywordsFound", "keywordsMissing", "keywordsAdded", "optimizedText"];
    for (const field of required) {
      if (parsed[field] === undefined) {
        return res.status(500).json({ error: "AI returned unexpected format. Please try again." });
      }
    }

    return res.json({
      scoreBefore:     parsed.scoreBefore,
      scoreAfter:      parsed.scoreAfter,
      keywordsFound:   parsed.keywordsFound,
      keywordsMissing: parsed.keywordsMissing,
      keywordsAdded:   parsed.keywordsAdded,
      originalText:    resumeTrunc,
      optimizedText: parsed.optimizedText
  .replace(/#{1,3}\s/g, '')
  .replace(/\*\*/g, '')
  .replace(/\*/g, '')
  .trim()
    });

  } catch (err) {
    console.error("Optimize error:", err);
    return res.status(500).json({
      error: "Optimization failed: " + err.message
    });
  }
}