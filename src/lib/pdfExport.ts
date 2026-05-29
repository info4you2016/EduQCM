import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Exam, Module, Question, OrganizationSettings, Result } from '../types';
import { formatDuration, formatScore, formatPercent, getLineImageUrl } from './utils';
// @ts-ignore
import reshaper from 'arabic-persian-reshaper';
import html2canvas from 'html2canvas';

const parseVal = (str: string, multiplier: number): number => {
  const val = parseFloat(str);
  if (isNaN(val)) return 0;
  if (str.endsWith('%')) {
    return val;
  }
  return val * multiplier;
};

const convertOklchContentToHsl = (content: string): string => {
  try {
    const cleanContent = content.trim().replace(/,/g, ' ');
    const slashParts = cleanContent.split('/');
    const lchParts = slashParts[0].trim().split(/\s+/);
    
    if (lchParts.length < 3) {
      return 'hsl(210, 10%, 65%)';
    }
    
    const lStr = lchParts[0];
    const cStr = lchParts[1];
    const hStr = lchParts[2];
    
    if (lStr.includes('var(') || cStr.includes('var(') || hStr.includes('var(')) {
      return 'hsl(210, 15%, 50%)';
    }
    
    let l = parseFloat(lStr);
    if (!lStr.endsWith('%') && l <= 1.0) {
      l = l * 100;
    }
    
    let c = parseFloat(cStr);
    if (cStr.endsWith('%')) {
      c = c / 100;
    }
    let s = Math.round(c * 230);
    if (isNaN(s)) s = 0;
    s = Math.min(100, Math.max(0, s));
    
    let h = parseFloat(hStr);
    if (isNaN(h)) h = 0;
    h = Math.min(360, Math.max(0, h));
    
    let lightness = Math.round(l);
    if (isNaN(lightness)) lightness = 50;
    lightness = Math.min(100, Math.max(0, lightness));
    
    const rawAlpha = slashParts[1] ? slashParts[1].trim() : '';
    if (rawAlpha) {
      if (rawAlpha.includes('var(')) {
        return `hsla(${h}, ${s}%, ${lightness}%, 0.8)`;
      }
      let alpha = parseFloat(rawAlpha);
      if (rawAlpha.endsWith('%')) {
        alpha = alpha / 100;
      }
      if (isNaN(alpha)) alpha = 1;
      alpha = Math.min(1, Math.max(0, alpha));
      return `hsla(${h}, ${s}%, ${lightness}%, ${alpha})`;
    }
    
    return `hsl(${h}, ${s}%, ${lightness}%)`;
  } catch (err) {
    console.error('Error converting OKLCH to HSL:', err);
    return 'hsl(210, 10%, 65%)';
  }
};

const convertOklabContentToHsl = (content: string): string => {
  try {
    const cleanContent = content.trim().replace(/,/g, ' ');
    const slashParts = cleanContent.split('/');
    const labParts = slashParts[0].trim().split(/\s+/);
    
    if (labParts.length < 3) {
      return 'hsl(210, 10%, 65%)';
    }
    
    const lStr = labParts[0];
    const aStr = labParts[1];
    const bStr = labParts[2];
    
    if (lStr.includes('var(') || aStr.includes('var(') || bStr.includes('var(')) {
      return 'hsl(210, 15%, 50%)';
    }
    
    const lVal = parseFloat(lStr);
    const aVal = parseFloat(aStr);
    const bVal = parseFloat(bStr);
    
    if (isNaN(lVal) || isNaN(aVal) || isNaN(bVal)) {
      return 'hsl(210, 10%, 65%)';
    }
    
    // convert Oklab to Oklch using standard color conversions
    const cVal = Math.sqrt(aVal * aVal + bVal * bVal);
    let hDeg = Math.atan2(bVal, aVal) * (180 / Math.PI);
    if (hDeg < 0) hDeg += 360;
    
    const alphaPart = slashParts[1] ? ` / ${slashParts[1].trim()}` : '';
    const oklchContent = `${lStr} ${cVal} ${hDeg}${alphaPart}`;
    return convertOklchContentToHsl(oklchContent);
  } catch (err) {
    console.error('Error converting OKLAB to HSL:', err);
    return 'hsl(210, 10%, 65%)';
  }
};

const replaceColorFunc = (cssText: string, funcName: string, convertFn: (content: string) => string): string => {
  let result = '';
  let index = 0;
  
  while (true) {
    const startIdx = cssText.indexOf(funcName, index);
    if (startIdx === -1) {
      result += cssText.substring(index);
      break;
    }
    
    result += cssText.substring(index, startIdx);
    
    let parenCount = 1;
    let i = startIdx + funcName.length;
    for (; i < cssText.length; i++) {
      if (cssText[i] === '(') parenCount++;
      else if (cssText[i] === ')') parenCount--;
      
      if (parenCount === 0) {
        break;
      }
    }
    
    if (i >= cssText.length) {
      result += cssText.substring(startIdx);
      break;
    }
    
    const content = cssText.substring(startIdx + funcName.length, i);
    index = i + 1;
    
    result += convertFn(content);
  }
  
  return result;
};

export const replaceOklchWithHsl = (cssText: string): string => {
  if (!cssText) return '';
  
  // First, convert oklch
  let result = replaceColorFunc(cssText, 'oklch(', convertOklchContentToHsl);
  // Then, convert oklab
  result = replaceColorFunc(result, 'oklab(', convertOklabContentToHsl);
  
  return result;
};

interface StylesheetBackup {
  element: HTMLStyleElement | HTMLLinkElement;
  parent: Node | null;
  nextSibling: Node | null;
}

