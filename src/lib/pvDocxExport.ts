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
  PageOrientation
} from "docx";
import { saveAs } from "file-saver";
import { Exam, Result, Module, OrganizationSettings } from "../types";

export const exportPVToWord = async (
  exam: Exam,
  results: Result[],
  module: Module,
  filiereName: string,
  filiereLevel: string,
  groupName: string,
  settings?: OrganizationSettings | null
) => {
  // Determine year based on filiereLevel or year info
  const levelStr = (filiereLevel || '').toLowerCase();
  const isFirstYear = levelStr.includes('1') || levelStr.includes('premiere') || levelStr.includes('1ère');
  const isSecondYear = levelStr.includes('2') || levelStr.includes('deuxieme') || levelStr.includes('2ème') || (!isFirstYear && levelStr.includes('ts'));
  const isThirdYear = levelStr.includes('3') || levelStr.includes('troisieme') || levelStr.includes('3ème');

  // Default durations
  const masseHorairePrevue = exam.durationMinutes ? `${Math.round(exam.durationMinutes / 60)}H` : '30H';
  const masseHoraireRealisee = exam.durationMinutes ? `${Math.round(exam.durationMinutes / 60)}H` : '30H';

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
                  new TextRun({ text: String(results.length), font: "Times New Roman" })
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

  // Generate real results rows
  results.forEach((res, index) => {
    const scorePercent = (res.score / (res.totalPoints || 1)) * 100;
    const efm40 = (res.score / (res.totalPoints || 1)) * 40;
    const moyModule = efm40 / 2;
    const appreciation = getAppreciation(scorePercent);

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
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "-", size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "-", size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "-", size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "-", size: 18, font: "Times New Roman" })] })]
          }),
          new TableCell({
            width: { size: 5, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "-", size: 18, font: "Times New Roman" })] })]
          }),
          // Moy CC
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            borders: tableAllBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "-", size: 18, font: "Times New Roman" })] })]
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
                    color: scorePercent < 50 ? "B91C1C" : "000000",
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
                    color: scorePercent >= 70 ? "047857" : scorePercent < 50 ? "B91C1C" : "4B5563"
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
  if (results.length < 15) {
    const padCount = 15 - results.length;
    for (let index = 0; index < padCount; index++) {
      const emptyIdx = results.length + index + 1;
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

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            orientation: PageOrientation.LANDSCAPE,
            width: { size: 16838, type: WidthType.DXA },  // Standard A4 landscape size in twips (297mm)
            height: { size: 11906, type: WidthType.DXA }, // Standard A4 landscape height in twips (210mm)
            margin: {
              top: 567, // 10mm
              bottom: 567, // 10mm
              left: 850, // 15mm
              right: 850 // 15mm
            }
          }
        } as any,
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "PV de l'Examen de Fin de Module",
                bold: true,
                size: 32, // 16pt
                font: "Times New Roman"
              })
            ]
          }),

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
