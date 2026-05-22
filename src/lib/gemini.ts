import { stripHtml } from "./utils";

async function fetchFromAI(endpoint: string, body: any): Promise<any> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || "AI Service Error");
  }

  return response.json();
}

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

  const prompt = `Tu es un expert pédagogique. Génère ${count} questions d'examen pour un niveau technique/professionnel sur le sujet suivant : "${topic}". 
    
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
    8. Ne fournis JAMAIS d'indices (hints), de remarques ou de pistes de réponse dans l'énoncé de la question.
    9. La langue de sortie doit être le Français.
    
    Répond uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING", description: "L'énoncé de la question" },
          type: { 
            type: "STRING", 
            enum: allowedTypes,
            description: "Le type de question"
          },
          options: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                text: { type: "STRING" },
                isCorrect: { type: "BOOLEAN" }
              },
              required: ['text']
            },
            description: "Options pour QCM, Vrai/Faux, Ordering (texte), Matching (gauche)"
          },
          matchOptions: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "OBLIGATOIRE pour Matching : Les éléments de la colonne de DROITE."
          },
          correctAnswer: { type: "STRING", description: "Corrigé type pour les questions à réponse courte" },
          correctAnswers: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Mots manquants pour Texte à trous"
          },
          correctOrder: {
            type: "ARRAY",
            items: { type: "NUMBER" },
            description: "Ordre correct des index pour Ordonnancement"
          },
          correctMatches: {
            type: "ARRAY",
            items: { type: "NUMBER" },
            description: "OBLIGATOIRE pour Matching : Index des matchOptions correspondant à chaque option de gauche."
          },
          columnAHeader: { type: "STRING", description: "Pour Matching : Titre de la colonne de gauche" },
          columnBHeader: { type: "STRING", description: "Pour Matching : Titre de la colonne de droite" },
          points: { type: "NUMBER", description: "Nombre de points (ex: 2)" }
        },
        required: ['text', 'type', 'points']
      }
    }
  };

  const result = await fetchFromAI("/api/ai/generate-questions", { prompt, config });

  try {
    return JSON.parse(result.text);
  } catch (error) {
    console.error("Error parsing AI response:", error);
    throw new Error("L'IA n'a pas pu générer les questions correctement.");
  }
};

export const evaluateShortAnswer = async (question: string, expectedAnswer: string, studentAnswer: string): Promise<number> => {
  if (!studentAnswer.trim()) return 0;
  
  const result = await fetchFromAI("/api/ai/evaluate-short-answer", { question, expectedAnswer, studentAnswer });

  const score = parseFloat(result.text.trim());
  return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
};

export const analyzeExamResults = async (
  examTitle: string,
  totalScore: number,
  totalPoints: number,
  questionResults: any[],
  questions: any[]
): Promise<string> => {
  const resultsSummary = questionResults.map((res, i) => {
    const q = questions[i];
    return `- Question: "${stripHtml(q.text)}" | Résultat: ${res.pointsEarned}/${q.points || 1} | Type: ${q.type}`;
  }).join('\n');

  const result = await fetchFromAI("/api/ai/analyze-results", { examTitle, totalScore, totalPoints, resultsSummary });

  return result.text.trim();
};

export const generateQuestionVariation = async (
  originalQuestion: any,
  instruction: string = "Propose une variation de cette question (même sujet, mais formulation ou valeurs différentes)"
): Promise<GeneratedQuestion> => {
  const prompt = `Tu es un expert pédagogique. Voici une question d'examen originale :
    ${JSON.stringify(originalQuestion)}
    
    Instruction de l'utilisateur : "${instruction}"
    
    Génère une NOUVELLE question basée sur l'originale en suivant l'instruction. Garde le même type de question (${originalQuestion.type}) et le même nombre de points (${originalQuestion.points}).
    
    Répond uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        text: { type: "STRING" },
        type: { type: "STRING" },
        options: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              text: { type: "STRING" },
              isCorrect: { type: "BOOLEAN" }
            },
            required: ['text']
          }
        },
        correctAnswer: { type: "STRING" },
        correctAnswers: { type: "ARRAY", items: { type: "STRING" } },
        matchOptions: { type: "ARRAY", items: { type: "STRING" } },
        correctMatches: { type: "ARRAY", items: { type: "NUMBER" } },
        correctOrder: { type: "ARRAY", items: { type: "NUMBER" } },
        points: { type: "NUMBER" }
      },
      required: ['text', 'type', 'points']
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};

export const generateDistractors = async (question: string, correctAnswer: string): Promise<string[]> => {
  const prompt = `Génère 3 fausses options (distracteurs) plausibles pour la question suivante :
    Question : "${stripHtml(question)}"
    Réponse correcte : "${stripHtml(correctAnswer)}"
    
    Répond uniquement avec un tableau JSON de 3 chaînes de caractères.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });

  try {
    return JSON.parse(result.text);
  } catch (error) {
    console.error("Error parsing distractors:", error);
    return [];
  }
};

export const generateMatchingPairs = async (topic: string, count: number = 4): Promise<{ a: string, b: string }[]> => {
  const prompt = `Génère ${count} paires d'associations logiques sur le sujet suivant : "${stripHtml(topic)}".
    Chaque paire doit être composée d'un élément court (A) et d'un élément correspondant (B).
    
    Répond uniquement avec un tableau JSON d'objets : [{ "a": "...", "b": "..." }]`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          a: { type: "STRING" },
          b: { type: "STRING" }
        },
        required: ["a", "b"]
      }
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });

  try {
    return JSON.parse(result.text);
  } catch (error) {
    console.error("Error parsing matching pairs:", error);
    return [];
  }
};

export const refineQuestion = async (question: any): Promise<any> => {
  const result = await fetchFromAI("/api/ai/refine-question", { question });

  try {
    return JSON.parse(result.text);
  } catch (error) {
    console.error("Error refining question:", error);
    return question;
  }
};