const sanitizeOklchColorsForHtml2Canvas = async (): Promise<() => void> => {
  const backups: StylesheetBackup[] = [];
  const sanitizedCssTexts: string[] = [];

  const styleElements = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));

  for (const el of styleElements) {
    if (el.id === 'html2canvas-sanitized-styles') continue;

    let cssText = '';
    if (el instanceof HTMLStyleElement) {
      cssText = el.textContent || '';
      if (!cssText) {
        try {
          if (el.sheet) {
            cssText = Array.from(el.sheet.cssRules).map(r => r.cssText).join('\n');
          }
        } catch (e) {
          // ignore
        }
      }
    } else if (el instanceof HTMLLinkElement) {
      try {
        const href = el.href;
        if (href) {
          const res = await fetch(href);
          if (res.ok) {
            cssText = await res.text();
          }
        }
      } catch (err) {
        console.warn('Failed to sanitize external link stylesheet for html2canvas:', el, err);
      }
    }

    if (cssText) {
      const sanitized = replaceOklchWithHsl(cssText);
      sanitizedCssTexts.push(sanitized);
    }

    // Save placement and detach from DOM so html2canvas doesn't find it
    backups.push({
      element: el as HTMLStyleElement | HTMLLinkElement,
      parent: el.parentNode,
      nextSibling: el.nextSibling
    });
    
    el.parentNode?.removeChild(el);
  }

  // Inject normalized styles
  const sanitizedStyleTag = document.createElement('style');
  sanitizedStyleTag.id = 'html2canvas-sanitized-styles';
  sanitizedStyleTag.textContent = sanitizedCssTexts.join('\n');
  document.head.appendChild(sanitizedStyleTag);

  return () => {
    const el = document.getElementById('html2canvas-sanitized-styles');
    if (el) el.remove();

    // Restore original style elements in exact reverse order
    for (let i = backups.length - 1; i >= 0; i--) {
      const { element, parent, nextSibling } = backups[i];
      if (parent) {
        if (nextSibling) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }
    }
  };
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  let cleanHex = (hex || '#E0E0E0').replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
  }
  if (cleanHex.length !== 6) {
    cleanHex = 'E0E0E0';
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 224;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 224;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 224;
  return { r, g, b };
};

const patchWindowGetComputedStyle = (win: any): (() => void) => {
  if (!win) return () => {};
  const originalGCS = win.getComputedStyle;
  try {
    win.getComputedStyle = function (elt: any, pseudoElt: any) {
      const style = originalGCS.call(win, elt, pseudoElt);
      if (!style) return style;
      return new Proxy(style, {
        get(target, prop, receiver) {
          if (typeof prop === 'string') {
            if (prop === 'getPropertyValue') {
              return function (p: string) {
                const val = target.getPropertyValue(p);
                if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
                  try {
                    return replaceOklchWithHsl(val);
                  } catch (e) {
                    return val;
                  }
                }
                return val;
              };
            }
            const val = (target as any)[prop];
            if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
              try {
                return replaceOklchWithHsl(val);
              } catch (e) {
                return val;
              }
            }
          }
          const val = Reflect.get(target, prop, receiver);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }
      });
    };
    return () => {
      win.getComputedStyle = originalGCS;
    };
  } catch (e) {
    console.warn('Failed to patch getComputedStyle:', e);
    return () => {};
  }
};

export const exportHtmlElementToPdf = async (
  element: HTMLElement,
  filename: string,
  orientation: 'p' | 'l' = 'p',
  settings: OrganizationSettings | null = null
): Promise<void> => {
  const isLandscape = orientation === 'l';
  const a4WidthMm = isLandscape ? 297 : 210;
  const a4HeightMm = isLandscape ? 210 : 297;
  
  // Save original style to restore later
  const originalStyle = element.getAttribute('style') || '';
  
  // Force visible A4 dimensions and perfect styles on the element during capture
  element.style.width = `${a4WidthMm}mm`;
  element.style.position = 'relative';
  element.style.left = '0';
  element.style.top = '0';
  element.style.margin = '0';
  element.style.backgroundColor = '#ffffff';
  element.style.color = '#000000';
  element.style.boxSizing = 'border-box';
  element.style.display = 'block';
  element.style.visibility = 'visible';
  
  let restoreStylesheets: (() => void) | null = null;
  let restorePagination: (() => void) | null = null;
  let restoreMainGCS: (() => void) | null = null;
  
  try {
    // Intercept computed styles to substitute oklch/oklab with HSL compatibility values
    restoreMainGCS = patchWindowGetComputedStyle(window);

    // Dynamic page-break pagination algorithm
    const elementWidthPx = element.clientWidth || parseInt(window.getComputedStyle(element).width || '794');
    const pageHeightPx = elementWidthPx * (a4HeightMm / a4WidthMm);
    
    // Select selectors that should NOT be broken across pages
    const unbreakableSelectors = [
      '.question-block',
      '.student-detail-card',
      '.participant-card',
      '.candidate-info-wrap',
      '.metadata-table',
      '.header-table',
      '.correction-summary',
      '.section-header',
      '.exam-body-content > table',
      'table'
    ];
    
    // Clean previous spacers just in case
    const existingSpacers = Array.from(element.querySelectorAll('.pdf-smart-spacer'));
    existingSpacers.forEach(s => s.remove());
    
    const blocks = Array.from(element.querySelectorAll(unbreakableSelectors.join(', '))) as HTMLElement[];
    
    // Keep only outermost unbreakable blocks to avoid double shifting inside parent containers
    const outermostBlocks = blocks.filter(block => {
      let parent = block.parentElement;
      while (parent && parent !== element) {
        if (blocks.includes(parent as HTMLElement)) {
          return false;
        }
        parent = parent.parentElement;
      }
      return true;
    });
    
    const spacersCreated: HTMLElement[] = [];
    
    // Iterate and insert smart spacers sequentially so that subsequent layout shifts are accurately computed
    for (const block of outermostBlocks) {
      const containerRect = element.getBoundingClientRect();
      const blockRect = block.getBoundingClientRect();
      
      const elTop = blockRect.top - containerRect.top;
      const elHeight = blockRect.height;
      const elBottom = elTop + elHeight;
      
      const pageOfTop = Math.floor(elTop / pageHeightPx);
      const pageOfBottom = Math.floor((elBottom - 1) / pageHeightPx);
      
      // If it crosses page boundary and fits within a single page
      if (pageOfTop !== pageOfBottom && elHeight <= pageHeightPx) {
        const spacerHeight = ((pageOfTop + 1) * pageHeightPx) - elTop;
        
        const spacer = document.createElement('div');
        spacer.className = 'pdf-smart-spacer';
        spacer.style.height = `${spacerHeight}px`;
        spacer.style.margin = '0';
        spacer.style.padding = '0';
        spacer.style.border = 'none';
        spacer.style.background = 'transparent';
        spacer.style.display = 'block';
        spacer.style.clear = 'both';
        
        block.parentNode?.insertBefore(spacer, block);
        spacersCreated.push(spacer);
      }
    }
    
    restorePagination = () => {
      spacersCreated.forEach(s => s.remove());
    };
    
    restoreStylesheets = await sanitizeOklchColorsForHtml2Canvas();
    
    const canvas = await html2canvas(element, {
      scale: 2.0, // High-quality resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.clientWidth,
      windowHeight: element.clientHeight,
      onclone: (clonedDoc) => {
        // Intercept computed styles in the cloned window context (iframe)
        const clonedWindow = clonedDoc.defaultView;
        if (clonedWindow) {
          patchWindowGetComputedStyle(clonedWindow);
        }

        // Also sanitize oklch and oklab inside inline style attributes of elements
        const elementsWithStyle = clonedDoc.querySelectorAll('[style]');
        elementsWithStyle.forEach(el => {
          const styleAttr = el.getAttribute('style');
          if (styleAttr) {
            const lowerAttr = styleAttr.toLowerCase();
            if (lowerAttr.includes('oklch') || lowerAttr.includes('oklab')) {
              el.setAttribute('style', replaceOklchWithHsl(styleAttr));
            }
          }
        });
      }
    });
    
    // Done capturing, restore main window getComputedStyle immediately
    if (restoreMainGCS) {
      restoreMainGCS();
      restoreMainGCS = null;
    }

    // Restore original CSS styles
    element.setAttribute('style', originalStyle);
    
    if (restorePagination) {
      restorePagination();
      restorePagination = null;
    }
    
    if (restoreStylesheets) {
      restoreStylesheets();
      restoreStylesheets = null;
    }
    
    const doc = new jsPDF(orientation, 'mm', 'a4');
    const imgWidth = a4WidthMm;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pageHeight = a4HeightMm;
    let heightLeft = imgHeight;
    let position = 0;
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    
    // First page
    doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // Next pages if multi-page content
    while (heightLeft > 0.01) {
      position -= pageHeight;
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Add watermark, page numbers, etc.
    const totalPages = doc.getNumberOfPages();
    const hasArabicText = (text: string) => /[\u0600-\u06FF]/.test(text || '');
    let watermarkFont = 'helvetica';
    if (settings?.showWatermark && settings.watermarkText && hasArabicText(settings.watermarkText)) {
      const loaded = await registerAmiriFont(doc);
      if (loaded) {
        watermarkFont = 'Amiri';
      }
    }

    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Watermark if requested
      if (settings?.showWatermark && settings.watermarkText) {
        doc.saveGraphicsState();
        try {
          const opacity = (settings.watermarkOpacity ?? 10) / 100;
          const GState = (jsPDF as any).GState || (doc.constructor as any).GState;
          if (GState) {
            doc.setGState(new GState({ opacity: opacity, "fill-opacity": opacity, "stroke-opacity": opacity }));
          }
        } catch (e) {
          console.error("GState setting error:", e);
        }
        const rgb = hexToRgb(settings.watermarkColor || '#E0E0E0');
        doc.setTextColor(rgb.r, rgb.g, rgb.b);
        doc.setFont(watermarkFont, watermarkFont === 'Amiri' ? 'normal' : 'bold');
        doc.setFontSize(40);
        
        const textToRender = watermarkFont === 'Amiri' ? processArabicText(settings.watermarkText) : settings.watermarkText;
        doc.text(textToRender, a4WidthMm / 2, a4HeightMm / 2, { align: 'center', angle: (orientation === 'l' ? 30 : 45) });
        doc.restoreGraphicsState();
      }

      // Page numbering (at the bottom of each page)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${i} / ${totalPages}`, a4WidthMm / 2, a4HeightMm - 8, { align: 'center' });
    }
    
    doc.save(filename);
  } catch (err) {
    console.error('Error in exportHtmlElementToPdf:', err);
    if (restoreMainGCS) {
      try { restoreMainGCS(); } catch (e) {}
    }
    element.setAttribute('style', originalStyle);
    if (restorePagination) {
      restorePagination();
    }
    if (restoreStylesheets) {
      restoreStylesheets();
    }
    throw err;
  }
};

