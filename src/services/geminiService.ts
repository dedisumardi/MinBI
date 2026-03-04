import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAIInstance() {
  if (!aiInstance) {
    // Menggunakan API Key yang diberikan pengguna sebagai fallback
    let apiKey = process.env.GEMINI_API_KEY;
    
    // Jika process.env tidak ada atau string "undefined", gunakan hardcoded key
    if (!apiKey || apiKey === "undefined" || apiKey === "") {
      apiKey = "AIzaSyBoxeCEzfN-_6iiShBIARoDEq3TewqKpj0";
    }
    
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export const geminiModel = "gemini-3-flash-preview";

export async function askAI(prompt: string, systemInstruction: string) {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });
    
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    if (error instanceof Error && error.message.includes("GEMINI_API_KEY")) {
      return "Konfigurasi AI belum lengkap. Harap pastikan API Key sudah terpasang.";
    }
    return "Maaf, asisten sedang sibuk. Silakan coba lagi nanti.";
  }
}

export async function getMotivation() {
  const systemInstruction = "Anda adalah motivator pendidikan di SDIT Bina Insan Parepare. Berikan satu motivasi islami pendek untuk anak sekolah dasar. Gunakan bahasa Indonesia yang menyemangati.";
  return askAI("Berikan satu motivasi islami pendek.", systemInstruction);
}

export async function getSpmbTips(category: string) {
  const systemInstruction = "Anda adalah konsultan pendidikan di SDIT Bina Insan Parepare. Berikan 3 tips singkat untuk orang tua dalam mempersiapkan kategori masuk SDIT.";
  return askAI(`Berikan 3 tips singkat untuk ${category}.`, systemInstruction);
}
