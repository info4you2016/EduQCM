import React from 'react';
import { Award, ShieldCheck, GraduationCap, Calendar, Compass, BarChart, Download, Printer } from 'lucide-react';
import { Exam, Result, UserProfile } from '../types';
import { exportHtmlElementToPdf } from '../lib/pdfExport';
import { toast } from 'react-hot-toast';

interface AttestationTemplateProps {
  exam: Exam;
  result: Result;
  user: UserProfile;
  moduleName?: string;
  isPreview?: boolean; // If true, we style it slightly smaller/responsive for on-screen preview
}

export const downloadAttestationPDF = async (
  exam: Exam,
  result: Result,
  user: UserProfile,
  moduleName?: string,
  elementId: string = "attestation-export-container"
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with ID ${elementId} not found, trying querySelector fallback...`);
    const fallback = document.querySelector('.attestation-export-print');
    if (!fallback) {
      toast.error("Impossible de générer le PDF : modèle d'attestation introuvable dans la page.");
      return;
    }
    // Use target fallback
    await triggerPDFGeneration(fallback as HTMLElement, exam, result, user);
    return;
  }
  await triggerPDFGeneration(element as HTMLElement, exam, result, user);
};

async function triggerPDFGeneration(element: HTMLElement, exam: Exam, result: Result, user: UserProfile) {
  const originalClassName = element.className;
  
  // Create toast notification
  const toastId = toast.loading("Génération de l'attestation PDF en haute définition...");
  
  try {
    // Temporarily replace classes to prevent any "hidden" or screen media overrides
    element.className = "attestation-export-content mx-auto bg-white text-slate-900 border-double block";
    
    const studentCleanName = (result.studentName || user.displayName || 'Stagiaire').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const examCleanTitle = exam.title.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Attestation_${studentCleanName}_${examCleanTitle}.pdf`;
    
    // Call high-fidelity export utility in landscape mode
    await exportHtmlElementToPdf(element, filename, 'l');
    
    toast.success("Votre attestation a été téléchargée avec succès !", { id: toastId });
  } catch (err) {
    console.error("Failed to generate attestation PDF:", err);
    toast.error("Échec de la génération automatique du PDF.", { id: toastId });
  } finally {
    // Restore original classes
    element.className = originalClassName;
  }
}

export const printAttestation = (elementId: string = "attestation-export-container") => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element with ID ${elementId} not found, trying querySelector...`);
    const fallbackElement = document.querySelector('.attestation-export-print');
    if (!fallbackElement) {
      console.error("No printable attestation template found in the DOM.");
      window.print();
      return;
    }
    triggerIframePrint(fallbackElement);
    return;
  }
  triggerIframePrint(element);
};

function triggerIframePrint(element: Element) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = 'none';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  document.body.appendChild(iframe);
  
  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }
  
  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Attestation d'Examen</title>
        <meta charset="utf-8" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        </style>
  `);
  
  // Copy stylesheets & styles to iframe document
  Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((styleNode) => {
    iframeDoc.write(styleNode.outerHTML);
  });
  
  // Clone the printable element and remove inline styles that hide it
  const clone = element.cloneNode(true) as HTMLElement;
  clone.id = "attestation-export-container-iframe";
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.width = '297mm';
  clone.style.height = '210mm';
  clone.style.position = 'static';
  clone.className = clone.className.replace('hidden', '').replace('pv-export-content', '');
  
  iframeDoc.write(`
        <style>
          @media print {
            @page {
              size: A4 landscape;
              margin: 4mm 8mm;
            }
            body {
              margin: 0;
              padding: 0;
              background-color: #ffffff !important;
              color: #000000 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .attestation-export-content {
              display: block !important;
              visibility: visible !important;
              position: static !important;
              width: 297mm !important;
              height: 210mm !important;
              box-sizing: border-box !important;
              margin: 0 auto !important;
              background-color: #ffffff !important;
              padding: 10mm 12mm !important;
              border: 15px double #1e1b4b !important;
            }
          }
          body {
            margin: 0;
            padding: 0;
            background-color: #ffffff !important;
          }
          .attestation-export-content {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            width: 297mm !important;
            height: 210mm !important;
            box-sizing: border-box !important;
            margin: 5px auto !important;
            background-color: #ffffff !important;
            padding: 10mm 12mm !important;
            border: 15px double #1e1b4b !important;
          }
        </style>
      </head>
      <body>
        <div class="printable-wrapper">
          ${clone.outerHTML}
        </div>
        <script>
          window.addEventListener('load', () => {
            setTimeout(() => {
              window.focus();
              try {
                window.print();
              } catch (e) {
                console.error("Print failed, printing directly", e);
              }
              setTimeout(() => {
                window.parent.document.body.removeChild(window.frameElement);
              }, 1200);
            }, 800);
          });
        </script>
      </body>
    </html>
  `);
  iframeDoc.close();
}

