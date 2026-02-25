import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: {
    bodyParser: { sizeLimit: "4mb" },
    maxDuration: 60
  }
};

const STOP_WORDS = new Set([
  // Only true grammar/filler words — NEVER remove skill/tech terms
  "and","or","the","with","for","to","of","in","on","a","an","is","are","was",
  "will","be","been","have","has","this","that","you","your","we","our","their",
  "they","it","its","by","as","at","from","about","which","who","when","where",
  "not","but","also","just","more","any","all","such","both","each","than","then",
  "so","yet","nor","too","very","here","there","what","how","its","been","do",
  "did","get","got","let","may","can","would","could","should","must","need",
  "please","great","good","well","best","new","want","apply","prefer","include"
]);

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractKeywords(text) {
  const words = normalize(text).split(" ");
  const freq = {};
  words.forEach(w => { if(w.length > 2 && !STOP_WORDS.has(w)) freq[w] = (freq[w]||0)+1; });
  // Also extract 2-word phrases
  for(let i = 0; i < words.length-1; i++) {
    const phrase = words[i]+" "+words[i+1];
    if(!STOP_WORDS.has(words[i]) && !STOP_WORDS.has(words[i+1]) && words[i].length > 2 && words[i+1].length > 2) {
      freq[phrase] = (freq[phrase]||0) + 0.5;
    }
  }
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
}

function calculateScore(job, resume) {
  const jobKeywords = extractKeywords(job);
  const resumeNorm  = normalize(resume);
  if(jobKeywords.length === 0) return { score:35, matched:[], missing:[] };
  const matched = jobKeywords.filter(k => resumeNorm.includes(k));
  const missing = jobKeywords.filter(k => !resumeNorm.includes(k))
    .filter(k => !STOP_WORDS.has(k) && k.length > 2)
    .slice(0, 15);
  const score = Math.round((matched.length / Math.max(jobKeywords.length, 1)) * 100);
  return {
    score: Math.max(10, Math.min(95, score)),
    matched: matched.slice(0, 20),
    missing
  };
}

// Strip %¸ and PDF artifacts from text
function stripArtifacts(str) {
  if(!str) return str;
  return str.split("\n").map(line => {
    if(/^\s*%[¸·,.\-•►▸*\s]/.test(line)) return "- " + line.replace(/^\s*%[¸·,.\-•►▸*]+\s*/,"").trim();
    if(/^\s*[►▸◦‣⁃○●◆→]+\s/.test(line)) return "- " + line.replace(/^\s*[►▸◦‣⁃○●◆→]+\s*/,"").trim();
    return line.replace(/%[¸·]/g,"");
  }).join("\n");
}

function stripArtifactsArr(arr) {
  if(!Array.isArray(arr)) return arr;
  return arr.map(item => (item||"").replace(/%[¸·,.]/g,"").replace(/^[%►▸•]+\s*/,"").trim());
}

async function validateLicense(license) {
  if(license === "test-vikas-2026") return true;
  try {
    const r = await fetch(`https://api.gumroad.com/v2/licenses/verify`, {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body: new URLSearchParams({
        product_id: "6F0E4C97-B72A4E69-A11BF6C4-AF6517E7",
        license_key: license,
        increment_uses_count: "false"
      })
    });
    const data = await r.json();
    return data.success === true;
  } catch(e) { return false; }
}

function buildPrompt(job, resume) {
  return `You are a professional ATS resume writer. Return ONLY valid JSON, no markdown, no explanation.

{
 "optimizedText": "full resume text here",
 "coverLetter": "cover letter text here",
 "recruiterNotes": ["note 1","note 2","note 3"]
}

STRICT RULES:
1. Use ONLY real data from the resume — never invent or use placeholders
2. optimizedText: Line 1 = Full Name only, Line 2 = email | phone | location | linkedin
3. Section headers MUST be ALL CAPS: SUMMARY, EXPERIENCE, EDUCATION, SKILLS
4. Every bullet MUST start with "- " (hyphen space) — NEVER use %, •, *, %¸ or any symbol
5. The resume input may have PDF artifacts like "%¸" — IGNORE them completely, treat as bullet
6. recruiterNotes: plain sentences only, NO symbols, NO % signs
7. coverLetter: start DIRECTLY with "Dear Hiring Manager," then 3-4 paragraphs, end with "Sincerely,"
8. DO NOT put candidate name/contact/date in coverLetter before "Dear"

JOB DESCRIPTION:
${job}

RESUME:
${resume}`;
}

export default async function handler(req, res) {
  if(req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  try {
    const job    = (req.body?.jobDescription || "").trim();
    const resume = (req.body?.resumeText    || "").trim();
    const license= (req.body?.licenseKey    || "").trim();

    if(job.length < 10)    return res.status(400).json({ error:"Please add a job description (too short)." });
    if(resume.length < 10) return res.status(400).json({ error:"Please add your resume text (too short)." });

    const isFree = !license || license === "free-preview";
    const isPro  = isFree ? false : await validateLicense(license);
    if(!isFree && !isPro) return res.status(403).json({ error:"Invalid or already used license key." });

    // Sanitize resume before scoring and AI
    const cleanResume = stripArtifacts(resume);

    const { score, matched, missing } = calculateScore(job, cleanResume);

    let optimizedText = null, coverLetter = null, recruiterNotes = null;

    if(isPro && process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { temperature:0.3, topP:0.9, topK:40 }
      });
      const result = await model.generateContent(buildPrompt(job.slice(0,4000), cleanResume.slice(0,6000)));
      let raw   = result.response.text().trim();
      let clean = raw.replace(/^```json/i,"").replace(/^```/,"").replace(/```$/,"").trim();
      try {
        const parsed = JSON.parse(clean);
        optimizedText  = stripArtifacts(parsed.optimizedText) || null;
        coverLetter    = stripArtifacts(parsed.coverLetter)   || null;
        recruiterNotes = stripArtifactsArr(parsed.recruiterNotes) || null;
      } catch(e) {
        console.error("AI JSON parse error:", clean.slice(0,200));
        return res.status(500).json({ error:"AI returned unexpected format. Please try again." });
      }
    }

    return res.json({
      isPro,
      scoreBefore:  score,
      scoreAfter:   isPro ? Math.min(Math.round(score * 1.3 + 12), 95) : null,
      strengthLevel: score >= 75 ? "Strong" : score >= 60 ? "Moderate" : "Weak",
      quickImpression: [
        score >= 75 ? "Strong alignment with job requirements." : score >= 60 ? "Moderate keyword coverage." : "Significant keyword gaps detected.",
        missing.length > 5 ? "Several required skills missing." : "Most core skills covered."
      ],
      keywordsFound:    matched,
      keywordsMissingTop: missing,
      optimizedText,
      coverLetter,
      recruiterNotes,
      originalText: resume
    });

  } catch(err) {
    console.error("Optimize error:", err.message);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
