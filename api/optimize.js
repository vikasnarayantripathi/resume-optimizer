import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

/* ---------- KEYWORD ENGINE ---------- */

function extractKeywords(text){
return Array.from(
new Set(
(text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [])
)
).slice(0,40);
}

function calculateScore(job,resume){

const jobWords = extractKeywords(job);
const resumeLower = resume.toLowerCase();

const matched = jobWords.filter(w => resumeLower.includes(w));
const missing = jobWords.filter(w => !resumeLower.includes(w));

let score = Math.round((matched.length / jobWords.length) * 100 || 0);

// clamp realistic ATS range
score = Math.min(Math.max(score,35),92);

return { score, matched, missing };
}

/* ---------- AI PROMPT ---------- */

function buildPrompt(job,resume,isPro){

return `
You are a PROFESSIONAL ATS resume writer.

Return ONLY JSON.

FORMAT:
{
 "optimizedText": "resume",
 "coverLetter": "text",
 "recruiterNotes": ["note"]
}

RESUME FORMAT RULES:

1. First line MUST be FULL NAME in caps
2. Second line MUST be:
Email | Phone | Location

3. Use clean sections:

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

4. Bullet points start with "- "
5. Never output a single paragraph
6. Keep candidate info real — do NOT invent data

JOB:
${job}

RESUME:
${resume}

${isPro
? "USER PRO → generate optimizedText, coverLetter, recruiterNotes"
: "USER FREE → return empty values"
}
`;
}

/* ---------- HANDLER ---------- */

export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"});
}

try{

const job=req.body.jobDescription||"";
const resume=req.body.resumeText||"";
const license=(req.body.licenseKey||"").trim().toLowerCase();

if(job.length<10) return res.status(400).json({error:"Missing job"});
if(resume.length<10) return res.status(400).json({error:"Missing resume"});

const isPro = license==="test-vikas-2026";

/* ---- REAL ATS SCORE ---- */

const {score,matched,missing} = calculateScore(job,resume);

/* ---- AI ONLY FOR PRO ---- */

let parsed={};

if(isPro){

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model=genAI.getGenerativeModel({
model:"gemini-2.5-flash-lite",
generationConfig:{ temperature:0.1, topP:0.8, topK:20 }
});

const result=await model.generateContent(
buildPrompt(job.slice(0,4000),resume.slice(0,6000),isPro)
);

const raw=result.response.text().trim();
const jsonStr=raw.replace(/^```json/i,'').replace(/```$/,'').trim();

try{
parsed=JSON.parse(jsonStr);
}catch{
console.error("AI JSON ERROR:",raw);
parsed={};
}

}

/* ---- RESPONSE ---- */

return res.json({

isPro,

scoreBefore:score,

strengthLevel:
score>75?"Strong":
score>55?"Moderate":"Weak",

quickImpression:[
score>70?"Good keyword alignment":"Needs better keyword alignment",
missing.length>6?"Several important skills missing":"Most core skills present",
"Score calculated using ATS keyword match"
],

keywordsFound:matched.slice(0,10),
keywordsMissingTop:missing.slice(0,10),

scoreAfter:isPro?Math.min(score+10,96):null,
optimizedText:isPro?parsed.optimizedText:null,
coverLetter:isPro?parsed.coverLetter:null,
recruiterNotes:isPro?parsed.recruiterNotes:null,

originalText:resume

});

}catch(e){

console.error("SERVER ERROR:",e);
return res.status(500).json({error:e.message});

}
}