import { stripHtml } from "./utils";
import { PracticalExamSheet } from "../types";


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

  const text = result.text || "";
  let scoreNum = 0;
  
  try {
    const cleaned = text.trim();
    if (cleaned.startsWith("{")) {
      const parsed = JSON.parse(cleaned);
      if (parsed && parsed.score !== undefined) {
        scoreNum = parseFloat(parsed.score);
      }
    } else {
      scoreNum = parseFloat(cleaned);
    }
  } catch (e) {
    // ignore parsing errors
  }
  
  if (isNaN(scoreNum)) {
    // search for a floating point number in text
    const match = text.replace(',', '.').match(/(?:0\.\d+|1\.0|0|1|\.\d+)/);
    if (match) {
      scoreNum = parseFloat(match[0]);
    }
  }
  
  return isNaN(scoreNum) ? 0 : Math.max(0, Math.min(1, scoreNum));
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

export const generatePracticalExamAI = async (
  vendor: string,
  certificationName: string,
  topic: string,
  totalPoints: number,
  durationMinutes: number
): Promise<PracticalExamSheet> => {
  const prompt = `Tu es une IA experte en certifications technologiques majeures (Microsoft, Cisco, AWS, etc.) et formateur académique chevronné.
    Génère une fiche de sujet et d'évaluation structurée et complète pour un Examen Pratique de Certification.
    Elle doit respecter rigoureusement les critères suivants :
    - Constructeur / Vendeur : "${vendor}"
    - Certification ciblée : "${certificationName}"
    - Sujet technique d'étude : "${topic}"
    - Total des points d'évaluation : ${totalPoints} points
    - Durée recommandée : ${durationMinutes} minutes

    Génère une épreuve pratique réaliste de niveau professionnel, comprenant :
    1. Un titre d'examen officiel et accrocheur (ex: "Évaluation Pratique Cisco CCNA : routage statique et dynamique").
    2. Un contexte / scénario professionnel d'entreprise immersif (l'élève est mis en situation réelle de projet ou d'incident).
    3. Les prérequis opérationnels ou applicatifs de l'environnement matériel/logiciel (ex: Packet Tracer 8.x, MS Excel v16, VM Ubuntu Server).
    4. 3 à 5 tâches détaillées que le candidat doit accomplir dans l'environnement de test. La somme de la propriété "points" de toutes ces tâches DOIT être exactement de ${totalPoints} points d'évaluation.
    5. Pour chaque tâche, fournis un titre de tâche, une description claire, des points attribués, un tableau ordonné d'étapes d'exécution détaillées (steps), et une propriété "solution" très détaillée décrivant la réponse correcte attendue, les lignes de commandes exactes, les formules de calcul MS Excel précises (par ex. =RECHERCHEV ou =SOMME.SI), ou les correctifs à apporter au code/script de départ.
    6. De 1 à 3 fichiers fournis de démarrage ('providedFiles') adaptés au sujet technique et BASÉS DIRECTEMENT ET LOGIQUEMENT SUR LES TÂCHES ET QUESTIONS DE L'EXAMEN :
       - Les fichiers doivent représenter l'état de départ que le candidat doit modifier, configurer, analyser ou corriger d'après les consignes des tâches.
       - Si le sujet de l'examen porte sur Excel (vendeur Microsoft Office, etc.) ou s'il y a un tableau à compléter/analyser, fournis 1 fichier 'xlsx' contenant d'authentiques données brutes cohérentes de départ (dans 'excelSheets' avec des 'headers' et des 'rows' remplis de valeurs de test réalistes et d'exemples concrets, pas de simples placeholders). Les lignes et colonnes doivent correspondre aux éléments que les tâches demandent d'ordonner, de calculer ou de mettre en forme.
       - Si le sujet concerne Cisco, Linux ou du scripting, fournis un fichier '.txt' ou '.sh' contenant le script de base incomplet, un script buggé à corriger, ou des configurations initiales décrites dans les consignes des tâches de l'examen.
       - Si c'est Microsoft Word, crée un '.docx' avec le texte brut non mis en forme et désorganisé, ou le canevas initial que la tâche demande de restructurer.
    7. Une grille de critères de correction détaillés (evaluationCriteria) permettant à un formateur d'évaluer impartialement la production en temps réel.
    8. Des conseils et remarques d'évaluation (generalTipsForTeacher) utiles pour le formateur correcteur.
    9. Un résumé global de la solution officielle attendue ('officialSolutionSummary') décrivant en quelques paragraphes la démarche globale de résolution idéale de l'ensemble de l'épreuve.

    Réponds uniquement au format JSON valide.`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        title: { type: "STRING" },
        vendor: { type: "STRING" },
        certificationName: { type: "STRING" },
        durationMinutes: { type: "INTEGER" },
        scenario: { type: "STRING" },
        requirements: { type: "ARRAY", items: { type: "STRING" } },
        tasks: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              title: { type: "STRING" },
              description: { type: "STRING" },
              points: { type: "INTEGER" },
              steps: { type: "ARRAY", items: { type: "STRING" } },
              solution: { type: "STRING" }
            },
            required: ["id", "title", "description", "points", "steps", "solution"]
          }
        },
        providedFiles: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              fileName: { type: "STRING" },
              fileType: { type: "STRING" },
              description: { type: "STRING" },
              contentStructure: { type: "STRING" },
              rawContentText: { type: "STRING" },
              excelSheets: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    sheetName: { type: "STRING" },
                    headers: { type: "ARRAY", items: { type: "STRING" } },
                    rows: { 
                      type: "ARRAY", 
                      items: { 
                        type: "ARRAY", 
                        items: { type: "STRING" } 
                      } 
                    }
                  },
                  required: ["sheetName", "headers", "rows"]
                }
              }
            },
            required: ["fileName", "fileType", "description"]
          }
        },
        evaluationCriteria: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              taskTitle: { type: "STRING" },
              criteriaName: { type: "STRING" },
              points: { type: "INTEGER" },
              guidelines: { type: "STRING" }
            },
            required: ["taskTitle", "criteriaName", "points", "guidelines"]
          }
        },
        generalTipsForTeacher: { type: "STRING" },
        officialSolutionSummary: { type: "STRING" }
      },
      required: [
        "title", 
        "vendor", 
        "certificationName", 
        "durationMinutes", 
        "scenario", 
        "requirements", 
        "tasks", 
        "providedFiles",
        "evaluationCriteria", 
        "generalTipsForTeacher",
        "officialSolutionSummary"
      ]
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};


