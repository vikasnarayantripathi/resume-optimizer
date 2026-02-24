import { GoogleGenerativeAI } from "@google/generative-ai";

export const config={
api:{bodyParser:{sizeLimit:"6mb"}},
maxDuration:30
};

const STOP=new Set(["and","or","the","with","for","to","of","in","on","a","an"]);

function extract(t){
return [...new Set((t.toLowerCase().match(/\b[a-z0-9.+#]{3,}\b/g)||[])
.filter(w=>!STOP.has(w)))].slice(0,40);
}

function score(job,resume){
const k=extract(job);
const r=resume.toLowerCase();
const matched=k.filter(x=>r.includes(x));
let s=Math.round((matched.length/k.length)*100||0);
s=Math.min(Math.max(s,35),92);
return {s,matched,missing:k.filter(x=>!matched.includes(x))};
}

export default async function handler(req,res){

try{

const {jobDescription,resumeText,licenseKey}=req.body||{};

if(!jobDescription||jobDescription.length<10)
return res.status(400).json({error:"Job description missing"});

if(!resumeText||resumeText.length<10)
return res.status(400).json({error:"Resume missing"});

const isPro=licenseKey==="test-vikas-2026";

const {s,matched,missing}=score(jobDescription,resumeText);

let optimizedText=null,coverLetter=null,recruiterNotes=null;

if(isPro){

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model=genAI.getGenerativeModel({
model:"gemini-2.5-flash-lite",
generationConfig:{temperature:0.3,topP:0.9,topK:40}
});

const prompt=`Return ONLY JSON:
{"optimizedText":"","coverLetter":"","recruiterNotes":[]}

JOB:${jobDescription}
RESUME:${resumeText}`;

const out=await model.generateContent(prompt);

let txt=out.response.text().trim()
.replace(/^```json/i,'')
.replace(/```$/,'')
.trim();

try{
const j=JSON.parse(txt);
optimizedText=j.optimizedText||null;
coverLetter=j.coverLetter||null;
recruiterNotes=j.recruiterNotes||null;
}catch(e){
console.error("AI JSON parse failed:",txt);
}

}

res.json({
isPro,
scoreBefore:s,
keywordsFound:matched.slice(0,10),
keywordsMissingTop:missing.slice(0,10),
optimizedText,
coverLetter,
recruiterNotes
});

}catch(e){
console.error(e);
res.status(500).json({error:e.message});
}

}import { GoogleGenerativeAI } from "@google/generative-ai";

export const config={
api:{bodyParser:{sizeLimit:"6mb"}},
maxDuration:30
};

const STOP=new Set(["and","or","the","with","for","to","of","in","on","a","an"]);

function extract(t){
return [...new Set((t.toLowerCase().match(/\b[a-z0-9.+#]{3,}\b/g)||[])
.filter(w=>!STOP.has(w)))].slice(0,40);
}

function score(job,resume){
const k=extract(job);
const r=resume.toLowerCase();
const matched=k.filter(x=>r.includes(x));
let s=Math.round((matched.length/k.length)*100||0);
s=Math.min(Math.max(s,35),92);
return {s,matched,missing:k.filter(x=>!matched.includes(x))};
}

export default async function handler(req,res){

try{

const {jobDescription,resumeText,isPro}=req.body||{};

if(!jobDescription||jobDescription.length<10)
return res.status(400).json({error:"Job description missing"});

if(!resumeText||resumeText.length<10)
return res.status(400).json({error:"Resume missing"});

const {s,matched,missing}=score(jobDescription,resumeText);

let optimizedText=null,coverLetter=null,recruiterNotes=null;

if(isPro){

const genAI=new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model=genAI.getGenerativeModel({
model:"gemini-2.5-flash-lite",
generationConfig:{temperature:0.3,topP:0.9,topK:40}
});

const prompt=`Return ONLY JSON:
{"optimizedText":"","coverLetter":"","recruiterNotes":[]}

JOB:${jobDescription}
RESUME:${resumeText}`;

const out=await model.generateContent(prompt);

let txt=out.response.text().trim()
.replace(/^```json/i,'')
.replace(/```$/,'')
.trim();

try{
const j=JSON.parse(txt);
optimizedText=j.optimizedText||null;
coverLetter=j.coverLetter||null;
recruiterNotes=j.recruiterNotes||null;
}catch(e){
console.error("AI JSON parse error:",txt);
}

}

res.json({
scoreBefore:s,
keywordsFound:matched.slice(0,10),
keywordsMissingTop:missing.slice(0,10),
optimizedText,
coverLetter,
recruiterNotes
});

}catch(e){
console.error(e);
res.status(500).json({error:e.message});
}

}