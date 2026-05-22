import React from 'react';
import { Exam, Result, Module, OrganizationSettings } from '../types';
import { formatScore, formatPercent } from '../lib/utils';

interface ResultsExportTemplateProps {
  exam: Exam;
  results: Result[];
  module: Module;
  filiereName: string;
  filiereLevel?: string;
  groupName: string;
  settings?: OrganizationSettings | null;
}

export const ResultsExportTemplate = React.forwardRef<HTMLDivElement, ResultsExportTemplateProps>(
  ({ exam, results, module, filiereName, filiereLevel, groupName, settings }, ref) => {
    const orgName = settings?.orgName || 'OFPPT';
    const orgSubName = settings?.orgSubName || 'DRBMKH';
    const academicYear = settings?.academicYear || '2024/2025';

    const replaceVariables = (text: string) => {
      if (!text) return '';
      return text
        .replace(/{{ORG_AR}}/g, settings?.orgNameArabic || '')
        .replace(/{{ORG_FR}}/g, settings?.orgNameFrench || '');
    };

    const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

    return (
      <div 
        ref={ref} 
        id="results-export-container"
        className="pdf-export-content"
        style={{ 
          width: '210mm', 
          margin: '0 auto', 
          fontSize: '10pt',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '15mm 20mm',
          fontFamily: "'Times New Roman', Times, 'Amiri', serif",
          boxSizing: 'border-box',
          lineHeight: '1.4'
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .pdf-export-content * {
            font-family: inherit;
          }
          .pdf-export-content h1, 
          .pdf-export-content h2, 
          .pdf-export-content h3 {
            color: #000000 !important;
          }
          .participant-card {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        `}} />
        {/* Header Summary */}
        <div id="export-summary-section">
          {settings?.headerColumns && settings.headerColumns.length > 0 ? (
            <table className="header-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', border: '1.5px solid #000' }}>
              <tbody>
                <tr>
                  {settings.headerColumns.map((col) => (
                    <td 
                      key={col.id} 
                      style={{ 
                        width: `${col.width}%`, 
                        padding: '0', 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        border: '1px solid #000',
                        borderRight: col.borderRight ? '1.5px solid #000' : '1px solid #000'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {col.lines.map((line, lIdx) => (
                          <div 
                            key={line.id} 
                            style={{ 
                              padding: '3px 10px',
                              textAlign: (line.alignment || 'center') as any,
                              minHeight: line.type === 'image' ? 'auto' : '22px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: line.alignment === 'left' ? 'flex-start' : line.alignment === 'right' ? 'flex-end' : 'center',
                              borderBottom: settings.showHeaderLines && lIdx < col.lines.length - 1 ? '1px solid #000' : 'none'
                             }}
                          >
                            {line.type === 'image' ? (
                              <img 
                                src={line.imageUrl} 
                                alt="Logo" 
                                style={{ 
                                  width: line.imageWidth ? `${line.imageWidth}pt` : '40pt',
                                  height: line.imageHeight ? `${line.imageHeight}pt` : '40pt',
                                  objectFit: 'contain'
                                }}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: `${line.fontSize || 10}pt`, 
                                  fontWeight: line.isBold ? 'bold' : 'normal',
                                  fontStyle: line.isItalic ? 'italic' : 'normal',
                                  fontFamily: line.fontFamily || 'inherit',
                                  direction: isArabic(line.text || '') ? 'rtl' : 'ltr',
                                  whiteSpace: 'nowrap'
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
            <div style={{ textAlign: 'center', marginBottom: '30px', border: '2px solid #000', padding: '20px', display: 'flex', gap: '20px', alignItems: 'center', direction: isArabic(exam.title) ? 'rtl' : 'ltr' }}>
              {settings?.orgLogoUrl && (
                <img 
                  src={settings.orgLogoUrl} 
                  alt="Logo Left" 
                  style={{ width: '60px', height: '60px', objectFit: 'contain' }} 
                  referrerPolicy="no-referrer"
                />
              )}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                  Rapport de Résultats : {exam.title}
                </h1>
                <p style={{ margin: '5px 0', fontSize: '12px' }}>
                  <strong>Module :</strong> {module.name} | <strong>Filière :</strong> {filiereName} | <strong>Niveau :</strong> {filiereLevel || 'TS / T / B'} | <strong>Groupe :</strong> {groupName}
                </p>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>
                  Institution : {orgName} ({orgSubName}) | Année de formation : {academicYear}
                </p>
              </div>
              {settings?.orgLogoUrlRight ? (
                <img 
                  src={settings.orgLogoUrlRight} 
                  alt="Logo Right" 
                  style={{ width: '60px', height: '60px', objectFit: 'contain' }} 
                  referrerPolicy="no-referrer"
                />
              ) : settings?.orgLogoUrl ? (
                <img 
                  src={settings.orgLogoUrl} 
                  alt="Logo Right" 
                  style={{ width: '60px', height: '60px', objectFit: 'contain' }} 
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </div>
          )}

          {settings?.headerColumns && settings.headerColumns.length > 0 && (
             <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '20px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
                  Rapport de Résultats : {exam.title}
                </h1>
                <p style={{ margin: '5px 0', fontSize: '12px' }}>
                  <strong>Module :</strong> {module.name} | <strong>Filière :</strong> {filiereName} | <strong>Niveau :</strong> {filiereLevel || 'TS / T / B'} | <strong>Groupe :</strong> {groupName}
                </p>
                <p style={{ margin: '5px 0', fontSize: '11px' }}>
                  Année de formation : {academicYear}
                </p>
             </div>
          )}

          {/* Results List */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '15px' }}>
              Liste des Participants ({results.length} étudiants)
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <th style={{ border: '1px solid #000000', padding: '8px', textAlign: 'left' }}>Étudiant</th>
                  <th style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>Score</th>
                  <th style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>Pourcentage</th>
                  <th style={{ border: '1px solid #000000', padding: '8px', textAlign: 'right' }}>Date de passage</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, i) => {
                  const nameAr = isArabic(res.studentName);
                  return (
                    <tr key={res.id}>
                      <td style={{ border: '1px solid #000000', padding: '8px', textAlign: nameAr ? 'right' : 'left', direction: nameAr ? 'rtl' : 'ltr' }}>{res.studentName}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>{formatScore(res.score)} / {res.totalPoints}</td>
                      <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>
                        {formatPercent((res.score / (res.totalPoints || 1)) * 100)}%
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'right' }}>
                        {new Date(res.completedAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Individual Details Section */}
        <div>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1.5px solid #000000', paddingBottom: '5px', marginBottom: '25px', textAlign: 'center' }}>
            DÉTAIL DES RÉPONSES PAR ÉTUDIANT
          </h2>
          
          {results.map((res, sIdx) => {
            const nameAr = isArabic(res.studentName);
            return (
              <div 
                key={res.id} 
                className="student-detail-card"
                style={{ 
                  marginBottom: '40px', 
                  padding: '20px', 
                  border: '1px solid #888888', 
                  borderRadius: '12px',
                  pageBreakBefore: 'always',
                  minHeight: '200mm' // Encourage a full page per student
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed #888888', paddingBottom: '10px', direction: nameAr ? 'rtl' : 'ltr' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', textAlign: nameAr ? 'right' : 'left' }}><strong>{sIdx + 1}. {res.studentName}</strong></h3>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Note : {formatScore(res.score)} / {res.totalPoints} ({formatPercent((res.score / (res.totalPoints || 1)) * 100)}%)</span>
                </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', opacity: 0.8 }}>
                {exam.questions.map((q, qIdx) => {
                  if (q.type === 'practical') return null;
                  const qRes = res.questionResults?.[qIdx];
                  const pointsEarned = qRes?.pointsEarned || 0;
                  const isCorrect = pointsEarned === q.points;
                  const isPartial = pointsEarned > 0 && pointsEarned < q.points;
                  const studentAns = res.answers[qIdx];
                  const qAr = isArabic(q.text);

                  return (
                    <div 
                      key={qIdx} 
                      style={{ 
                        padding: '6px 10px', 
                        border: '1px solid #888888', 
                        borderRadius: '4px',
                        backgroundColor: '#ffffff',
                        fontSize: '10px',
                        minWidth: '60px',
                        direction: qAr ? 'rtl' : 'ltr',
                        textAlign: qAr ? 'right' : 'left'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Q{qIdx + 1}</div>
                      <div style={{ color: isCorrect ? '#000000' : '#888888', fontWeight: 'black' }}>
                        {isCorrect ? 'Correct' : isPartial ? 'Partiel' : 'Incorrect'}
                      </div>
                      {/* Hidden indices removed as per request */}
                      <div style={{ height: '4px' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    );
  }
);

ResultsExportTemplate.displayName = 'ResultsExportTemplate';
