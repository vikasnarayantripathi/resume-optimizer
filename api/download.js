import PDFDocument from "pdfkit";

export const config = {
  api:{ bodyParser:true },
  maxDuration:30
};

export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"});
}

try{

const { type, optimizedText, coverLetter, report, licenseKey, photo } = req.body;

if(licenseKey!=="test-vikas-2026"){
return res.status(403).json({error:"Pro required"});
}

const doc=new PDFDocument({margin:50});

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition",`attachment; filename=${type}.pdf`);

doc.pipe(res);

/* ================= RESUME ================= */

if(type==="resume"){

// photo
if(photo){
try{
const img=photo.replace(/^data:image\/\w+;base64,/,"");
doc.image(Buffer.from(img,"base64"),250,40,{width:80});
doc.moveDown(4);
}catch{}
}

const lines=(optimizedText||"").split("\n").filter(l=>l.trim());

if(lines.length>0){

// NAME
doc.fontSize(20).font("Helvetica-Bold")
.text(lines[0],{align:"center"});

// CONTACT
if(lines[1]){
doc.moveDown(0.3);
doc.fontSize(10).font("Helvetica").fillColor("#555")
.text(lines[1],{align:"center"});
doc.fillColor("#000");
}

doc.moveDown();
doc.moveTo(50,doc.y).lineTo(550,doc.y).stroke();
doc.moveDown();

}

doc.fontSize(11).font("Helvetica");

for(let i=2;i<lines.length;i++){

let line=lines[i];

// divider
if(line.includes("----")){
doc.moveDown(.6);
doc.moveTo(50,doc.y).lineTo(550,doc.y).stroke();
doc.moveDown(.6);
continue;
}

// section titles
if(["SUMMARY","SKILLS","EXPERIENCE","EDUCATION"].includes(line)){
doc.moveDown(.5);
doc.font("Helvetica-Bold").fontSize(12).text(line);
doc.moveDown(.2);
doc.font("Helvetica").fontSize(11);
continue;
}

doc.text(line);
}

}

/* ================= COVER LETTER ================= */

else if(type==="cover"){

doc.fontSize(12).font("Helvetica")
.text(coverLetter||"");

}

/* ================= REPORT ================= */

else if(type==="report"){

const score=report?.score||0;

doc.fontSize(18).font("Helvetica-Bold")
.text("ATS Optimization Report");

doc.moveDown();

doc.fontSize(12).font("Helvetica")
.text("ATS Score: "+score+"/100");

doc.moveDown();

// meter background
const x=50;
const y=doc.y;
const width=420;

doc.rect(x,y,width,16).stroke();

// meter fill
let color="#ff5a5a";
if(score>=70) color="#2ecc71";
else if(score>=55) color="#ffcc00";

doc.rect(x,y,width*(score/100),16).fill(color);

doc.fillColor("#000");
doc.moveDown(2);

// impression
doc.font("Helvetica-Bold").text("Recruiter Impression");
doc.font("Helvetica");
(report?.impression||[]).forEach(t=>doc.text("• "+t));

doc.moveDown();

// missing keywords
doc.font("Helvetica-Bold").text("Missing Keywords");
doc.font("Helvetica");
(report?.keywords||[]).forEach(t=>doc.text("• "+t));

doc.moveDown();

// notes
doc.font("Helvetica-Bold").text("Recruiter Notes");
doc.font("Helvetica");
(report?.notes||[]).forEach(t=>doc.text("• "+t));

}

doc.end();

}catch(e){

console.error(e);
return res.status(500).json({error:e.message});

}
}