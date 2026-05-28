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

export const generateAnnouncementAI = async (
  topic: string, 
  audience: string, 
  tone: string
): Promise<{ title: string; content: string; importance: 'normal' | 'low' | 'high' }> => {
  const prompt = `Tu es un assistant pédagogique d'IA. Génère un communiqué ou une annonce scolaire de haute qualité selon ces paramètres :
    Sujet/Objectif : "${topic}"
    Audience cible : "${audience}" (ex: les étudiants de la filière Web, tous les élèves, etc.)
    Ton / Style : "${tone}" (ex: standard Académique, vigilant/Urgent, motivant & dynamique, etc.)
    
    Format de réponse attendu : un objet JSON valide contenant :
    1. "title" : Un titre percutant, court et professionnel (maximum 75 caractères) avec un émoji introductif pertinent.
    2. "content" : Un long texte rédigé en HTML propre (avec des paragraphes <p>, des listes à puces <ul>/<li>, des mots importants en gras <strong> ou italique <em>). Ne pas inclure de balises html globales comme <html> ou <body>, juste le balisage structuré pour le corps de l'annonce. Reste bienveillant, clair et mentionne les détails, livrables ou dates s'il y en a dans le sujet.
    3. "importance" : Evalue la criticité de l'annonce ('normal', 'low', ou 'high') selon l'urgence du sujet.
    
    Répond uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        content: { type: "STRING" },
        importance: { type: "STRING", enum: ["low", "normal", "high"] }
      },
      required: ["title", "content", "importance"]
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};

export const generateStudyGuideAI = async (
  moduleName: string, 
  topic: string
): Promise<{ title: string; sections: { subtitle: string; markdownContent: string }[]; keyTakeaways: string[] }> => {
  const prompt = `Tu es une IA de vulgarisation et de pédagogie académique. Génère une Fiche Synthétique de Cours (un guide de révision de référence) pour les étudiants :
    Module/Discipline : "${moduleName}"
    Sujet ou leçon : "${topic}"
    
    Format de réponse attendu : un objet JSON contenant :
    1. "title" : Titre de la ficher de révision (ex: "Fiche Synthèse : Les bases de React et du State Management")
    2. "sections" : Un tableau d'au moins 3 sections d'étude, chaque sous-section contenant :
       - "subtitle" : Nom de la section (ex: "Enjeux et Mécanique Fondamentale")
       - "markdownContent" : Le contenu de cours rédigé en format Markdown fluide, structuré, professionnel avec du code d'illustration ou des exemples concrets pertinents.
    3. "keyTakeaways" : Liste d'au moins 4 points clés capitaux ("A retenir absolument") sous forme de phrases courtes et mémorables.
    
    Répond uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        sections: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              subtitle: { type: "STRING" },
              markdownContent: { type: "STRING" }
            },
            required: ["subtitle", "markdownContent"]
          }
        },
        keyTakeaways: {
          type: "ARRAY",
          items: { type: "STRING" }
        }
      },
      required: ["title", "sections", "keyTakeaways"]
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};

export const generateRubricAI = async (
  assignment: string, 
  totalPoints: number
): Promise<{ title: string; criteriaList: { criteriaName: string; maxPoints: number; description: string }[]; tips: string }> => {
  const prompt = `Tu es un formateur et inspecteur académique. Aide-moi à concevoir un barème de notation précis et une grille de critères (Rubric) pour corriger ce devoir ou projet :
    Sujet/Description du devoir : "${assignment}"
    Total de points visé : ${totalPoints} points d'évaluation.
    
    Génère un tableau de critères de réussite clairs et mesurables. La somme de la propriété "maxPoints" de tous les critères générés DOIT être exactement égale à ${totalPoints} points.
    
    Format de réponse attendu : un objet JSON contenant :
    1. "title" : Titre de la grille (ex: "Grille d'Évaluation : Projet Pratique React & API")
    2. "criteriaList" : Tableau de critères, contenant pour chacun :
       - "criteriaName" : Nom clair (ex: "Qualité du Code & Architecture", "Conformité du Design", ou "Gestion des États")
       - "maxPoints" : Barème max de points (ex: 5)
       - "description" : Instructions détaillées de ce que l'étudiant doit accomplir pour obtenir l'intégralité de ces points.
    3. "tips" : Conseil d'évaluation général pour le correcteur (ex: "Soigner la tolérance sur la réactivité CSS", "Vérifier le chargement asynchrone").
    
    Répond uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        criteriaList: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              criteriaName: { type: "STRING" },
              maxPoints: { type: "INTEGER" },
              description: { type: "STRING" }
            },
            required: ["criteriaName", "maxPoints", "description"]
          }
        },
        tips: { type: "STRING" }
      },
      required: ["title", "criteriaList", "tips"]
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};

export const generateCohortReportAI = async (
  cohortName: string,
  avgPercent: number,
  resultsData: Array<{ studentName: string; examTitle: string; score: number; totalPoints: number }>,
  examsCount: number
): Promise<{ 
  overview: string; 
  strengths: string[]; 
  weaknesses: string[]; 
  remediations: string[]; 
  conclusion: string 
}> => {
  const serializedResults = resultsData.slice(0, 40).map(r => 
    `- Étudiant: ${r.studentName} | Évaluation: "${r.examTitle}" | Note: ${r.score}/${r.totalPoints} (${Math.round(r.score/(r.totalPoints || 1) * 100)}%)`
  ).join("\n");

  const prompt = `Tu es un inspecteur d'académie et un analyste de performances scolaires. Analyse l'état des résultats scolaires pour cette cohorte :
    Nom de la Cohorte/Module : "${cohortName}"
    Nombre d'examens : ${examsCount}
    Moyenne générale de la classe : ${avgPercent.toFixed(1)}%
    
    Voici l'historique récent des copies élèves :
    ${serializedResults}
    
    Format de réponse attendu : un objet JSON valide contenant :
    1. "overview" : Un résumé d'analyse pédogogique global, factuel et chaleureux (sans citer de numéros de questions, maximum 4-5 phrases).
    2. "strengths" : Un tableau d'au moins 3 forces académiques identifiées chez le groupe ou les étudiants performants.
    3. "weaknesses" : Un tableau d'au moins 3 lacunes, concepts non assimilés ou difficultés récurrentes déduites des bas scores.
    4. "remediations" : Un tableau d'au moins 3 plans d'action correctifs ou remédiations concrètes que le formateur peut mettre en place.
    5. "conclusion" : Un mot d'encouragement professionnel et prospectif pour le formateur.
    
    Réponds uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        overview: { type: "STRING" },
        strengths: { type: "ARRAY", items: { type: "STRING" } },
        weaknesses: { type: "ARRAY", items: { type: "STRING" } },
        remediations: { type: "ARRAY", items: { type: "STRING" } },
        conclusion: { type: "STRING" }
      },
      required: ["overview", "strengths", "weaknesses", "remediations", "conclusion"]
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};

