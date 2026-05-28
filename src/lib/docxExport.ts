import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Header,
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
  PageNumber,
  LevelFormat
} from "docx";
import { saveAs } from "file-saver";
import { Exam, Module, Question, OrganizationSettings } from "../types";
import { formatDuration, getLineImageUrl } from "./utils";

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
  filiereLevel?: string,
  teacherName?: string,
  paperSaver: boolean = false,
  qcmDoubleColumn: boolean = false
) => {
  const orgName = settings?.orgName || 'OFPPT';
  const orgNameArabic = settings?.orgNameArabic || 'مكتب التكوين المهني وإنعاش الشغل';
  const orgNameFrench = settings?.orgNameFrench || 'Office de la Formation Professionnelle et de la promotion du travail';
  const regionalDirection = settings?.regionalDirection || 'Direction Régionale De BM-KH';
  const institutionName = settings?.institutionName || 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem';
  const orgSubName = settings?.orgSubName || 'DRBMKH';
  const regionName = settings?.regionName || 'ROYAUME DU MAROC';
  const academicYear = settings?.academicYear || '2024/2025';

  const replaceVariables = (text: string) => {
    if (!text) return '';
    return text
      .replace(/{{TITRE}}/g, exam.title || '')
      .replace(/{{MODULE}}/g, module.name || '')
      .replace(/{{PROF}}/g, teacherName || '')
      .replace(/{{DATE}}/g, exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'))
      .replace(/{{GROUPE}}/g, groupName || '')
      .replace(/{{DUREE}}/g, formatDuration(exam.durationMinutes))
      .replace(/{{TYPE}}/g, exam.type === 'controle-continu' ? 'CC' : 'EFM')
      .replace(/{{FILIERE}}/g, filiereName || '')
      .replace(/{{NIVEAU}}/g, filiereLevel || '')
      .replace(/{{ETABLISSEMENT}}/g, settings?.institutionName || 'INSTITUTION')
      .replace(/{{DIRECTION}}/g, settings?.regionalDirection || 'DIRECTION RÉGIONALE')
      .replace(/{{REGION}}/g, settings?.regionName || 'REGION')
      .replace(/{{ANNEE_ACAD}}/g, settings?.academicYear || '2024/2025')
      .replace(/{{CODE_ORG}}/g, settings?.orgSubName || 'ORG')
      .replace(/{{ORG_AR}}/g, settings?.orgNameArabic || 'ORG AR')
      .replace(/{{ORG_FR}}/g, settings?.orgNameFrench || 'ORG FR')
      .replace(/\u00A0/g, ' ');
  };

  const footerTextRaw = settings?.footerText || `${orgName} / ${orgSubName} / ${module.code}`;
  const footerText = replaceVariables(footerTextRaw);

  let logoBufferLeft: Uint8Array | null = null;
  let logoBufferRight: Uint8Array | null = null;
  
  if (settings?.orgLogoUrl) {
    logoBufferLeft = await fetchImageAsBuffer(settings.orgLogoUrl);
  }
  if (settings?.orgLogoUrlRight) {
    logoBufferRight = await fetchImageAsBuffer(settings.orgLogoUrlRight);
  } else if (settings?.orgLogoUrl) {
    logoBufferRight = logoBufferLeft; // Fallback to same logo if only one is provided
  }

  const colLogoBuffers: Map<string, Uint8Array | null> = new Map();
  if (settings?.headerColumns) {
    for (const col of settings.headerColumns) {
      for (const line of col.lines) {
        if (line.type === 'image') {
          const resolvedUrl = getLineImageUrl(line, settings);
          if (resolvedUrl) {
            if (!colLogoBuffers.has(resolvedUrl)) {
              const buffer = await fetchImageAsBuffer(resolvedUrl);
              colLogoBuffers.set(resolvedUrl, buffer);
            }
          }
        }
      }
    }
  }

  const footerColLogoBuffers: Map<string, Uint8Array | null> = new Map();
  if (settings?.footerColumns) {
    for (const col of settings.footerColumns) {
      for (const line of col.lines) {
        if (line.type === 'image') {
          const resolvedUrl = getLineImageUrl(line, settings);
          if (resolvedUrl) {
            if (!footerColLogoBuffers.has(resolvedUrl)) {
              const buffer = await fetchImageAsBuffer(resolvedUrl);
              footerColLogoBuffers.set(resolvedUrl, buffer);
            }
          }
        }
      }
    }
  }

  // Pre-fetch images from questions
  const questionImageBuffers: Map<string, Uint8Array | null> = new Map();
  for (const q of exam.questions) {
    const urls = extractImageUrls(q.text);
    for (const url of urls) {
      if (!questionImageBuffers.has(url)) {
        const buffer = await fetchImageAsBuffer(url);
        questionImageBuffers.set(url, buffer);
      }
    }
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

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "main-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%2.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 1080, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: paperSaver
              ? { top: 720, bottom: 720, left: 720, right: 720 }
              : { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        headers: {
          default: new Header({
            children: settings?.showWatermark && settings.watermarkText ? [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: settings.watermarkText,
                    color: (() => {
                      const hex = (settings.watermarkColor || "#E0E0E0").replace('#', '');
                      if (settings.watermarkOpacity !== undefined) {
                        // Blend with white (FFFFFF) based on opacity (0-100)
                        // This is a rough approximation for 'transparency' in Word text runs
                        const r = parseInt(hex.substring(0, 2), 16);
                        const g = parseInt(hex.substring(2, 4), 16);
                        const b = parseInt(hex.substring(4, 6), 16);
                        const alpha = settings.watermarkOpacity / 100;
                        const nr = Math.round(r * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
                        const ng = Math.round(g * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
                        const nb = Math.round(b * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
                        return `${nr}${ng}${nb}`;
                      }
                      return hex;
                    })(),
                    size: 110,
                    bold: true,
                  }),
                ],
              }),
            ] : [],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              ...(settings?.showFooter && settings?.footerColumns && settings.footerColumns.length > 0 ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: settings.footerColumns.map(col => new TableCell({
                        width: { size: col.width, type: WidthType.PERCENTAGE },
                        shading: col.bgColor ? { fill: col.bgColor.replace('#', '') } : undefined,
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          left: col.borderLeft ? { style: BorderStyle.DOUBLE, size: 6, color: "000000" } : { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          right: col.borderRight ? { style: BorderStyle.DOUBLE, size: 6, color: "000000" } : { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        },
                        children: col.lines.map((line, idx) => {
                          if (line.type === 'image') {
                            const buffer = footerColLogoBuffers.get(getLineImageUrl(line, settings) || '');
                            const img = createLogoImage(buffer || null, line.imageWidth || 30, line.imageHeight || 30);
                            return new Paragraph({
                              alignment: line.alignment === 'right' ? AlignmentType.RIGHT : 
                                         line.alignment === 'left' ? AlignmentType.LEFT : 
                                         AlignmentType.CENTER,
                              children: img ? [img] : [],
                              border: settings?.showFooterLines && idx < col.lines.length - 1 
                                ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: col.textColor ? col.textColor.replace('#', '') : "000000" } } 
                                : undefined,
                              spacing: { before: 40, after: 40 }
                            });
                          } else {
                            const isArabicText = /[\u0600-\u06FF]/.test(line.text || '');
                            return new Paragraph({
                              alignment: line.alignment === 'right' ? AlignmentType.RIGHT : 
                                         line.alignment === 'left' ? AlignmentType.LEFT : 
                                         AlignmentType.CENTER,
                              bidirectional: isArabicText,
                              children: [
                                new TextRun({ 
                                  text: replaceVariables(line.text || ''), 
                                  bold: line.isBold, 
                                  italics: line.isItalic,
                                  size: (line.fontSize || 9) * 2,
                                  font: line.fontFamily ? line.fontFamily.split(',')[0].replace(/"/g, '') : undefined,
                                  color: col.textColor ? col.textColor.replace('#', '') : undefined
                                }),
                              ],
                              border: settings?.showFooterLines && idx < col.lines.length - 1 
                                ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: col.textColor ? col.textColor.replace('#', '') : "000000" } } 
                                : undefined,
                              spacing: { before: 40, after: 40 }
                            });
                          }
                        }),
                        verticalAlign: VerticalAlign.CENTER,
                      }))
                    })
                  ]
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "Page ",
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
                  spacing: { before: 100 }
                })
              ] : [
                ...(settings?.showFooter && (settings.showFooterText ?? true) ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: `${footerText} - Page `,
                        size: (settings.footerFontSize || 9) * 2,
                        font: settings.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: (settings.footerFontSize || 9) * 2,
                        font: settings.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                      new TextRun({
                        text: " sur ",
                        size: (settings.footerFontSize || 9) * 2,
                        font: settings.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: (settings.footerFontSize || 9) * 2,
                        font: settings.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                    ],
                  })
                ] : []),
                ...(settings?.showFooter && (settings.showFooterTable ?? true) && settings.footerTable ? [
                  new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: settings.footerTable.rows.map(row => new TableRow({
                      children: row.map(cell => new TableCell({
                        width: { size: 100 / (row.length || 1), type: WidthType.PERCENTAGE },
                        children: [new Paragraph({ 
                          alignment: AlignmentType.CENTER,
                          children: [new TextRun({ 
                            text: replaceVariables(cell), 
                            size: ((settings.footerFontSize || 9) - 1) * 2,
                            font: settings.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                          })] 
                        })],
                        verticalAlign: VerticalAlign.CENTER,
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
                        }
                      }))
                    }))
                  })
                ] : []),
                ...(!(settings?.showFooter && (settings.showFooterText ?? true)) && !(settings?.showFooter && settings?.footerColumns && settings.footerColumns.length > 0) ? [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "Page ",
                        size: (settings?.footerFontSize || 9) * 2,
                        font: settings?.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: (settings?.footerFontSize || 9) * 2,
                        font: settings?.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                      new TextRun({
                        text: " sur ",
                        size: (settings?.footerFontSize || 9) * 2,
                        font: settings?.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: (settings?.footerFontSize || 9) * 2,
                        font: settings?.footerFontFamily ? settings.footerFontFamily.split(',')[0].replace(/"/g, '') : undefined,
                      }),
                    ],
                  })
                ] : [])
              ])
            ],
          }),
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: settings?.headerColumns && settings.headerColumns.length > 0
                  ? settings.headerColumns.map(col => new TableCell({
                      width: { size: col.width, type: WidthType.PERCENTAGE },
                      shading: col.bgColor ? { fill: col.bgColor.replace('#', '') } : undefined,
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        left: col.borderLeft ? { style: BorderStyle.DOUBLE, size: 6, color: "000000" } : { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        right: col.borderRight ? { style: BorderStyle.DOUBLE, size: 6, color: "000000" } : { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                      },
                      children: col.lines.map((line, idx) => {
                        if (line.type === 'image') {
                          const buffer = colLogoBuffers.get(getLineImageUrl(line, settings) || '');
                          const img = createLogoImage(buffer || null, line.imageWidth || 40, line.imageHeight || 40);
                          return new Paragraph({
                            alignment: line.alignment === 'right' ? AlignmentType.RIGHT : 
                                       line.alignment === 'left' ? AlignmentType.LEFT : 
                                       AlignmentType.CENTER,
                            children: img ? [img] : [],
                            border: settings?.showHeaderLines && idx < col.lines.length - 1 
                              ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: col.textColor ? col.textColor.replace('#', '') : "000000" } } 
                              : undefined,
                            spacing: { before: 80, after: 80 }
                          });
                        } else {
                          const isArabicText = /[\u0600-\u06FF]/.test(line.text || '');
                          return new Paragraph({
                            alignment: line.alignment === 'right' ? AlignmentType.RIGHT : 
                                       line.alignment === 'left' ? AlignmentType.LEFT : 
                                       AlignmentType.CENTER,
                            bidirectional: isArabicText,
                            children: [
                              new TextRun({ 
                                text: replaceVariables(line.text || ''), 
                                bold: line.isBold, 
                                italics: line.isItalic,
                                size: (line.fontSize || 10) * 2,
                                font: line.fontFamily ? line.fontFamily.split(',')[0].replace(/"/g, '') : undefined,
                                color: col.textColor ? col.textColor.replace('#', '') : undefined
                              }),
                            ],
                            border: settings?.showHeaderLines && idx < col.lines.length - 1 
                              ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: col.textColor ? col.textColor.replace('#', '') : "000000" } } 
                              : undefined,
                            spacing: { before: 80, after: 80 }
                          });
                        }
                      }),
                      verticalAlign: VerticalAlign.CENTER,
                    }))
                  : [
                      new TableCell({
                        width: { size: 15, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        },
                        children: [
                          (() => {
                            const img = createLogoImage(logoBufferLeft);
                            return img ? 
                              new Paragraph({ alignment: AlignmentType.CENTER, children: [img] }) :
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                  new TextRun({ 
                                    text: orgName, 
                                    bold: true, 
                                    size: 20
                                  })
                                ]
                              });
                          })(),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                      }),
                      new TableCell({
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            bidirectional: true,
                            children: [
                              new TextRun({ text: orgNameArabic, bold: true, size: 28 }),
                            ],
                            border: settings?.showHeaderLines ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } : undefined,
                            spacing: { before: 40, after: 40 }
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: orgNameFrench, bold: true, size: 18 }),
                            ],
                            border: settings?.showHeaderLines ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } : undefined,
                            spacing: { before: 40, after: 40 }
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: regionalDirection, bold: true, size: 18 }),
                            ],
                            border: settings?.showHeaderLines ? { bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" } } : undefined,
                            spacing: { before: 40, after: 40 }
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: institutionName, bold: true, size: 18 }),
                            ],
                            spacing: { before: 40, after: 40 }
                          }),
                        ],
                        verticalAlign: VerticalAlign.CENTER,
                      }),
                      new TableCell({
                        width: { size: 15, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                          right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
                        },
                        children: [
                          (() => {
                            const img = createLogoImage(logoBufferRight);
                            return img ? 
                              new Paragraph({ alignment: AlignmentType.CENTER, children: [img] }) :
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                  new TextRun({ 
                                    text: orgSubName, 
                                    bold: true, 
                                    size: 20
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
          new Paragraph({ text: "", spacing: { after: 120 } }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Filière : ", bold: true }), new TextRun({ text: filiereName })] })],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Niveau : ", bold: true }), new TextRun({ text: filiereLevel || "TS / T / B" })] })],
                  }),
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Année de formation : ", bold: true }), new TextRun({ text: academicYear })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Numéro du module : ", bold: true }), new TextRun({ text: String(module.code) })] })],
                  }),
                  new TableCell({
                    width: { size: 67, type: WidthType.PERCENTAGE },
                    columnSpan: 2,
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Intitulé du module : ", bold: true }), new TextRun({ text: module.name })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Horaire : ", bold: true }), new TextRun({ text: formatDuration(exam.durationMinutes) })] })],
                  }),
                  new TableCell({
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Date : ", bold: true }), new TextRun({ text: new Date().toLocaleDateString('fr-FR') })] })],
                  }),
                  new TableCell({
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ spacing: { before: 60, after: 60, line: 240 }, children: [new TextRun({ text: "Barème : ", bold: true }), new TextRun({ text: `/ ${Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2)} Pts` })] })],
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
            spacing: { before: 200, after: 200 }
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

          new Paragraph({ text: "", spacing: { after: 120 } }),

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
              'ordering': "Questions d'Ordonnancement",
              'practical': 'Évaluation Pratique'
            };

            const orderedTypes = [
              'multiple-choice',
              'true-false',
              'matching',
              'ordering',
              'fill-in-the-blanks',
              'short-answer',
              'practical'
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
                  spacing: { before: 160, after: 80, line: 240 },
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
                    spacing: { before: 80, after: 80, line: 240 },
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
                                    new TextRun({ text: `${originalIdx + 1}. `, size: 20 }),
                                    ...htmlToDocxRuns(q.text, { size: 20 }),
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
                  if (type === 'multiple-choice' && qcmDoubleColumn) {
                    const qcmQuestions = groupedQuestions[type];
                    const tableRows = [];
                    for (let i = 0; i < qcmQuestions.length; i += 2) {
                      const pair1 = qcmQuestions[i];
                      const pair2 = qcmQuestions[i + 1];
                      
                      const leftElements = renderQuestionDocx(pair1.q, pair1.originalIdx, showAnswers, questionImageBuffers, paperSaver, true);
                      const rightElements = pair2 
                        ? renderQuestionDocx(pair2.q, pair2.originalIdx, showAnswers, questionImageBuffers, paperSaver, true)
                        : [];
                      
                      const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
                      const borders = {
                        top: noBorder, bottom: noBorder, left: noBorder, right: noBorder
                      };
                      
                      tableRows.push(
                        new TableRow({
                          children: [
                            new TableCell({
                              width: { size: 50, type: WidthType.PERCENTAGE },
                              borders,
                              children: leftElements
                            }),
                            new TableCell({
                              width: { size: 50, type: WidthType.PERCENTAGE },
                              borders,
                              children: rightElements
                            })
                          ]
                        })
                      );
                    }
                    return [
                      new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: tableRows
                      })
                    ];
                  }
                  return groupedQuestions[type].flatMap(({ q, originalIdx }) => renderQuestionDocx(q, originalIdx, showAnswers, questionImageBuffers, paperSaver, false));
                })()
              ];
            });
          })(),

          // Optional Correction Grid
          ...(showAnswers ? [
            new Paragraph({ text: "", spacing: { before: paperSaver ? 200 : 400 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "GRILLE DE RÉPONSES (CORRIGÉ)", bold: true, underline: {}, size: paperSaver ? 20 : 24 }),
              ],
              spacing: { after: paperSaver ? 60 : 120, line: paperSaver ? 180 : 240 },
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

function renderQuestionDocx(q: Question, index: number, showAnswers: boolean, imageBuffers: Map<string, Uint8Array | null>, paperSaver: boolean = false, singleColOptions: boolean = false): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const rtl = isArabic(q.text);

  if (q.type === 'fill-in-the-blanks') {
    const headerChildren: TextRun[] = [
      new TextRun({ text: `${index + 1}. `, bold: true }),
    ];
    const parts = q.text.split('[blank]');
    parts.forEach((part, i) => {
      headerChildren.push(...htmlToDocxRuns(part));
      if (i < parts.length - 1) {
        if (showAnswers && q.correctAnswers?.[i]) {
          headerChildren.push(new TextRun({ 
            text: ` [ ${q.correctAnswers[i]} ] `, 
            bold: true, 
            color: "059669",
            size: paperSaver ? 14 : 20
          }));
        } else {
          headerChildren.push(new TextRun({ text: paperSaver ? " ......... " : " ...................... ", bold: true }));
        }
      }
    });
    headerChildren.push(new TextRun({ text: ` (${Number.isInteger(q.points) ? q.points : q.points.toFixed(2)} pts)`, italics: true, size: paperSaver ? 14 : 18 }));
    
    elements.push(
      new Paragraph({
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: rtl,
        spacing: { before: paperSaver ? 80 : 160, after: paperSaver ? 30 : 60, line: paperSaver ? 200 : 240 },
        children: headerChildren,
      })
    );
  } else {
    // For other questions, render directly as standard paragraphs without using tables
    const prefixRuns = [
      new TextRun({ text: `${index + 1}. `, bold: true })
    ];
    const suffixRuns = [
      new TextRun({ text: ` (${Number.isInteger(q.points) ? q.points : q.points.toFixed(2)} pts)`, italics: true, size: paperSaver ? 13 : 16 })
    ];

    const questionContentElements = htmlToDocxElements(
      q.text, 
      { size: paperSaver ? 18 : 22, prefixRuns, suffixRuns }, 
      imageBuffers
    );

    elements.push(...questionContentElements);
  }

  if (q.type === 'multiple-choice') {
    const optionsWithOrig = (q.options || []).map((opt, idx) => ({ ...opt, originalIndex: idx }));
    // Shuffle MCQ options
    for (let i = optionsWithOrig.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsWithOrig[i], optionsWithOrig[j]] = [optionsWithOrig[j], optionsWithOrig[i]];
    }

    const tableRows = [];
    
    if (singleColOptions) {
      for (let i = 0; i < optionsWithOrig.length; i++) {
        const opt = optionsWithOrig[i];
        const optRtl = isArabic(opt.text);
        
        const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
        const borders = {
          top: noBorder, bottom: noBorder, left: noBorder, right: noBorder
        };
        
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders,
                children: [
                  new Paragraph({
                    alignment: optRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    bidirectional: optRtl,
                    spacing: { before: paperSaver ? 10 : 20, after: paperSaver ? 10 : 20, line: paperSaver ? 180 : 240 },
                    children: [
                      new TextRun({ 
                        text: showAnswers && opt.isCorrect ? " [X] " : " [  ] ",
                        bold: showAnswers && opt.isCorrect,
                        color: showAnswers && opt.isCorrect ? "059669" : undefined,
                        size: paperSaver ? 16 : 20
                      }),
                      new TextRun({ 
                        text: `${String.fromCharCode(97 + i)}) `,
                        bold: showAnswers && opt.isCorrect,
                        color: showAnswers && opt.isCorrect ? "059669" : undefined,
                        size: paperSaver ? 16 : 20
                      }),
                      ...htmlToDocxRuns(opt.text, { 
                        bold: showAnswers && opt.isCorrect,
                        color: showAnswers && opt.isCorrect ? "059669" : undefined,
                        size: paperSaver ? 16 : 20
                      }),
                    ],
                  })
                ]
              })
            ]
          })
        );
      }
    } else {
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
                spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
                children: [
                  new TextRun({ 
                    text: showAnswers && opt1.isCorrect ? " [X] " : " [  ] ",
                    bold: showAnswers && opt1.isCorrect,
                    color: showAnswers && opt1.isCorrect ? "059669" : undefined,
                    size: paperSaver ? 16 : 20
                  }),
                  new TextRun({ 
                    text: `${String.fromCharCode(97 + i)}) `,
                    bold: showAnswers && opt1.isCorrect,
                    color: showAnswers && opt1.isCorrect ? "059669" : undefined,
                    size: paperSaver ? 16 : 20
                  }),
                  ...htmlToDocxRuns(opt1.text, { 
                    bold: showAnswers && opt1.isCorrect,
                    color: showAnswers && opt1.isCorrect ? "059669" : undefined,
                    size: paperSaver ? 16 : 20
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
                  spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
                  children: [
                    new TextRun({ 
                      text: showAnswers && opt2.isCorrect ? " [X] " : " [  ] ",
                      bold: showAnswers && opt2.isCorrect,
                      color: showAnswers && opt2.isCorrect ? "059669" : undefined,
                      size: paperSaver ? 16 : 20
                    }),
                    new TextRun({ 
                      text: `${String.fromCharCode(97 + i + 1)}) `,
                      bold: showAnswers && opt2.isCorrect,
                      color: showAnswers && opt2.isCorrect ? "059669" : undefined,
                      size: paperSaver ? 16 : 20
                    }),
                    ...htmlToDocxRuns(opt2.text, { 
                      bold: showAnswers && opt2.isCorrect,
                      color: showAnswers && opt2.isCorrect ? "059669" : undefined,
                      size: paperSaver ? 16 : 20
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
          spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
          children: [
            new TextRun({ text: " [  ] ", size: paperSaver ? 16 : 20 }),
            ...htmlToDocxRuns(opt.text, { size: paperSaver ? 16 : 20 }),
            showAnswers && q.correctOrder ? new TextRun({ text: ` (Pos: ${q.correctOrder.indexOf(opt.originalIndex) + 1})`, color: "059669", bold: true, size: paperSaver ? 16 : 20 }) : new TextRun({}),
          ],
        })
      );
    });
  } else if (q.type === 'matching') {
    const leftOptions = q.options || [];
    const rightOptionsRaw = q.matchOptions || [];
    const qRtl = isArabic(q.text);
    const optionsRtl = leftOptions.length > 0 && isArabic(leftOptions[0].text);
    const rtl = qRtl || optionsRtl;
    const rightWithOriginalIndex = rightOptionsRaw.map((text, originalIndex) => ({ text, originalIndex }));
    
    // Shuffle the right side for the export document
    const shuffledRight = [...rightWithOriginalIndex];
    for (let i = shuffledRight.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledRight[i], shuffledRight[j]] = [shuffledRight[j], shuffledRight[i]];
    }

    const tableRows = [];
    
    // Header row
    const columnAHeader = q.columnAHeader || (rtl ? 'العمود أ' : "Colonne A");
    const columnBHeader = q.columnBHeader || (rtl ? 'العمود ب' : "Colonne B");
    const matchingHeader = rtl ? 'إجابة' : "Réponse";

    tableRows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ 
            width: { size: 42, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, 
              bidirectional: rtl, 
              spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
              children: [new TextRun({ 
                text: columnAHeader, 
                bold: true, 
                size: paperSaver ? 16 : 20 
              })] 
            })],
            shading: { fill: "f1f5f9" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: paperSaver ? 30 : 60, bottom: paperSaver ? 30 : 60, left: 100, right: 100 }
          }),
          new TableCell({ 
            width: { size: 16, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              children: [new TextRun({ text: matchingHeader, bold: true, size: paperSaver ? 16 : 20 })], 
              alignment: AlignmentType.CENTER,
              spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 }
            })],
            shading: { fill: "f1f5f9" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: paperSaver ? 30 : 60, bottom: paperSaver ? 30 : 60, left: 100, right: 100 }
          }),
          new TableCell({ 
            width: { size: 42, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ 
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT, 
              bidirectional: rtl, 
              spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
              children: [new TextRun({ 
                text: columnBHeader, 
                bold: true, 
                size: paperSaver ? 16 : 20 
              })] 
            })],
            shading: { fill: "f1f5f9" },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: paperSaver ? 30 : 60, bottom: paperSaver ? 30 : 60, left: 100, right: 100 }
          }),
        ],
      })
    );

    // Rows for each option
    for (let i = 0; i < Math.max(leftOptions.length, shuffledRight.length); i++) {
        const leftText = leftOptions[i]?.text || "";
        const rightText = shuffledRight[i]?.text || "";
        const rightLabel = String.fromCharCode(65 + i); // A, B, C...
        const lRtl = isArabic(leftText);
        const rRtl = isArabic(rightText);
        
        const middleCellParagraphs: Paragraph[] = [];
        
        if (i < leftOptions.length) {
          if (showAnswers && q.correctMatches) {
            const correctRightOrigIdx = q.correctMatches[i];
            const currentIdxInShuffled = shuffledRight.findIndex(r => r.originalIndex === correctRightOrigIdx);
            const answerLabel = currentIdxInShuffled !== -1 ? String.fromCharCode(65 + currentIdxInShuffled) : "?";
            
            middleCellParagraphs.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: paperSaver ? 15 : 30, after: paperSaver ? 15 : 30, line: paperSaver ? 180 : 240 },
              children: [
                new TextRun({ 
                  text: `[ ${answerLabel} ]`, 
                  bold: true,
                  color: "059669",
                  size: paperSaver ? 16 : 20
                })
              ]
            }));
          } else {
            middleCellParagraphs.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: paperSaver ? 15 : 30, after: paperSaver ? 15 : 30, line: paperSaver ? 180 : 240 },
              children: [
                new TextRun({ text: "[      ]", size: paperSaver ? 16 : 20, color: "cbd5e1" })
              ]
            }));
          }
        }

        tableRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                width: { size: 42, type: WidthType.PERCENTAGE },
                children: leftText ? [new Paragraph({ 
                  alignment: lRtl ? AlignmentType.RIGHT : AlignmentType.LEFT, 
                  bidirectional: lRtl, 
                  spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
                  children: [
                    new TextRun({ text: `${i + 1}. `, bold: true, size: paperSaver ? 16 : 20 }),
                    ...htmlToDocxRuns(leftText, { size: paperSaver ? 16 : 20 })
                  ] 
                })] : [],
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: paperSaver ? 30 : 60, bottom: paperSaver ? 30 : 60, left: 100, right: 100 }
              }),
              new TableCell({ 
                width: { size: 16, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: middleCellParagraphs,
                shading: showAnswers && i < leftOptions.length ? { fill: "f0fdf4" } : undefined,
                margins: { top: paperSaver ? 15 : 30, bottom: paperSaver ? 15 : 30 }
              }),
              new TableCell({ 
                width: { size: 42, type: WidthType.PERCENTAGE },
                children: rightText ? [new Paragraph({ 
                  alignment: rRtl ? AlignmentType.RIGHT : AlignmentType.LEFT, 
                  bidirectional: rRtl, 
                  spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 },
                  children: [
                    new TextRun({ text: `${rightLabel}. `, bold: true, size: paperSaver ? 16 : 20 }),
                    ...htmlToDocxRuns(rightText, { size: paperSaver ? 16 : 20 })
                  ] 
                })] : [],
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: paperSaver ? 30 : 60, bottom: paperSaver ? 30 : 60, left: 100, right: 100 }
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
          text: rtl ? "قم بمطابقة كل رقم من العمود الأيمن مع الحرف المقابل له في العمود الأوسط." : "Indiquez pour chaque numéro de la colonne de gauche la lettre correspondante dans la colonne centrale.",
          italics: true,
          size: paperSaver ? 14 : 18
        })
      ],
      spacing: { before: paperSaver ? 50 : 100, after: paperSaver ? 50 : 100, line: paperSaver ? 180 : 240 }
    }));
  } else if (q.type === 'fill-in-the-blanks') {
    // Already rendered in header above
  } else if (q.type === 'short-answer') {
    elements.push(new Paragraph({ 
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: rtl,
      indent: rtl ? undefined : { left: 720 }, 
      text: "................................................................................................................................................................",
      spacing: { before: paperSaver ? 20 : 40, after: paperSaver ? 20 : 40, line: paperSaver ? 180 : 240 }
    }));
    if (!paperSaver) {
      elements.push(new Paragraph({ 
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: rtl,
        indent: rtl ? undefined : { left: 720 }, 
        text: "................................................................................................................................................................",
        spacing: { before: 40, after: 40, line: 240 }
      }));
    }
    if (showAnswers) {
      elements.push(new Paragraph({ 
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: rtl,
        indent: rtl ? undefined : { left: 720 }, 
        spacing: { before: paperSaver ? 30 : 60, after: paperSaver ? 30 : 60, line: paperSaver ? 180 : 240 },
        children: [
          new TextRun({ text: `${rtl ? 'الإجابة:' : 'Corrigé:'} `, italics: true, color: "059669", bold: true, size: paperSaver ? 16 : 20 }),
          ...htmlToDocxRuns(q.correctAnswer || '', { italic: true, color: "059669", size: paperSaver ? 16 : 20 })
        ] 
      }));
    }
  } else if (q.type === 'practical') {
    if (!paperSaver) {
      elements.push(new Paragraph({ 
        alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: rtl,
        indent: rtl ? undefined : { left: 720 }, 
        text: "................................................................................................................................................................",
        spacing: { before: 80, after: 40, line: 240 }
      }));
    }
    elements.push(new Paragraph({ 
      alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: rtl,
      indent: rtl ? undefined : { left: 720 }, 
      children: [
        new TextRun({ 
          text: rtl ? "مساحة للتقييم العملي / ملاحظات المكون..." : "Espace pour l'évaluation pratique / observations du formateur...",
          italics: true,
          color: "666666",
          size: paperSaver ? 14 : 18
        })
      ],
      spacing: { before: paperSaver ? 40 : 80, after: paperSaver ? 40 : 80, line: paperSaver ? 180 : 240 }
    }));
  }

  return elements;
}

