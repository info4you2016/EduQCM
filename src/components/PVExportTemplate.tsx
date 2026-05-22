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
}

export const PVExportTemplate = React.forwardRef<HTMLDivElement, PVExportTemplateProps>(
  ({ exam, results, module, filiereName, filiereLevel, groupName, settings }, ref) => {
    // Determine year based on filiereLevel or year info
    const levelStr = (filiereLevel || '').toLowerCase();
    const isFirstYear = levelStr.includes('1') || levelStr.includes('premiere') || levelStr.includes('1ère');
    const isSecondYear = levelStr.includes('2') || levelStr.includes('deuxieme') || levelStr.includes('2ème') || (!isFirstYear && levelStr.includes('ts')); // default TS usually 2nd year if not specified as 1st
    const isThirdYear = levelStr.includes('3') || levelStr.includes('troisieme') || levelStr.includes('3ème');

    // Default duration from exam or 30H
    const masseHorairePrevue = exam.durationMinutes ? `${Math.round(exam.durationMinutes / 60)}H` : '30H';
    const masseHoraireRealisee = exam.durationMinutes ? `${Math.round(exam.durationMinutes / 60)}H` : '30H';

    const getAppreciation = (scorePercent: number) => {
      if (scorePercent >= 80) return 'Très Bien';
      if (scorePercent >= 70) return 'Bien';
      if (scorePercent >= 60) return 'Assez Bien';
      if (scorePercent >= 50) return 'Passable';
      return 'Insuffisant';
    };

    return (
      <div 
        ref={ref} 
        id="pv-export-container"
        className="pv-export-content"
        style={{ 
          width: '297mm', // Landscape A4 size
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

        {/* PV Main Title */}
        <h2>PV de l'Examen de Fin de Module</h2>

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
                  <span>Nombre de stagiaire : <span style={{ fontWeight: 'normal' }}>{results.length}</span></span>
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
            {results.map((res, index) => {
              const scorePercent = (res.score / (res.totalPoints || 1)) * 100;
              const efm40 = (res.score / (res.totalPoints || 1)) * 40;
              const moyModule = efm40 / 2; // EFM / 40 divided by 2 is equivalent to Moy Module / 20
              const appreciation = getAppreciaDoc(scorePercent);

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
                  {/* Empty CC columns to act as clean paper template cells */}
                  <td style={{ border: '1px solid #000000' }}>-</td>
                  <td style={{ border: '1px solid #000000' }}>-</td>
                  <td style={{ border: '1px solid #000000' }}>-</td>
                  <td style={{ border: '1px solid #000000' }}>-</td>
                  <td style={{ border: '1px solid #000000' }}>-</td>
                  {/* Moy CC empty as well or showing a default out of 20 */}
                  <td style={{ border: '1px solid #000000' }}>-</td>
                  {/* Real EFM note scored out of 40 */}
                  <td style={{ border: '1px solid #000000', fontWeight: 'bold', color: scorePercent < 50 ? '#888888' : '#000000' }}>
                    {efm40.toFixed(1)}
                  </td>
                  {/* Moy Module out of 20 */}
                  <td style={{ border: '1px solid #000000', fontWeight: 'bold', backgroundColor: '#ffffff' }}>
                    {moyModule.toFixed(1)}
                  </td>
                  {/* Dynamic Appreciation based on score */}
                  <td style={{ 
                    border: '1px solid #000000', 
                    fontSize: '9pt', 
                    fontWeight: 'bold',
                    color: scorePercent >= 70 ? '#000000' : scorePercent < 50 ? '#888888' : '#888888'
                  }}>
                    {appreciation}
                  </td>
                </tr>
              );
            })}
            
            {/* If fewer than 15 rows, pad with some empty rows to make it look like a real printed PV sheet */}
            {results.length < 15 && Array.from({ length: 15 - results.length }).map((_, index) => (
              <tr key={`empty-${index}`} style={{ height: '24px' }}>
                <td style={{ border: '1px solid #000000', fontWeight: 'bold', color: '#888888' }}>{results.length + index + 1}</td>
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
