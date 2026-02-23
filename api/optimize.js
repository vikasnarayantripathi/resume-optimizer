import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

function buildPrompt(job,resume,isPro){

return `
You are a PROFESSIONAL ATS resume writer.

Return ONLY JSON.

FORMAT:
{
 "scoreBefore": number,
 "strengthLevel": "Strong | Moderate | Weak",
 "quickImpression": ["point","point","point"],
 "keywordsFound": ["kw"],
 "keywordsMissingTop": ["kw"],
 "scoreAfter": number,
 "optimizedText": "resume",
 "coverLetter": "text",
 "recruiterNotes": ["note"]
}

RESUME STYLE RULES:

1. First line MUST be candidate FULL NAME in caps
2. Second line MUST be:
Email | Phone | Location

3. Use sections with separators:

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
5. Keep spacing between sections
6. Never output single paragraph
7. Keep original candidate info

SCORING:
- realistic ATS scoring
- typical resumes 45–75
- only perfect resumes above 85

JOB:
${job}

RESUME:
${resume}

${isPro
? "USER PRO → fill ALL fields"
: "USER FREE → fill only scoreBefore, keywords, strengthLevel, quickImpression"
}
`;
}

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

const isPro=license==="test-vikas-2026";

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

let parsed;
try{ parsed=JSON.parse(jsonStr); }
catch{
console.error(raw);
return res.status(500).json({error:"AI JSON error"});
}

return res.json({

isPro,

scoreBefore:Math.round(parsed.scoreBefore||0),
strengthLevel:parsed.strengthLevel||null,
quickImpression:parsed.quickImpression||[],
keywordsFound:parsed.keywordsFound||[],
keywordsMissingTop:parsed.keywordsMissingTop||[],

scoreAfter:isPro?Math.round(parsed.scoreAfter||0):null,
optimizedText:isPro?parsed.optimizedText:null,
coverLetter:isPro?parsed.coverLetter:null,
recruiterNotes:isPro?parsed.recruiterNotes:null,

originalText:resume

});

}catch(e){
console.error(e);
return res.status(500).json({error:e.message});
}
}