import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Question } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const stripHtml = (html: string) => {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || "").trim();
  } catch (e) {
    // Fallback for environments where DOMParser might fail
    let text = html.replace(/<[^>]*>/g, '');
    const entities: { [key: string]: string } = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&rsquo;': "'",
      '&lsquo;': "'"
    };
    Object.keys(entities).forEach(entity => {
      text = text.replace(new RegExp(entity, 'g'), entities[entity]);
    });
    return text.trim();
  }
};

export const normalizeQuestion = (q: Question): Question => {
  if (!q) return q;
  
  // Ensure question has an ID
  const id = q.id || Math.random().toString(36).substr(2, 9);
  
  if (!q.options || !Array.isArray(q.options)) return { ...q, id };
  
  const normalizedOptions = q.options.map((opt, idx) => {
    let text = '';
    let isCorrect = false;

    if (typeof opt === 'string') {
      text = opt;
      isCorrect = idx === q.correctOptionIndex;
    } else {
      text = opt.text || '';
      // If isCorrect is explicitly defined on the object, use it.
      // Otherwise, fallback to correctOptionIndex if it matches this index.
      isCorrect = (opt.isCorrect !== undefined) ? !!opt.isCorrect : (idx === q.correctOptionIndex);
    }
    return { text, isCorrect };
  });

  return { 
    ...q, 
    id,
    options: normalizedOptions 
  };
};

export const getExamTotalPoints = (exam: any) => {
  if (!exam || !exam.questions) return 0;
  return exam.questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
};

export const formatScore = (score: number) => {
  if (score === undefined || score === null) return '0';
  return Number.isInteger(score) ? score.toString() : score.toFixed(2);
};

export const formatPercent = (percent: number) => {
  if (percent === undefined || percent === null) return '0';
  return Number.isInteger(percent) ? percent.toString() : percent.toFixed(2);
};

export const formatDuration = (minutes: number) => {
  if (!minutes) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) {
    return `${h}H ${m > 0 ? `${m}min` : ''}`.trim();
  }
  return `${m}min`;
};