export const optimizePracticalExamRubricsAI = async (
  sheet: PracticalExamSheet
): Promise<any[]> => {
  const prompt = `Tu es une IA experte qui audits et optimise les barèmes d'évaluation académique d'examens pratiques de certification IT et Bureautique (Cisco, Microsoft, Linux, Excel, etc.).
  Donné le sujet d'examen pratique suivant, analyse sa grille actuelle et propose une version améliorée et TRÈS rigoureuse de la grille de critères de correction (evaluationCriteria).
  Pour chaque tâche, fragmente les points de manière ultra professionnelle en prévoyant :
  - Des critères standards importants (+ points)
  - Des indicateurs de vérification extrêmement précis (ex: commandes CLI exactes à tester, vérifications de formules de cellules Excel, validation de scripts)
  - Des critères de pénalités ou d'erreurs critiques/bloquantes (ex: configuration causant une coupure de liaison, script avec syntaxe invalide) avec des pénalités décisives (ex: -2 points ou -5 points).
  
  Voici le sujet d'examen :
  Titre d'examen: ${sheet.title}
  Certification: ${sheet.certificationName}
  Tâches à réaliser:
  ${sheet.tasks.map((t, idx) => `Tâche ${idx+1}: ${t.title} (${t.points} pts) - Description: ${t.description}`).join('\n')}
  
  Grille actuelle à optimiser :
  ${sheet.evaluationCriteria.map((c, idx) => `- Tâche associée: ${c.taskTitle} / Nom: ${c.criteriaName} / Points: ${c.points} / Méthode: ${c.guidelines}`).join('\n')}
  
  Renvoie UNIQUEMENT un tableau d'objets JSON valide représentant la grille optimisée sous le schéma demandé. Assure-toi que la somme totale des points de ces critères reste cohérente ou ré-équilibrée d'après le barème global de l'examen (total: ${sheet.tasks.reduce((sum, t) => sum + (t.points || 0), 0)} pts).
  Chaque critère doit avoir la structure JSON suivante :
  - taskTitle: le titre de la tâche associée
  - criteriaName: le critère de correction précis
  - points: la note (entier positif ou négatif pour les pénalités/erreurs bloquantes)
  - guidelines: la méthode de test ou l'indicateur d'évaluation pour le formateur`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          taskTitle: { type: "STRING" },
          criteriaName: { type: "STRING" },
          points: { type: "INTEGER" },
          guidelines: { type: "STRING" }
        },
        required: ["taskTitle", "criteriaName", "points", "guidelines"]
      }
    }
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return JSON.parse(result.text);
};


export const generateCandidatePracticalFeedbackAI = async (
  examTitle: string,
  totalPoints: number,
  candidateName: string,
  candidateGroup: string,
  score: number,
  criteriaResults: { criteriaName: string; maxPoints: number; pointsAwarded: number; guidelines: string }[]
): Promise<string> => {
  const prompt = `Tu es un formateur académique ou examinateur professionnel. Rédige un feedback pédagogique personnalisé, professionnel et constructif, entièrement rédigé en français, destiné au candidat suivant pour son épreuve pratique.
  
  Informations de l'épreuve :
  - Examen : "${examTitle}"
  - Candidat : "${candidateName}" (Groupe : "${candidateGroup}")
  - Score obtenu : ${score} / ${totalPoints} points d'évaluation
  
  Détails de l'évaluation par critère de la grille de correction :
  ${criteriaResults.map(r => `- Critère: "${r.criteriaName}" | Score attribué: ${r.pointsAwarded}/${r.maxPoints} pts | Directives: "${r.guidelines}"`).join('\n')}
  
  Consignes de rédaction :
  1. Félicite chaleureusement le candidat pour ses points forts s'il a d'excellents résultats, ou encourage-le à persévérer avec optimisme s'il a commis des erreurs.
  2. Fournis des pistes d'amélioration technique extrêmement concrètes, en te basant sur les critères spécifiques où le candidat a perdu des points (pointsAwarded < maxPoints).
  3. Indique-lui clairement les concepts ou modules de cours à revoir pour ses prochaines sessions de révisions.
  4. Le style doit être bienveillant, constructif, digne d'un professeur d'ingénierie ou de bureautique d'excellence. Rédige un texte bien structuré d'environ 3 à 5 paragraphes, utilisant des listes à puces si cela clarifie l'explication.
  
  Réponds directement avec le texte du feedback d'évaluation, sans fioritures ni balises markdown d'introduction ou de conclusion superflues.`;

  const config = {
    responseMimeType: "text/plain"
  };

  const result = await fetchFromAI("/api/ai/generic", { prompt, config });
  return result.text;
};


