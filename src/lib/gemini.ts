import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedQuestion {
  text: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-in-the-blanks' | 'ordering' | 'matching';
  options?: { text: string; isCorrect: boolean }[];
  matchOptions?: string[];
  correctAnswer?: string;
  correctAnswers?: string[];
  correctOrder?: number[];
  correctMatches?: number[];
  columnAHeader?: string;
  columnBHeader?: string;
  points: number;
}

export const generateQuestions = async (
  topic: string, 
  count: number = 5, 
  targetPoints?: number,
  allowedTypes: string[] = ['multiple-choice', 'true-false', 'short-answer']
): Promise<GeneratedQuestion[]> => {
  const pointsInstruction = targetPoints 
    ? `IMPORTANT : La somme totale des points de ces ${count} questions DOIT être exactement de ${targetPoints} points. Répartis les points de manière cohérente selon la difficulté.`
    : "Répartis les points (ex: 2 points par question).";

  const typeNamesMap: Record<string, string> = {
    'multiple-choice': 'QCM (multiple-choice)',
    'true-false': 'Vrai/Faux (true-false)',
    'short-answer': 'Réponse Courte (short-answer)',
    'fill-in-the-blanks': 'Texte à trous (fill-in-the-blanks)',
    'ordering': 'Ordonnancement (ordering)',
    'matching': 'Appariement (matching)'
  };

  const selectedTypeNames = allowedTypes.map(t => typeNamesMap[t] || t).join(', ');

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Tu es un expert pédagogique. Génère ${count} questions d'examen pour un niveau technique/professionnel sur le sujet suivant : "${topic}". 
    
    ${pointsInstruction}

    Instructions :
    1. Les questions doivent être EXCLUSIVEMENT des types suivants : ${selectedTypeNames}.
    2. Pour 'multiple-choice', fournis exactement 4 options avec 'isCorrect'.
    3. Pour 'true-false', fournis 2 options : "Vrai" et "Faux" avec 'isCorrect' sur la bonne.
    4. Pour 'short-answer', fournis une 'correctAnswer' qui sert de corrigé type.
    5. Pour 'fill-in-the-blanks', utilise [blank] dans le 'text' pour les trous, et liste les réponses dans 'correctAnswers'.
    6. Pour 'ordering', fournis les éléments dans 'options' sous forme d'objets avec 'text' (ex: [{"text": "Étape 1"}, {"text": "Étape 2"}]) et l'ordre correct des index dans 'correctOrder'.
    7. Pour 'matching', tu DOIS impérativement fournir :
       - 'options' : les éléments de la colonne de GAUCHE sous forme d'objets avec 'text' (ex: [{"text": "France"}, {"text": "Maroc"}]).
       - 'matchOptions' : les éléments de la colonne de DROITE sous forme de chaines de caractères (ex: ["Paris", "Rabat"]).
       - 'correctMatches' : les index de 'matchOptions' reliant la gauche à la droite (ex: [0, 1] car France correspond à matchOptions[0] (Paris)).
       - 'columnAHeader' et 'columnBHeader' : titres pertinents pour chaque colonne (ex: "Pays" et "Capitales").
    8. La langue de sortie doit être le Français.
    
    Répond uniquement au format JSON valide.`,
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
              enum: allowedTypes,
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
                required: ['text']
              },
              description: "Options pour QCM, Vrai/Faux, Ordering (texte), Matching (gauche)"
            },
            matchOptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "OBLIGATOIRE pour Matching : Les éléments de la colonne de DROITE."
            },
            correctAnswer: { type: Type.STRING, description: "Corrigé type pour les questions à réponse courte" },
            correctAnswers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Mots manquants pour Texte à trous"
            },
            correctOrder: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "Ordre correct des index pour Ordonnancement"
            },
            correctMatches: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "OBLIGATOIRE pour Matching : Index des matchOptions correspondant à chaque option de gauche."
            },
            columnAHeader: { type: Type.STRING, description: "Pour Matching : Titre de la colonne de gauche" },
            columnBHeader: { type: Type.STRING, description: "Pour Matching : Titre de la colonne de droite" },
            points: { type: Type.NUMBER, description: "Nombre de points (ex: 2)" }
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
