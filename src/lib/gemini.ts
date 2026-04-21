import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedQuestion {
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: { text: string; isCorrect: boolean }[];
  correctAnswer?: string;
  points: number;
}

export const generateQuestions = async (topic: string, count: number = 5): Promise<GeneratedQuestion[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Génère ${count} questions d'examen sur le sujet suivant : "${topic}". 
    Les questions doivent être variées (QCM, Vrai/Faux, Réponse Courte).
    Répond uniquement au format JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "L'énoncé de la question" },
            type: { 
              type: Type.STRING, 
              enum: ['multiple-choice', 'true-false', 'short-answer'],
              description: "Le type de question"
            },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN }
                },
                required: ['text', 'isCorrect']
              },
              description: "Options pour QCM ou Vrai/Faux"
            },
            correctAnswer: { type: Type.STRING, description: "Réponse correcte pour les questions à réponse courte" },
            points: { type: Type.NUMBER, description: "Nombre de points par défaut (ex: 2)" }
          },
          required: ['text', 'type', 'points']
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw new Error("L'IA n'a pas pu générer les questions correctement.");
  }
};

export const evaluateShortAnswer = async (question: string, expectedAnswer: string, studentAnswer: string): Promise<number> => {
  if (!studentAnswer.trim()) return 0;
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Évalue la réponse de l'étudiant par rapport à la réponse attendue pour la question donnée.
    Question : "${question}"
    Réponse attendue : "${expectedAnswer}"
    Réponse de l'étudiant : "${studentAnswer}"
    
    Donne un score entre 0 et 1 (0 = faux, 1 = parfait, entre les deux pour une réponse partiellement correcte).
    Sois indulgent sur l'orthographe si le sens est correct.
    Répond uniquement avec le nombre (ex: 0.5 ou 1).`,
  });

  const score = parseFloat(response.text.trim());
  return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
};
