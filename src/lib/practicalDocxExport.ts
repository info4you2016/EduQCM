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
  PageOrientation
} from "docx";
import { saveAs } from "file-saver";
import { PracticalExamSheet } from "../types";

export const exportPracticalExamToWord = async (sheet: PracticalExamSheet) => {
  // Border styles for table layout
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" }; // gray-300
  const boldBorder = { style: BorderStyle.SINGLE, size: 8, color: "1e293b" }; // slate-800
  const doubleBorder = { style: BorderStyle.DOUBLE, size: 12, color: "1e293b" }; // thicker slate double line

  const standardBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  };

  const boldTopBottomBorders = {
    top: boldBorder,
    bottom: boldBorder,
    left: { style: BorderStyle.NIL, size: 0, color: "auto" },
    right: { style: BorderStyle.NIL, size: 0, color: "auto" },
  };

  // 1. Institution / Header section (Tripartite Style table)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NIL },
      bottom: thinBorder,
      left: { style: BorderStyle.NIL },
      right: { style: BorderStyle.NIL },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new TextRun({ text: "Royaume du Maroc\n", bold: true, size: 18, font: "Times New Roman" }),
                  new TextRun({ text: "Office de la Formation Professionnelle\net de la Promotion du Travail", size: 16, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "EXAMEN PRATIQUE\n", bold: true, size: 24, font: "Times New Roman", color: "1e3a8a" }),
                  new TextRun({ text: "PRÉPARATION AUX CERTIFICATIONS", bold: true, size: 18, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `Vendeur: ${sheet.vendor}\n`, bold: true, size: 18, font: "Times New Roman" }),
                  new TextRun({ text: `Certif: ${sheet.certificationName}`, size: 16, font: "Times New Roman" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 2. Info sheet table (Candidate name, group, points)
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: standardBorders,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            shading: { fill: "f8fafc" },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Nom du candidat : ", bold: true, size: 20, font: "Times New Roman" }),
                  new TextRun({ text: "___________________________", size: 18, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: standardBorders,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            shading: { fill: "f8fafc" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Groupe : ", bold: true, size: 20, font: "Times New Roman" }),
                  new TextRun({ text: "__________", size: 18, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: standardBorders,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            shading: { fill: "f8fafc" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Durée : ", bold: true, size: 20, font: "Times New Roman" }),
                  new TextRun({ text: `${sheet.durationMinutes} Min`, size: 20, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: standardBorders,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            shading: { fill: "eff6ff" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Note sur : ", bold: true, size: 20, font: "Times New Roman", color: "1d4ed8" }),
                  new TextRun({ text: `${sheet.tasks.reduce((sum, t) => sum + (t.points || 0), 0)} Pts`, bold: true, size: 22, font: "Times New Roman", color: "1d4ed8" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 3. Scenario container built inside a neat shaded table box for layout elegance
  const scenarioBoxTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: doubleBorder,
      bottom: doubleBorder,
      left: { style: BorderStyle.SINGLE, size: 4, color: "1e293b" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "1e293b" }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: "f8fafc" },
            margins: { top: 180, bottom: 180, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: "CONCOURS TECHNIQUE & CONTEXTE PROFESSIONNEL", bold: true, size: 20, font: "Times New Roman", color: "0f172a" })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: sheet.scenario, size: 18, font: "Times New Roman", italics: true })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // Requirements List elements
  const requirementsList: Paragraph[] = [
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({ text: "II. Environnement Technologique de l'Épreuve", bold: true, size: 22, font: "Times New Roman", color: "1e3a8a" })
      ]
    })
  ];

  sheet.requirements.forEach(req => {
    requirementsList.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({ text: req, size: 18, font: "Times New Roman" })
        ]
      })
    );
  });

  // Tasks display construction
  const tasksSection: Paragraph[] = [
    new Paragraph({
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({ text: "III. Travaux Pratiques Consignes & Tâches Métier", bold: true, size: 22, font: "Times New Roman", color: "1e3a8a" })
      ]
    })
  ];

  sheet.tasks.forEach((task, index) => {
    // Spacer before every task unless it's first
    if (index > 0) {
      tasksSection.push(new Paragraph({ spacing: { before: 180 } }));
    }

    tasksSection.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `Tâche N°${index + 1} : ${task.title} `, bold: true, size: 20, font: "Times New Roman", color: "0f172a" }),
          new TextRun({ text: `(${task.points} Points)`, bold: true, size: 20, font: "Times New Roman", color: "1d4ed8" })
        ]
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: "Description :  ", bold: true, italics: true, size: 18, font: "Times New Roman", color: "475569" }),
          new TextRun({ text: task.description, size: 18, font: "Times New Roman" })
        ]
      })
    );

    // Dynamic steps listing
    task.steps.forEach((step, stepIdx) => {
      tasksSection.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { start: 360 }, // indent to separate numbered bullets nicely
          children: [
            new TextRun({ text: `${index + 1}.${stepIdx + 1}  `, bold: true, size: 18, font: "Times New Roman", color: "1d4ed8" }),
            new TextRun({ text: step, size: 18, font: "Times New Roman" })
          ]
        })
      );
    });
  });

  // 4. Correction Rubric Grid table section
  const criteriaHeaderRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { fill: "1e293b" },
        borders: standardBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Tâche énumérée", bold: true, size: 18, font: "Times New Roman", color: "ffffff" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: "1e293b" },
        borders: standardBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: "Critères d'évaluation", bold: true, size: 18, font: "Times New Roman", color: "ffffff" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        shading: { fill: "1e293b" },
        borders: standardBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Barème", bold: true, size: 18, font: "Times New Roman", color: "ffffff" })]
          })
        ]
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: "1e293b" },
        borders: standardBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: "Ligne directrice de correction", bold: true, size: 18, font: "Times New Roman", color: "ffffff" })]
          })
        ]
      })
    ]
  });

  const criteriaRows = sheet.evaluationCriteria.map(crit => {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: standardBorders,
          shading: { fill: "f8fafc" },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: crit.taskTitle, bold: true, size: 18, font: "Times New Roman" })]
            })
          ]
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: standardBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: crit.criteriaName, size: 18, font: "Times New Roman" })]
            })
          ]
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          borders: standardBorders,
          shading: { fill: crit.points < 0 ? "fef2f2" : "f0fdf4" }, // rose-50 for penalty, green-50 for points
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ 
                  text: crit.points < 0 ? `${crit.points} pts` : `+${crit.points} pts`, 
                  bold: true, 
                  size: 18, 
                  font: "Times New Roman", 
                  color: crit.points < 0 ? "991b1b" : "15803d" // deep red for penalty, green for points
                })
              ]
            })
          ]
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: standardBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: crit.guidelines, size: 18, font: "Times New Roman", italics: true })]
            })
          ]
        })
      ]
    });
  });

  const criteriaGridTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [criteriaHeaderRow, ...criteriaRows]
  });

  const rubricHeader = [
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({ text: "IV. Grille de Notation & Barème de Validation", bold: true, size: 22, font: "Times New Roman", color: "1e3a8a" })
      ]
    })
  ];

  // 5. Instruction tips paragraph
  const instructorTipsBox: Paragraph[] = [];
  if (sheet.generalTipsForTeacher) {
    instructorTipsBox.push(
      new Paragraph({
        spacing: { before: 300, after: 80 },
        children: [
          new TextRun({ text: "V. Directives Administratives à l'attention de l'Examinateur", bold: true, size: 22, font: "Times New Roman", color: "1e3a8a" })
        ]
      })
    );

    const tipsTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: boldTopBottomBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: "f1f5f9" },
              margins: { top: 140, bottom: 140, left: 180, right: 180 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: sheet.generalTipsForTeacher, size: 18, font: "Times New Roman", italics: true, color: "334155" })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });

    instructorTipsBox.push(new Paragraph({ spacing: { after: 100 } })); // small space
    instructorTipsBox.push(tipsTable as any); // cast safely
  }

  // 6. Build final multi-segment Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            orientation: PageOrientation.PORTRAIT,
            width: { size: 11906, type: WidthType.DXA }, // A4 Portrait width in twips
            height: { size: 16838, type: WidthType.DXA }, // A4 Portrait height in twips
            margin: {
              top: 850, // 15mm
              bottom: 850, // 15mm
              left: 850, // 15mm
              right: 850 // 15mm
            }
          }
        } as any,
        children: [
          // Corporate/Academic Header Box
          headerTable,

          new Paragraph({ text: "", spacing: { after: 120 } }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 180 },
            children: [
              new TextRun({
                text: sheet.title.toUpperCase(),
                bold: true,
                size: 28, // 14pt
                font: "Times New Roman",
                color: "1e293b"
              })
            ]
          }),

          // Info Layout Block
          infoTable,

          new Paragraph({ text: "", spacing: { after: 240 } }),

          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: "I. Cahier des Charges & Description Clinique", bold: true, size: 22, font: "Times New Roman", color: "1e3a8a" })
            ]
          }),

          // Business Scenario Card
          scenarioBoxTable,

          new Paragraph({ text: "" }),

          // Hardware and systems requirements
          ...requirementsList,

          // Candidate Practical Tasks
          ...tasksSection,

          // Rubrics grid of corrected elements
          ...rubricHeader,
          criteriaGridTable,

          // Guidelines and directives for teachers
          ...instructorTipsBox
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  // Sanitize title for filename
  const sanitizedTitle = sheet.title.replace(/[^a-zA-Z0-9_\u00C0-\u00FF-]/g, '_').substring(0, 50);
  saveAs(blob, `Examen_Pratique_${sanitizedTitle}.docx`);
};
