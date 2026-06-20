import React from 'react';
import { Exam, Result, Module, OrganizationSettings } from '../types';

interface PVExportTemplateProps {
  exam: Exam;
  results: Result[];
  module: Module;
  filiereName: string;
  filiereLevel?: string;
  groupName: string;
  settings?: OrganizationSettings | null;
  allExams?: Exam[];
  allResults?: Result[];
}

export const PVExportTemplate = React.forwardRef<HTMLDivElement, PVExportTemplateProps>(
  ({ exam, results, module, filiereName, filiereLevel, groupName, settings, allExams, allResults }, ref) => {
    // Determine year based on filiereLevel or year info
    const levelStr = (filiereLevel || '').toLowerCase();
    const groupStr = (groupName || '').toLowerCase();

    let isFirstYear = levelStr.includes('1') || levelStr.includes('premiere') || levelStr.includes('1ère');
    let isSecondYear = levelStr.includes('2') || levelStr.includes('deuxieme') || levelStr.includes('2ème') || (!isFirstYear && levelStr.includes('ts')); // default TS usually 2nd year if not specified as 1st
    let isThirdYear = levelStr.includes('3') || levelStr.includes('troisieme') || levelStr.includes('3ème');

    // Override/supplement based on groupName (e.g., CDN102 is 1ère année, TCM201 is 2ème année)
    const groupMatch1xx = groupStr.match(/1\d{2}/);
    const groupMatch2xx = groupStr.match(/2\d{2}/);
    const groupMatch3xx = groupStr.match(/3\d{2}/);

    if (groupMatch1xx) {
      isFirstYear = true;
      isSecondYear = false;
      isThirdYear = false;
    } else if (groupMatch2xx) {
      isFirstYear = false;
      isSecondYear = true;
      isThirdYear = false;
    } else if (groupMatch3xx) {
      isFirstYear = false;
      isSecondYear = false;
      isThirdYear = true;
    }

    // Default durations (using module's duration hours as requested by user)
    const masseHorairePrevue = module?.durationHours ? `${module.durationHours}H` : '30H';
    const masseHoraireRealisee = module?.durationHours ? `${module.durationHours}H` : '30H';

    const getAppreciation = (scorePercent: number) => {
      if (scorePercent >= 80) return 'Très Bien';
      if (scorePercent >= 70) return 'Bien';
      if (scorePercent >= 60) return 'Assez Bien';
      if (scorePercent >= 50) return 'Passable';
      return 'Insuffisant';
    };

    // Find CC Exams for this module and group to display continuous assessment marks
    const ccExams = (allExams || []).filter(ex => 
      ex.moduleId === exam.moduleId && 
      ex.type === 'controle-continu' && 
      (ex.groupId === exam.groupId || ex.groupName === exam.groupName)
    );
    // Sort them so they map consistently to CC1, CC2, CC3, etc.
    ccExams.sort((a, b) => a.id - b.id);

    // Sort results alphabetically by trainee name
    const sortedResults = [...results].sort((a, b) => {
      const nameA = (a.studentName || '').trim().toLowerCase();
      const nameB = (b.studentName || '').trim().toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });

    const orgName = settings?.orgName || 'OFPPT';
    const orgNameArabic = settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل';
    const orgNameFrench = settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail';
    const regionalDirection = settings?.regionalDirection || 'Direction Régionale De BM-KH';
    const institutionName = settings?.institutionName || 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem';
    const orgSubName = settings?.orgSubName || 'DRBMKH';
    const academicYear = settings?.academicYear || '2024/2025';

    return (
      <div 
        ref={ref} 
        id="pv-export-container"
        className="pv-export-content"
        style={{ 
          width: '297mm', // Landscape A4 size
          height: '210mm',
          margin: '0 auto', 
          fontSize: '10pt',
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '10mm 15mm',
          fontFamily: "'Times New Roman', Times, serif",
          boxSizing: 'border-box',
          lineHeight: '1.3'
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 landscape !important;
              margin: 10mm 15mm !important;
            }
            body {
              background-color: #ffffff !important;
              color: #000000 !important;
            }
            #pv-export-container, .pv-export-content {
              display: block !important;
              visibility: visible !important;
              position: static !important;
              width: 297mm !important;
              height: 210mm !important;
              box-sizing: border-box !important;
              margin: 0 auto !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              padding: 10mm 15mm !important;
            }
          }
          .pv-export-content * {
            font-family: 'Times New Roman', Times, serif;
          }
          .pv-export-content table {
            border-collapse: collapse;
            width: 100%;
          }
          .pv-export-content th, .pv-export-content td {
            border: 1px solid #000000;
            padding: 4px 6px;
            font-size: 10pt;
            text-align: center;
            vertical-align: middle;
          }
          .pv-export-content h2 {
            font-size: 16pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 12px;
          }
        `}} />

        {/* PV Landscape Header with Logo on the left and right */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '15px',
          borderBottom: 'none',
          paddingBottom: '10px'
        }}>
          {/* Left: Institution Logo and Code */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '25%', textAlign: 'left' }}>
            {settings?.orgLogoUrl ? (
              <img 
                src={settings.orgLogoUrl} 
                alt="Logo Gauche" 
                style={{ height: '55px', maxWidth: '100px', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>{orgName}</div>
            )}
            <div style={{ fontSize: '8pt', lineHeight: '1.2' }}>
              <p style={{ margin: 0, fontWeight: 'bold', textTransform: 'uppercase' }}>{orgSubName}</p>
              <p style={{ margin: 0, fontSize: '7pt', color: '#666' }}>{regionalDirection}</p>
            </div>
          </div>

          {/* Center: PV Main Title and Academic Year */}
          <div style={{ textAlign: 'center', width: '50%' }}>
            <div style={{ fontSize: '9pt', color: '#000', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {orgNameFrench}
            </div>
            <div style={{ fontSize: '9pt', color: '#111', fontWeight: 'bold', marginTop: '2px' }}>
              {institutionName}
            </div>
            <div style={{ fontSize: '9pt', color: '#444', marginTop: '2px' }}>
              Année de formation : <strong>{academicYear}</strong>
            </div>
            <h2 style={{ fontSize: '15pt', fontWeight: 'bold', margin: '6px 0 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PV de l'Examen de Fin de Module
            </h2>
          </div>

          {/* Right: Secondary Logo or Arabic Text */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', width: '25%', textAlign: 'right' }}>
            <div style={{ fontSize: '7.5pt', lineHeight: '1.2' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontFamily: "'Amiri', serif", fontSize: '9pt', color: '#000' }}>{orgNameArabic}</p>
              <p style={{ margin: 0, fontSize: '7pt', color: '#555' }}>Royaume du Maroc</p>
            </div>
            {settings?.orgLogoUrlRight ? (
              <img 
                src={settings.orgLogoUrlRight} 
                alt="Logo Droit" 
                style={{ height: '55px', maxWidth: '100px', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
              />
            ) : settings?.orgLogoUrl ? (
              <img 
                src={settings.orgLogoUrl} 
                alt="Logo Droit Fallback" 
                style={{ height: '55px', maxWidth: '100px', objectFit: 'contain', opacity: 0.6 }}
                referrerPolicy="no-referrer"
              />
            ) : null}
          </div>
        </div>

        {/* PV Meta Grid Info Header */}
        <table style={{ marginBottom: '15px', border: '1.5px solid #000000' }}>
          <tbody>
            <tr>
              <td style={{ textAlign: 'left', fontWeight: 'bold', width: '50%', borderBottom: '1px solid #000000' }}>
                Filière : <span style={{ fontWeight: 'normal' }}>{filiereName || 'Cycle de découverte du numérique'}</span>
              </td>
              <td style={{ textAlign: 'left', fontWeight: 'bold', width: '50%', borderBottom: '1px solid #000000' }}>
                Module : <span style={{ fontWeight: 'normal' }}>{module.code ? `${module.code} ` : ''}{module.name}</span>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid #000000' }}>
                Masse horaire prévue pour ce module : <span style={{ fontWeight: 'normal' }}>{masseHorairePrevue}</span>
              </td>
              <td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px solid #000000' }}>
                Masse horaire réalisée pour ce module : <span style={{ fontWeight: 'normal' }}>{masseHoraireRealisee}</span>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'left', fontWeight: 'bold' }}>
                <span style={{ marginRight: '15px' }}>
                  1ère année : <span style={{ fontSize: '12pt', verticalAlign: 'middle' }}>{isFirstYear ? '☒' : '☐'}</span>
                </span>
                <span style={{ marginRight: '15px' }}>
                  2ème année : <span style={{ fontSize: '12pt', verticalAlign: 'middle' }}>{isSecondYear || (!isFirstYear && !isThirdYear) ? '☒' : '☐'}</span>
                </span>
                <span>
                  3ème année : <span style={{ fontSize: '12pt', verticalAlign: 'middle' }}>{isThirdYear ? '☒' : '☐'}</span>
                </span>
              </td>
              <td style={{ textAlign: 'left', fontWeight: 'bold' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span>Groupe : <span style={{ fontWeight: 'normal' }}>{groupName || '101'}</span></span>
                  <span>Nombre de stagiaire : <span style={{ fontWeight: 'normal' }}>{sortedResults.length}</span></span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* PV Main Marks Grid */}
        <table style={{ border: '1.5px solid #000000' }}>
          <thead>
            <tr style={{ fontWeight: 'bold', backgroundColor: '#ffffff' }}>
              <th rowSpan={2} style={{ width: '5%', border: '1px solid #000000' }}>N° d'Ins</th>
              <th rowSpan={2} style={{ width: '30%', textLeft: 'left', border: '1px solid #000000' }}>Prénom et nom des stagiaires</th>
              <th colSpan={5} style={{ width: '25%', border: '1px solid #000000' }}>Notes des contrôles continus</th>
              <th rowSpan={2} style={{ width: '8%', border: '1px solid #000000' }}>Moy. CC. /20</th>
              <th rowSpan={2} style={{ width: '8%', border: '1px solid #000000' }}>Note EFM /40</th>
              <th rowSpan={2} style={{ width: '8%', border: '1px solid #000000' }}>Moy. Module /20</th>
              <th rowSpan={2} style={{ width: '16%', border: '1px solid #000000' }}>Appréciations</th>
            </tr>
            <tr style={{ fontWeight: 'bold', backgroundColor: '#ffffff' }}>
              <th style={{ border: '1px solid #000000' }}>CC1</th>
              <th style={{ border: '1px solid #000000' }}>CC2</th>
              <th style={{ border: '1px solid #000000' }}>CC3</th>
              <th style={{ border: '1px solid #000000' }}>CC4</th>
              <th style={{ border: '1px solid #000000' }}>CC5</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((res, index) => {
              // CC Marks lookup for each of the 5 CC columns
              const studentCCMarks: string[] = [];
              let ccSum = 0;
              let ccCount = 0;

              for (let i = 0; i < 5; i++) {
                const ccExam = ccExams[i];
                if (ccExam) {
                  const studentCCResult = (allResults || []).find(r => 
                    r.examId === ccExam.id && 
                    (r.studentId === res.studentId || (r.studentName && res.studentName && r.studentName.toLowerCase() === res.studentName.toLowerCase()))
                  );

                  if (studentCCResult) {
                    const markOutOf20 = (studentCCResult.score / (studentCCResult.totalPoints || 1)) * 20;
                    studentCCMarks.push(markOutOf20.toFixed(1));
                    ccSum += markOutOf20;
                    ccCount++;
                  } else {
                    studentCCMarks.push("-");
                  }
                } else {
                  studentCCMarks.push("-");
                }
              }

              const moyCC = ccCount > 0 ? ccSum / ccCount : null;
              const moyCCText = moyCC !== null ? moyCC.toFixed(1) : "-";

              const scorePercent = (res.score / (res.totalPoints || 1)) * 100;
              const efm40 = (res.score / (res.totalPoints || 1)) * 40;
              
              // Moy Module /20 is the average of (Moy CC + Note EFM out of 20) / 2 if CC exists, otherwise just EFM / 20
              const efmOutOf20 = efm40 / 2;
              const moyModule = moyCC !== null ? (moyCC + efmOutOf20) / 2 : efmOutOf20;
              const appreciation = getAppreciaDoc((moyModule / 20) * 100);

              // Split name into uppercase last name and capitalised first name if possible
              const fullName = res.studentName || '';
              const parts = fullName.split(' ');
              const formattedName = parts.length > 1 
                ? `${parts[0].toUpperCase()} ${parts.slice(1).join(' ')}`
                : fullName.toUpperCase();

              return (
                <tr key={res.id}>
                  <td style={{ border: '1px solid #000000', fontWeight: 'bold' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #000000', textAlign: 'left', fontWeight: 'bold', paddingLeft: '8px' }}>
                    {formattedName}
                  </td>
                  <td style={{ border: '1px solid #000000' }}>{studentCCMarks[0]}</td>
                  <td style={{ border: '1px solid #000000' }}>{studentCCMarks[1]}</td>
                  <td style={{ border: '1px solid #000000' }}>{studentCCMarks[2]}</td>
                  <td style={{ border: '1px solid #000000' }}>{studentCCMarks[3]}</td>
                  <td style={{ border: '1px solid #000000' }}>{studentCCMarks[4]}</td>
                  <td style={{ border: '1px solid #000000' }}>{moyCCText}</td>
                  {/* Real EFM note scored out of 40 */}
                  <td style={{ border: '1px solid #000000', fontWeight: 'bold', color: scorePercent < 50 ? '#888888' : '#000000' }}>
                    {efm40.toFixed(1)}
                  </td>
                  {/* Moy Module out of 20 */}
                  <td style={{ border: '1px solid #000000', fontWeight: 'bold', backgroundColor: '#ffffff', color: (moyModule / 20 * 100) < 50 ? '#aa0000' : '#000000' }}>
                    {moyModule.toFixed(1)}
                  </td>
                  {/* Dynamic Appreciation based on score */}
                  <td style={{ 
                    border: '1px solid #000000', 
                    fontSize: '9pt', 
                    fontWeight: 'bold',
                    color: (moyModule / 20 * 100) >= 70 ? '#000000' : (moyModule / 20 * 100) < 50 ? '#888888' : '#888888'
                  }}>
                    {appreciation}
                  </td>
                </tr>
              );
            })}
            
            {/* If fewer than 15 rows, pad with some empty rows to make it look like a real printed PV sheet */}
            {sortedResults.length < 15 && Array.from({ length: 15 - sortedResults.length }).map((_, index) => (
              <tr key={`empty-${index}`} style={{ height: '24px' }}>
                <td style={{ border: '1px solid #000000', fontWeight: 'bold', color: '#888888' }}>{sortedResults.length + index + 1}</td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
                <td style={{ border: '1px solid #000000' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

// Helper for appreciation values
const getAppreciaDoc = (score: number) => {
  if (score >= 80) return 'Très Bien';
  if (score >= 70) return 'Bien';
  if (score >= 60) return 'Assez Bien';
  if (score >= 50) return 'Passable';
  return 'Insuffisant';
};

PVExportTemplate.displayName = 'PVExportTemplate';
