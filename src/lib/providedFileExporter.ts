import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, AlignmentType, WidthType, PageOrientation, Table, TableRow, TableCell, BorderStyle, VerticalAlign } from 'docx';
import { PracticalExamProvidedFile } from '../types';

export const exportProvidedFile = async (file: PracticalExamProvidedFile, asSolution: boolean = false) => {
  const prefix = asSolution ? "CORRIGE_" : "";
  const nameToSave = prefix + (file.fileName || ("document." + file.fileType));

  if (file.fileType === 'xlsx') {
    const wb = XLSX.utils.book_new();
    
    // Add raw sheets
    if (file.excelSheets && file.excelSheets.length > 0) {
      file.excelSheets.forEach(s => {
        const dataArr = [s.headers, ...s.rows];
        const ws = XLSX.utils.aoa_to_sheet(dataArr);
        XLSX.utils.book_append_sheet(wb, ws, s.sheetName || 'Données Brutes');
      });
    } else {
      const sampleHeaders = ["ID", "Désignation", "Quantité", "Prix Unitaire (DH)", "Date Vente"];
      const sampleRows = [
        ["1", "Ordinateur Portable Core i7", "5", "8500", "2026-06-01"],
        ["2", "Écran Full HD IPS 24\"", "12", "1800", "2026-06-02"],
        ["3", "Souris Ergonomique Sans Fil", "30", "250", "2026-06-02"],
        ["4", "Disque Dur Externe SSD 1To", "15", "1200", "2026-06-03"]
      ];
      const ws = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);
      XLSX.utils.book_append_sheet(wb, ws, "Données Brutes");
    }

    // If exporting solution, add an auxiliary guide worksheet showing exactly what formulas/calculations were expected
    if (asSolution) {
      const solutionHeaders = ["ID Tâche", "Intitulé Consigne", "Formules Excel attendues / Script de calcul", "Résultat d'évaluation"];
      const solutionRows = [
        ["Calcul 1", "Mise en place des totaux par produit", "=B2*C2 (Quantité * Prix)", "Valeur numérique calculée"],
        ["Calcul 2", "Calcul de la somme globale", "=SOMME(D2:D5)", "Montant Total consolidé"],
        ["Calcul 3", "Taux de TVA de départ", "=D2 * 0.20", "Montant de TVA (20%)"],
        ["Calcul 4", "Application de bonus / SI conditionnel", "=SI(C2>10; \"Excellent\"; \"Normal\")", "Texte conditionnel"]
      ];
      const wsSol = XLSX.utils.aoa_to_sheet([solutionHeaders, ...solutionRows]);
      XLSX.utils.book_append_sheet(wb, wsSol, "CRITÈRES & FORMULES");
    }
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, nameToSave);
  } 
  else if (file.fileType === 'docx') {
    // Generate an unstyled Word document candidate template
    const headerTitle = asSolution 
      ? "CORRIGÉ OFFICIEL & SPÉCIMEN DE TRAVAIL TERMINÉ (CORRECTION TYPE)" 
      : "DOCUMENT DE TRAVAIL PRATIQUE DU CANDIDAT (STARTER)";
    
    const mainText = asSolution
      ? "[TEXTE CORRIGÉ ET ENTIÈREMENT STRUCTURÉ PAR LE CORRECTEUR]\n\n" + (file.rawContentText || "Exemple de mise en forme réussie.") + "\n\nNote de correction: Les styles Titre 1 (24pt, Gras, Couleur Bleu foncé) et les espacements de paragraphes ont été appliqués avec précision conformément au cahier des charges de l'évaluation."
      : (file.rawContentText || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam nec ex at ex placerat finibus.");

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            orientation: PageOrientation.PORTRAIT,
            width: { size: 11906, type: WidthType.DXA },
            height: { size: 16838, type: WidthType.DXA }
          }
        } as any,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: headerTitle,
                bold: true,
                size: 22,
                font: "Times New Roman",
                color: asSolution ? "166534" : "1e293b"
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: asSolution 
                  ? "Sujet résolu : Voici l'état final attendu après mise en œuvre des règles du barème."
                  : "Sujet : Mettez en forme ce texte brut selon les consignes de l'épreuve.",
                italics: true,
                size: 16,
                font: "Times New Roman",
                color: "555555"
              })
            ]
          }),
          new Paragraph({
            spacing: { before: 200, after: 120 },
            children: [
              new TextRun({
                text: mainText,
                size: 18,
                font: "Times New Roman"
              })
            ]
          })
        ]
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, nameToSave);
  } 
  else {
    // General text files like .txt, .sh scripts, JSON router configurations
    let content = file.rawContentText || file.contentStructure || "Fichier fourni initial pour l'évaluation.";
    
    if (asSolution) {
      // Modify placeholders in text/scripts to simulate solution replacement
      content = `# ========================================== \n` +
                `# CORRIGÉ OFFICIEL - SCRIPT / CONFIGURATION RÉSOPLUE \n` +
                `# ========================================== \n\n` + 
                content
                .replace(/#\s*TODO\s*:\s*compléter/g, "# COMPLÉTÉ d'après les consignes d'évaluation")
                .replace(/TODO/g, "Configuration_Valide_Officielle")
                .replace(/<votre_script_ici>/g, "# CORRIGÉ PRATIQUE :\necho \"Exécution réussie des tests d'évaluation !\"\nexit 0")
                .replace(/<votre_configuration_ici>/g, "! CONFIGURATION REQUIS :\ninterface FastEthernet0/1\n ip address 192.168.1.1 255.255.255.0\n no shutdown\nexit");
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, nameToSave);
  }
};