// Helper to strip HTML tags
const stripHtml = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, '') // Strip tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
};

const cleanText = (text: string): string => {
  if (!text) return '';
  return text
    // Clean HTML entities and redundant escape/invisible chars
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/\u00ad/g, '') // Soft hyphen
    
    // Remove markdown bold/italic markers (*, **, _, __)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    
    // Remove inline code markdown `code` -> code
    .replace(/`([^`]+)`/g, '$1')
    
    // Remove heading hashes
    .replace(/(?:^|\s)#+\s+/g, '')
    
    // Remove markdown bullet characters or checkbox markers at start of string or list
    .replace(/^\s*[-*+]\s+/g, '')
    .replace(/\[[xX ]\]/g, '')
    
    // Normalize consecutive spaces and tabs to a single space
    .replace(/[ \t]+/g, ' ')
    .trim();
};

// Check if string has Arabic characters (including presentation blocks)
const isArabicText = (text: string): boolean => {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text || '');
};

// Shape & reverse Arabic Unicode blocks so that they draw correctly inside jsPDF LTR canvas
const isArabicChar = (char: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(char);

export const processArabicText = (text: string): string => {
  if (!text) return '';
  if (!/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) {
    return text;
  }

  try {
    // 1. Reshape Arabic text using arabic-persian-reshaper to contextual typographic shapes
    const reshaped = (reshaper as any).ArabicShaper.convertArabic(text);

    // 2. Fragment string into chunks of Arabic (RTL) and Latin/number/punctuation (LTR) blocks
    const tokens: { type: 'ar' | 'en'; text: string }[] = [];
    let currentToken = '';
    let currentType: 'ar' | 'en' | null = null;

    for (let i = 0; i < reshaped.length; i++) {
      const char = reshaped[i];
      const isAr = isArabicChar(char);
      const charType = isAr ? 'ar' : 'en';

      if (currentType === null) {
        currentType = charType;
        currentToken = char;
      } else if (currentType === charType) {
        currentToken += char;
      } else {
        tokens.push({ type: currentType, text: currentToken });
        currentType = charType;
        currentToken = char;
      }
    }
    if (currentToken) {
      tokens.push({ type: currentType!, text: currentToken });
    }

    // Reverse individual Arabic token sheets and then reverse the token listing itself to preserve total BiDi integrity in LTR page draw
    const processedTokens = tokens.map(token => {
      if (token.type === 'ar') {
        return token.text.split('').reverse().join('');
      }
      return token.text;
    });

    return processedTokens.reverse().join('');
  } catch (err) {
    console.error("Arabic reshaping error:", err);
    return text;
  }
};

// Main format utility for all dynamic texts going to jsPDF
const createFormatText = (shouldReshape: boolean) => (text: string): string => {
  if (!text) return '';
  const cleaned = cleanText(text);
  return shouldReshape ? processArabicText(cleaned) : cleaned;
};

// Check if entire data context has Arabic characters demanding Amiri font
const hasArabicInContext = (
  exam: Exam,
  module?: Module,
  filiereName?: string,
  settings?: OrganizationSettings | null
): boolean => {
  if (exam.title && isArabicText(exam.title)) return true;
  if (module && (isArabicText(module.name) || isArabicText(module.code))) return true;
  if (filiereName && isArabicText(filiereName)) return true;
  if (settings) {
    if (settings.orgNameArabic && isArabicText(settings.orgNameArabic)) return true;
    if (settings.orgNameFrench && isArabicText(settings.orgNameFrench)) return true;
    if (settings.institutionName && isArabicText(settings.institutionName)) return true;
    if (settings.regionalDirection && isArabicText(settings.regionalDirection)) return true;
    if (settings.watermarkText && isArabicText(settings.watermarkText)) return true;
    if (settings.footerText && isArabicText(settings.footerText)) return true;
  }
  
  if (exam.questions) {
    for (const q of exam.questions) {
      if (q.text && isArabicText(q.text)) return true;
      if (q.options) {
        for (const opt of q.options) {
          const optText = typeof opt === 'string' ? opt : (opt?.text || '');
          if (isArabicText(optText)) return true;
        }
      }
      if (q.matchOptions) {
        for (const mOpt of q.matchOptions) {
          if (isArabicText(mOpt)) return true;
        }
      }
      if (q.correctAnswer && isArabicText(String(q.correctAnswer))) return true;
    }
  }
  return false;
};

// Conver ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Fetch and add Amiri font dynamically to jsPDF Virtual File System
const registerAmiriFont = async (doc: jsPDF): Promise<boolean> => {
  try {
    const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf';
    const response = await fetch(fontUrl);
    if (!response.ok) throw new Error('Failed to fetch Amiri font');
    const buffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    doc.addFileToVFS('Amiri-Regular.ttf', base64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    return true;
  } catch (err) {
    console.error('Error loading Amiri font for jsPDF:', err);
    return false;
  }
};

const loadImgBase64 = async (url: string): Promise<string> => {
  try {
    const res = await fetch(url, { referrerPolicy: 'no-referrer' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Failed to load image for PDF:", url, err);
    return '';
  }
};

export const generateExamPDF = async (
  exam: Exam,
  module: Module,
  filiereName: string,
  filiereLevel: string,
  groupName: string,
  showAnswers: boolean = false,
  settings: OrganizationSettings | null = null,
  teacherName: string = '',
  paperSaver: boolean = false,
  qcmDoubleColumn: boolean = false
) => {
  const element = document.getElementById('export-container') || document.querySelector('.pdf-export-content');
  if (element) {
    const filename = showAnswers ? `Correction_${exam.title.replace(/\s+/g, '_')}.pdf` : `Examen_${exam.title.replace(/\s+/g, '_')}.pdf`;
    await exportHtmlElementToPdf(element as HTMLElement, filename, 'p', settings);
    return;
  }

  const totalPoints = exam.questions.reduce((acc, q) => acc + (q.points || 0), 0);

  // Settings fallbacks
  const orgName = settings?.orgName || 'OFPPT';
  const orgNameArabic = settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل';
  const orgNameFrench = settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail';
  const regionalDirection = settings?.regionalDirection || 'Direction Régionale De BM-KH';
  const institutionName = settings?.institutionName || 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem';
  const orgSubName = settings?.orgSubName || 'DRBMKH';
  const regionName = settings?.regionName || 'ROYAUME DU MAROC';
  const academicYear = settings?.academicYear || '2024/2025';

  const doc = new jsPDF('p', 'mm', 'a4');

  // Detect and set font configuration
  const needArabic = hasArabicInContext(exam, module, filiereName, settings);
  let pdfFont = 'helvetica';
  if (needArabic) {
    const loaded = await registerAmiriFont(doc);
    if (loaded) {
      pdfFont = 'Amiri';
    }
  }

  const formatText = createFormatText(pdfFont === 'Amiri');

  const replaceVariables = (text: string) => {
    if (!text) return '';
    const replaced = text
      .replace(/{{TITRE}}/g, exam.title || '')
      .replace(/{{MODULE}}/g, module.name || '')
      .replace(/{{PROF}}/g, teacherName || '')
      .replace(/{{DATE}}/g, exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'))
      .replace(/{{GROUPE}}/g, groupName || '')
      .replace(/{{DUREE}}/g, formatDuration(exam.durationMinutes))
      .replace(/{{TYPE}}/g, exam.type === 'controle-continu' ? 'CC' : 'EFM')
      .replace(/{{FILIERE}}/g, filiereName || '')
      .replace(/{{NIVEAU}}/g, filiereLevel || '')
      .replace(/{{ETABLISSEMENT}}/g, settings?.institutionName || '')
      .replace(/{{DIRECTION}}/g, settings?.regionalDirection || '')
      .replace(/{{REGION}}/g, settings?.regionName || '')
      .replace(/{{ANNEE_ACAD}}/g, settings?.academicYear || '')
      .replace(/{{CODE_ORG}}/g, settings?.orgSubName || '')
      .replace(/{{ORG_AR}}/g, settings?.orgNameArabic || '')
      .replace(/{{ORG_FR}}/g, settings?.orgNameFrench || '');
    return formatText(replaced);
  };

  // Pre-load all logos
  const logoUrlsMap: Record<string, string> = {};
  const uniqueUrls = new Set<string>();
  if (settings?.orgLogoUrl) uniqueUrls.add(settings.orgLogoUrl);
  if (settings?.orgLogoUrlRight) uniqueUrls.add(settings.orgLogoUrlRight);
  if (settings?.headerColumns) {
    settings.headerColumns.forEach(col => {
      col.lines.forEach(line => {
        if (line.type === 'image') {
          const resolvedUrl = getLineImageUrl(line, settings);
          if (resolvedUrl) {
            uniqueUrls.add(resolvedUrl);
          }
        }
      });
    });
  }

  await Promise.all(
    Array.from(uniqueUrls).map(async (url) => {
      const b64 = await loadImgBase64(url);
      if (b64) logoUrlsMap[url] = b64;
    })
  );

  let currentY = 15;

  const checkSpace = (neededHeight: number) => {
    if (currentY + neededHeight > 275) {
      doc.addPage();
      currentY = 15;
      return true;
    }
    return false;
  };

  const printWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10, fontStyle = 'normal') => {
    doc.setFont(pdfFont, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    const formatted = formatText(text);
    const lines = doc.splitTextToSize(formatted, maxWidth);
    lines.forEach((line: string, i: number) => {
      doc.text(line, x, y + (i * (fontSize * 0.45)));
    });
    return lines.length * (fontSize * 0.45);
  };

  // --- 1. HEADER TABLE ---
  let columnStyles: Record<number, any> = {};
  let headerBody: string[] = [];

  if (settings?.headerColumns && settings.headerColumns.length > 0) {
    settings.headerColumns.forEach((col, idx) => {
      const cellWidth = (col.width / 100) * 180;
      columnStyles[idx] = { cellWidth };
      
      const linesText = col.lines.map(line => {
        if (line.type === 'text') {
          return replaceVariables(line.text || '');
        }
        return '';
      }).join('\n');
      headerBody.push(linesText);
    });
  } else {
    columnStyles = {
      0: { cellWidth: 35 },
      1: { cellWidth: 110 },
      2: { cellWidth: 35 }
    };
    const leftText = settings?.orgLogoUrl ? '' : formatText(orgName);
    const rightText = settings?.orgLogoUrlRight ? '' : formatText(orgSubName);
    const middleText = [
      formatText(orgNameArabic),
      formatText(orgNameFrench),
      formatText(regionalDirection),
      formatText(institutionName)
    ].join('\n');
    headerBody = [leftText, middleText, rightText];
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    body: [headerBody],
    theme: 'plain',
    styles: {
      cellPadding: 3,
      fontSize: 8.5,
      font: pdfFont,
      halign: 'center',
      valign: 'middle',
      textColor: [0, 0, 0],
      lineWidth: 0.35,
      lineColor: [0, 0, 0]
    },
    columnStyles,
    didDrawCell: (data) => {
      if (data.section === 'body') {
        const colIdx = data.column.index;
        let logoDataUrl = '';
        
        if (settings?.headerColumns && settings.headerColumns.length > 0) {
          const col = settings.headerColumns[colIdx];
          const imgLine = col.lines.find(line => line.type === 'image');
          if (imgLine) {
            const resolvedUrl = getLineImageUrl(imgLine, settings);
            if (resolvedUrl) {
              logoDataUrl = logoUrlsMap[resolvedUrl] || '';
            }
          }
        } else {
          if (colIdx === 0 && settings?.orgLogoUrl) {
            logoDataUrl = logoUrlsMap[settings.orgLogoUrl] || '';
          } else if (colIdx === 2) {
            logoDataUrl = (settings?.orgLogoUrlRight ? logoUrlsMap[settings.orgLogoUrlRight] : '') || (settings?.orgLogoUrl ? logoUrlsMap[settings.orgLogoUrl] : '');
          }
        }
        
        if (logoDataUrl) {
          const imgWidth = 14;
          const imgHeight = 14;
          const x = data.cell.x + (data.cell.width - imgWidth) / 2;
          const y = data.cell.y + (data.cell.height - imgHeight) / 2;
          try {
            doc.addImage(logoDataUrl, 'PNG', x, y, imgWidth, imgHeight);
          } catch {}
        }
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // --- 2. EXAM TITLE ---
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(16);
  const examTitleText = formatText(exam.title);
  doc.text(examTitleText, 105, currentY, { align: 'center' });
  
  const textW = doc.getTextWidth(examTitleText);
  doc.setLineWidth(0.4);
  doc.line(105 - textW / 2, currentY + 1.2, 105 + textW / 2, currentY + 1.2);

  currentY += 10;

  // --- 3. METADATA GRID ---
  const metadataRows = [
    [
      `Filière : ${formatText(filiereName)}`,
      `Niveau : ${formatText(filiereLevel || 'TS / T / B')}`,
      `Année : ${formatText(academicYear)}`
    ],
    [
      `Code Module : ${formatText(module.code)}`,
      { content: `Intitulé : ${formatText(module.name)}`, colSpan: 2 }
    ],
    [
      `Durée : ${formatDuration(exam.durationMinutes)}`,
      `Date : ${exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`,
      `Barème : / ${Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2)} Pts`
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    body: metadataRows,
    theme: 'plain',
    styles: {
      cellPadding: 2,
      fontSize: 9,
      font: pdfFont,
      textColor: [0, 0, 0],
      lineWidth: 0.35,
      lineColor: [0, 0, 0],
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 65 },
      2: { cellWidth: 60 }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- 4. CANDIDATE INFO BOX ---
  const candidateRows = [
    [
      `Nom et Prénom : ____________________________________________`,
      {
        content: `NOTE : \n\n....... / ${Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2)} Pts`,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 10 }
      }
    ]
  ];

  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    body: candidateRows,
    theme: 'plain',
    styles: {
      cellPadding: 4,
      fontSize: 9.5,
      font: pdfFont,
      textColor: [0, 0, 0],
      lineWidth: 0.4,
      lineColor: [0, 0, 0],
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 135 },
      1: { cellWidth: 45, fillColor: [248, 250, 252] }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- 5. IMPORTANT CONSIGNES ---
  const consignesText = `Consignes importantes :\n• L'usage de tout document ou matériel électronique est strictement interdit.\n• Le soin apporté à la rédaction et à la présentation sera pris en compte dans la notation.\n• Répondez directement sur cette feuille de sujet.`;
  
  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    body: [[formatText(consignesText)]],
    theme: 'plain',
    styles: {
      cellPadding: 3,
      fontSize: 8,
      font: pdfFont,
      fontStyle: 'italic',
      textColor: [60, 60, 60],
      lineWidth: 0.3,
      lineColor: [0, 0, 0]
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // --- 6. QUESTIONS ---
  const groupedQuestions = exam.questions.reduce((acc, q, idx) => {
    const type = q.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push({ q, originalIdx: idx });
    return acc;
  }, {} as Record<string, { q: Question, originalIdx: number }[]>);

  const typeLabels: Record<string, string> = {
    'multiple-choice': 'Questions à Choix Multiples (QCM)',
    'true-false': 'Questions Vrai / Faux',
    'short-answer': 'Questions à Réponse Courte',
    'fill-in-the-blanks': 'Texte à Trous',
    'matching': "Questions d'Appariement (Association)",
    'ordering': "Questions d'Ordonnancement",
    'practical': 'Évaluation Pratique'
  };

  const orderedTypes = [
    'multiple-choice',
    'true-false',
    'matching',
    'ordering',
    'fill-in-the-blanks',
    'short-answer',
    'practical'
  ].filter(type => groupedQuestions[type]);

  orderedTypes.forEach((type) => {
    // Section Header Ribbon
    checkSpace(30);

    autoTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      body: [[formatText(typeLabels[type].toUpperCase())]],
      theme: 'plain',
      styles: {
        fillColor: [243, 244, 246],
        cellPadding: 3,
        fontSize: 9.5,
        font: pdfFont,
        fontStyle: 'bold',
        halign: 'center',
        textColor: [0, 0, 0],
        lineWidth: 0.35,
        lineColor: [0, 0, 0]
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Is it True/False? We group them in a nice unified table
    if (type === 'true-false') {
      const questionsList = groupedQuestions[type];
      const tfRows = questionsList.map(({ q, originalIdx }) => {
        const pText = ` (${Number.isInteger(q.points) ? q.points : q.points.toFixed(2)} pts)`;
        const cleanTFText = `${originalIdx + 1}. ${formatText(stripHtml(q.text))} ${pText}`;
        
        let vraiAns = '';
        let fauxAns = '';
        if (showAnswers) {
          const isCorrectTrue = String(q.correctAnswer).toLowerCase() === 'true' || String(q.correctAnswer).toLowerCase() === 'vrai';
          vraiAns = isCorrectTrue ? 'X' : '';
          fauxAns = !isCorrectTrue ? 'X' : '';
        }
        return [cleanTFText, vraiAns, fauxAns];
      });

      checkSpace(tfRows.length * 10 + 15);

      autoTable(doc, {
        startY: currentY,
        margin: { left: 15, right: 15 },
        head: [['Questions', 'Vrai', 'Faux']],
        body: tfRows,
        theme: 'plain',
        styles: {
          cellPadding: 3,
          fontSize: 9,
          font: pdfFont,
          textColor: [0, 0, 0],
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 25, halign: 'center' as const, fontStyle: 'bold' as const, fillColor: showAnswers ? [240, 253, 244] : [255, 255, 255] },
          2: { cellWidth: 25, halign: 'center' as const, fontStyle: 'bold' as const, fillColor: showAnswers ? [240, 253, 244] : [255, 255, 255] }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    } else {
      // Loop individual questions
      groupedQuestions[type].forEach(({ q: question, originalIdx: qIdx }) => {
        // Estimate space needed
        let minHeight = 15;
        if (question.type === 'multiple-choice') minHeight += (question.options?.length || 0) * 6;
        if (question.type === 'ordering') minHeight += (question.options?.length || 0) * 6.5 + 4;
        if (question.type === 'matching') minHeight += (question.options?.length || 0) * 11 + 6;
        if (question.type === 'short-answer') minHeight += showAnswers ? 8 : 15;
        if (question.type === 'practical') minHeight += showAnswers ? 8 : 22;

        checkSpace(minHeight);

        // Draw index and text (except for fill-in-the-blanks)
        if (question.type !== 'fill-in-the-blanks') {
          const qPointsStr = `( / ${Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)`;
          const qTitleText = `${qIdx + 1}. ${formatText(stripHtml(question.text))}  ${qPointsStr}`;
          const consumedH = printWrappedText(qTitleText, 15, currentY, 180, 9.5, 'bold');
          currentY += consumedH + 3.5;
        }

        // Draw choices or boxes based on type
        if (question.type === 'multiple-choice') {
          const options = question.options || [];
          const optionsWithOrig = options.map((opt, idx) => ({ ...opt, originalIndex: idx }));
          const shuffled = [...optionsWithOrig];
          
          // Shuffling choices
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          shuffled.forEach((opt, idx) => {
            checkSpace(7);
            const letter = String.fromCharCode(97 + idx); // a), b), c)...
            const isCorrect = showAnswers && opt.isCorrect;
            
            doc.setLineWidth(0.35);
            doc.setDrawColor(0, 0, 0);
            doc.circle(20, currentY - 1, 1.6);
            
            if (isCorrect) {
              doc.setFillColor(5, 150, 105);
              doc.circle(20, currentY - 1, 0.9, 'FD');
              doc.setTextColor(5, 150, 105);
              doc.setFont(pdfFont, 'bold');
            } else {
              doc.setTextColor(0, 0, 0);
              doc.setFont(pdfFont, 'normal');
            }
            
            doc.setFontSize(9);
            doc.text(`${letter}) ${formatText(opt.text)}`, 24, currentY);
            currentY += 5.5;
          });
          currentY += 2;
        }

        if (question.type === 'ordering') {
          const options = question.options || [];
          const optionsWithOrig = options.map((opt, idx) => ({ ...opt, originalIndex: idx }));
          const shuffled = [...optionsWithOrig];
          
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          doc.setFont(pdfFont, 'italic');
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(`(Numérotez de 1 à ${options.length})`, 24, currentY - 1.5);
          currentY += 2.5;

          shuffled.forEach((opt) => {
            checkSpace(8);
            
            // Draw square
            doc.setLineWidth(0.3);
            doc.setDrawColor(0, 0, 0);
            doc.rect(18, currentY - 3.2, 4.5, 4.5);
            
            if (showAnswers && question.correctOrder) {
               const correctPos = question.correctOrder.indexOf(opt.originalIndex) + 1;
               doc.setFont(pdfFont, 'bold');
               doc.setFontSize(9);
               doc.setTextColor(5, 150, 105);
               doc.text(String(correctPos), 20, currentY);
            }
            
            doc.setFont(pdfFont, 'normal');
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text(formatText(opt.text), 25, currentY);
            currentY += 6;
          });
          currentY += 2;
        }

        if (question.type === 'matching') {
          const left = question.options || [];
          const rightWithOriginalIndex = (question.matchOptions || []).map((text, originalIndex) => ({ text, originalIndex }));
          const shuffledRight = [...rightWithOriginalIndex];
          for (let i = shuffledRight.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledRight[i], shuffledRight[j]] = [shuffledRight[j], shuffledRight[i]];
          }

          const tableHeaders = [
            question.columnAHeader || 'Éléments (Gauche)',
            'Lettre / Chiffre',
            question.columnBHeader || 'Éléments (Droite)'
          ];

          const tableBody = left.map((opt, lIdx) => {
            const optText = typeof opt === 'string' ? opt : (opt?.text || '');
            const leftClean = `${lIdx + 1}. ${formatText(stripHtml(optText))}`;
            const rightOpt = shuffledRight[lIdx];
            const rightClean = rightOpt ? `${String.fromCharCode(65 + lIdx)}. ${formatText(stripHtml(rightOpt.text))}` : '';
            
            let matchResult = '';
            if (showAnswers) {
              const targetMatchIdx = question.correctMatches?.[lIdx];
              const rightSideIdx = shuffledRight.findIndex(r => r.originalIndex === targetMatchIdx);
              const rightChar = rightSideIdx !== -1 ? String.fromCharCode(65 + rightSideIdx) : '?';
              matchResult = `${lIdx + 1} → ${rightChar}`;
            }

            return [leftClean, matchResult, rightClean];
          });

          autoTable(doc, {
            startY: currentY,
            margin: { left: 15, right: 15 },
            head: [tableHeaders.map(h => formatText(h))],
            body: tableBody,
            theme: 'plain',
            styles: {
              cellPadding: 2.5,
              fontSize: 8.5,
              font: pdfFont,
              textColor: [0, 0, 0],
              lineWidth: 0.25,
              lineColor: [0, 0, 0],
              valign: 'middle'
            },
            columnStyles: {
              0: { cellWidth: 70 },
              1: { cellWidth: 40, halign: 'center' as const, fontStyle: 'bold' as const, fillColor: showAnswers ? [240, 253, 244] : [255, 255, 255] },
              2: { cellWidth: 70 }
            }
          });

          currentY = (doc as any).lastAutoTable.finalY + 6;
        }

        if (question.type === 'fill-in-the-blanks') {
          const parts = question.text.split('[blank]');
          let blanksCount = 0;
          let paragraph = `${qIdx + 1}. `;
          
          parts.forEach((part, idx) => {
            paragraph += formatText(stripHtml(part));
            if (idx < parts.length - 1) {
              if (showAnswers) {
                const correctAns = question.correctAnswers?.[blanksCount++] || '';
                paragraph += ` [ ${formatText(correctAns.toUpperCase())} ] `;
              } else {
                paragraph += ' ...................... ';
                blanksCount++;
              }
            }
          });

          const qPointsStr = `  ( / ${Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)`;
          paragraph += qPointsStr;

          currentY += printWrappedText(paragraph, 15, currentY, 180, 9.5, 'bold') + 4;
        }

        if (question.type === 'short-answer') {
          if (showAnswers) {
            doc.setFont(pdfFont, 'italic');
            doc.setFontSize(9);
            doc.setTextColor(5, 150, 105);
            doc.text(`Corrigé : ${formatText(question.correctAnswer || '')}`, 18, currentY);
            currentY += 5.5;
          } else {
            doc.setLineWidth(0.15);
            doc.setDrawColor(180, 180, 180);
            doc.line(18, currentY, 190, currentY);
            doc.line(18, currentY + 5.5, 190, currentY + 5.5);
            doc.line(18, currentY + 11, 190, currentY + 11);
            currentY += 14;
          }
        }

        if (question.type === 'practical') {
          if (showAnswers) {
            doc.setFont(pdfFont, 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(110, 110, 110);
            doc.text(`[Évaluation Pratique / Observations du formateur pour la notation]`, 18, currentY);
            currentY += 5.5;
          } else {
            doc.setLineWidth(0.2);
            doc.setDrawColor(150, 150, 150);
            doc.setLineDashPattern([2, 1], 0);
            doc.rect(18, currentY, 175, 18);
            doc.setLineDashPattern([], 0);
            
            doc.setFont(pdfFont, 'italic');
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);
            doc.text(`Espace pour l'évaluation pratique / observations du formateur...`, 22, currentY + 5.5);
            currentY += 21;
          }
        }

        currentY += 4;
      });
    }

    currentY += 4;
  });

  // --- Add Watermark, footers and page numbering to everything in a unified pass ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Watermark if requested
    if (settings?.showWatermark && settings.watermarkText) {
      doc.saveGraphicsState();
      try {
        const opacity = (settings.watermarkOpacity ?? 10) / 100;
        const GState = (jsPDF as any).GState || (doc.constructor as any).GState;
        if (GState) {
          doc.setGState(new GState({ opacity: opacity, "fill-opacity": opacity, "stroke-opacity": opacity }));
        }
      } catch (e) {
        console.error("GState setting error in direct export:", e);
      }
      const rgb = hexToRgb(settings.watermarkColor || '#E0E0E0');
      doc.setTextColor(rgb.r, rgb.g, rgb.b);
      doc.setFont(pdfFont, pdfFont === 'Amiri' ? 'normal' : 'bold');
      doc.setFontSize(40);
      
      const textToRender = pdfFont === 'Amiri' ? processArabicText(settings.watermarkText) : settings.watermarkText;
      doc.text(textToRender, 105, 148, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    }

    // Horizontal line above footer
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(15, 282, 195, 282);

    // Footer lines
    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${formatText(exam.title)} - Page ${i} / ${totalPages}`, 15, 287);
    
    const footerText = settings?.footerText ? replaceVariables(settings.footerText) : `${orgName} / ${module.code}`;
    doc.text(formatText(footerText), 195, 287, { align: 'right' });
  }

  const filename = showAnswers ? `Correction_${exam.title.replace(/\s+/g, '_')}.pdf` : `Examen_${exam.title.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
};

export const generateResultsPDF = async (
  exam: Exam,
  results: Result[],
  module: Module,
  filiereName: string,
  filiereLevel: string,
  groupName: string,
  settings: OrganizationSettings | null = null
) => {
  const element = document.getElementById('results-export-container');
  if (element) {
    const filename = `Resultats_${exam.title.replace(/\s+/g, '_')}.pdf`;
    await exportHtmlElementToPdf(element as HTMLElement, filename, 'p', settings);
    return;
  }

  const doc = new jsPDF('p', 'mm', 'a4');

  // Detect and set font configuration
  const needArabic = hasArabicInContext(exam, module, filiereName, settings) || results.some(r => isArabicText(r.studentName));
  let pdfFont = 'helvetica';
  if (needArabic) {
    const loaded = await registerAmiriFont(doc);
    if (loaded) {
      pdfFont = 'Amiri';
    }
  }

  const formatText = createFormatText(pdfFont === 'Amiri');

  let currentY = 15;

  const orgName = settings?.orgName || 'OFPPT';
  const orgSubName = settings?.orgSubName || 'DRBMKH';
  const academicYear = settings?.academicYear || '2024/2025';

  // --- 1. RESULTS TITLE BANNER ---
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, currentY, 180, 28);

  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(13);
  doc.text(formatText(`Rapport de Résultats : ${exam.title}`), 105, currentY + 7, { align: 'center' });

  doc.setFont(pdfFont, 'normal');
  doc.setFontSize(8.5);
  doc.text(formatText(`Module : ${module.name}  |  Filière : ${filiereName}  |  Niveau : ${filiereLevel || 'TS/T/B'}  |  Groupe : ${groupName}`), 105, currentY + 14, { align: 'center' });
  doc.text(formatText(`Établissement : ${orgName} (${orgSubName})  |  Année de formation : ${academicYear}`), 105, currentY + 20, { align: 'center' });
  doc.text(formatText(`Généré le : ${new Date().toLocaleDateString('fr-FR')} (${results.length} participants)`), 105, currentY + 25, { align: 'center' });

  currentY += 36;

  // --- 2. PARTICIPANTS LIST TABLE ---
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(11);
  doc.text(formatText(`LISTE DES PARTICIPANTS ET SCORES DE FIN D'EXAMEN`), 15, currentY);
  currentY += 4.5;

  // Sort results descending by score for rankings
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  const tableHeaders = ['Rang', 'Étudiant', 'Score', 'Pourcentage', 'Date de Passage'];
  const tableRows = sortedResults.map((res, i) => {
    return [
      String(i + 1),
      formatText(res.studentName),
      `${formatScore(res.score)} / ${res.totalPoints}`,
      `${formatPercent((res.score / (res.totalPoints || 1)) * 100)}%`,
      new Date(res.completedAt).toLocaleDateString('fr-FR')
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: 15, right: 15 },
    head: [tableHeaders.map(h => formatText(h))],
    body: tableRows,
    theme: 'plain',
    styles: {
      cellPadding: 2,
      fontSize: 8.5,
      font: pdfFont,
      textColor: [0, 0, 0],
      lineWidth: 0.25,
      lineColor: [180, 180, 180]
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' as const, fontStyle: 'bold' as const },
      1: { cellWidth: 70 },
      2: { cellWidth: 30, halign: 'center' as const },
      3: { cellWidth: 30, halign: 'center' as const, fontStyle: 'bold' as const },
      4: { cellWidth: 35, halign: 'right' as const }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // --- 3. DETAILED RESPONSES (One page per student or flow cleanly) ---
  doc.addPage();
  currentY = 15;

  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(11);
  doc.text(formatText(`FICHES DE DÉTAILS ET STATUTS DES RÉPONSES PAR ÉTUDIANT`), 105, currentY, { align: 'center' });
  doc.line(15, currentY + 2, 195, currentY + 2);
  currentY += 10;

  sortedResults.forEach((res, sIdx) => {
    // Check if drawing this student card requires adding a page
    const totalQuestions = exam.questions.filter(q => q.type !== 'practical').length;
    const gridRows = Math.ceil(totalQuestions / 4);
    const boxHeight = 12 + gridRows * 13;

    if (currentY + boxHeight > 275) {
      doc.addPage();
      currentY = 15;
    }

    // Outer framing card
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.35);
    doc.rect(15, currentY, 180, boxHeight);

    // Header strip inside card
    doc.setFillColor(248, 250, 252);
    doc.rect(15, currentY, 180, 10, 'F');
    doc.line(15, currentY + 10, 195, currentY + 10);

    doc.setFont(pdfFont, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${sIdx + 1}.  ${formatText(res.studentName)}`, 18, currentY + 6.5);

    const scorePct = `${formatPercent((res.score / (res.totalPoints || 1)) * 100)}%`;
    const scoreStr = `Note : ${formatScore(res.score)} / ${res.totalPoints}  (${scorePct})`;
    doc.text(formatText(scoreStr), 192, currentY + 6.5, { align: 'right' });

    // Grid of questions inside the card
    let gridY = currentY + 11.5;
    let gridX = 18;
    let cellCount = 0;

    exam.questions.forEach((q, qIdx) => {
      if (q.type === 'practical') return;

      const qRes = res.questionResults?.[qIdx];
      const pointsEarned = qRes?.pointsEarned || 0;
      const isCorrect = pointsEarned === q.points;
      const isPartial = pointsEarned > 0 && pointsEarned < q.points;

      // Draw cell border
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.rect(gridX, gridY, 41, 11);

      // Draw indicator box background
      let bgColor: [number, number, number] = [243, 244, 246]; // Gray / Incorrect
      let textColor: [number, number, number] = [100, 116, 139];
      let statusLabel = 'Incorrect';

      if (isCorrect) {
        bgColor = [240, 253, 244]; // Soft Green
        textColor = [21, 128, 61];
        statusLabel = 'Correct';
      } else if (isPartial) {
        bgColor = [254, 252, 232]; // Soft Yellow
        textColor = [161, 98, 7];
        statusLabel = 'Partiel';
      }

      doc.setFillColor(...bgColor);
      doc.rect(gridX + 18, gridY + 0.5, 22.5, 10, 'F');

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(0, 0, 0);
      doc.text(`Q${qIdx + 1}`, gridX + 2, gridY + 6.5);

      doc.setFont(pdfFont, 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...textColor);
      doc.text(formatText(statusLabel), gridX + 29, gridY + 6.5, { align: 'center' });

      // Move cell cursor
      cellCount++;
      if (cellCount % 4 === 0) {
        gridX = 18;
        gridY += 12.5;
      } else {
        gridX += 44;
      }
    });

    currentY += boxHeight + 4.5;
  });

  // --- Add footers and page numbering strip ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(15, 282, 195, 282);

    doc.setFont(pdfFont, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(formatText(`${exam.title} - Résultats - Page ${i} / ${totalPages}`), 15, 287);
    doc.text(formatText(`Généré le ${new Date().toLocaleDateString('fr-FR')}`), 195, 287, { align: 'right' });
  }

  const filename = `Resultats_${exam.title.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
};
