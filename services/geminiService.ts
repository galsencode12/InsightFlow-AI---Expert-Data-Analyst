
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, DataPayload } from "../types";

const API_KEY = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export const analyzeData = async (data: DataPayload): Promise<AnalysisResult> => {
  const model = "gemini-3-pro-preview";
  
  const headersStr = data.headers ? data.headers.join(", ") : "Inconnus";
  const sampleData = data.type === 'pdf' 
    ? data.content.substring(0, 15000) 
    : JSON.stringify(data.content.slice(0, 60));

  const prompt = `
    Agis en tant que Data Scientist de classe mondiale et Analyste de Données Senior. 
    Je vais te fournir un échantillon de données provenant d'un fichier ${data.type.toUpperCase()} nommé "${data.name}".
    
    Colonnes disponibles (Headers) : ${headersStr}

    Contexte des données :
    ${data.type === 'pdf' ? 'Texte extrait du PDF' : 'Représentation JSON des lignes'}
    ---
    ${sampleData}
    ---

    Mission :
    1. Analyser la structure et les tendances de ces données.
    2. Fournir une vue d'ensemble de haut niveau (en français).
    3. Extraire 5 insights analytiques profonds (en français).
    4. Suggérer 3 graphiques. TRÈS IMPORTANT : Pour xAxis et yAxis, utilise EXACTEMENT les noms de colonnes fournis dans la liste des Headers ci-dessus. Le yAxis doit impérativement être une colonne contenant des valeurs numériques.
    5. Fournir une brève perspective prédictive (en français).

    Tu DOIS répondre au format JSON en respectant exactement le schéma fourni. Toute la rédaction doit être en FRANÇAIS.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overview: { type: Type.STRING },
          keyInsights: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          suggestedCharts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'bar, line, pie, or scatter' },
                title: { type: Type.STRING },
                xAxis: { type: Type.STRING, description: 'Nom exact de la colonne pour l\'axe X' },
                yAxis: { type: Type.STRING, description: 'Nom exact de la colonne pour l\'axe Y (doit être numérique)' },
                description: { type: Type.STRING }
              },
              required: ['type', 'title', 'xAxis', 'yAxis', 'description']
            }
          },
          predictions: { type: Type.STRING }
        },
        required: ['overview', 'keyInsights', 'suggestedCharts']
      }
    }
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Échec de l'analyse Gemini:", error);
    throw new Error("Format d'analyse invalide reçu de l'IA.");
  }
};

export const chatWithData = async (
  data: DataPayload, 
  history: { role: 'user' | 'assistant', content: string }[],
  query: string
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  
  const sampleData = data.type === 'pdf' 
    ? data.content.substring(0, 8000) 
    : JSON.stringify(data.content.slice(0, 30));

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `Tu es un expert en science des données. Tu as accès au fichier "${data.name}". 
      Voici un échantillon des données : ${sampleData}. 
      Réponds toujours de manière professionnelle, basée sur les données, et EXCLUSIVEMENT en FRANÇAIS. 
      Utilise le Markdown pour le formatage.`
    }
  });

  const response = await chat.sendMessage({ message: query });
  return response.text || "Désolé, je n'ai pas pu traiter cette demande.";
};
