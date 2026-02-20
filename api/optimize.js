import Anthropic from "@anthropic-ai/sdk";
import Busboy from "busboy";

export const config = {
  api: { bodyParser: false }
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 10 * 1024 * 1024 } });
    const fields = {};
    const files = {};
    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => {
        files[name] = { buffer: Buffer.concat(chunks), filename: info.filename, mimetype: info.mimeType };
      });
    });
    bb.on("finish", () => resolve({ fields, files }));
    bb.on("error", err => reject(err));
    req.pipe(bb);
  });
}

async function extractPdf(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractDocx(buffer) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function buildPrompt(jobDescription, resumeText) {
  const prompt = [
    "You are an expert resume writer and ATS optimization specialist.",
    "",
    "Analyze this resume against the job description and produce an optimized version.",
    "",
    "JOB DESCRIPTION:",
    jobDescription,
    "",
    "ORIGINAL RESUME:",
    resumeText,
    "",
    "Respond with ONLY valid JSON using this exact structure:",
    "{",
    '  "scoreBefore": <integer 0-100>,',
    '  "scoreAfter": <integer 0-100>,',
    '  "keywordsFound": ["keyword1", "keyword2"],',
    '  "keywordsMissing": ["keyword1", "keyword2"],',
    '  "keywordsAdded": <integer>,',
    '  "optimizedText": "<full optimized resume with newlines as \\n>"',
    "}",
    "",
    "Rules:",
    "1. Reorder bullet points so most relevant ones appear first",
    "2. Naturally integrate missing keywords where they truthfully apply",
    "3. Strengthen weak bullets with stronger action verbs",
    "4. Do NOT fabricate jobs, degrees, or skills",
    "5. Keep the same resume structure and sections",
    "6. Make the summary strongly mirror the job language",
    "7. Only enhance, never invent"
  ].join("\n");
  return prompt;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let fields, files;
  try {
    ({ fields, files } = await parseForm(req));
  } catch (err) {
    return res.status(400).json({ error: "Failed to parse upload: " + err.message });
  }

  const { jobDescription, resumeText: pastedText, licenseKey } = fields;

  if (!jobDescription || jobDescription.trim().length < 50) {
    return res.status(400).json({ error: "Please provide a complete job description." });
  }

  if (!licenseKey) {
    return res.status(401).json({ error: "No license key provided." });
  }

  try {
    const gRes = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_id: process.env.GUMROAD_PRODUCT_ID,
        license_key: licenseKey.trim(),
        increment_uses_count: "false"
      })
    });
    const gData = await gRes.json();
    if (!gData.success || gData.purchase?.refunded) {
      return res.status(401).json({ error: "Invalid license key." });
    }
  } catch (err) {
    console.error("License verify error:", err);
  }

  let resumeText = "";
  if (pastedText && pastedText.trim().length > 50) {
    resumeText = pastedText.trim();
  } else if (files.resumeFile) {
    const { buffer, mimetype, filename } = files.resumeFile;
    try {
      if (mimetype === "application/pdf" || filename?.endsWith(".pdf")) {
        resumeText = await extractPdf(buffer);
      } else if (
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        filename?.endsWith(".docx")
      ) {
        resumeText = await extractDocx(buffer);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Please upload PDF or DOCX." });
      }
    } catch (err) {
      return res.status(400).json({ error: "Could not parse your file. Try pasting instead." });
    }
  } else {
    return res.status(400).json({ error: "Please provide your resume." });
  }

  if (resumeText.length < 100) {
    return res.status(400).json({ error: "Resume text is too short." });
  }

  const jobTrunc = jobDescription.trim().slice(0, 4000);
  const resumeTrunc = resumeText.trim().slice(0, 6000);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let claudeResult;
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: buildPrompt(jobTrunc, resumeTrunc) }]
    });
    const raw = message.content[0].text.trim();
    const jsonStr = raw.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    claudeResult = JSON.parse(jsonStr);
  } catch (err) {
    console.error("Claude error:", err);
    return res.status(500).json({ error: "AI optimization failed. Please try again." });
  }

  const required = ["scoreBefore", "scoreAfter", "keywordsFound", "keywordsMissing", "keywordsAdded", "optimizedText"];
  for (const field of required) {
    if (claudeResult[field] === undefined) {
      return res.status(500).json({ error: "AI returned unexpected format. Please try again." });
    }
  }

  return res.json({
    scoreBefore:     claudeResult.scoreBefore,
    scoreAfter:      claudeResult.scoreAfter,
    keywordsFound:   claudeResult.keywordsFound,
    keywordsMissing: claudeResult.keywordsMissing,
    keywordsAdded:   claudeResult.keywordsAdded,
    originalText:    resumeTrunc,
    optimizedText:   claudeResult.optimizedText
  });
}