export const AttestationTemplate = ({ exam, result, user, moduleName, isPreview = false }: AttestationTemplateProps) => {
  const percentage = Math.round((result.score / (result.totalPoints || 1)) * 100);
  const isPassed = percentage >= 50;

  // Format date
  const completeDate = result.completedAt ? new Date(result.completedAt) : new Date();
  const formattedDate = completeDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Generate unique certificate hash for authenticity
  const generateVerificationCode = () => {
    const p1 = String(exam.id).padStart(3, '0');
    const p2 = String(user.id).padStart(3, '0');
    const p3 = completeDate.getTime().toString(36).substring(4, 9).toUpperCase();
    return `CERT-${p1}-${p2}-${p3}`;
  };

  const getAppreciation = (scorePercent: number) => {
    if (scorePercent >= 80) return 'Très Bien';
    if (scorePercent >= 70) return 'Bien';
    if (scorePercent >= 60) return 'Assez Bien';
    if (scorePercent >= 50) return 'Passable';
    return 'Insuffisant';
  };

  const appreciation = getAppreciation(percentage);
  const verificationCode = generateVerificationCode();

  // If in preview mode, we present it with full Tailwind layout suited for a modal.
  // Otherwise, it adopts print-only landscape dimensions and standard times/serif typography.
  return (
    <div 
      id={isPreview ? "attestation-preview-container" : "attestation-export-container"}
      className={`${isPreview ? 'w-full max-w-3xl border-4' : 'pv-export-content hidden md:block attestation-export-print'} attestation-export-content mx-auto bg-white text-slate-900 border-double`}
      style={isPreview ? {
        borderColor: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
      } : {
        width: '297mm',
        height: '210mm',
        margin: '0 auto',
        padding: '12mm 15mm',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Times New Roman', Times, serif",
        boxSizing: 'border-box',
        border: '15px double #1e1b4b', // Royal indigo double border
        position: 'relative',
        display: 'none' // Hidden on screen, shown on print thanks to index.css
      }}
    >
      {/* CSS overrides inside the template for absolute print precision */}
      {!isPreview && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            #attestation-export-container {
              display: block !important;
              visibility: visible !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              width: 297mm !important;
              height: 210mm !important;
              background: #ffffff !important;
              padding: 12mm 15mm !important;
              border: 15px double #1e1b4b !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              z-index: 99999 !important;
              box-sizing: border-box !important;
            }
          }
        `}} />
      )}

      {/* Decorative Golden Corner Accents (only visible on screen as icons, or nicely formatted in print) */}
      <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-amber-500/60 pointer-events-none" />
      <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-amber-500/60 pointer-events-none" />
      <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-amber-500/60 pointer-events-none" />
      <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-amber-500/60 pointer-events-none" />

      <div className="flex flex-col justify-between h-full border border-amber-500/30 p-6 md:p-8 relative">
        {/* BG watermark (faded graduation cap) */}
        {!isPreview && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center items-center opacity-[0.03] pointer-events-none">
            <GraduationCap style={{ width: '400px', height: '400px' }} />
          </div>
        )}

        {/* Header Block */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Plateforme d'Évaluation Académique & de Certification
          </p>
          <div className="flex items-center justify-center gap-1.5 my-1">
            <span className="h-1 w-12 bg-amber-500 rounded-full" />
            <GraduationCap className="w-5 h-5 text-indigo-900" />
            <span className="h-1 w-12 bg-amber-500 rounded-full" />
          </div>
          <p className="text-[11px] font-black tracking-widest text-indigo-950 uppercase">
            RÉPUBLIQUE MAROCAINE • ÉTABLISSEMENT DE FORMATION PROFESSIONNELLE
          </p>
        </div>

        {/* Certificate Title */}
        <div className="text-center my-4">
          <h2 className="text-2xl md:text-3xl font-black text-indigo-950 uppercase tracking-wide">
            {isPassed ? "Attestation de Réussite" : "Attestation de Passage d'Examen"}
          </h2>
          <p className="text-[10px] md:text-xs text-amber-600 font-serif italic mt-1">
            {isPassed ? "Certificatif d'acquisition de compétences académiques" : "Attestation nominative de participation pour l'évaluation"}
          </p>
        </div>

        {/* Main Body */}
        <div className="text-center space-y-4 max-w-4xl mx-auto my-3">
          <p className="text-xs md:text-sm text-slate-500 font-serif">
            Le Secrétariat Académique et le corps enseignant de la filière certifient que :
          </p>
          
          <div className="space-y-1">
            <p className="text-xl md:text-2xl font-black text-indigo-950 font-sans uppercase tracking-tight">
              {result.studentName || user.displayName}
            </p>
            <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest">
              Identifiant Stagiaire : <strong className="text-slate-700 font-bold">{user.registrationNumber || user.email || 'N/A'}</strong>
              {user.groupName && <span> • Groupe : <strong className="text-slate-700 font-bold">{user.groupName}</strong></span>}
              {user.filiere && <span> • Filière : <strong className="text-slate-700 font-bold">{user.filiere}</strong></span>}
            </p>
          </div>

          <p className="text-xs md:text-sm text-slate-500 font-serif leading-relaxed px-6">
            A passé avec succès l'examen académique correspondant au module d'enseignement :
          </p>

          <div className="bg-indigo-50/40 border border-slate-100 rounded-xl p-3 md:p-4 inline-block w-full max-w-2xl">
            <h4 className="text-sm md:text-base font-black text-indigo-900 uppercase">
              {exam.title}
            </h4>
            <p className="text-[10px] md:text-xs text-slate-500 font-bold mt-1">
              Module : {moduleName || "Module Académique Spécialisé"}
            </p>
          </div>

          <p className="text-xs md:text-sm text-slate-600 font-serif leading-relaxed px-6">
            {isPassed ? (
              <span>
                Ayant validé les connaissances théoriques et pratiques nécessaires avec un score de{' '}
                <strong className="text-indigo-900 font-black font-sans">{percentage}%</strong> ({result.score}/{result.totalPoints} points) avec la mention :{' '}
                <strong className="text-emerald-700 font-black uppercase font-sans tracking-wide bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-100">{appreciation}</strong>.
              </span>
            ) : (
              <span>
                A complété l'épreuve d'évaluation de fin de module avec un score de{' '}
                <strong className="text-indigo-900 font-black font-sans">{percentage}%</strong> ({result.score}/{result.totalPoints} points).
              </span>
            )}
          </p>
        </div>

        {/* Bottom Block: Date / Verification / Signatures */}
        <div className="grid grid-cols-3 gap-4 items-end mt-4 pt-4 border-t border-slate-100 text-left">
          
          {/* Verification Left */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Code d'Authenticité</span>
            </div>
            <p className="font-mono text-[9px] text-slate-700 font-bold">{verificationCode}</p>
            <p className="text-[7px] text-slate-400 max-w-[170px] leading-snug">
              Cet enregistrement est certifié infalsifiable et stocké de manière sécurisée dans le portail d'évaluation.
            </p>
          </div>

          {/* Golden Seal Center */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative w-14 h-14 flex items-center justify-center bg-amber-50 text-amber-500 border border-amber-300 rounded-full shadow-inner shadow-amber-200">
              {/* Star details around */}
              <div className="absolute inset-1 border border-dashed border-amber-400 rounded-full pointer-events-none" />
              <Award className="w-7 h-7 text-amber-500 animate-pulse" />
            </div>
            <p className="text-[8px] font-bold text-amber-700 uppercase tracking-widest mt-1.5 leading-none">CERTIFIÉ CONFORME</p>
            <p className="text-[7px] text-slate-400 mt-1">Fait le {formattedDate}</p>
          </div>

          {/* Signatures Right */}
          <div className="text-right space-y-1 pr-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Le Directoire d'Évaluation</p>
            <div className="h-10 flex items-center justify-end relative">
              {/* Simulated Signature Line */}
              <div className="absolute right-0 bottom-1 w-24 h-px bg-slate-300" />
              
              {/* Stamp Circle */}
              <div className="absolute right-8 w-11 h-11 rounded-full border border-dashed border-indigo-400/40 opacity-70 flex items-center justify-center text-center rotate-12">
                <span className="text-[6px] font-serif text-indigo-400 uppercase leading-[7px]">SOCIETATE<br/>SIGNATURE</span>
              </div>
            </div>
            <p className="text-[8px] font-black text-indigo-950 uppercase tracking-wider">Prof. Administrateur</p>
          </div>

        </div>
      </div>
    </div>
  );
};
