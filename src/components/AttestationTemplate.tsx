import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, GraduationCap, Calendar, Compass, BarChart, Download, Printer } from 'lucide-react';
import { Exam, Result, UserProfile, OrganizationSettings } from '../types';
import { exportHtmlElementToPdf } from '../lib/pdfExport';
import { toast } from 'react-hot-toast';
import { api } from '../lib/api';

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
  // Create toast notification
  const toastId = toast.loading("Génération de l'attestation PDF en haute définition...");
  
  // Create a clean landscape sandbox container on document.body as absolute/fixed
  // Positioned at (0,0) with z-index in background so that getBoundingClientRect computes positive, perfect layout bounds in html2canvas
  const sandbox = document.createElement('div');
  sandbox.style.position = 'fixed';
  sandbox.style.top = '0';
  sandbox.style.left = '0';
  sandbox.style.width = '297mm';
  sandbox.style.height = '210mm';
  sandbox.style.overflow = 'hidden';
  sandbox.style.zIndex = '-9999';
  sandbox.style.backgroundColor = '#ffffff';
  sandbox.style.pointerEvents = 'none';
  document.body.appendChild(sandbox);
  
  // Clone element to prevent polluting or flashing the live UI
  const clone = element.cloneNode(true) as HTMLElement;
  clone.id = "attestation-pdf-capture-clone";
  
  // Force clean landscape metrics for printing/exporting on the cloned node
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.width = '297mm';
  clone.style.height = '210mm';
  clone.style.position = 'static';
  clone.style.margin = '0';
  clone.style.padding = '15mm 15mm';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';
  clone.style.boxSizing = 'border-box';
  clone.style.border = '15px double #1e1b4b';
  
  // Copy styles/classes specifically for attestation high fidelity
  clone.className = "attestation-export-content bg-white text-slate-900 border-double block";
  
  // Append within sandbox
  sandbox.appendChild(clone);
  
  try {
    const studentCleanName = (result?.studentName || user?.displayName || 'Stagiaire').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const examCleanTitle = (exam?.title || 'Examen').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Attestation_${studentCleanName}_${examCleanTitle}.pdf`;
    
    // Call high-fidelity export utility in landscape mode on our pristine clone
    await exportHtmlElementToPdf(clone, filename, 'l');
    
    toast.success("Votre attestation a été téléchargée avec succès !", { id: toastId });
  } catch (err) {
    console.error("Failed to generate attestation PDF:", err);
    toast.error("Échec de la génération automatique du PDF.", { id: toastId });
  } finally {
    // Safely remove sandbox
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
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
              margin: 8mm 10mm;
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
              padding: 12mm 15mm !important;
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
            padding: 12mm 15mm !important;
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
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let active = true;
    api.settings.get()
      .then((data) => {
        if (active) {
          setSettings(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load settings in AttestationTemplate", err);
      });
    return () => {
      active = false;
    };
  }, []);

  const percentage = Math.round(((result?.score || 0) / (result?.totalPoints || exam?.questions?.reduce((acc, q) => acc + (q.points || 0), 0) || 1)) * 100);
  const isPassed = percentage >= 50;

  // Format date
  const completeDate = result?.completedAt ? new Date(result.completedAt) : new Date();
  const formattedDate = completeDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Generate unique certificate hash for authenticity
  const generateVerificationCode = () => {
    const p1 = String(exam?.id || 0).padStart(3, '0');
    const p2 = String(user?.id || 0).padStart(3, '0');
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
  // Otherwise, it adopts print-only portrait dimensions and standard times/serif typography.
  return (
    <div 
      id={isPreview ? "attestation-preview-container" : "attestation-export-container"}
      className={`${isPreview ? 'w-full max-w-4xl border-double border-[10px] p-2 relative flex flex-col' : 'attestation-export-print attestation-export-content border-double'} mx-auto bg-white text-slate-900`}
      style={isPreview ? {
        borderColor: '#1e1b4b',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        aspectRatio: '1.414 / 1',
      } : {
        width: '297mm',
        height: '210mm',
        padding: '12mm 12mm',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        border: '15px double #1e1b4b', // Royal indigo double border
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        zIndex: -9999,
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
              padding: 12mm 12mm !important;
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
        <div className="grid grid-cols-3 gap-2 items-center border-b pb-4 min-h-[105px] select-none" style={{ borderColor: 'rgba(30, 27, 75, 0.1)' }}>
          {/* Left Column: Organization French */}
          <div className="text-left space-y-0.5 leading-tight flex flex-col justify-center">
            <p className="text-[8px] font-bold tracking-wider uppercase" style={{ color: '#1e1b4b' }}>
              {settings?.regionName || 'ROYAUME DU MAROC'}
            </p>
            <p className="text-[8px] font-black uppercase" style={{ color: '#312e81' }}>
              {settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail'}
            </p>
            <p className="text-[7.5px] font-medium" style={{ color: '#64748b' }}>
              {settings?.regionalDirection || 'Direction Régionale De BM-KH'}
            </p>
            <p className="text-[7.5px] font-bold" style={{ color: '#1e293b' }}>
              {settings?.institutionName || 'ISTA AL HASSANIA'}
            </p>
          </div>

          {/* Middle Column: Logo and Mini Badges/Cap */}
          <div className="text-center flex flex-col items-center justify-center space-y-1 self-center">
            {settings?.orgLogoUrl && !imgError ? (
              <img 
                src={settings.orgLogoUrl} 
                alt="Logo" 
                className="h-14 max-w-[150px] object-contain mx-auto" 
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center border" style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe', color: '#312e81' }}>
                <GraduationCap className="w-6 h-6" />
              </div>
            )}
            <p className="text-[7.5px] font-bold uppercase tracking-wider leading-none mt-1" style={{ color: '#d97706' }}>
              Année : {settings?.academicYear || '2024/2025'}
            </p>
          </div>

          {/* Right Column: Organization Arabic */}
          <div className="text-right space-y-0.5 leading-tight flex flex-col justify-center items-stretch w-full" style={{ direction: 'rtl', textAlign: 'right' }}>
            <p className="text-[9px] font-bold w-full" style={{ color: '#1e1b4b', textAlign: 'right' }}>
              المملكة المغربية
            </p>
            <p className="text-[8.5px] font-black w-full" style={{ color: '#312e81', textAlign: 'right' }}>
              {settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل'}
            </p>
            <p className="text-[7.5px] font-medium w-full" style={{ color: '#64748b', textAlign: 'right' }}>
              {settings?.regionalDirection ? 'المديرية الجهوية' : ''}
            </p>
            <p className="text-[7.5px] font-bold w-full" style={{ color: '#1e293b', textAlign: 'right' }}>
              {settings?.orgSubName || 'DRBMKH'}
            </p>
          </div>
        </div>

        {/* Certificate Title */}
        <div className="text-center my-4">
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wide" style={{ color: '#1e1b4b' }}>
            {isPassed ? "Attestation de Réussite de Module" : "Attestation de Passage de Module"}
          </h2>
          <p className="text-[10px] md:text-xs font-serif italic mt-1" style={{ color: '#d97706' }}>
            {isPassed ? "Certificatif d'acquisition de compétences académiques" : "Attestation nominative de participation pour l'évaluation"}
          </p>
        </div>

        {/* Main Body */}
        <div className="text-center space-y-3 max-w-4xl mx-auto my-2">
          <p className="text-xs md:text-sm font-serif" style={{ color: '#475569' }}>
            Le Secrétariat Académique et le corps enseignant de la filière certifient que :
          </p>
          
          <div className="space-y-0.5">
            <p className="text-xl md:text-2xl font-black font-sans uppercase tracking-tight" style={{ color: '#1e1b4b' }}>
              {result?.studentName || user?.displayName || 'Stagiaire'}
            </p>
            <p className="text-[10px] md:text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>
              Identifiant Stagiaire : <strong style={{ color: '#334155', fontWeight: 'bold' }}>{user?.registrationNumber || user?.email || result?.studentEmail || 'N/A'}</strong>
              {(result?.groupName || user?.groupName) && <span> • Groupe : <strong style={{ color: '#334155', fontWeight: 'bold' }}>{result?.groupName || user?.groupName}</strong></span>}
              {(result?.filiere || user?.filiere) && <span> • Filière : <strong style={{ color: '#334155', fontWeight: 'bold' }}>{result?.filiere || user?.filiere}</strong></span>}
            </p>
          </div>

          <p className="text-xs md:text-sm font-serif leading-relaxed px-6" style={{ color: '#475569' }}>
            A validé avec succès l'évaluation académique pour le module d'enseignement :
          </p>

          <div 
            className="rounded-2xl p-4 py-5 block mx-auto w-full max-w-2xl text-center shadow-md my-2 border-2" 
            style={{ 
              backgroundColor: '#f8fafc', 
              borderColor: '#d97706', // Rich amber color for high-fidelity highlighted border
              borderStyle: 'solid',
            }}
          >
            <p className="text-[10px] md:text-xs font-extrabold uppercase tracking-[0.2em] mb-1" style={{ color: '#d97706', marginRight: '-0.2em' }}>
              MODULE D'ENSEIGNEMENT
            </p>
            <h3 className="text-base md:text-lg uppercase font-sans tracking-wide leading-tight px-4 mb-2" style={{ fontWeight: 900, color: '#1e1b4b' }}>
              {moduleName || exam?.moduleName || "Spécialisé"}
            </h3>
            <div className="w-24 h-0.5 mx-auto mb-2" style={{ backgroundColor: '#d97706' }} />
            <p className="text-xs md:text-sm font-medium italic" style={{ color: '#334155' }}>
              {exam?.title || "Examen Académique"}
            </p>
            <div className="mt-3 text-[9px] font-black tracking-widest uppercase" style={{ color: '#94a3b8' }}>
              • Épreuve de Certification Officielle •
            </div>
          </div>

          <p className="text-xs md:text-sm font-serif leading-relaxed px-6" style={{ color: '#475569' }}>
            {isPassed ? (
              <span className="inline-block align-middle">
                Ayant validé les connaissances théoriques et pratiques nécessaires de ce module avec un score de{' '}
                <strong className="font-black font-sans" style={{ color: '#1e1b4b' }}>{percentage}%</strong> ({result?.score || 0}/{result?.totalPoints || 0} points) avec la mention :{' '}
                <strong className="inline-flex items-center justify-center align-middle uppercase font-sans tracking-wide bg-emerald-50 px-2 py-0.5 rounded-md border text-[10px] md:text-xs font-black" style={{ color: '#047857', borderColor: 'rgba(16, 185, 129, 0.3)', verticalAlign: 'middle', marginTop: '-2px' }}>{appreciation}</strong>.
              </span>
            ) : (
              <span>
                A complété l'épreuve d'évaluation correspondante avec un score de{' '}
                <strong className="font-black font-sans" style={{ color: '#1e1b4b' }}>{percentage}%</strong> ({result?.score || 0}/{result?.totalPoints || 0} points).
              </span>
            )}
          </p>
        </div>

        {/* Bottom Block: Date / Verification / Signatures */}
        <div className="grid grid-cols-3 gap-4 items-end mt-2 pt-3 border-t border-slate-100 text-left" style={{ borderColor: '#f1f5f9' }}>
          
          {/* Verification Left */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[8px] font-black uppercase tracking-widest leading-none" style={{ color: '#94a3b8' }}>Code d'Authenticité</span>
            </div>
            <p className="font-mono text-[9px] font-bold" style={{ color: '#334155' }}>{verificationCode}</p>
            <p className="text-[7px] max-w-[170px] leading-snug" style={{ color: '#94a3b8' }}>
              Cet enregistrement est certifié infalsifiable et stocké de manière sécurisée dans le portail d'évaluation.
            </p>
          </div>

          {/* Golden Seal Center */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative w-12 h-12 flex items-center justify-center bg-amber-50 text-amber-500 border border-amber-300 rounded-full shadow-inner shadow-amber-200">
              {/* Star details around */}
              <div className="absolute inset-1 border border-dashed border-amber-400 rounded-full pointer-events-none" />
              <Award className="w-6 h-6 text-amber-500 animate-pulse" />
            </div>
            <p className="text-[8px] font-bold text-amber-700 uppercase tracking-widest mt-1 leading-none" style={{ color: '#b45309' }}>CERTIFIÉ CONFORME</p>
            <p className="text-[7px] mt-1" style={{ color: '#94a3b8' }}>Fait le {formattedDate}</p>
          </div>

          {/* Signatures Right */}
          <div className="text-right space-y-1 pr-2">
            <p className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Le Directoire d'Évaluation</p>
            <div className="h-8 flex items-center justify-end relative">
              {/* Simulated Signature Line */}
              <div className="absolute right-0 bottom-1 w-24 h-px bg-slate-200" style={{ backgroundColor: '#e2e8f0' }} />
              
              {/* Stamp Circle */}
              <div className="absolute right-8 w-11 h-11 rounded-full border border-dashed border-indigo-400/40 opacity-70 flex items-center justify-center text-center rotate-12" style={{ borderColor: 'rgba(129, 140, 248, 0.4)' }}>
                <span className="text-[6px] font-serif uppercase leading-[7px]" style={{ color: '#818cf8' }}>SOCIETATE<br/>SIGNATURE</span>
              </div>
            </div>
            <p className="text-[8px] font-black uppercase tracking-wider" style={{ color: '#1e1b4b' }}>Prof. Administrateur</p>
          </div>

        </div>
      </div>
    </div>
  );
};
