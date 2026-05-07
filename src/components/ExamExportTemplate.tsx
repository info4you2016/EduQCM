import React from 'react';
import { Exam, Module, Question, OrganizationSettings } from '../types';
import { formatDuration } from '../lib/utils';

interface ExamExportTemplateProps {
  exam: Exam;
  module: Module;
  filiereName: string;
  filiereLevel?: string;
  groupName: string;
  showAnswers?: boolean;
  settings?: OrganizationSettings | null;
}

export const ExamExportTemplate = React.forwardRef<HTMLDivElement, ExamExportTemplateProps>(
  ({ exam, module, filiereName, filiereLevel, groupName, showAnswers = false, settings }, ref) => {
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
      'ordering': "Questions d'Ordonnancement"
    };

    const orderedTypes = [
      'multiple-choice',
      'true-false',
      'matching',
      'ordering',
      'fill-in-the-blanks',
      'short-answer'
    ].filter(type => groupedQuestions[type]);

    const isArabic = (text: string) => /[\u0600-\u06FF]/.test(text || '');

    return (
      <div 
        ref={ref} 
        id="export-container"
        style={{ 
          width: '210mm', 
          margin: '0 auto', 
          fontSize: '11pt',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '10mm 15mm',
          fontFamily: "'Times New Roman', Times, serif",
          boxSizing: 'border-box',
          lineHeight: '1.4'
        }}
      >
        {/* Main Header Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '20px' }}>
          <tbody>
            <tr>
              {/* Left Logo */}
              <td style={{ width: '15%', border: '1px solid #000', padding: '5px', textAlign: 'center', verticalAlign: 'middle' }}>
                {settings?.orgLogoUrl ? (
                  <img 
                    src={settings.orgLogoUrl} 
                    alt="Logo" 
                    style={{ width: '60px', maxHeight: '60px', objectFit: 'contain' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div style={{ fontSize: '10px', fontWeight: 'bold' }}>OFPPT</div>
                )}
              </td>
              
              {/* Middle Content */}
              <td style={{ width: '70%', border: '1px solid #000', padding: '0', textAlign: 'center' }}>
                {settings?.headerLines && settings.headerLines.length > 0 ? (
                  settings.headerLines.map((line, idx) => (
                    <div 
                      key={line.id} 
                      style={{ 
                        borderBottom: settings.showHeaderLines && idx < settings.headerLines!.length - 1 ? '1px solid #000' : 'none', 
                        padding: '4px 10px' 
                      }}
                    >
                      <p style={{ 
                        margin: 0, 
                        fontSize: `${line.fontSize}pt`, 
                        fontWeight: line.isBold ? 'bold' : 'normal',
                        fontStyle: line.isItalic ? 'italic' : 'normal',
                        textAlign: line.alignment as any,
                        fontFamily: line.fontFamily || 'inherit',
                        direction: /[\u0600-\u06FF]/.test(line.text) ? 'rtl' : 'ltr'
                      }}>
                        {line.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <>
                    <div style={{ borderBottom: settings?.showHeaderLines ? '1px solid #000' : 'none', padding: '5px' }}>
                      <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{orgNameArabic}</h1>
                    </div>
                    <div style={{ borderBottom: settings?.showHeaderLines ? '1px solid #000' : 'none', padding: '5px' }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>{orgNameFrench}</p>
                    </div>
                    <div style={{ borderBottom: settings?.showHeaderLines ? '1px solid #000' : 'none', padding: '5px' }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>{regionalDirection}</p>
                    </div>
                    <div style={{ padding: '5px' }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>{institutionName}</p>
                    </div>
                  </>
                )}
              </td>
              
              {/* Right Logo */}
              <td style={{ width: '15%', border: '1px solid #000', padding: '5px', textAlign: 'center', verticalAlign: 'middle' }}>
                {settings?.orgLogoUrl ? (
                  <img 
                    src={settings.orgLogoUrl} 
                    alt="Logo" 
                    style={{ width: '60px', maxHeight: '60px', objectFit: 'contain' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div style={{ fontSize: '10px', fontWeight: 'bold' }}>OFPPT</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Metadata Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '10px', fontSize: '11px' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '4px 8px', width: '33%' }}>
                <strong>Filière :</strong> {filiereName}
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 8px', width: '33%' }}>
                <strong>Niveau :</strong> {filiereLevel || 'TS / T / B'}
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 8px', width: '34%' }}>
                <strong>Année de formation :</strong> {academicYear}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                <strong>Numéro du module :</strong> {module.code}
              </td>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 8px' }}>
                <strong>Intitulé du module :</strong> {module.name}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                <strong>Horaire :</strong> {formatDuration(exam.durationMinutes)}
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                <strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}
              </td>
              <td style={{ border: '1px solid #000', padding: '4px 8px' }}>
                <strong>Barème :</strong> / {Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2)} Pts
              </td>
            </tr>
          </tbody>
        </table>

        {/* Exam Title */}
        <div style={{ textAlign: 'center', margin: '15px 0' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', textDecoration: 'underline' }}>
            {exam.title}
          </h2>
        </div>

        {/* Candidate Info Section */}
        <div style={{ 
          marginBottom: '20px', 
          border: '1px solid #000', 
          padding: '10px', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '80%' }}>
            <span style={{ fontWeight: 'bold' }}>Nom et Prénom : ................................................................................</span>
          </div>
          <div style={{ 
            border: '2px solid #000', 
            padding: '8px 5px', 
            textAlign: 'center', 
            width: '20%',
            boxSizing: 'border-box' 
          }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>NOTE</span>
            <span style={{ fontSize: '16px', fontWeight: 'bold' }}>....... / {totalPoints}</span>
          </div>
        </div>


        {/* Questions Grouped */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {orderedTypes.map((type) => (
            <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '5px 15px', borderLeft: '4px solid #000', marginBottom: '5px' }}>
                <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '14px', fontWeight: '900' }}>
                  {typeLabels[type]}
                </h3>
              </div>
              
              {type === 'true-false' ? (
                <div style={{ marginTop: '10px', breakInside: 'avoid' }}>
                  {(() => {
                    const hasRtl = groupedQuestions[type].some(({ q }) => isArabic(q.text));
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', direction: hasRtl ? 'rtl' : 'ltr' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            <th style={{ border: '1px solid #000', padding: '8px', fontSize: '11px', textAlign: hasRtl ? 'right' : 'left' }}>{hasRtl ? 'الأسئلة' : 'Questions'}</th>
                            <th style={{ border: '1px solid #000', padding: '8px', fontSize: '11px', textAlign: 'center', width: '1.5cm', whiteSpace: 'nowrap' }}>{hasRtl ? 'صحيح' : 'Vrai'}</th>
                            <th style={{ border: '1px solid #000', padding: '8px', fontSize: '11px', textAlign: 'center', width: '1.5cm', whiteSpace: 'nowrap' }}>{hasRtl ? 'خطأ' : 'Faux'}</th>
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
                                    padding: '10px 8px', 
                                    fontSize: '12px',
                                    direction: rtl ? 'rtl' : 'ltr',
                                    textAlign: rtl ? 'right' : 'left'
                                  }}
                                >
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                                    <span style={{ fontWeight: 'bold', shrink: 0 }}>{qIdx + 1}.</span>
                                    <div style={{ flex: 1 }}>
                                      <div dangerouslySetInnerHTML={{ __html: question.text }} style={{ display: 'inline' }} />
                                      <span style={{ fontSize: '9px', fontWeight: 'bold', [rtl ? 'marginRight' : 'marginLeft']: '10px', color: '#666', whiteSpace: 'nowrap' }}>({Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)</span>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>
                                  <div style={{ 
                                    width: '18px', 
                                    height: '18px', 
                                    border: '1px solid #000', 
                                    margin: '0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    backgroundColor: showAnswers && isTrue ? '#f0fdf4' : 'transparent'
                                  }}>
                                    {showAnswers && isTrue ? 'X' : ''}
                                  </div>
                                </td>
                                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>
                                  <div style={{ 
                                    width: '18px', 
                                    height: '18px', 
                                    border: '1px solid #000', 
                                    margin: '0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
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
              ) : groupedQuestions[type].map(({ q: question, originalIdx: qIdx }) => {
                const rtl = isArabic(question.text);
                return (
                <div key={qIdx} style={{ breakInside: 'avoid', direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', borderBottom: '0.5px solid #eee', paddingBottom: '3px', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px', shrink: 0 }}>{qIdx + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px' }} dangerouslySetInnerHTML={{ __html: question.text }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', whiteSpace: 'nowrap', [rtl ? 'marginRight' : 'marginLeft']: '10px' }}>(.... / {Number.isInteger(question.points) ? question.points : question.points.toFixed(2)} pts)</span>
                  </div>
                  
                  <div style={{ [rtl ? 'marginRight' : 'marginLeft']: '25px' }}>
                    {question.type === 'multiple-choice' && (() => {
                      const optionsWithOrig = (question.options || []).map((opt, idx) => ({ ...opt, originalIndex: idx }));
                      // Shuffle
                      const shuffled = [...optionsWithOrig];
                      for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                      }

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {shuffled.map((opt, sIdx) => {
                            const isCorrect = showAnswers && opt.isCorrect;
                            const optRtl = isArabic(opt.text);
                            return (
                              <div key={sIdx} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                border: isCorrect ? '1px solid #059669' : '1px solid #f9f9f9', 
                                padding: '6px', 
                                backgroundColor: isCorrect ? '#f0fdf4' : 'transparent', 
                                borderRadius: '4px',
                                direction: optRtl ? 'rtl' : 'ltr',
                                flexDirection: optRtl ? 'row-reverse' : 'row',
                                justifyContent: optRtl ? 'flex-start' : 'flex-start'
                              }}>
                                <div style={{ width: '16px', height: '16px', border: '1px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {isCorrect && <div style={{ width: '8px', height: '8px', backgroundColor: '#059669', borderRadius: '50%' }} />}
                                </div>
                                <span style={{ fontSize: '12px', color: isCorrect ? '#059669' : 'inherit', fontWeight: isCorrect ? 'bold' : 'normal', textAlign: optRtl ? 'right' : 'left' }}>{String.fromCharCode(97 + sIdx)}) {opt.text}</span>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontStyle: 'italic', fontSize: '10px', color: '#666', marginBottom: '5px' }}>({rtl ? 'رتب العناصر من 1 إلى' : 'Numérotez les éléments de 1 à'} {question.options?.length})</span>
                          {shuffled.map((opt, sIdx) => {
                            const optRtl = isArabic(opt.text);
                            return (
                              <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: rtl ? 'row-reverse' : 'row' }}>
                                <div style={{ width: '25px', height: '25px', border: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {showAnswers && question.correctOrder && (
                                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                      {question.correctOrder.indexOf(opt.originalIndex) + 1}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '12px', textAlign: optRtl ? 'right' : 'left', flex: 1 }} dangerouslySetInnerHTML={{ __html: opt.text }} />
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
                        <div style={{ marginTop: '10px', breakInside: 'avoid' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', direction: rtl ? 'rtl' : 'ltr' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb' }}>
                                <th style={{ border: '1px solid #000', padding: '5px', fontSize: '11px', textAlign: rtl ? 'right' : 'left', width: '45%' }}>
                                  {question.columnAHeader || (rtl ? 'عناصر (يمين)' : 'Éléments (Gauche)')}
                                </th>
                                <th style={{ border: '1px solid #000', padding: '5px', fontSize: '11px', textAlign: 'center', width: '10%' }}>
                                  {rtl ? 'حرف/رقم' : 'Lettre/Chiffre'}
                                </th>
                                <th style={{ border: '1px solid #000', padding: '5px', fontSize: '11px', textAlign: rtl ? 'right' : 'left', width: '45%' }}>
                                  {question.columnBHeader || (rtl ? 'عناصر (يسار)' : 'Éléments (Droite)')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {left.map((opt, lIdx) => (
                                <tr key={lIdx}>
                                  <td style={{ border: '1px solid #000', padding: '12px 8px', fontSize: '12px', height: '40px', textAlign: isArabic(opt.text) ? 'right' : 'left' }}>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start', flexDirection: isArabic(opt.text) ? 'row-reverse' : 'row' }}>
                                      <span style={{ fontWeight: 'bold', shrink: 0 }}>{lIdx + 1}.</span>
                                      <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: opt.text }} />
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
                                        <div style={{ fontSize: '9px', color: '#059669', fontWeight: 'bold' }}>
                                          {left.map((_, i) => (
                                            <div key={i} style={{ marginBottom: '4px' }}>
                                              {i + 1} → {String.fromCharCode(65 + shuffledRight.findIndex(r => r.originalIndex === question.correctMatches![i]))}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{ color: '#e2e8f0', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'black', letterSpacing: '0.1em' }}>
                                          {rtl ? 'مساحة\nللسهام' : 'Espace pour\nflèches'}
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  <td style={{ border: '1px solid #000', padding: '12px 8px', fontSize: '12px', height: '40px', textAlign: isArabic(shuffledRight[lIdx]?.text || '') ? 'right' : 'left' }}>
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-start', flexDirection: isArabic(shuffledRight[lIdx]?.text || '') ? 'row-reverse' : 'row' }}>
                                      <span style={{ fontWeight: 'bold', shrink: 0 }}>{String.fromCharCode(65 + lIdx)}.</span>
                                      <div style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: shuffledRight[lIdx]?.text }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p style={{ fontStyle: 'italic', fontSize: '10px', marginTop: '5px', color: '#666', textAlign: rtl ? 'right' : 'left' }}>
                            {rtl ? 'قم بمطابقة كل رقم من العمود الأيمن مع الحرف المقابل له في العمود الأوسط.' : 'Associez chaque chiffre de la colonne de gauche à sa lettre correspondante dans la colonne centrale.'}
                          </p>
                        </div>
                      );
                    })()}

                    {question.type === 'fill-in-the-blanks' && (
                      <div style={{ padding: '15px', border: '1px dashed #ccc', backgroundColor: '#fdfdfd', borderRadius: '4px', direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>
                        <p style={{ fontSize: '12px', lineHeight: '2.2', margin: 0 }}>
                          {(() => {
                            let blanksCount = 0;
                            return question.text.split('[blank]').map((part, i, arr) => (
                              <React.Fragment key={i}>
                                <span dangerouslySetInnerHTML={{ __html: part }} />
                                {i < arr.length - 1 && (
                                  <>
                                    <span style={{ borderBottom: '1px solid #000', padding: '0 5px', color: showAnswers ? '#059669' : 'transparent', fontWeight: 'bold' }}>
                                      &nbsp;&nbsp;{showAnswers ? question.correctAnswers?.[blanksCount++] : '......................'}&nbsp;&nbsp;
                                    </span>
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
                       <div style={{ borderBottom: '1px dotted #000', height: '60px', marginTop: '10px', direction: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>
                         {showAnswers && <span style={{ fontSize: '11px', color: '#059669', fontStyle: 'italic', fontWeight: 'bold' }}>{rtl ? 'الإجابة:' : 'Corrigé :'} {question.correctAnswer}</span>}
                       </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

        {/* Footer info */}
        <div style={{ marginTop: '40px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
            Elaboré par le Formateur :
          </div>
          
          <div style={{ borderTop: '1px solid #000', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', color: '#666' }}>
             <span>{orgName} / Direction Régionale BM-KH / {module.code}</span>
             <span>Fin de l'épreuve - Bonne chance</span>
          </div>
        </div>

        {/* Correction Summary Grid (Only if showAnswers) */}
        {showAnswers && (
          <div style={{ marginTop: '40px', border: '2px solid #000', padding: '15px', breakInside: 'avoid', backgroundColor: '#f0fdf4' }}>
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
