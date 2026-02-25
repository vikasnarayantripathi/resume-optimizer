import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } },
  maxDuration: 30
};

const STOP_WORDS = new Set([
  "and","or","the","with","for","to","of","in","on","a","an",
  "responsible","candidate","role","ability","work","team",
  "excellent","strong","good","skills","experience"
]);

function extractKeywords(text="") {
  const words = text.toLowerCase().match(/\b[a-zA-Z0-9.+#]{3,}\b/g) || [];
  return [...new Set(words.filter(w => !STOP_WORDS.has(w)))].slice(0,40);
}

function normalize(text="") {
  return text.toLowerCase()
    .replace(/js/g,"javascript")
    .replace(/node /g,"nodejs ")
    .replace(/postgres/g,"postgresql");
}

function calculateScore(job, resume) {
  const jobKeywords = extractKeywords(job);
  const resumeText = normalize(resume);
  if(jobKeywords.length === 0) return { score:35, matched:[], missing:[] };
  const matched = jobKeywords.filter(k => resumeText.includes(k));
  const missing = jobKeywords.filter(k => !resumeText.includes(k));
  let score = Math.round((matched.length / jobKeywords.length) * 100);
  score = Math.min(Math.max(score,35),92);
  return { score, matched: matched.slice(0,12), missing: missing.slice(0,12) };
}

function buildPrompt(job,resume){
  return `You are a professional ATS resume writer. Return ONLY valid JSON, no markdown, no explanation.

{
 "optimizedText": "full optimized resume as plain text, ALL CAPS section headers, bullet points start with - ",
 "coverLetter": "professional cover letter tailored to the job",
 "recruiterNotes": ["specific improvement 1","specific improvement 2","specific improvement 3"]
}

RULES:
1. Use ONLY real candidate data - never use placeholders like [Your Name]
2. Do NOT invent experience, skills or education
3. optimizedText MUST start with: Line 1 = Full Name, Line 2 = email | phone | location | linkedin (all contact details on one line separated by |)
4. ALL CAPS section headers: SUMMARY, EXPERIENCE, EDUCATION, SKILLS
5. Bullet points start with -
6. Cover letter: start with candidate name & contact, then date, then Dear [Hiring Manager], body paragraphs, then Sincerely, [Name]
7. Recruiter notes explain specific improvements made

JOB DESCRIPTION:
${job}

RESUME:
${resume}`;
}

async function validateLicense(license) {
  if(license === "test-vikas-2026") return true;
  try {
    const r = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_id: "6F0E4C97-B72A4E69-A11BF6C4-AF6517E7",
        license_key: license,
        increment_uses_count: "false"
      })
    });
    const data = await r.json();
    return data.success === true;
  } catch(e) {
    return false;
  }
}

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try {
    const job = req.body.jobDescription||"";
    const resume = req.body.resumeText||"";
    const license = (req.body.licenseKey||"").trim();

    if(job.length<10) return res.status(400).json({error:"Job description missing"});
    if(resume.length<10) return res.status(400).json({error:"Resume missing"});

    // Free preview - no license needed, just show score + keywords
    const isFree = !license || license === "free-preview";
    const isPro = isFree ? false : await validateLicense(license);

    if(!isFree && !isPro){
      return res.status(403).json({error:"Invalid or already used license key."});
    }

    const {score,matched,missing} = calculateScore(job,resume);

    let optimizedText=null, coverLetter=null, recruiterNotes=null;

    // Only run AI for paid users
    if(isPro && process.env.GEMINI_API_KEY){
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model:"gemini-2.5-flash-lite",
        generationConfig:{temperature:0.3,topP:0.9,topK:40}
      });
      const result = await model.generateContent(buildPrompt(job.slice(0,4000),resume.slice(0,6000)));
      let raw = result.response.text().trim();
      let clean = raw.replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();
      try {
        const parsed = JSON.parse(clean);
        optimizedText = parsed.optimizedText||null;
        coverLetter = parsed.coverLetter||null;
        recruiterNotes = parsed.recruiterNotes||null;
      } catch(e) {
        console.error("AI JSON parse error:",clean);
        return res.status(500).json({error:"AI returned unexpected format. Please try again."});
      }
    }

    return res.json({
      isPro,
      scoreBefore: score,
      scoreAfter: isPro ? Math.min(score+8,95) : null,
      strengthLevel: score>=75?"Strong":score>=60?"Moderate":"Weak",
      quickImpression: [
        score>=75?"Strong alignment with job requirements.":score>=60?"Moderate keyword coverage.":"Significant keyword gaps detected.",
        missing.length>5?"Several required skills missing.":"Most core skills covered."
      ],
      keywordsFound: matched,
      keywordsMissingTop: missing,
      optimizedText,
      coverLetter,
      recruiterNotes,
      originalText: resume
    });

  } catch(err) {
    console.error("Server Error:",err);
    return res.status(500).json({error:err.message});
  }
}