function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || '');
}

function extractImageUrls(html: string): string[] {
  if (!html) return [];
  const urls: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img');
  imgs.forEach(img => {
    const src = img.getAttribute('src');
    if (src) urls.push(src);
  });
  return urls;
}

function htmlToDocxElements(
  html: string, 
  options: { 
    size?: number; 
    prefixRuns?: (TextRun | ImageRun)[]; 
    suffixRuns?: (TextRun | ImageRun)[]; 
  } = {}, 
  imageBuffers: Map<string, Uint8Array | null>
): Paragraph[] {
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  interface PendingParagraph {
    runs: (TextRun | ImageRun)[];
    rtl: boolean;
    bullet?: any;
    numbering?: any;
    spacing: { before: number; after: number; line?: number };
  }
  const pendingParagraphs: PendingParagraph[] = [];

  const processElement = (element: Element, isListItem = false, listLevel = 0, listType: 'bullet' | 'number' = 'bullet') => {
    const runs: (TextRun | ImageRun)[] = [];
    const rtl = isArabic(element.textContent || '');

    const traverse = (node: Node, style: any) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').replace(/\u00A0/g, ' ');
        if (text.trim() || text === ' ') {
          runs.push(new TextRun({
            text,
            bold: style.bold,
            italics: style.italic,
            underline: style.underline ? {} : undefined,
            size: style.size || options.size || 22,
            color: style.color,
            font: style.font || (isArabic(text) ? "Amiri" : "Times New Roman")
          }));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const nextStyle = { ...style };
        const tag = el.tagName.toLowerCase();

        if (tag === 'b' || tag === 'strong') nextStyle.bold = true;
        if (tag === 'i' || tag === 'em') nextStyle.italic = true;
        if (tag === 'u') nextStyle.underline = true;
        if (tag === 'br') {
          runs.push(new TextRun({ text: "", break: 1 }));
          return;
        }
        if (tag === 'img') {
          const src = el.getAttribute('src');
          if (src && imageBuffers.has(src)) {
            const buffer = imageBuffers.get(src);
            if (buffer) {
              // Try to get dimensions from style or attributes
              let width = 300; // Increased default width
              let height = 200;
              const wAttr = el.getAttribute('width');
              const hAttr = el.getAttribute('height');
              if (wAttr) width = parseInt(wAttr);
              if (hAttr) height = parseInt(hAttr);
              
              if (el.style.width) {
                 const match = el.style.width.match(/(\d+)px/);
                 if (match) width = parseInt(match[1]);
              }
              if (el.style.height) {
                 const match = el.style.height.match(/(\d+)px/);
                 if (match) height = parseInt(match[1]);
              }

              // Constrain width to fit within page (approx 450-500 points)
              if (width > 450) {
                const ratio = height / width;
                width = 450;
                height = Math.round(width * ratio);
              }

              runs.push(new ImageRun({
                data: buffer,
                transformation: { width, height }
              } as any));
            }
          }
          return;
        }

        if (tag === 'span' && el.style) {
          if (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700) nextStyle.bold = true;
          if (el.style.fontStyle === 'italic') nextStyle.italic = true;
          if (el.style.textDecoration === 'underline' || el.style.textDecorationLine === 'underline') nextStyle.underline = true;
          if (el.style.color) {
            let color = el.style.color;
            if (color.startsWith('#')) nextStyle.color = color.substring(1);
          }
          if (el.style.fontSize) {
            const sizeMatch = el.style.fontSize.match(/(\d+)(px|pt)/);
            if (sizeMatch) {
              const val = parseInt(sizeMatch[1]);
              nextStyle.size = sizeMatch[2] === 'pt' ? val * 2 : Math.round(val * 1.5);
            }
          }
          if (el.style.fontFamily) {
            nextStyle.font = el.style.fontFamily.split(',')[0].replace(/"/g, '').trim();
          }
        }

        el.childNodes.forEach(child => traverse(child, nextStyle));
      }
    };

    element.childNodes.forEach(child => {
       if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = (child as Element).tagName.toLowerCase();
          if (['ul', 'ol', 'p', 'div'].includes(tag)) {
             if (runs.length > 0) {
                pendingParagraphs.push({
                  runs: [...runs],
                  rtl,
                  bullet: isListItem && listType === 'bullet' ? { level: listLevel } : undefined,
                  numbering: isListItem && listType === 'number' ? { reference: 'main-numbering', level: listLevel } : undefined,
                  spacing: { before: 60, after: 60, line: 240 }
                });
                runs.length = 0;
             }
             processNode(child, listLevel + (isListItem ? 1 : 0));
             return;
          }
       }
       traverse(child, {});
    });

    if (runs.length > 0) {
      pendingParagraphs.push({
        runs: [...runs],
        rtl,
        bullet: isListItem && listType === 'bullet' ? { level: listLevel } : undefined,
        numbering: isListItem && listType === 'number' ? { reference: 'main-numbering', level: listLevel } : undefined,
        spacing: { before: isListItem ? 0 : 60, after: isListItem ? 0 : 60, line: 240 }
      });
    }
  };

  const processNode = (node: Node, level = 0) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'ul' || tag === 'ol') {
      const type = tag === 'ul' ? 'bullet' : 'number';
      el.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === 'li') {
          processElement(child as Element, true, level, type);
        }
      });
    } else if (tag === 'p' || tag === 'div' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
      processElement(el);
    } else {
      // Default to processing as a block if it's the root body children
      if (node.parentNode === doc.body) {
        processElement(el);
      }
    }
  };

  doc.body.childNodes.forEach(node => processNode(node));

  // If no paragraphs were added (e.g. just raw text in body), do one final pass
  if (pendingParagraphs.length === 0 && doc.body.textContent?.trim()) {
    processElement(doc.body as any);
  }

  if (pendingParagraphs.length === 0) {
    pendingParagraphs.push({
      runs: [],
      rtl: false,
      spacing: { before: 60, after: 60, line: 240 }
    });
  }

  // Prepend prefixRuns if provided
  if (options.prefixRuns && options.prefixRuns.length > 0) {
    pendingParagraphs[0].runs = [...options.prefixRuns, ...pendingParagraphs[0].runs];
  }

  // Append suffixRuns if provided
  if (options.suffixRuns && options.suffixRuns.length > 0) {
    const lastIdx = pendingParagraphs.length - 1;
    pendingParagraphs[lastIdx].runs = [...pendingParagraphs[lastIdx].runs, ...options.suffixRuns];
  }

  // Map to actual Paragraph elements
  const paragraphs = pendingParagraphs.map(p => new Paragraph({
    children: p.runs,
    alignment: p.rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bidirectional: p.rtl,
    bullet: p.bullet,
    numbering: p.numbering,
    spacing: p.spacing
  }));

  return paragraphs;
}

