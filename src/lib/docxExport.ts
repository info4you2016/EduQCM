import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Footer, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  VerticalAlign,
  HeightRule,
  HeadingLevel,
  VerticalMergeType,
  ImageRun,
  PageNumber
} from "docx";
import { saveAs } from "file-saver";
import { Exam, Module, Question, OrganizationSettings } from "../types";
import { formatDuration } from "./utils";

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

export const exportExamToWord = async (
  exam: Exam, 
  module: Module, 
  filiereName: string, 
  groupName: string, 
  totalPoints: number, 
  showAnswers: boolean = false,
  settings?: OrganizationSettings | null,
  filiereLevel?: string
) => {
  const orgName = settings?.orgName || 'OFPPT';
  const orgNameArabic = settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل';
  const orgNameFrench = settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail';
  const regionalDirection = settings?.regionalDirection || 'Direction Régionale De BM-KH';
  const institutionName = settings?.institutionName || 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem';
  const orgSubName = settings?.orgSubName || 'DRBMKH';
  const regionName = settings?.regionName || 'ROYAUME DU MAROC';
  const academicYear = settings?.academicYear || '2024/2025';

  let logoBuffer: Uint8Array | null = null;
  if (settings?.orgLogoUrl) {
    logoBuffer = await fetchImageAsBuffer(settings.orgLogoUrl);
  }

  const createLogoImage = () => {
    if (!logoBuffer) return null;
    return new ImageRun({
      data: logoBuffer,
      transformation: {
        width: 50,
        height: 50,
      },
    } as any);
  };

  const doc = new Document({
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${orgName} / ${orgSubName} / ${module.code} - Page `,
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                  }),
                  new TextRun({
                    text: " sur ",
                    size: 16,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    children: [
                      (() => {
                        const img = createLogoImage();
                        return img ? 
                          new Paragraph({ alignment: AlignmentType.CENTER, children: [img] }) :
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ 
                                text: "OFPPT", 
                                bold: true, 
                                size: 24
                              })
                            ]
                          });
                      })(),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                  new TableCell({
                    width: { size: 76, type: WidthType.PERCENTAGE },
                    children: settings?.headerLines && settings.headerLines.length > 0 
                      ? settings.headerLines.map((line, idx) => {
                          const isArabic = /[\u0600-\u06FF]/.test(line.text);
                          return new Paragraph({
                            alignment: line.alignment === 'right' ? AlignmentType.RIGHT : 
                                       line.alignment === 'left' ? AlignmentType.LEFT : 
                                       AlignmentType.CENTER,
                            bidirectional: isArabic,
                            children: [
                              new TextRun({ 
                                text: line.text, 
                                bold: line.isBold, 
                                italics: line.isItalic,
                                size: line.fontSize * 2,
                                font: line.fontFamily ? line.fontFamily.split(',')[0].replace(/"/g, '') : undefined
                              }),
                            ],
                            border: settings?.showHeaderLines && idx < settings.headerLines!.length - 1 
                              ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } 
                              : undefined
                          });
                        })
                      : [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            bidirectional: true,
                            children: [
                              new TextRun({ text: orgNameArabic, bold: true, size: 28 }),
                            ],
                            border: settings?.showHeaderLines ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } : undefined
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: orgNameFrench, bold: true, size: 20 }),
                            ],
                            border: settings?.showHeaderLines ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } : undefined
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: regionalDirection, bold: true, size: 20 }),
                            ],
                            border: settings?.showHeaderLines ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } : undefined
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: institutionName, bold: true, size: 20 }),
                            ],
                          }),
                        ],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                  new TableCell({
                    width: { size: 12, type: WidthType.PERCENTAGE },
                    children: [
                      (() => {
                        const img = createLogoImage();
                        return img ? 
                          new Paragraph({ alignment: AlignmentType.CENTER, children: [img] }) :
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ 
                                text: "OFPPT", 
                                bold: true, 
                                size: 24
                              })
                            ]
                          });
                      })(),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Filière : ", bold: true }), new TextRun({ text: filiereName })] })],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Niveau : ", bold: true }), new TextRun({ text: filiereLevel || "TS / T / B" })] })],
                  }),
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Année de formation : ", bold: true }), new TextRun({ text: academicYear })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Numéro du module : ", bold: true }), new TextRun({ text: String(module.code) })] })],
                  }),
                  new TableCell({
                    width: { size: 67, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    children: [new Paragraph({ children: [new TextRun({ text: "Intitulé du module : ", bold: true }), new TextRun({ text: module.name })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Horaire : ", bold: true }), new TextRun({ text: formatDuration(exam.durationMinutes) })] })],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Date : ", bold: true }), new TextRun({ text: new Date().toLocaleDateString('fr-FR') })] })],
                  }),
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: "Barème : ", bold: true }), new TextRun({ text: `/ ${Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2)} Pts` })] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ 
                text: exam.title, 
                bold: true, 
                size: 28,
                underline: { type: "single" }
              }),
            ],
            spacing: { before: 400, after: 400 }
          }),


          // Questions
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [
                          new TextRun({ text: "Nom et Prénom : ", bold: true, size: 24 }),
                          new TextRun({ text: "...................................................................................." }),
                        ],
                      }),
                    ],
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: "NOTE", bold: true, size: 24 })],
                        spacing: { before: 100, after: 100 }
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: `....... / ${totalPoints}`, bold: true, size: 28 })],
                        spacing: { after: 100 }
                      }),
                    ],
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                      bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                      left: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                      right: { style: BorderStyle.SINGLE, size: 12, color: "000000" },
                    },
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 400 } }),

          ...(() => {
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

            return orderedTypes.flatMap(type => {
              const label = typeLabels[type];
              const labelRtl = isArabic(label);
              return [
                new Paragraph({
                  alignment: labelRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  bidirectional: labelRtl,
                  children: [
                    new TextRun({
                      text: label.toUpperCase(),
                      bold: true,
                      size: 24,
                    }),
                  ],
                  shading: { fill: "f3f4f6" },
                  spacing: { before: 400, after: 200 },
                }),
                ...(type === 'fill-in-the-blanks' ? [
                  new Paragraph({
                    children: [
                      new TextRun({ 
                        text: "Complétez le texte ci-dessous :", 
                        bold: true, 
                        size: 20,
                        underline: { type: "single" }
                      }),
                    ],
                    spacing: { before: 200, after: 200 },
                  }),
                ] : []),
                ...(() => {
                  if (type === 'true-false') {
                    const tableRows = [
                      new TableRow({
                        children: [
                          new TableCell({ 
                            width: { size: 7650, type: WidthType.DXA },
                            children: [new Paragraph({ children: [new TextRun({ text: "Questions", bold: true })] })],
                            shading: { fill: "f9fafb" }
                          }),
                          new TableCell({ 
                            width: { size: 850, type: WidthType.DXA },
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vrai", bold: true })] })],
                            shading: { fill: "f9fafb" }
                          }),
                          new TableCell({ 
                            width: { size: 850, type: WidthType.DXA },
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Faux", bold: true })] })],
                            shading: { fill: "f9fafb" }
                          }),
                        ]
                      })
                    ];

                    groupedQuestions[type].forEach(({ q, originalIdx }) => {
                      const ans = String(q.correctAnswer).toLowerCase();
                      const isTrue = ans === 'true' || ans === 'vrai';
                      const isFalse = ans === 'false' || ans === 'faux';
                      const rtl = isArabic(q.text);

                      tableRows.push(
                        new TableRow({
                          children: [
                            new TableCell({ 
                              width: { size: 7650, type: WidthType.DXA },
                              children: [
                                new Paragraph({ 
                                  alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                                  bidirectional: rtl,
                                  children: [
                                    new TextRun({ text: `${originalIdx + 1}. ${cleanHtml(q.text)}`, size: 20 }),
                                    new TextRun({ text: ` (${Number.isInteger(q.points) ? q.points : q.points.toFixed(2)} pts)`, size: 16, italics: true, color: "666666" })
                                  ] 
                                })
                              ] 
                            }),
                            new TableCell({ 
                              width: { size: 850, type: WidthType.DXA },
                              verticalAlign: VerticalAlign.CENTER,
                              children: [
                                new Paragraph({ 
                                  alignment: AlignmentType.CENTER,
                                  children: [
                                    new TextRun({ 
                                      text: showAnswers && isTrue ? " [X] " : " [   ] ", 
                                      bold: showAnswers && isTrue,
                                      color: showAnswers && isTrue ? "059669" : undefined
                                    })
                                  ] 
                                })
                              ],
                              shading: showAnswers && isTrue ? { fill: "f0fdf4" } : undefined
                            }),
                            new TableCell({ 
                              width: { size: 850, type: WidthType.DXA },
                              verticalAlign: VerticalAlign.CENTER,
                              children: [
                                new Paragraph({ 
                                  alignment: AlignmentType.CENTER,
                                  children: [
                                    new TextRun({ 
                                      text: showAnswers && isFalse ? " [X] " : " [   ] ", 
                                      bold: showAnswers && isFalse,
                                      color: showAnswers && isFalse ? "059669" : undefined
                                    })
                                  ] 
                                })
                              ],
                              shading: showAnswers && isFalse ? { fill: "f0fdf4" } : undefined
                            }),
                          ]
                        })
                      );
                    });

                    return [
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows
                      })
                    ];
                  }
                  return groupedQuestions[type].flatMap(({ q, originalIdx }) => renderQuestionDocx(q, originalIdx, showAnswers));
                })()
              ];
            });
          })(),

          new Paragraph({
            children: [
              new TextRun({ text: "Elaboré par le Formateur :", bold: true, size: 22 }),
            ],
            spacing: { before: 800, after: 200 }
          }),

          // Optional Correction Grid
          ...(showAnswers ? [
            new Paragraph({ text: "", spacing: { before: 800 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "GRILLE DE RÉPONSES (CORRIGÉ)", bold: true, underline: {}, size: 24 }),
              ],
              spacing: { after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: exam.questions.map((_, i) => new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, text: `Q${i + 1}`, children: [new TextRun({ bold: true })] })]
                  }))
                }),
                new TableRow({
                  children: exam.questions.map((q) => new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, text: getShortAnswer(q), children: [new TextRun({ bold: true, color: "059669" })] })]
                  }))
                })
              ]
            })
          ] : [])
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${exam.title.replace(/\s+/g, '_')}_${showAnswers ? 'Corrige' : 'Examen'}.docx`);
};

