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

export const exportPracticalSolutionToWord = async (sheet: PracticalExamSheet) => {
  // Border styles for table layout
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" }; // gray-300
  const boldBorder = { style: BorderStyle.SINGLE, size: 8, color: "1a5f7a" }; // teal-800
  const doubleBorder = { style: BorderStyle.DOUBLE, size: 12, color: "1a5f7a" }; 

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

  // 1. Institution / Header section (Tripartite Style table marked as Corrigé)
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
            shading: { fill: "f0fdf4" }, // green subtle shade for solution
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "CORRIGÉ OFFICIEL\n", bold: true, size: 24, font: "Times New Roman", color: "15803d" }),
                  new TextRun({ text: "SOLUTION ET DIRECTIVES DE CORRECTION", bold: true, size: 14, font: "Times New Roman", color: "166534" })
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
                  new TextRun({ text: `Vendeur : ${sheet.vendor}\n`, bold: true, size: 18, font: "Times New Roman" }),
                  new TextRun({ text: `Certif : ${sheet.certificationName}`, size: 16, font: "Times New Roman" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 2. Info sheet table (Marked as CORRECTION BARÈME)
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
                  new TextRun({ text: "Ressource de l'épreuve : ", bold: true, size: 18, font: "Times New Roman", color: "475569" }),
                  new TextRun({ text: "Guide du Correcteur", bold: true, size: 18, font: "Times New Roman", color: "0f172a" })
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
                  new TextRun({ text: "Barème global : ", bold: true, size: 18, font: "Times New Roman" }),
                  new TextRun({ text: `${sheet.tasks.reduce((sum, t) => sum + (t.points || 0), 0)} Pts`, size: 18, font: "Times New Roman" })
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
                  new TextRun({ text: "Durée épreuve : ", bold: true, size: 18, font: "Times New Roman" }),
                  new TextRun({ text: `${sheet.durationMinutes} Min`, size: 18, font: "Times New Roman" })
                ]
              })
            ]
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            borders: standardBorders,
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            shading: { fill: "f0fdf4" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Statut : ", bold: true, size: 18, font: "Times New Roman", color: "15803d" }),
                  new TextRun({ text: "Résolu (100%)", bold: true, size: 18, font: "Times New Roman", color: "15803d" })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 3. Overall Solution Summary Box
  const solutionSummaryBoxTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: doubleBorder,
      bottom: doubleBorder,
      left: { style: BorderStyle.SINGLE, size: 4, color: "15803d" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "15803d" }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { fill: "f0fdf4" },
            margins: { top: 180, bottom: 180, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: "I. APERÇU ET STRATÉGIE GLOBALE DE RÉSOLUTION", bold: true, size: 20, font: "Times New Roman", color: "14532d" })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ 
                    text: sheet.officialSolutionSummary || "Cette section résume l'analyse logique, l'orchestration des données d'entrée fournies et l'ensemble des livrables requis pour valider cette certification pratique.", 
                    size: 18, 
                    font: "Times New Roman", 
                    italics: true 
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });

  // 4. Tasks and Detailed Solutions Display Construction
  const tasksSection: Paragraph[] = [
    new Paragraph({
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({ text: "II. Procédure et Corrigé Détaillé par Tâche", bold: true, size: 22, font: "Times New Roman", color: "166534" })
      ]
    })
  ];

  sheet.tasks.forEach((task, index) => {
    // Spacer before every task unless it's first
    if (index > 0) {
      tasksSection.push(new Paragraph({ spacing: { before: 180 } }));
    }

    // Task heading
    tasksSection.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `Tâche N°${index + 1} : ${task.title} `, bold: true, size: 20, font: "Times New Roman", color: "0f172a" }),
          new TextRun({ text: `(${task.points} Points)`, bold: true, size: 20, font: "Times New Roman", color: "15803d" })
        ]
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: "Consignes de l'énoncé : ", bold: true, size: 18, font: "Times New Roman", color: "475569" }),
          new TextRun({ text: task.description, size: 18, font: "Times New Roman" })
        ]
      })
    );

    // Steps to reach results
    task.steps.forEach((step, stepIdx) => {
      tasksSection.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: { start: 360 },
          children: [
            new TextRun({ text: `${index + 1}.${stepIdx + 1} `, bold: true, size: 18, font: "Times New Roman", color: "15803d" }),
            new TextRun({ text: step, size: 18, font: "Times New Roman" })
          ]
        })
      );
    });

    tasksSection.push(new Paragraph({ spacing: { before: 100 } }));

    // Embedded Solution / Answers box
    const solutionParaList = (task.solution || "Aucune consigne textuelle spécifique disponible.")
      .split('\n')
      .map(line => {
        // Simple formatting for command lines or codes inside the solution
        const isCodeLine = line.trim().startsWith('>') || line.trim().startsWith('$') || line.trim().startsWith('=') || line.trim().includes('configure terminal') || line.trim().includes('import ');
        return new Paragraph({
          spacing: { before: 40, after: 40 },
          indent: isCodeLine ? { start: 240 } : undefined,
          children: [
            new TextRun({ 
              text: line, 
              size: 18, 
              font: isCodeLine ? "Courier New" : "Times New Roman",
              bold: isCodeLine,
              color: isCodeLine ? "1e293b" : "334155"
            })
          ]
        });
      });

    const solutionBox = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: "15803d" },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: "15803d" },
        left: { style: BorderStyle.SINGLE, size: 12, color: "15803d" }, // thick green left border
        right: { style: BorderStyle.SINGLE, size: 4, color: "cbd5e1" }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { fill: "f0fdf4" }, // beautiful soft green callout box
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({ text: "🔑 SOLUTION ATTENDUE & ÉLÉMENTS DE RÉPONSES PRÉCIS", bold: true, size: 18, font: "Times New Roman", color: "166534" })
                  ]
                }),
                ...solutionParaList
              ]
            })
          ]
        })
      ]
    });

    tasksSection.push(solutionBox as any);
  });

  // 5. Correction Rubric Grid table section
  const criteriaHeaderRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { fill: "15803d" },
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
        shading: { fill: "15803d" },
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
        shading: { fill: "15803d" },
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
        shading: { fill: "15803d" },
        borders: standardBorders,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: "Instructions précises de notation", bold: true, size: 18, font: "Times New Roman", color: "ffffff" })]
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
          shading: { fill: crit.points < 0 ? "fef2f2" : "f0fdf4" }, 
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
                  color: crit.points < 0 ? "991b1b" : "166534" 
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
        new TextRun({ text: "III. Barème Exhaustif & Guide Complémentaire de Notation", bold: true, size: 22, font: "Times New Roman", color: "166534" })
      ]
    })
  ];

  // 6. Instructor advice / feedback
  const instructorTipsBox: Paragraph[] = [];
  if (sheet.generalTipsForTeacher) {
    instructorTipsBox.push(
      new Paragraph({
        spacing: { before: 300, after: 80 },
        children: [
          new TextRun({ text: "IV. Recommandations Pédagogiques pour l'Aide au Diagnostic", bold: true, size: 22, font: "Times New Roman", color: "166534" })
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
              shading: { fill: "f9fafb" },
              margins: { top: 140, bottom: 140, left: 180, right: 180 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: sheet.generalTipsForTeacher, size: 18, font: "Times New Roman", italics: true, color: "374151" })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });

    instructorTipsBox.push(new Paragraph({ spacing: { after: 100 } }));
    instructorTipsBox.push(tipsTable as any);
  }

  // 7. Assemble document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            orientation: PageOrientation.PORTRAIT,
            width: { size: 11906, type: WidthType.DXA },
            height: { size: 16838, type: WidthType.DXA },
            margin: {
              top: 850,
              bottom: 850,
              left: 850,
              right: 850
            }
          }
        } as any,
        children: [
          headerTable,

          new Paragraph({ text: "", spacing: { after: 120 } }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 180 },
            children: [
              new TextRun({
                text: `CORRIGÉ - ${sheet.title.toUpperCase()}`,
                bold: true,
                size: 26,
                font: "Times New Roman",
                color: "111827"
              })
            ]
          }),

          // Info Layout Block
          infoTable,

          new Paragraph({ text: "", spacing: { after: 240 } }),

          // General solutions text block
          solutionSummaryBoxTable,

          // Candidate Practical Tasks with solutions
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
  const sanitizedTitle = sheet.title.replace(/[^a-zA-Z0-9_\u00C0-\u00FF-]/g, '_').substring(0, 50);
  saveAs(blob, `Corrige_Examen_Pratique_${sanitizedTitle}.docx`);
};