function htmlToDocxRuns(html: string, options: { bold?: boolean, size?: number, color?: string, italic?: boolean } = {}): TextRun[] {
  if (!html) return [];
  
  // Basic HTML parser for <b>, <i>, <u>, <strong>, <em>, <span> with style, and line breaks
  const runs: TextRun[] = [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const processNode = (node: Node, currentStyle: any) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').replace(/\u00A0/g, ' ');
      if (text.trim() || text === ' ') {
        runs.push(new TextRun({
          text,
          bold: currentStyle.bold,
          italics: currentStyle.italic,
          underline: currentStyle.underline ? {} : undefined,
          size: currentStyle.size || options.size || 22,
          color: currentStyle.color || options.color,
          font: currentStyle.font || (isArabic(text) ? "Amiri" : "Times New Roman")
        }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const nextStyle = { ...currentStyle };
      
      const tag = el.tagName.toLowerCase();
      if (tag === 'b' || tag === 'strong') nextStyle.bold = true;
      if (tag === 'i' || tag === 'em') nextStyle.italic = true;
      if (tag === 'u') nextStyle.underline = true;
      if (tag === 'br') {
        runs.push(new TextRun({ text: "", break: 1 }));
        return;
      }
      
      if (tag === 'span' && el.style) {
        if (el.style.fontWeight === 'bold' || parseInt(el.style.fontWeight) >= 700) nextStyle.bold = true;
        if (el.style.fontStyle === 'italic') nextStyle.italic = true;
        if (el.style.textDecoration === 'underline' || el.style.textDecorationLine === 'underline') nextStyle.underline = true;
        
        if (el.style.color) {
          let color = el.style.color;
          if (color.startsWith('#')) color = color.substring(1);
          // Handle rgb converter here if needed, but hex is common
          if (color.startsWith('rgb')) {
             // skip complex rgb for now or add helper
          } else {
             nextStyle.color = color;
          }
        }
        
        if (el.style.fontSize) {
          const sizeMatch = el.style.fontSize.match(/(\d+)(px|pt)/);
          if (sizeMatch) {
            const val = parseInt(sizeMatch[1]);
            nextStyle.size = sizeMatch[2] === 'pt' ? val * 2 : Math.round(val * 1.5);
          }
        }

        if (el.style.fontFamily) {
          nextStyle.font = el.style.fontFamily.split(',')[0].replace(/"/g, '').trim();
        }
      }
      
      // Handle block elements by adding a break before/after if they are not the first child?
      // Simple approach: Add a break after <p>, <div>, <li>, <h1>-<h6>
      const isBlock = ['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'].includes(tag);
      
      el.childNodes.forEach(child => processNode(child, nextStyle));
      
      if (isBlock && el.nextSibling) {
        runs.push(new TextRun({ text: "", break: 1 }));
      }
    }
  };
  
  doc.body.childNodes.forEach(node => processNode(node, { 
    bold: options.bold, 
    italic: options.italic,
    color: options.color
  }));
  
  return runs;
}

function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, '') // Remove tags
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
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
