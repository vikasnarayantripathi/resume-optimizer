import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30
};

function buildPrompt(jobDescription, resumeText, isPro){

return `
You are a professional ATS resume analyzer.

Return ONLY valid JSON.

FORMAT:

{
 "scoreBefore": number,
 "strengthLevel": "Strong | Moderate | Weak",
 "quickImpression": ["point","point","point"],
 "keywordsFound": ["kw"],
 "keywordsMissingTop": ["kw"],
 "scoreAfter": number,
 "optimizedText": "formatted resume",
 "coverLetter": "text",
 "recruiterNotes": ["note"]
}

IMPORTANT SCORING RULES:
- Compare job description vs resume strictly
- Score must reflect % of required keywords present
- Never give 100 unless resume perfectly matches
- Most resumes should score 40–75
- Round to integer

KEYWORD RULES:
- Extract real skills/tools/technologies from job description
- Mark only exact or clear semantic matches as found
- Missing keywords must be realistic

RESUME FORMATTING RULES:
- optimizedText MUST be multi-line formatted resume
- Use section headers like:

SUMMARY
SKILLS
EXPERIENCE
EDUCATION

- Use line breaks between sections
- Use "- " bullet points
- NEVER output one paragraph

JOB DESCRIPTION:
${jobDescription}

RESUME:
${resumeText}

${isPro
? "USER HAS PRO ACCESS → fill ALL fields including optimizedText, scoreAfter, coverLetter, recruiterNotes."
: "USER IS FREE → fill ONLY scoreBefore, strengthLevel, quickImpression, keywordsFound, keywordsMissingTop. Leave others empty."
}

Do NOT add explanations.
`;
}

export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"});
}

try{

const job=req.body.jobDescription||"";
const resume=req.body.resumeText||"";
let license=(req.body.licenseKey||"").trim().toLowerCase();

if(job.length<10) return res.status(400).json({error:"Missing job description"});
if(resume.length<10) return res.status(400).json({error:"Missing resume"});

const isPro=license==="test-vikas-2026";

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model=genAI.getGenerativeModel({
model:"gemini-2.5-flash-lite",
generationConfig:{
temperature:0.1,
topP:0.8,
topK:20
}
});

const result=await model.generateContent(
buildPrompt(job.slice(0,4000),resume.slice(0,6000),isPro)
);

const raw=result.response.text().trim();
const jsonStr=raw.replace(/^```json/i,'').replace(/```$/,'').trim();

let parsed;
try{
parsed=JSON.parse(jsonStr);
}catch(e){
console.error("JSON ERROR:",raw);
return res.status(500).json({error:"AI JSON parse failed"});
}

const scoreBefore=parsed.scoreBefore?Math.round(parsed.scoreBefore):null;
const scoreAfter=parsed.scoreAfter?Math.round(parsed.scoreAfter):null;

return res.json({

isPro,

scoreBefore,
strengthLevel:parsed.strengthLevel||null,
quickImpression:parsed.quickImpression||[],
keywordsFound:parsed.keywordsFound||[],
keywordsMissingTop:parsed.keywordsMissingTop||[],

scoreAfter:isPro?scoreAfter:null,
optimizedText:isPro?parsed.optimizedText:null,
coverLetter:isPro?parsed.coverLetter:null,
recruiterNotes:isPro?parsed.recruiterNotes:null,

originalText:resume

});

}catch(err){

console.error("SERVER ERROR:",err);

return res.status(500).json({
error:"Server error: "+err.message
});

}
}