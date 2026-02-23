import PDFDocument from "pdfkit";

export const config = { api:{ bodyParser:true }, maxDuration:30 };

export default async function handler(req,res){

if(req.method!=="POST"){
return res.status(405).json({error:"Method not allowed"});
}

try{

const { optimizedText, licenseKey } = req.body;

if(!optimizedText) return res.status(400).json({error:"Missing resume"});

if(licenseKey!=="test-vikas-2026"){
return res.status(403).json({error:"Pro required"});
}

const doc=new PDFDocument({margin:50});

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition","attachment; filename=optimized-resume.pdf");

doc.pipe(res);

const lines=optimizedText.split("\n").filter(l=>l.trim()!="");

if(lines.length>0){

// NAME
doc.fontSize(20).font("Helvetica-Bold").text(lines[0],{align:"center"});

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

// BODY
doc.fontSize(11).font("Helvetica");

for(let i=2;i<lines.length;i++){

let line=lines[i];

if(line.includes("----")){
doc.moveDown(.6);
doc.moveTo(50,doc.y).lineTo(550,doc.y).stroke();
doc.moveDown(.6);
continue;
}

// Section titles
if(
line==="SUMMARY"||
line==="SKILLS"||
line==="EXPERIENCE"||
line==="EDUCATION"
){
doc.moveDown(.5);
doc.font("Helvetica-Bold").fontSize(12).text(line);
doc.moveDown(.2);
doc.font("Helvetica").fontSize(11);
continue;
}

doc.text(line);

}

doc.end();

}catch(e){

console.error(e);
return res.status(500).json({error:e.message});

}

}