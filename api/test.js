export default async function handler(req, res) {
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    res.json({ 
      success: true, 
      hasKey: !!process.env.GEMINI_API_KEY,
      keyLength: process.env.GEMINI_API_KEY?.length 
    });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
}