function renderQuestionDocx(q: Question, index: number, showAnswers: boolean): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const rtl = isArabic(q.text);

  // Question header (Points and Text)
  const headerChildren: TextRun[] = [
    new TextRun({ text: `${index + 1}. `, bold: true }),
  ];

  if (q.type === 'fill-in-the-blanks') {
    const parts = q.text.split('[blank]');
    parts.forEach((part, i) => {
      headerChildren.push(new TextRun({ text: cleanHtml(part), bold: true }));
      if (i < parts.length - 1) {
        if (showAnswers && q.correctAnswers?.[i]) {
          headerChildren.push(new TextRun({ 
            text: ` [ ${q.correctAnswers[i]} ] `, 
            bold: true, 
            color: "059669" 
          }));
        } else {
          headerChildren.push(new TextRun({ text: " ...................... ", bold: true }));
        }
      }
    });
  } else {
    headerChildren.push(new TextRun({ text: cleanHtml(q.text), bold: true }));
  }

  headerChildren.push(new TextRun({ text: ` (${Number.isInteger(q.points) ? q.points : q.points.toFixed(2)} pts)`, italics: true, size: 18 }));

  elements.push(
    new Paragraph({
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: rtl,
      spacing: { before: 300, after: 100 },
      children: headerChildren,
    })
  );

  if (q.type === 'multiple-choice') {
    const optionsWithOrig = (q.options || []).map((opt, idx) => ({ ...opt, originalIndex: idx }));
    // Shuffle MCQ options
    for (let i = optionsWithOrig.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithOrig[i], optionsWithOrig[j]] = [optionsWithOrig[j], optionsWithOrig[i]];
    }

    const tableRows = [];
    
    for (let i = 0; i < optionsWithOrig.length; i += 2) {
      const opt1 = optionsWithOrig[i];
      const opt2 = optionsWithOrig[i + 1];
      const opt1Rtl = isArabic(opt1.text);
      
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
      const borders = {
        top: noBorder, bottom: noBorder, left: noBorder, right: noBorder
      };

      const cells = [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders,
          children: [
            new Paragraph({
              alignment: opt1Rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
              bidirectional: opt1Rtl,
              children: [
                new TextRun({ 
                  text: showAnswers && opt1.isCorrect ? " [X] " : " [  ] ",
                  bold: showAnswers && opt1.isCorrect,
                  color: showAnswers && opt1.isCorrect ? "059669" : undefined
                }),
                new TextRun({ 
                  text: `${String.fromCharCode(97 + i)}) ${cleanHtml(opt1.text)}`,
                  bold: showAnswers && opt1.isCorrect,
                  color: showAnswers && opt1.isCorrect ? "059669" : undefined
                }),
              ],
            })
          ],
        })
      ];

      if (opt2) {
        const opt2Rtl = isArabic(opt2.text);
        cells.push(
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders,
            children: [
              new Paragraph({
                alignment: opt2Rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                bidirectional: opt2Rtl,
                children: [
                  new TextRun({ 
                    text: showAnswers && opt2.isCorrect ? " [X] " : " [  ] ",
                    bold: showAnswers && opt2.isCorrect,
                    color: showAnswers && opt2.isCorrect ? "059669" : undefined
                  }),
                  new TextRun({ 
                    text: `${String.fromCharCode(97 + i + 1)}) ${cleanHtml(opt2.text)}`,
                    bold: showAnswers && opt2.isCorrect,
                    color: showAnswers && opt2.isCorrect ? "059669" : undefined
                  }),
                ],
              })
            ],
          })
        );
      } else {
        cells.push(new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders, children: [] }));
      }
      
      tableRows.push(new TableRow({ children: cells }));
    }

    elements.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
    }));
  } else if (q.type === 'ordering') {
    const optionsWithOriginalIndex = (q.options || []).map((opt, originalIndex) => ({ ...opt, originalIndex }));
    
    // Shuffle
    const shuffled = [...optionsWithOriginalIndex];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    shuffled.forEach((opt) => {
      const optRtl = isArabic(opt.text);
      elements.push(
        new Paragraph({
          alignment: optRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          bidirectional: optRtl,
          indent: optRtl ? undefined : { left: 720 },
          children: [
            new TextRun({ text: " [  ] " }),
            new TextRun({ text: cleanHtml(opt.text) }),
            showAnswers && q.correctOrder ? new TextRun({ text: ` (Pos: ${q.correctOrder.indexOf(opt.originalIndex) + 1})`, color: "059669" }) : new TextRun({}),
          ],
        })
      );
    });
  } else if (q.type === 'matching') {
    const leftOptions = q.options || [];
    const rightOptionsRaw = q.matchOptions || [];
    const rtl = isArabic(q.text) || (leftOptions.length > 0 && isArabic(leftOptions[0].text));
    const rightWithOriginalIndex = rightOptionsRaw.map((text, originalIndex) => ({ text, originalIndex }));
    
    // Shuffle the right side for the export document
    const shuffledRight = [...rightWithOriginalIndex];
    for (let i = shuffledRight.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledRight[i], shuffledRight[j]] = [shuffledRight[j], shuffledRight[i]];
    }

    const tableRows = [];
    // Header row
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ 
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, 
              bidirectional: rtl, 
              children: [new TextRun({ 
                text: q.columnAHeader || (rtl ? 'عناصر (يمين)' : "Éléments (Gauche)"), 
                bold: true, 
                size: 20 
              })] 
            })],
            shading: { fill: "f9fafb" }
          }),
          new TableCell({ 
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              children: [new TextRun({ text: rtl ? 'حرف' : "Lettre", bold: true, size: 20 })], 
              alignment: AlignmentType.CENTER 
            })],
            shading: { fill: "f9fafb" }
          }),
          new TableCell({ 
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, 
              bidirectional: rtl, 
              children: [new TextRun({ 
                text: q.columnBHeader || (rtl ? 'عناصر (يسار)' : "Éléments (Droite)"), 
                bold: true, 
                size: 20 
              })] 
            })],
            shading: { fill: "f9fafb" }
          }),
        ],
      })
    );

    for (let i = 0; i < leftOptions.length; i++) {
      const leftText = leftOptions[i].text;
      const rightText = shuffledRight[i]?.text || "";
      const rightLabel = String.fromCharCode(65 + i);
      const lRtl = isArabic(leftText);
      const rRtl = isArabic(rightText);
      
      const middleCellChildren: Paragraph[] = [];
      if (i === 0) {
        if (showAnswers && q.correctMatches) {
          leftOptions.forEach((_, lIdx) => {
            const correctRightOrigIdx = q.correctMatches![lIdx];
            const currentIdxInShuffled = shuffledRight.findIndex(r => r.originalIndex === correctRightOrigIdx);
            if (currentIdxInShuffled !== -1) {
              middleCellChildren.push(new Paragraph({
                children: [new TextRun({ 
                  text: `${lIdx + 1} → ${String.fromCharCode(65 + currentIdxInShuffled)}`, 
                  size: 14, 
                  bold: true,
                  color: "059669"
                })],
                alignment: AlignmentType.CENTER
              }));
            }
          });
        } else {
          middleCellChildren.push(new Paragraph({
            children: [new TextRun({ text: rtl ? "مساحة للسهام" : "Espace flèches", size: 14, color: "cbd5e1", bold: true })],
            alignment: AlignmentType.CENTER
          }));
        }
      }

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ 
              children: [new Paragraph({ alignment: lRtl ? AlignmentType.RIGHT : AlignmentType.LEFT, bidirectional: lRtl, children: [new TextRun({ text: `${i + 1}. ${cleanHtml(leftText)}`, size: 18 })] })] 
            }),
            new TableCell({ 
              verticalMerge: i === 0 ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
              verticalAlign: VerticalAlign.CENTER,
              children: middleCellChildren,
              shading: showAnswers ? { fill: "f0fdf4" } : undefined
            }),
            new TableCell({ 
              children: [new Paragraph({ alignment: rRtl ? AlignmentType.RIGHT : AlignmentType.LEFT, bidirectional: rRtl, children: [new TextRun({ text: `${rightLabel}. ${cleanHtml(rightText)}`, size: 18 })] })] 
            }),
          ],
        })
      );
    }

    elements.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }));
    
    elements.push(new Paragraph({ 
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: rtl,
      children: [
        new TextRun({ 
          text: rtl ? "قم بمطابقة كل رقم من العمود الأيمن مع الحرف المقابل له في العمود الأوسط." : "Associez chaque chiffre de la colonne de gauche à sa lettre correspondante dans la colonne centrale.",
          italics: true,
          size: 16
        })
      ],
      spacing: { before: 100 }
    }));
  } else if (q.type === 'fill-in-the-blanks') {
    // Already rendered in header above
  } else if (q.type === 'short-answer') {
    elements.push(new Paragraph({ 
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: rtl,
      indent: rtl ? undefined : { left: 720 }, 
      text: "................................................................................................................................................................" 
    }));
    elements.push(new Paragraph({ 
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: rtl,
      indent: rtl ? undefined : { left: 720 }, 
      text: "................................................................................................................................................................" 
    }));
    if (showAnswers) {
      elements.push(new Paragraph({ 
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: rtl,
        indent: rtl ? undefined : { left: 720 }, 
        children: [new TextRun({ text: `${rtl ? 'الإجابة:' : 'Corrigé:'} ${cleanHtml(q.correctAnswer || '')}`, italics: true, color: "059669" })] 
      }));
    }
  }

  return elements;
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || '');
}

function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, '') // Remove tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&acirc;/g, 'â')
    .replace(/&icirc;/g, 'î')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&ucirc;/g, 'û')
    .replace(/&euml;/g, 'ë')
    .replace(/&iuml;/g, 'ï')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ccedil;/g, 'ç');
}

function getShortAnswer(q: Question): string {
    if (q.type === 'multiple-choice') {
        const idx = q.options?.findIndex(o => o.isCorrect);
        return idx !== undefined && idx !== -1 ? String.fromCharCode(97 + idx) : "?";
    }
    if (q.type === 'true-false') {
        return q.correctAnswer === 'true' ? 'V' : 'F';
    }
    if (q.type === 'short-answer') return 'SA';
    if (q.type === 'fill-in-the-blanks') return 'TEXT';
    return '-';
}
