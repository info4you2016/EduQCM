import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Exam, Module, Question, OrganizationSettings } from '../types';
import { formatDuration, getLineImageUrl } from '../lib/utils';

interface ExamExportTemplateProps {
  exam: Exam;
  module: Module;
  filiereName: string;
  filiereLevel?: string;
  groupName: string;
  showAnswers?: boolean;
  paperSaver?: boolean;
  qcmDoubleColumn?: boolean;
  settings?: OrganizationSettings | null;
  teacherName?: string;
}

export const ExamExportTemplate = React.forwardRef<HTMLDivElement, ExamExportTemplateProps>(
  ({ exam, module, filiereName, filiereLevel, groupName, showAnswers = false, paperSaver = false, qcmDoubleColumn = false, settings, teacherName }, ref) => {
    const totalPoints = exam.questions.reduce((acc, q) => acc + (q.points || 0), 0);
    
    // Default settings if none provided
    const orgName = settings?.orgName || 'OFPPT';
    const orgNameArabic = settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل';
    const orgNameFrench = settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail';
    const regionalDirection = settings?.regionalDirection || 'Direction Régionale De BM-KH';
    const institutionName = settings?.institutionName || 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem';
    const orgSubName = settings?.orgSubName || 'DRBMKH';
    const regionName = settings?.regionName || 'ROYAUME DU MAROC';
    const academicYear = settings?.academicYear || '2024/2025';
    const orgLogoBgColor = settings?.orgLogoBgColor || '#059669';
    const orgLogoTextColor = settings?.orgLogoTextColor || '#ffffff';

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

    const replaceVariables = (text: string) => {
      if (!text) return '';
      return text
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
    };

    const footerTextRaw = settings?.footerText || `${orgName} / ${regionalDirection} / ${module.code}`;
    const footerText = replaceVariables(footerTextRaw);
    const showFooter = settings?.showFooter !== false;

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
      'matching': "Questions d'Appariement",
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

    const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

    // Verification URL (placeholder)
    const verificationUrl = `https://exam-verify.app/verify/${exam.id || 'placeholder'}`;

    return (
      <div 
        ref={ref} 
        id="export-container"
        className="pdf-export-content"
        style={{ 
          width: '210mm', 
          margin: '0 auto', 
          fontSize: paperSaver ? '9pt' : '11pt',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: paperSaver ? '6mm 10mm' : '12mm 18mm',
          fontFamily: "'Times New Roman', Times, 'Amiri', serif",
          boxSizing: 'border-box',
          lineHeight: '1.2',
          position: 'relative'
        }}
      >
        {settings?.showWatermark && settings.watermarkText && (
          <div 
            className="watermark-overlay" 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              alignItems: 'center',
              overflow: 'hidden',
              opacity: (settings.watermarkOpacity ?? 10) / 100
            }}
          >
            {Array.from({ length: 6 }).map((_, idx) => (
              <div 
                key={idx}
                style={{
                  transform: 'rotate(-35deg)',
                  fontSize: paperSaver ? '40pt' : '55pt',
                  fontWeight: 'bold',
                  color: settings.watermarkColor || '#e0e0e0',
                  fontFamily: isArabic(settings.watermarkText || '') ? 'Amiri' : 'inherit',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                  margin: '140px 0'
                }}
              >
                {settings.watermarkText}
              </div>
            ))}
          </div>
        )}

        <style dangerouslySetInnerHTML={{ __html: `
          @page {
            size: A4;
            margin: 0;
          }
          .pdf-export-content * {
            font-family: inherit;
          }
          .question-block {
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: ${paperSaver ? '6px' : '15px'};
            padding-bottom: ${paperSaver ? '2px' : '6px'};
          }
          .question-block:last-child {
            border-bottom: none;
          }
          .rich-text-content p {
            margin: 0;
            line-height: 1.25;
          }
          .rich-text-content {
            font-size: ${paperSaver ? '9.5pt' : '11.5pt'};
          }
          .pdf-export-content h1, 
          .pdf-export-content h2, 
          .pdf-export-content h3 {
            color: #000000 !important;
          }
          .section-header {
            background-color: #f3f4f6;
            border-top: 1.5px solid #000;
            border-bottom: 1.5px solid #000;
            padding: ${paperSaver ? '4px 8px' : '8px 12px'};
            margin: ${paperSaver ? '3px 0' : '6px 0'};
            text-align: center;
            width: 100%;
            display: block;
            overflow: visible;
          }
          .metadata-table td {
            border: 1.5px solid #000;
            padding: ${paperSaver ? '2px 4px' : '4px 8px'};
          }
          .header-table td {
            border: 1.5px solid #000;
          }
        `}} />

        {/* Main Header Table */}
        <table className="header-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: paperSaver ? '8px' : '15px', border: '1.5px solid #000' }}>
          <tbody>
            <tr>
              {settings?.headerColumns && settings.headerColumns.length > 0 ? (
                settings.headerColumns.map((col, cIdx) => (
                  <td 
                    key={col.id} 
                    style={{ 
                      width: `${col.width}%`, 
                      padding: '0', 
                      textAlign: 'center', 
                      verticalAlign: 'middle', 
                      border: '1px solid #000',
                      borderLeft: col.borderLeft ? '1.5px solid #000' : '1px solid #000',
                      borderRight: col.borderRight ? '1.5px solid #000' : '1px solid #000',
                      backgroundColor: col.bgColor || 'transparent',
                      color: col.textColor || 'inherit'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {col.lines.map((line, lIdx) => (
                        <div 
                          key={line.id} 
                          style={{ 
                            padding: paperSaver ? '1px 5px' : '3px 10px',
                            textAlign: (line.alignment || 'center') as any,
                            minHeight: line.type === 'image' ? 'auto' : (paperSaver ? '15px' : '22px'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: line.alignment === 'left' ? 'flex-start' : line.alignment === 'right' ? 'flex-end' : 'center',
                            borderBottom: settings.showHeaderLines && lIdx < col.lines.length - 1 ? '1px solid #000' : 'none'
                          }}
                        >
                          {line.type === 'image' ? (
                            <img 
                              src={getLineImageUrl(line, settings)} 
                              alt="Logo" 
                              style={{ 
                                width: line.imageWidth ? `${paperSaver ? Math.max(15, line.imageWidth - 10) : line.imageWidth}pt` : (paperSaver ? '25pt' : '40pt'),
                                height: line.imageHeight ? `${paperSaver ? Math.max(15, line.imageHeight - 10) : line.imageHeight}pt` : (paperSaver ? '25pt' : '40pt'),
                                objectFit: 'contain'
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <p style={{ 
                              margin: 0, 
                              fontSize: `${paperSaver ? Math.max(7, (line.fontSize || 10) - 1.5) : (line.fontSize || 10)}pt`, 
                              fontWeight: line.isBold ? 'bold' : 'normal',
                              fontStyle: line.isItalic ? 'italic' : 'normal',
                              fontFamily: line.fontFamily || 'inherit',
                              direction: isArabic(line.text || '') ? 'rtl' : 'ltr',
                              whiteSpace: 'nowrap',
                              color: col.textColor || 'inherit'
                            }}>
                              {cleanText(replaceVariables(line.text))}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                ))
              ) : (
                <>
                  {/* Left Side: Institution Logo */}
                  <td style={{ width: '15%', padding: paperSaver ? '4px' : '10px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #000' }}>
                    {settings?.orgLogoUrl ? (
                      <img 
                        src={settings.orgLogoUrl} 
                        alt="Logo" 
                        style={{ width: paperSaver ? '35px' : '60px', maxHeight: paperSaver ? '35px' : '60px', objectFit: 'contain' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div style={{ fontSize: paperSaver ? '8pt' : '10pt', fontWeight: 'bold' }}>{orgName}</div>
                    )}
                  </td>
                  
                  {/* Middle Section: Header Lines from Settings */}
                  <td style={{ width: '70%', padding: '0', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #000' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ borderBottom: '1px solid #000', padding: paperSaver ? '2px' : '5px' }}>
                        <p style={{ margin: 0, fontSize: paperSaver ? '9pt' : '11pt', fontWeight: 'bold', fontFamily: "'Amiri', serif", direction: 'rtl' }}>{orgNameArabic}</p>
                      </div>
                      <div style={{ borderBottom: '1px solid #000', padding: paperSaver ? '2px' : '5px' }}>
                        <p style={{ margin: 0, fontSize: paperSaver ? '8.5pt' : '10pt', fontWeight: 'bold' }}>{orgNameFrench}</p>
                      </div>
                      <div style={{ borderBottom: '1px solid #000', padding: paperSaver ? '2px' : '5px' }}>
                        <p style={{ margin: 0, fontSize: paperSaver ? '7.5pt' : '9pt', fontWeight: 'bold' }}>{regionalDirection}</p>
                      </div>
                      <div style={{ padding: paperSaver ? '2px' : '5px' }}>
                        <p style={{ margin: 0, fontSize: paperSaver ? '7.5pt' : '9pt', fontWeight: 'bold' }}>{institutionName}</p>
                      </div>
                    </div>
                  </td>
                  
                  {/* Right Side: Secondary Logo / Kingdom Info */}
                  <td style={{ width: '15%', padding: paperSaver ? '4px' : '10px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #000' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: paperSaver ? '4px' : '8px' }}>
                      {settings?.orgLogoUrlRight ? (
                        <img 
                          src={settings.orgLogoUrlRight} 
                          alt="Logo Sec" 
                          style={{ width: paperSaver ? '35px' : '60px', maxHeight: paperSaver ? '35px' : '60px', objectFit: 'contain' }}
                          referrerPolicy="no-referrer"
                        />
                      ) : settings?.orgLogoUrl ? (
                        <img 
                          src={settings.orgLogoUrl} 
                          alt="Logo" 
                          style={{ width: paperSaver ? '35px' : '60px', maxHeight: paperSaver ? '35px' : '60px', objectFit: 'contain' }}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div style={{ fontSize: paperSaver ? '8pt' : '10pt', fontWeight: 'bold' }}>{orgSubName}</div>
                      )}
                    </div>
                  </td>
                </>
              )}
              {/* Hidden QR code for PDF export capture moved outside if needed, but it was inside a td */}
              {/* Actually, let's keep it in the last column if it is not present in the dynamic columns. 
                  But the user wants the QR code at the center bottom of each page, which I already implemented in TeacherDashboard.tsx for jsPDF.
                  The one in the template was probably for something else or a fallback.
              */}
              <td style={{ width: '0', padding: '0', border: 'none', position: 'relative' }}>
                <div id="qr-code-for-export" style={{ position: 'absolute', top: '-1000px', left: '-1000px' }}>
                    <div className="qr-code-verification-wrap" style={{ padding: '2px', border: '1px solid #eee', background: '#fff', textAlign: 'center', width: '45px' }}>
                      <QRCodeCanvas 
                        value={verificationUrl} 
                        size={42} 
                        level="L"
                        includeMargin={false}
                      />
                      <div style={{ fontSize: '5pt', fontWeight: 'bold' }}>VERIFICATION</div>
                    </div>
                  </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Global Instructions Wrap */}
        <div className="exam-body-content">
          <div style={{ textAlign: 'center', margin: paperSaver ? '3px 0' : '10px 0' }}>
            <h1 style={{ fontSize: paperSaver ? '14pt' : '18pt', fontWeight: 'bold', textDecoration: 'underline', textTransform: 'uppercase', margin: 0 }}>
              {cleanText(exam.title)}
            </h1>
          </div>

          {/* Metadata Grid (Mirrors docxExport.ts) */}
          <table className="metadata-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: paperSaver ? '5px' : '10px', fontSize: paperSaver ? '8.5pt' : '10pt', border: '1.5px solid #000' }}>
            <tbody>
              <tr>
                <td style={{ width: '33%', border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Filière :</strong> {cleanText(filiereName)}
                </td>
                <td style={{ width: '33%', border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Niveau :</strong> {cleanText(filiereLevel || 'TS / T / B')}
                </td>
                <td style={{ width: '34%', border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Année de formation :</strong> {cleanText(academicYear)}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Numéro du module :</strong> {cleanText(module.code)}
                </td>
                <td colSpan={2} style={{ border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Intitulé du module :</strong> {cleanText(module.name)}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Horaire :</strong> {formatDuration(exam.durationMinutes)}
                </td>
                <td style={{ border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}
                </td>
                <td style={{ border: '1.5px solid #000', padding: paperSaver ? '2px 4px' : '4px 8px' }}>
                  <strong>Barème :</strong> / {Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2)} Pts
                </td>
              </tr>
            </tbody>
          </table>

          {/* Candidate Info Section */}
          <div className="candidate-info-wrap" style={{ marginBottom: paperSaver ? '6px' : '15px', border: '1.5px solid #000' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '75%', border: '1px solid #000', padding: paperSaver ? '4px 6px' : '10px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <strong style={{ fontSize: paperSaver ? '10pt' : '12pt', whiteSpace: 'nowrap' }}>Nom et Prénom :</strong>
                      <div style={{ flex: 1, borderBottom: '1px dotted #000', marginLeft: '10px', height: '1px', marginTop: paperSaver ? '10px' : '14px' }}></div>
                    </div>
                  </td>
                  <td style={{ width: '25%', borderLeft: '1.5px solid #000', borderRight: '1px solid #000', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '0', textAlign: 'center', backgroundColor: '#ffffff' }}>
                    <div style={{ borderBottom: '1px solid #000', padding: '2px', fontSize: paperSaver ? '9pt' : '11pt', fontWeight: 'bold', backgroundColor: '#f8fafc' }}>NOTE</div>
                    <div style={{ padding: paperSaver ? '3px' : '6px', fontSize: paperSaver ? '12pt' : '16pt', fontWeight: 'bold' }}>....... / {totalPoints}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        {/* Instructions Section */}
        {paperSaver ? (
          <div style={{ border: '1px solid #000', padding: '3px 6px', marginBottom: '8px', fontSize: '8pt', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between' }}>
            <div><strong>Consignes :</strong> Document non autorisé. Répondre directement sur cette feuille.</div>
            <div style={{ fontWeight: 'bold' }}>Soin de présentation pris en compte dans la note.</div>
          </div>
        ) : (
          <div style={{ border: '1px solid #000', padding: '8px 10px', marginBottom: '15px', fontSize: '9.5pt', fontStyle: 'italic' }}>
            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', textDecoration: 'underline' }}>Consignes importantes :</p>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li>L'usage de tout document ou matériel électronique est strictement interdit.</li>
              <li>Le soin apporté à la rédaction et à la présentation sera pris en compte dans la notation.</li>
              <li>Répondez directement sur cette feuille de sujet.</li>
            </ul>
          </div>
        )}


        {/* Questions Grouped */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {orderedTypes.map((type) => (
            <div key={type} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="section-header" style={{ backgroundColor: '#f3f4f6' }}>
                <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: paperSaver ? '10pt' : '13pt', fontWeight: 'bold', lineHeight: '1.4' }}>
                  {typeLabels[type]}
                </h3>
              </div>
              
              {type === 'true-false' ? (
                <div style={{ marginTop: paperSaver ? '4px' : '10px', breakInside: 'avoid' }}>
                  {(() => {
                    const hasRtl = groupedQuestions[type].some(({ q }) => isArabic(q.text));
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', direction: hasRtl ? 'rtl' : 'ltr' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            <th style={{ border: '1px solid #000', padding: paperSaver ? '4px 6px' : '8px', fontSize: paperSaver ? '9.5px' : '11px', textAlign: hasRtl ? 'right' : 'left' }}>{hasRtl ? 'الأسئلة' : 'Questions'}</th>
                            <th style={{ border: '1px solid #000', padding: paperSaver ? '4px 6px' : '8px', fontSize: paperSaver ? '9.5px' : '11px', textAlign: 'center', width: '1.5cm', whiteSpace: 'nowrap' }}>{hasRtl ? 'صحيح' : 'Vrai'}</th>
                            <th style={{ border: '1px solid #000', padding: paperSaver ? '4px 6px' : '8px', fontSize: paperSaver ? '9.5px' : '11px', textAlign: 'center', width: '1.5cm', whiteSpace: 'nowrap' }}>{hasRtl ? 'خطأ' : 'Faux'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedQuestions[type].map(({ q: question, originalIdx: qIdx }) => {
                            const ans = String(question.correctAnswer).toLowerCase();
                            const isTrue = ans === 'true' || ans === 'vrai';
                            const isFalse = ans === 'false' || ans === 'faux';
                            const rtl = isArabic(question.text);
                            return (
                              <tr key={qIdx}>
                                <td 
                                  style={{ 
                                    border: '1px solid #000', 
                                    padding: paperSaver ? '4px 6px' : '10px 8px', 
                                    fontSize: paperSaver ? '10px' : '12px',
                                    direction: rtl ? 'rtl' : 'ltr',
                                    textAlign: rtl ? 'right' : 'left'
                                  }}
                                >
                                  <div style={{ display: 'flex', gap: paperSaver ? '4px' : '8px', alignItems: 'flex-start', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                                    <span style={{ fontWeight: 'bold', flexShrink: 0, lineHeight: '1.4' }}>{qIdx + 1}.</span>
                                    <div style={{ flex: 1 }}>
                                      <div dangerouslySetInnerHTML={{ __html: cleanText(question.text) }} style={{ display: 'inline' }} />
                                      <span style={{ fontSize: paperSaver ? '8px' : '9px', fontWeight: 'bold', [rtl ? 'marginRight' : 'marginLeft']: '10px', color: '#666', whiteSpace: 'nowrap' }}>({Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)</span>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: paperSaver ? '2px' : '8px', textAlign: 'center' }}>
                                  <div style={{ 
                                    width: paperSaver ? '13px' : '18px', 
                                    height: paperSaver ? '13px' : '18px', 
                                    border: '1px solid #000', 
                                    margin: '0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: paperSaver ? '10px' : '14px',
                                    fontWeight: 'bold',
                                    backgroundColor: showAnswers && isTrue ? '#f0fdf4' : 'transparent'
                                  }}>
                                    {showAnswers && isTrue ? 'X' : ''}
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: paperSaver ? '2px' : '8px', textAlign: 'center' }}>
                                  <div style={{ 
                                    width: paperSaver ? '13px' : '18px', 
                                    height: paperSaver ? '13px' : '18px', 
                                    border: '1px solid #000', 
                                    margin: '0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: paperSaver ? '10px' : '14px',
                                    fontWeight: 'bold',
                                    backgroundColor: showAnswers && isFalse ? '#f0fdf4' : 'transparent'
                                  }}>
                                    {showAnswers && isFalse ? 'X' : ''}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              ) : (type === 'multiple-choice' && qcmDoubleColumn) ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: paperSaver ? '10px 15px' : '15px 25px',
                  marginTop: paperSaver ? '4px' : '10px'
                }}>
                  {groupedQuestions[type].map(({ q: question, originalIdx: qIdx }) => {
                    const rtl = isArabic(question.text);
                    return (
                      <div key={qIdx} className="question-block" style={{ direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left', marginBottom: paperSaver ? '4px' : '10px', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: paperSaver ? '2px' : '5px', paddingBottom: '2px', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                          <span style={{ fontWeight: 'bold', fontSize: paperSaver ? '11px' : '13px', flexShrink: 0, lineHeight: '1.4', marginTop: '1px' }}>{qIdx + 1}.</span>
                          <div style={{ flex: 1 }}>
                            <div className="rich-text-content" style={{ fontSize: paperSaver ? '11px' : '13px', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: cleanText(question.text) }} />
                          </div>
                          <span style={{ fontSize: paperSaver ? '9px' : '11px', fontWeight: 'bold', whiteSpace: 'nowrap', [rtl ? 'marginRight' : 'marginLeft']: '10px', lineHeight: '1.4' }}>(.... / {Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)</span>
                        </div>
                        
                        <div style={{ [rtl ? 'marginRight' : 'marginLeft']: paperSaver ? '15px' : '20px' }}>
                          {(() => {
                            const optionsWithOrig = (question.options || []).map((opt, idx) => ({ ...opt, originalIndex: idx }));
                            // Shuffle options
                            const shuffled = [...optionsWithOrig];
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                            }

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: paperSaver ? '4px' : '6px' }}>
                                {shuffled.map((opt, sIdx) => {
                                  const isCorrect = showAnswers && opt.isCorrect;
                                  const optRtl = isArabic(opt.text);
                                  return (
                                    <div key={sIdx} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '8px', 
                                      padding: paperSaver ? '1px 3px' : '2px 6px', 
                                      backgroundColor: isCorrect ? '#f0fdf4' : 'transparent', 
                                      borderRadius: '4px',
                                      direction: optRtl ? 'rtl' : 'ltr',
                                      flexDirection: optRtl ? 'row-reverse' : 'row',
                                      justifyContent: optRtl ? 'flex-start' : 'flex-start'
                                    }}>
                                      <div style={{ width: paperSaver ? '12px' : '16px', height: paperSaver ? '12px' : '16px', border: '1px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {isCorrect && <div style={{ width: paperSaver ? '6px' : '8px', height: paperSaver ? '6px' : '8px', backgroundColor: '#059669', borderRadius: '50%' }} />}
                                      </div>
                                      <span style={{ fontSize: paperSaver ? '10px' : '12px', color: isCorrect ? '#059669' : 'inherit', fontWeight: isCorrect ? 'bold' : 'normal', textAlign: optRtl ? 'right' : 'left' }}>{String.fromCharCode(97 + sIdx)}) {cleanText(opt.text)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : groupedQuestions[type].map(({ q: question, originalIdx: qIdx }) => {
                const rtl = isArabic(question.text);
                return (
                <div key={qIdx} className="question-block" style={{ direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left', marginBottom: paperSaver ? '4px' : '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: paperSaver ? '2px' : '5px', paddingBottom: '2px', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                    <span style={{ fontWeight: 'bold', fontSize: paperSaver ? '11px' : '13px', flexShrink: 0, lineHeight: '1.4', marginTop: '1px' }}>{qIdx + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div className="rich-text-content" style={{ fontSize: paperSaver ? '11px' : '13px', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: cleanText(question.text) }} />
                    </div>
                    <span style={{ fontSize: paperSaver ? '9px' : '11px', fontWeight: 'bold', whiteSpace: 'nowrap', [rtl ? 'marginRight' : 'marginLeft']: '10px', lineHeight: '1.4' }}>(.... / {Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)</span>
                  </div>
                  
                  <div style={{ [rtl ? 'marginRight' : 'marginLeft']: paperSaver ? '15px' : '25px' }}>
                    {question.type === 'multiple-choice' && (() => {
                      const optionsWithOrig = (question.options || []).map((opt, idx) => ({ ...opt, originalIndex: idx }));
                      // Shuffle
                      const shuffled = [...optionsWithOrig];
                      for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                      }

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: paperSaver ? '1fr 1fr 1fr' : '1fr 1fr', gap: paperSaver ? '4px' : '6px' }}>
                          {shuffled.map((opt, sIdx) => {
                            const isCorrect = showAnswers && opt.isCorrect;
                            const optRtl = isArabic(opt.text);
                            return (
                              <div key={sIdx} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: paperSaver ? '1px 3px' : '2px 6px', 
                                backgroundColor: isCorrect ? '#f0fdf4' : 'transparent', 
                                borderRadius: '4px',
                                direction: optRtl ? 'rtl' : 'ltr',
                                flexDirection: optRtl ? 'row-reverse' : 'row',
                                justifyContent: optRtl ? 'flex-start' : 'flex-start'
                              }}>
                                <div style={{ width: paperSaver ? '12px' : '16px', height: paperSaver ? '12px' : '16px', border: '1px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {isCorrect && <div style={{ width: paperSaver ? '6px' : '8px', height: paperSaver ? '6px' : '8px', backgroundColor: '#059669', borderRadius: '50%' }} />}
                                </div>
                                <span style={{ fontSize: paperSaver ? '10px' : '12px', color: isCorrect ? '#059669' : 'inherit', fontWeight: isCorrect ? 'bold' : 'normal', textAlign: optRtl ? 'right' : 'left' }}>{String.fromCharCode(97 + sIdx)}) {cleanText(opt.text)}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* True-false logic for individual questions removed as they are now grouped above */}

                    {question.type === 'ordering' && (() => {
                      const optionsWithOriginalIndex = (question.options || []).map((opt, originalIndex) => ({ ...opt, originalIndex }));
                      
                      // Shuffle
                      const shuffled = [...optionsWithOriginalIndex];
                      for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: paperSaver ? '3px' : '6px' }}>
                          <span style={{ fontStyle: 'italic', fontSize: paperSaver ? '9px' : '10px', color: '#666', marginBottom: paperSaver ? '2px' : '5px' }}>({rtl ? 'رتب العناصر من 1 إلى' : 'Numérotez les éléments de 1 à'} {question.options?.length})</span>
                          {shuffled.map((opt, sIdx) => {
                            const optRtl = isArabic(opt.text);
                            return (
                              <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: paperSaver ? '6px' : '10px', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                                <div style={{ width: paperSaver ? '18px' : '25px', height: paperSaver ? '18px' : '25px', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {showAnswers && question.correctOrder && (
                                    <span style={{ fontSize: paperSaver ? '10px' : '12px', fontWeight: 'bold' }}>
                                      {question.correctOrder.indexOf(opt.originalIndex) + 1}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: paperSaver ? '10.5px' : '12px', textAlign: optRtl ? 'right' : 'left', flex: 1 }} dangerouslySetInnerHTML={{ __html: cleanText(opt.text) }} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {question.type === 'matching' && (() => {
                      const left = question.options || [];
                      const rightWithOriginalIndex = (question.matchOptions || []).map((text, originalIndex) => ({ text, originalIndex }));
                      
                      // Shuffle the right side for the export document
                      const shuffledRight = [...rightWithOriginalIndex];
                      for (let i = shuffledRight.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffledRight[i], shuffledRight[j]] = [shuffledRight[j], shuffledRight[i]];
                      }

                      return (
                        <div style={{ marginTop: paperSaver ? '4px' : '10px', breakInside: 'avoid' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', direction: rtl ? 'rtl' : 'ltr' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb' }}>
                                <th style={{ border: '1px solid #000', padding: paperSaver ? '3px 5px' : '5px', fontSize: paperSaver ? '9.5px' : '11px', textAlign: rtl ? 'right' : 'left', width: '45%' }}>
                                  {question.columnAHeader || (rtl ? 'عناصر (يمين)' : 'Éléments (Gauche)')}
                                </th>
                                <th style={{ border: '1px solid #000', padding: paperSaver ? '3px' : '5px', fontSize: paperSaver ? '9.5px' : '11px', textAlign: 'center', width: '10%' }}>
                                  {rtl ? 'حرف/رقم' : 'Lettre/Chiffre'}
                                </th>
                                <th style={{ border: '1px solid #000', padding: paperSaver ? '3px 5px' : '5px', fontSize: paperSaver ? '9.5px' : '11px', textAlign: rtl ? 'right' : 'left', width: '45%' }}>
                                  {question.columnBHeader || (rtl ? 'عناصر (يسار)' : 'Éléments (Droite)')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {left.map((opt, lIdx) => (
                                <tr key={lIdx}>
                                  <td style={{ border: '1px solid #000', padding: paperSaver ? '3px 5px' : '6px 8px', fontSize: paperSaver ? '10px' : '11.5px', height: paperSaver ? '18px' : '28px', textAlign: isArabic(opt.text) ? 'right' : 'left' }}>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start', flexDirection: isArabic(opt.text) ? 'row-reverse' : 'row' }}>
                                      <span style={{ fontWeight: 'bold', flexShrink: 0 }}>{lIdx + 1}.</span>
                                      <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: cleanText(opt.text) }} />
                                    </div>
                                  </td>
                                  {lIdx === 0 && (
                                    <td 
                                      rowSpan={left.length} 
                                      style={{ 
                                        border: '1px solid #000', 
                                        background: showAnswers ? '#f0fdf4' : '#fff',
                                        textAlign: 'center', 
                                        verticalAlign: 'middle',
                                        width: '15%',
                                        position: 'relative'
                                      }}
                                    >
                                      {showAnswers ? (
                                        <div style={{ fontSize: paperSaver ? '8px' : '9px', color: '#059669', fontWeight: 'bold' }}>
                                          {left.map((_, i) => (
                                            <div key={i} style={{ marginBottom: paperSaver ? '2px' : '4px' }}>
                                              {i + 1} → {String.fromCharCode(65 + shuffledRight.findIndex(r => r.originalIndex === question.correctMatches![i]))}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ color: '#e2e8f0', fontSize: paperSaver ? '8px' : '10px', textTransform: 'uppercase', fontWeight: 'black', letterSpacing: '0.1em' }}>
                                          {rtl ? 'رسم' : 'Espace'}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td style={{ border: '1px solid #000', padding: paperSaver ? '3px 5px' : '6px 8px', fontSize: paperSaver ? '10px' : '11.5px', height: paperSaver ? '18px' : '28px', textAlign: isArabic(shuffledRight[lIdx]?.text || '') ? 'right' : 'left' }}>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start', flexDirection: isArabic(shuffledRight[lIdx]?.text || '') ? 'row-reverse' : 'row' }}>
                                      <span style={{ fontWeight: 'bold', flexShrink: 0 }}>{String.fromCharCode(65 + lIdx)}.</span>
                                      <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: cleanText(shuffledRight[lIdx]?.text || '') }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p style={{ fontStyle: 'italic', fontSize: paperSaver ? '8px' : '10px', marginTop: '5px', color: '#666', textAlign: rtl ? 'right' : 'left' }}>
                            {rtl ? 'قم بمطابقة كل رقم من العمود الأيمن مع الحرف المقابل له في العمود الأوسط.' : 'Associez chaque chiffre de la colonne de gauche à sa lettre correspondante dans la colonne centrale.'}
                          </p>
                        </div>
                      );
                    })()}

                    {question.type === 'fill-in-the-blanks' && (
                      <div style={{ padding: paperSaver ? '2px 0' : '5px 0', backgroundColor: 'transparent', direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>
                        <p style={{ fontSize: paperSaver ? '10.5px' : '12px', lineHeight: paperSaver ? '1.4' : '1.7', margin: 0 }}>
                          {(() => {
                            let blanksCount = 0;
                            return question.text.split('[blank]').map((part, i, arr) => (
                              <React.Fragment key={i}>
                                <span dangerouslySetInnerHTML={{ __html: cleanText(part) }} />
                                {i < arr.length - 1 && (
                                  <>
                                    {showAnswers ? (
                                      <span style={{ color: '#059669', fontWeight: 'bold' }}>
                                        &nbsp;[&nbsp;{cleanText(question.correctAnswers?.[blanksCount++] || '')}&nbsp;]&nbsp;
                                      </span>
                                    ) : (
                                      <span style={{ fontWeight: 'bold' }}>
                                        &nbsp;{paperSaver ? '.........' : '......................'}&nbsp;
                                      </span>
                                    )}
                                    {!showAnswers && <span style={{ display: 'none' }}>{blanksCount++}</span>}
                                  </>
                                )}
                              </React.Fragment>
                            ));
                          })()}
                        </p>
                      </div>
                    )}

                    {question.type === 'short-answer' && (
                       <div style={{ borderBottom: '1px dotted #000', height: paperSaver ? '20px' : '42px', marginTop: '5px', direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>
                         {showAnswers && <span style={{ fontSize: paperSaver ? '9.5px' : '11px', color: '#059669', fontStyle: 'italic', fontWeight: 'bold' }}>{rtl ? 'الإجابة:' : 'Corrigé :'} {cleanText(question.correctAnswer || '')}</span>}
                       </div>
                    )}

                    {question.type === 'practical' && (
                       <div style={{ borderBottom: '1px dotted #000', height: paperSaver ? '24px' : '52px', marginTop: '5px', direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left', fontStyle: 'italic', color: '#666', fontSize: paperSaver ? '9px' : '11.5px' }}>
                         {rtl ? 'مساحة للتقييم العملي...' : 'Espace pour l\'évaluation pratique / observations du formateur...'}
                       </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

               {showFooter && settings?.footerColumns && settings.footerColumns.length > 0 ? (
            <table className="footer-columns-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', border: '1.5px solid #000' }}>
              <tbody>
                <tr>
                  {settings.footerColumns.map((col, cIdx) => (
                    <td 
                      key={col.id} 
                      style={{ 
                        width: `${col.width}%`, 
                        padding: '0', 
                        textAlign: 'center', 
                        verticalAlign: 'top', 
                        border: '1px solid #000',
                        borderLeft: col.borderLeft ? '1.5px solid #000' : '1px solid #000',
                        borderRight: col.borderRight ? '1.5px solid #000' : '1px solid #000',
                        backgroundColor: col.bgColor || 'transparent',
                        color: col.textColor || 'inherit'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {col.lines.map((line, lIdx) => (
                          <div 
                            key={line.id} 
                            style={{ 
                              padding: '3px 10px',
                              textAlign: (line.alignment || 'center') as any,
                              minHeight: line.type === 'image' ? 'auto' : '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: line.alignment === 'left' ? 'flex-start' : line.alignment === 'right' ? 'flex-end' : 'center',
                              borderBottom: (settings.showFooterLines ?? false) && lIdx < col.lines.length - 1 ? '1px solid #000' : 'none'
                            }}
                          >
                            {line.type === 'image' ? (
                              <img 
                                src={getLineImageUrl(line, settings)} 
                                alt="Footer Logo" 
                                style={{ 
                                  width: line.imageWidth ? `${line.imageWidth}pt` : '30pt',
                                  height: line.imageHeight ? `${line.imageHeight}pt` : '30pt',
                                  objectFit: 'contain'
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <p style={{ 
                                margin: 0, 
                                fontSize: `${line.fontSize || 9}pt`, 
                                fontWeight: line.isBold ? 'bold' : 'normal',
                                fontStyle: line.isItalic ? 'italic' : 'normal',
                                fontFamily: line.fontFamily || 'inherit',
                                direction: isArabic(line.text || '') ? 'rtl' : 'ltr',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                color: col.textColor || 'inherit'
                              }}>
                                {replaceVariables(line.text)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {showFooter && (settings?.showFooterTable ?? true) && settings?.footerTable && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '9px', border: '1px solid #000' }}>
                  <tbody>
                    {settings.footerTable.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>
                            {replaceVariables(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {showFooter && (settings?.showFooterText ?? true) && (
                <div style={{ borderTop: '1px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: '#666' }}>
                   <span>{footerText}</span>
                   <span>Fin de l'épreuve - Bonne chance</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Correction Summary Grid (Only if showAnswers) */}
        {showAnswers && (
          <div className="correction-summary" style={{ marginTop: '40px', border: '2px solid #000', padding: '15px', breakInside: 'avoid', backgroundColor: '#f0fdf4' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '15px', textAlign: 'center' }}>GRILLE DE RÉPONSES (CORRIGÉ)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', backgroundColor: '#000', border: '1px solid #000' }}>
              {exam.questions.map((q, i) => (
                <div key={i} style={{ backgroundColor: '#fff', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Q{i+1}</span>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: '#059669' }}>
                    {q.type === 'multiple-choice' && (() => {
                       const correctIdx = q.options?.findIndex(o => o.isCorrect);
                       return correctIdx !== undefined && correctIdx !== -1 ? String.fromCharCode(97 + correctIdx) : '?';
                    })()}
                    {q.type === 'true-false' && (q.correctAnswer === 'true' ? 'V' : 'F')}
                    {q.type === 'short-answer' && 'SA'}
                    {q.type === 'fill-in-the-blanks' && 'TEXT'}
                    {q.type === 'ordering' && q.correctOrder?.map(idx => idx + 1).join(',')}
                    {q.type === 'matching' && 'M'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

ExamExportTemplate.displayName = 'ExamExportTemplate';
