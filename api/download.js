import PDFDocument from "pdfkit";

export const config = { api:{ bodyParser:true }, maxDuration:30 };

export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"});
}

try{

const { type, optimizedText, coverLetter, report, licenseKey } = req.body;

if(licenseKey!=="test-vikas-2026"){
return res.status(403).json({error:"Pro required"});
}

const doc=new PDFDocument({margin:50});

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition",`attachment; filename=${type}.pdf`);

doc.pipe(res);

if(type==="resume"){

const lines=optimizedText.split("\n").filter(l=>l.trim()!="");

doc.fontSize(20).font("Helvetica-Bold").text(lines[0],{align:"center"});

if(lines[1]){
doc.fontSize(10).font("Helvetica").fillColor("#555")
.text(lines[1],{align:"center"});
doc.fillColor("#000");
}

doc.moveDown();
doc.moveTo(50,doc.y).lineTo(550,doc.y).stroke();
doc.moveDown();

doc.fontSize(11).font("Helvetica");

for(let i=2;i<lines.length;i++){

let line=lines[i];

if(line.includes("----")){
doc.moveDown(.6);
doc.moveTo(50,doc.y).lineTo(550,doc.y).stroke();
doc.moveDown(.6);
continue;
}

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

else if(type==="cover"){

doc.fontSize(12).font("Helvetica").text(coverLetter);

}

else if(type==="report"){

doc.fontSize(18).font("Helvetica-Bold").text("ATS Optimization Report");

doc.moveDown();

const score=report.score;

doc.fontSize(12).font("Helvetica").text("ATS Score: "+score+"/100");

doc.moveDown();

// draw meter bar
const x=50;
const y=doc.y;
const width=400;

doc.rect(x,y,width,15).stroke();
doc.rect(x,y,width*(score/100),15).fill("#667eea");
doc.moveDown(2);

doc.fillColor("#000");

doc.font("Helvetica-Bold").text("Recruiter Impression");
doc.font("Helvetica");
(report.impression||[]).forEach(t=>doc.text("• "+t));

doc.moveDown();

doc.font("Helvetica-Bold").text("Missing Keywords");
doc.font("Helvetica");
(report.keywords||[]).forEach(t=>doc.text("• "+t));

doc.moveDown();

doc.font("Helvetica-Bold").text("Recruiter Notes");
doc.font("Helvetica");
(report.notes||[]).forEach(t=>doc.text("• "+t));

}

doc.end();

}catch(e){

console.error(e);
return res.status(500).json({error:e.message});

}

}