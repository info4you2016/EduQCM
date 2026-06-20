import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  VerticalAlign,
  VerticalMergeType,
  PageOrientation,
  ImageRun
} from "docx";
import { saveAs } from "file-saver";
import { Exam, Result, Module, OrganizationSettings } from "../types";

async function fetchImageAsBuffer(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("Failed to fetch image:", error);
    return null;
  }
}

export const exportPVToWord = async (
  exam: Exam,
  results: Result[],
  module: Module,
  filiereName: string,
  filiereLevel: string,
  groupName: string,
  settings?: OrganizationSettings | null,
  allExams?: Exam[],
  allResults?: Result[]
) => {
  // Determine year based on filiereLevel or year info
  const levelStr = (filiereLevel || '').toLowerCase();
  const groupStr = (groupName || '').toLowerCase();

  let isFirstYear = levelStr.includes('1') || levelStr.includes('premiere') || levelStr.includes('1ère');
  let isSecondYear = levelStr.includes('2') || levelStr.includes('deuxieme') || levelStr.includes('2ème') || (!isFirstYear && levelStr.includes('ts'));
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

  // Sort trainees alphabetically by student name
  const sortedResults = [...results].sort((a, b) => {
    const nameA = (a.studentName || '').trim().toLowerCase();
    const nameB = (b.studentName || '').trim().toLowerCase();
    return nameA.localeCompare(nameB, 'fr');
  });

  // Default durations (using module's duration hours as requested by user)
  const masseHorairePrevue = module?.durationHours ? `${module.durationHours}H` : '30H';
  const masseHoraireRealisee = module?.durationHours ? `${module.durationHours}H` : '30H';

  const orgName = settings?.orgName || 'OFPPT';
  const orgNameArabic = settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل';
  const orgNameFrench = settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail';
  const regionalDirection = settings?.regionalDirection || 'Direction Régionale De BM-KH';
  const institutionName = settings?.institutionName || 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem';
  const orgSubName = settings?.orgSubName || 'DRBMKH';
  const academicYear = settings?.academicYear || '2024/2025';

  let logoBufferLeft: Uint8Array | null = null;
  let logoBufferRight: Uint8Array | null = null;
  
  if (settings?.orgLogoUrl) {
    logoBufferLeft = await fetchImageAsBuffer(settings.orgLogoUrl);
  }
  if (settings?.orgLogoUrlRight) {
    logoBufferRight = await fetchImageAsBuffer(settings.orgLogoUrlRight);
  } else if (settings?.orgLogoUrl) {
    logoBufferRight = logoBufferLeft;
  }

  const createLogoImage = (buffer: Uint8Array | null, width = 50, height = 50) => {
    if (!buffer) return null;
    return new ImageRun({
      data: buffer,
      transformation: {
        width: width,
        height: height,
      },
    } as any);
  };

  const getAppreciation = (scorePercent: number) => {
    if (scorePercent >= 80) return 'Très Bien';
    if (scorePercent >= 70) return 'Bien';
    if (scorePercent >= 60) return 'Assez Bien';
    if (scorePercent >= 50) return 'Passable';
    return 'Insuffisant';
  };

  // Border style definitions for clean tables
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const doubleBorder = { style: BorderStyle.DOUBLE, size: 8, color: "000000" };

  const tableAllBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  };

  // Meta grid Info Header table
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Filière : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: filiereName || 'Cycle de découverte du numérique', font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Module : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: (module.code ? `${module.code} - ` : '') + module.name, font: "Times New Roman" })
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Masse horaire prévue : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: masseHorairePrevue, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Masse horaire réalisée : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: masseHoraireRealisee, font: "Times New Roman" })
                ]
              })
            ]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "1ère année : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: isFirstYear ? "☒   " : "☐   ", font: "Times New Roman" }),
                  new TextRun({ text: "2ème année : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: (isSecondYear || (!isFirstYear && !isThirdYear)) ? "☒   " : "☐   ", font: "Times New Roman" }),
                  new TextRun({ text: "3ème année : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: isThirdYear ? "☒" : "☐", font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Groupe : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: (groupName || '101') + "         ", font: "Times New Roman" }),
                  new TextRun({ text: "Nombre de stagiaires : ", bold: true, font: "Times New Roman" }),
                  new TextRun({ text: String(sortedResults.length), font: "Times New Roman" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // Main marks grid Table Row 1 & 2 Headers inside Table Children
  const headerRow1 = new TableRow({
    children: [
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.RESTART,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "N° d'Ins", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.RESTART,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: "Prénom et nom des stagiaires", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        columnSpan: 5,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Notes des contrôles continus", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.RESTART,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Moy. CC. /20", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.RESTART,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Note EFM /40", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.RESTART,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Moy. Module /20", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 16, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.RESTART,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Appréciations", bold: true, size: 18, font: "Times New Roman" })]
          })
        ]
      })
    ]
  });

  const headerRow2 = new TableRow({
    children: [
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.CONTINUE,
        children: []
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.CONTINUE,
        children: []
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CC1", bold: true, size: 16, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CC2", bold: true, size: 16, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CC3", bold: true, size: 16, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CC4", bold: true, size: 16, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "CC5", bold: true, size: 16, font: "Times New Roman" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.CONTINUE,
        children: []
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.CONTINUE,
        children: []
      }),
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.CONTINUE,
        children: []
      }),
      new TableCell({
        width: { size: 16, type: WidthType.PERCENTAGE },
        borders: tableAllBorders,
        verticalMerge: VerticalMergeType.CONTINUE,
        children: []
      })
    ]
  });

  const bodyRows: TableRow[] = [];

  // Find CC Exams for this module and group to display continuous assessment marks
  const ccExams = (allExams || []).filter(ex => 
    ex.moduleId === exam.moduleId && 
    ex.type === 'controle-continu' && 
    (ex.groupId === exam.groupId || ex.groupName === exam.groupName)
  );
  // Sort them so they map consistently to CC1, CC2, CC3, etc.
  ccExams.sort((a, b) => a.id - b.id);

  // Generate real results rows
  sortedResults.forEach((res, index) => {
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
    const appreciation = getAppreciation((moyModule / 20) * 100);

    // Format student name to standard: LASTNAME Firstname
    const fullName = res.studentName || '';
    const parts = fullName.split(' ');
    const formattedName = parts.length > 1 
      ? `${parts[0].toUpperCase()} ${parts.slice(1).join(' ')}`
      : fullName.toUpperCase();

    bodyRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(index + 1), bold: true, size: 18, font: "Times New Roman" })]
              })
            ]
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: formattedName, bold: true, size: 18, font: "Times New Roman" })]
              })
            ]
          }),
          // Continuous control cells
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: studentCCMarks[0], size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: studentCCMarks[1], size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: studentCCMarks[2], size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: studentCCMarks[3], size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: studentCCMarks[4], size: 18, font: "Times New Roman" })] })]
          }),
          // Moy CC
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: moyCCText, size: 18, font: "Times New Roman" })] })]
          }),
          // Note EFM /40
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ 
                    text: efm40.toFixed(1), 
                    bold: true, 
                    size: 18, 
                    color: scorePercent < 50 ? "B91C1C" : "000000",
                    font: "Times New Roman" 
                  })
                ]
              })
            ]
          }),
          // Moy Module /20
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 40, right: 40 },
            shading: { fill: "FCFCFC" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ 
                    text: moyModule.toFixed(1), 
                    bold: true, 
                    size: 18, 
                    color: (moyModule / 20 * 100) < 50 ? "B91C1C" : "000000",
                    font: "Times New Roman" 
                  })
                ]
              })
            ]
          }),
          // Appreciations
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 50, bottom: 50, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ 
                    text: appreciation, 
                    bold: true, 
                    size: 16, 
                    font: "Times New Roman",
                    color: (moyModule / 20 * 100) >= 70 ? "047857" : (moyModule / 20 * 100) < 50 ? "B91C1C" : "4B5563"
                  })
                ]
              })
            ]
          })
        ]
      })
    );
  });

  // Safe padding with empty rows if total results are less than 15
  if (sortedResults.length < 15) {
    const padCount = 15 - sortedResults.length;
    for (let index = 0; index < padCount; index++) {
      const emptyIdx = sortedResults.length + index + 1;
      bodyRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5, type: WidthType.PERCENTAGE },
              borders: tableAllBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 50, bottom: 50 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(emptyIdx), bold: true, color: "CCCCCC", size: 18, font: "Times New Roman" })]
                })
              ]
            }),
            new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 8, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] }),
            new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, borders: tableAllBorders, children: [new Paragraph({ text: "" })] })
          ]
        })
      );
    }
  }

  const marksTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow1,
      headerRow2,
      ...bodyRows
    ]
  });

  const logoLeftImg = createLogoImage(logoBufferLeft, 55, 55);
  const logoRightImg = createLogoImage(logoBufferRight, 55, 55);

  const HeaderBorderNone = { style: BorderStyle.NONE };
  const headerBorders = {
    top: HeaderBorderNone,
    bottom: HeaderBorderNone,
    left: HeaderBorderNone,
    right: HeaderBorderNone
  };

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: headerBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              logoLeftImg 
                ? new Paragraph({ alignment: AlignmentType.LEFT, children: [logoLeftImg] })
                : new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: orgName, bold: true, size: 20, font: "Times New Roman" })]
                  })
            ]
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: headerBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ 
                    text: orgNameFrench, 
                    bold: true,
                    size: 16, 
                    font: "Times New Roman" 
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ 
                    text: institutionName, 
                    bold: true,
                    size: 16, 
                    font: "Times New Roman" 
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ 
                    text: `Année de formation : ${academicYear}`, 
                    bold: true,
                    size: 16, 
                    font: "Times New Roman" 
                  })
                ]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100 },
                children: [
                  new TextRun({ 
                    text: "PV de l'Examen de Fin de Module", 
                    bold: true, 
                    size: 28, 
                    font: "Times New Roman" 
                  })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: headerBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              logoRightImg 
                ? new Paragraph({ alignment: AlignmentType.RIGHT, children: [logoRightImg] })
                : new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ 
                        text: orgNameArabic, 
                        bold: true, 
                        size: 18, 
                        font: "Times New Roman" 
                      })
                    ]
                  })
            ]
          })
        ]
      })
    ]
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
              width: 11906, // 11906 twips (will be swapped with height by 'docx' lib under LANDSCAPE orientation)
              height: 16838, // 16838 twips (will be swapped with width by 'docx' lib under LANDSCAPE orientation)
            },
            margin: {
              top: 567, // 10mm
              bottom: 567, // 10mm
              left: 850, // 15mm
              right: 850 // 15mm
            }
          }
        },
        children: [
          headerTable,

          new Paragraph({ text: "", spacing: { after: 200 } }),

          // Metadata Info table
          metaTable,

          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Main Marks Table
          marksTable
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `PV_Examen_${exam.title.replace(/\s+/g, '_')}.docx`);
};
