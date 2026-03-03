import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiModel = "gemini-3-flash-preview";

export async function askAI(prompt: string, systemInstruction: string) {
  try {
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
