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

    const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

    return (
      <div 
        ref={ref} 
        id="results-export-container"
        style={{ 
          width: '210mm', 
          margin: '0 auto', 
          fontSize: '10pt',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '15mm 20mm',
          fontFamily: "'Times New Roman', Times, serif",
          boxSizing: 'border-box',
          lineHeight: '1.4'
        }}
      >
        {/* Header Summary */}
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
          {settings?.orgLogoUrl && (
            <img 
              src={settings.orgLogoUrl} 
              alt="Logo Right" 
              style={{ width: '60px', height: '60px', objectFit: 'contain' }} 
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {/* Results List */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '15px' }}>
            Liste des Participants ({results.length} étudiants)
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left' }}>Étudiant</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Score</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>Pourcentage</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>Date de passage</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, i) => {
                const nameAr = isArabic(res.studentName);
                return (
                  <tr key={res.id}>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: nameAr ? 'right' : 'left', direction: nameAr ? 'rtl' : 'ltr' }}>{res.studentName}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{formatScore(res.score)} / {res.totalPoints}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>
                      {formatPercent((res.score / (res.totalPoints || 1)) * 100)}%
                    </td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right' }}>
                      {new Date(res.completedAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Individual Details Section */}
        <div style={{ pageBreakBefore: 'always' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1.5px solid #000', paddingBottom: '5px', marginBottom: '25px', textAlign: 'center' }}>
            DÉTAIL DES RÉPONSES PAR ÉTUDIANT
          </h2>
          
          {results.map((res, sIdx) => {
            const nameAr = isArabic(res.studentName);
            return (
              <div key={res.id} style={{ marginBottom: '40px', padding: '15px', border: '1px solid #eee', breakInside: 'avoid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px dashed #ccc', paddingBottom: '10px', direction: nameAr ? 'rtl' : 'ltr' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', textAlign: nameAr ? 'right' : 'left' }}><strong>{sIdx + 1}. {res.studentName}</strong></h3>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Note : {formatScore(res.score)} / {res.totalPoints} ({formatPercent((res.score / (res.totalPoints || 1)) * 100)}%)</span>
                </div>
              
              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Aperçu des performances par question :</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {exam.questions.map((q, qIdx) => {
                    const qRes = res.questionResults?.[qIdx];
                    const pointsEarned = qRes?.pointsEarned || 0;
                    const isCorrect = pointsEarned === q.points;
                    const isPartial = pointsEarned > 0 && pointsEarned < q.points;
                    
                    return (
                      <div 
                        key={qIdx} 
                        style={{ 
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          backgroundColor: isCorrect ? '#10b981' : isPartial ? '#f59e0b' : '#f43f5e',
                          color: '#ffffff',
                          fontSize: '9px',
                          fontWeight: '900',
                          border: '1px solid rgba(0,0,0,0.05)'
                        }}
                      >
                        {qIdx + 1}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', opacity: 0.8 }}>
                {exam.questions.map((q, qIdx) => {
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
                        border: '1px solid #ddd', 
                        borderRadius: '4px',
                        backgroundColor: isCorrect ? '#f0fdf4' : isPartial ? '#fffbeb' : '#fef2f2',
                        fontSize: '10px',
                        minWidth: '60px',
                        direction: qAr ? 'rtl' : 'ltr',
                        textAlign: qAr ? 'right' : 'left'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Q{qIdx + 1}</div>
                      <div style={{ color: isCorrect ? '#059669' : isPartial ? '#d97706' : '#dc2626', fontWeight: 'black' }}>
                        {isCorrect ? 'Correct' : isPartial ? 'Partiel' : 'Incorrect'}
                      </div>
                      <div style={{ fontSize: '9px', marginTop: '2px', color: '#666' }}>
                        {q.type === 'multiple-choice' || q.type === 'true-false' ? (
                          <span>{qAr ? 'رد : ' : 'Rép: '}{studentAns !== undefined && studentAns !== null ? String.fromCharCode(97 + (studentAns as number)) : 'N/A'}</span>
                        ) : (
                          <span>{qAr ? 'نقط : ' : 'Pts: '}{formatScore(pointsEarned)}</span>
                        )}
                      </div>
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
