import PDFDocument from "pdfkit";

export const config={
api:{bodyParser:{sizeLimit:"6mb"}},
maxDuration:30
};

export default async function handler(req,res){

if(req.method!=="POST")
return res.status(405).json({error:"Method not allowed"});

try{

const {type,optimizedText,coverLetter,report,photo}=req.body;

const doc=new PDFDocument({margin:50});

res.setHeader("Content-Type","application/pdf");
res.setHeader("Content-Disposition",`attachment; filename="${type}.pdf"`);

doc.pipe(res);

if(type==="resume"){

if(photo){
try{
const img=photo.replace(/^data:image\/\w+;base64,/,"");
doc.image(Buffer.from(img,"base64"),250,40,{width:80});
doc.moveDown(4);
}catch{}
}

doc.text(optimizedText||"");
}

else if(type==="cover"){
doc.text(coverLetter||"");
}

else if(type==="report"){
doc.text("ATS Report\n\nScore: "+(report?.score||0)+"\n\n");
(report?.notes||[]).forEach(n=>doc.text("• "+n));
}

doc.end();

}catch(e){
console.error(e);
res.status(500).json({error:e.message});
}

}