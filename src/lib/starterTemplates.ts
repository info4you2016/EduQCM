export interface PrebuildStarterTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  fileName: string;
  fileType: 'xlsx' | 'docx' | 'txt' | 'sh' | 'json';
  contentStructure?: string;
  rawContentText?: string;
  excelSheets?: {
    sheetName: string;
    headers: string[];
    rows: any[][];
  }[];
}

export const PREBUILT_STARTER_TEMPLATES: PrebuildStarterTemplate[] = [
  {
    id: "excel_corp_inventory",
    category: "Microsoft Excel / Tableur",
    title: "Gestion d'Inventaire Corporate",
    description: "Modèle complet d'inventaire bureautique d'entreprise avec codes produits bruts, quantités en stock, prix unitaires et seuils de réapprovisionnement.",
    fileName: "inventaire_materiel_starter.xlsx",
    fileType: "xlsx",
    excelSheets: [
      {
        sheetName: "Stocks_Physiques",
        headers: ["Code_Ref", "Designation_Produit", "Classification", "Stock_Physique", "Prix_Achat_Devis_DH", "Seuil_Minimum_Alerte", "Origine_Fournisseur"],
        rows: [
          ["PRD-101", "PC Portable Lenovo ThinkPad L14", "Matériel Informatique", 14, 7500, 5, "Lenovo France SAS"],
          ["PRD-102", "Écran Dell Professional UltraSharp 27\"", "Périphérique Affichage", 8, 3800, 3, "Dell Direct Distribution"],
          ["PRD-103", "Clavier Mécanique Haute-Précision Corsair", "Accessoires Saisie", 25, 1200, 10, "Corsair EMEA"],
          ["PRD-104", "Souris Ergonomique Logitech MX Master", "Accessoires Saisie", 42, 950, 15, "Logitech Maroc Distribution"],
          ["PRD-105", "Casque Micro Réduction Bruit actif Sony", "Audio & Comms", 2, 3400, 5, "Sony Maroc Retail"],
          ["PRD-106", "Switch Giga Cisco Catalyst 2960-X", "Équipement Réseau", 6, 4500, 2, "Cisco Systems Morocco"],
          ["PRD-107", "Serveur de Stockage NAS Synology 4-Baies", "Stockage Serveurs", 1, 6200, 2, "Synology Distri EMEA"]
        ]
      }
    ]
  },
  {
    id: "excel_hr_payroll",
    category: "Microsoft Excel / RH",
    title: "Livre des Salaires & Heures Supplémentaires",
    description: "Registre brut de ressources humaines avec matricules, départements, salaires de base et décomptes d'heures supplémentaires pour exercices de calcul.",
    fileName: "registre_paie_mensuel.xlsx",
    fileType: "xlsx",
    excelSheets: [
      {
        sheetName: "Synthese_Heures_Salarie",
        headers: ["Matricule_ID", "Nom_Prenom_Salarie", "Departement_Affectation", "Salaire_Base_Contractuel_DH", "Heures_Sup_Effectuees_H", "Taux_Horaire_Sup_DH", "Annees_Anciennete"],
        rows: [
          ["MAT-0205", "El Amrani Hassan", "Ingénierie Réseaux", 8900, 12, 45, 4],
          ["MAT-0208", "Benjelloun Sofia", "Développement Web", 11500, 8, 55, 2],
          ["MAT-0210", "Chraibi Omar", "Cyber-Sécurité Infogérance", 9800, 16, 50, 7],
          ["MAT-0215", "Berrada Yasmina", "Marketing & Communication", 7200, 0, 35, 1],
          ["MAT-0220", "Tahiri Khalid", "Ressources Humaines & RSE", 8300, 5, 40, 8]
        ]
      }
    ]
  },
  {
    id: "word_stage_rapport",
    category: "Microsoft Word / Mise en page",
    title: "Modèle de Rapport Technique non formaté (Brut)",
    description: "Texte brut informatisé à structurer avec des styles, des sauts de sections, des marges et l'insertion d'une table des matières.",
    fileName: "rapport_stage_technique_starter.docx",
    fileType: "docx",
    rawContentText: `OFFICE DE LA FORMATION PROFESSIONNELLE ET DE LA PROMOTION DU TRAVAIL
COMPTE-RENDU DE STAGE PRATIQUE PROFESSIONNEL
SUJET DE CERTIFICATION: INTÉGRATION DE PROTOCOLES DE ROUTAGE SÉCURISÉS (OSPF AREA 0) ET CONVERTISSEURS D'ADRESSES IP (NAT/PAT)

Rédigé et documenté par: Le Candidat au Titre Professionnel
Organisme d'accueil: Direction Régionale de l'Énergie
Période d'activité: du 01 Avril au 30 Mai 2026

INTRODUCTION GENERALE
Au cours de notre formation, nous avons assimilé la théorie des modèles OSI et les couches physiques/liaisons du routage IP. Ce projet constitue une mise en pratique réelle des compétences au sein d'une entreprise publique structurée.

1. ANALYSE LOGIQUE DES INFRASTRUCTURES EXISTANTES ET BESOINS DE MUTATION
1.1 PRÉSENTATION GLOBALE DE LA CELLULE INFORMATIQUE
La cellule s'occupe de la maintenance d'un parc de 150 machines clients et de l'administration de 6 serveurs Windows Server Active Directory et Ubuntu DNS. Les liaisons sont saturées à cause de la propagation excessive de diffusions.
1.2 LIMITATIONS DE L'ARCHITECTUR DU ROUTAGE STATIQUE
La table de routage statique nécessite d'être configurée par zone sur chaque routeur local de l'organisme. En cas d'incident physique sur l'une des fibres, le réseau complet s'isole du fait de l'absence de redirection dynamique automatique.

2. SOLUTIONS EXPÉRIMENTALES ET PLANIFICATION DU PROTOCOLE OSPF
La mise en œuvre d'une zone Backbone unique (OSPF Zone 0) résout les congestions de mise à jour des routeurs. L'algorithme Dijkstra recalcule la meilleure route en millisecondes en cas de défaut.
Adresse IP du Réseau Backbone Interconnecté: 10.10.10.0/30 (Réseaux WAN d'interconnexion interne)
Plan d'adressage LAN du Client Principal: 172.16.10.0/24 (Siège et Serveurs de Fichiers)
Plan d'adressage LAN Agences distantes: 172.16.20.0/24 (Agences et accès visiteurs)

CONCLUSION ET REME_CIEMENTS
L'impact direct de ce déploiement se traduit par une disponibilité du réseau de 99.8%. Les coupures d'accès n'impactent plus les agents métiers.`
  },
  {
    id: "cisco_router_config",
    category: "Réseau Cisco CLI",
    title: "Fiche d'Éléments de Démarrage Routeur Cisco",
    description: "Modèle de configuration CLI de démarrage Cisco avec instructions de sécurisation privilèges, adressages d'interfaces Gigabit et configuration OSPF.",
    fileName: "cisco_router_exam_starter.txt",
    fileType: "txt",
    contentStructure: `! =========================================================================
! DEVOIR DE TRAVAIL PRATIQUE - CONFIGURATION GLOBALE ROUTEUR CISCO
! =========================================================================
enable
configure terminal

! 1. CONFIGURATION DU NOM D'HOTE ET BANNER GENERAL
hostname Routeur-Maroc-Central
banner motd # ACCES STRICTEMENT PRIVE - AUTORISATION SPECIFIQUE DIRECTEUR REQUIS #

! 2. ACTIVITE SÉCURITÉ CONSOLE ET PRIVILÉGIÉ (À COMPLÉTER PAR LE CANDIDAT)
! TODO: Activer le chiffrement fort des mots de passe en mémoire du routeur (service password-encryption)
! TODO: Programmer la clé secrète sécurisée de mot de passe du mode Privilégié (mot de passe attendu : "CiscoPassSecure2026")

! 3. PARAMÉTRA_E ADRESSAGE IP ET ACTIVATION DES INTERFACES LAN & WAN
interface GigabitEthernet0/0
 description Liaison Interne LAN Siege Social
 ! TODO: Assigner l'adresse IP de passerelle: 192.168.10.254 avec masque de réseau 255.255.255.0
 ! TODO: Activer la mise sous tension de l'interface par la commande adéquate
exit

interface GigabitEthernet0/1
 description Interconnexion Backbone WAN
 ! TODO: Assigner l'adresse IP point-à-point: 10.10.10.1 avec masque CIDR /30 (255.255.255.252)
 ! TODO: Activer l'interface réseau
exit

! 4. INSTANCIATION ROUTAGE DYNAMIQUE OSPF ET DECLARATIONS RESERVES
router ospf 10
 router-id 1.1.1.1
 ! TODO: Déclarer le réseau LAN Privé 192.168.10.0/24 dans l'Area 0
 ! TODO: Déclarer le sous-réseau Point-à-Point WAN 10.10.10.0/30 dans l'Area 0
 ! Astuce : Utilisez les masques génériques sauvages (wildcard masks)
exit

! 5. PARAMETRAGE LIGNE DE TRAVAIL VTY POUR PRISE EN MAIN SSH (TODO)
line vty 0 4
 ! TODO: Mettre en place la sécurité de mot de passe à distance "VtyCiscoSsh"
 ! TODO: Activer le filtrage par 'login'
exit

end
write memory
`
  },
  {
    id: "linux_backup_script",
    category: "Scripting / Linux Bash",
    title: "Script d'Automatisation de Sauvegardes Système",
    description: "Squelette de script Shell (.sh) Linux incomplet et bogué avec variables d'environnement, à corriger pour réaliser une sauvegarde Apache et MySQL compressée.",
    fileName: "backup_serveur_automation_starter.sh",
    fileType: "sh",
    contentStructure: `#!/bin/bash
# =========================================================================
# SYSTEM SCRIPTLING AUTOMATION - STARTER EXAMEN PRATIQUE BASH
# Objectif: Archiver les configurations Web et dump MySQL
# =========================================================================

# 1. PARAMÈTRES ET CONSTANTES GLOBALES
DESTDIR_BACKUP="/var/backups/corporate-ofppt"
APACHE_SOURCE_PATH="/etc/apache2"
WWW_RESOURCES_PATH="/var/www/html"
DATABASE_TO_DUMP="ofppt_exams_db"
SUFFIX_DATETIME=$(date +%Y-%m-%d_%Hh%M)

echo "=============== LANCEMENT SCRIPT AUTOMATIQUE DU $SUFFIX_DATETIME ==============="

# TODO_1: Vérifier si le dossier $DESTDIR_BACKUP existe sur la machine de test
# Si le dossier est inexistant, créez-le directement avec les sous-dossiers requis (mkdir -p)

# 2. DUMP ET EXPORT DES TABLES DE LA BASE DE DONNÉES SQL (TODO)
echo "Lancement de la sauvegarde de la base de données SQL standard..."
# TODO_2: Ajoutez la commande mysqldump pour sauvegarder la base de données 'ofppt_exams_db'
# Utilisateur requis : 'root_backup'
# Mot de passe requis : 'OfpptPass2026'
# Chemin cible du fichier SQL à générer: "$DESTDIR_BACKUP/dump_database_$SUFFIX_DATETIME.sql"

# 3. EXTRACTION ET ARCHIVAGE DES RESSOURCES WEB ET LOGICIEL (TODO)
echo "Compression des dossiers web Apache..."
# TODO_3: Ajoutez la commande tar pour archiver et compresser (format .tar.gz)
# le dossier source $WWW_RESOURCES_PATH vers le fichier cible : "$DESTDIR_BACKUP/html_source_backup_$SUFFIX_DATETIME.tar.gz"

# 4. DURCISSEMENT DES DROITS D'ACCÈS POUR DES RAISONS DE SÉCURITÉ (TODO)
echo "Modification des privilèges d'accès réseau sur les fichiers..."
# TODO_4: Modifiez l'état d'accès du dossier de sauvegarde $DESTDIR_BACKUP
# de sorte que seul l'utilisateur créateur (propriétaire) puisse lire/écrire/exécuter le dossier complet (chmod 700)

echo "=============== TRAVAIL CRÉÉ SANS ERREURS DE SYNTAXE - TERMINE ==============="
`
  }
];
