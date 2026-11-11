---
lot: LT-00
titre: Dossier technique DSFAV — sommaire
date: 2026-11-07
jalon: M0
statut: en cours
---

# Dossier technique DSFAV

**Dispositif de Suivi de la Fistule Artério-Veineuse**, outil d'aide à la décision pour la surveillance de l'abord vasculaire des patients hémodialysés. Encadrement : Pr. ZAZ.

> Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.

## Comment lire ce dossier

Chaque **lot de travail** (LT) documente une étape réalisée : le problème traité, la méthode, ce qui a été construit, comment cela a été vérifié, les décisions prises et leurs limites. Chaque chiffre renvoie à sa source (fichier du dépôt ou commande exécutée). Les versions PDF se trouvent dans `pdf/`.

## Lots de travail

| Lot | Titre | Jalon | Statut |
|---|---|---|---|
| [LT-01](LT-01-cadrage-pre-developpement.md) | Cadrage et pré-développement | Avant M0 | terminé |
| [LT-02](LT-02-environnement-multi-agents.md) | Environnement d'ingénierie multi-agents | M0 | terminé |
| [LT-03](LT-03-cartographie-connaissances.md) | Cartographie des connaissances du projet | M0 | terminé |
| [LT-04](LT-04-architecture-squelette.md) | Architecture et squelette logiciel (monorepo) | M0 | terminé |
| [LT-05](LT-05-tdd-tracabilite.md) | Démarche de développement piloté par les tests et traçabilité | M0 | terminé (cadre) |
| [LT-06](LT-06-salle-controle-visuelle.md) | Salle de contrôle visuelle | M0 | terminé |
| [LT-07](LT-07-design-system-interfaces.md) | Système de design et génération des interfaces | M0 / M5 | en cours |
| [LT-08](LT-08-contexte-documentation.md) | Pack de contexte et documentation académique | M0 | terminé |
| [LT-09](LT-09-contrat-api-modele-donnees.md) | Contrat d'API et modèle de données | M1 | terminé |
| [LT-10](LT-10-moteur-traitement-signal.md) | Moteur de traitement du signal | M2 | terminé |
| [LT-11](LT-11-backend-core.md) | Cœur du backend | M3 | terminé |
| [LT-12](LT-12-web-app.md) | Application web et système de design | M5 | terminé |
| [LT-13](LT-13-banc-formation.md) | Banc de formation et concordance | M7 | terminé |
| [LT-14](LT-14-integration-demo.md) | Intégration et démonstration en 8 étapes | M6-M7 | terminé |
| [LT-15](LT-15-interfaces-graphiques.md) | Interfaces et graphiques médicaux | M5 | terminé |
| [LT-16](LT-16-droits-securite.md) | Droits, authentification et durcissement | M6 | terminé |
| [LT-17](LT-17-ia-explicable.md) | Couche d’IA explicable | M2 / M5 | terminé |
| [LT-18](LT-18-firmware-protocole.md) | Protocole appareil et squelette de firmware | H3 | terminé sur PC |
| [LT-19](LT-19-banc-etude-virtuelle.md) | Kit d’étude sur banc et étude virtuelle | M9 | terminé |
| [LT-20](LT-20-integration-limites.md) | Intégration, limites et suite | synthèse | terminé |
| [LT-21](LT-21-refonte-ecrans-competences-conception.md) | Refonte des écrans avec les compétences de conception | M5 (reprise 2) | terminé (finitions listées) |

Lots suivants (prévus, `pre-dev/10-build-plan.md` §3) : M1 gel du contrat, M2 moteur de traitement du signal, M3 cœur du backend, M4 simulateur, M5 interfaces web, M6 flotte et synchronisation, M7 banc d'essai, M8 intégration matérielle, M9 étude sur banc et validation.

## Supports de présentation

| Support | Fichier | Remarque |
|---|---|---|
| Affiche A2 | [affiche-dsfav.pdf](poster/affiche-dsfav.pdf), texte dans [affiche.md](poster/affiche.md) | Construite depuis de vraies captures de l'application; auteurs à ajouter |
| Film de présentation (40,8 s, sans son) | [dsfav-presentation.mp4](video/dsfav-presentation.mp4), notes dans [film/NOTE.md](video/film/NOTE.md) | Portes calculées G0, G2, G3, G5 réussies; voix off non faite |
| Script de démonstration en 8 étapes | [script-demo.md](video/script-demo.md) | Découpage de tournage, non mesuré |
| Invites de génération | `artifacts/DSFAV_POSTER_PROMPTS.md` | Non exécutées sur un service payant |

## Glossaire

| Terme | Définition simple |
|---|---|
| FAV | Fistule artério-veineuse : raccordement chirurgical d'une artère et d'une veine du bras, utilisé pour la dialyse. |
| Thrill | Vibration perceptible au toucher au-dessus de la FAV, causée par le flux sanguin turbulent. |
| Baseline | Référence personnelle d'un patient, calculée sur ses 3 premières mesures valides. |
| RMS | Moyenne quadratique : mesure de l'énergie du signal de vibration, en g. |
| FFT / STFT | Transformées de Fourier : décomposent le signal en fréquences (globalement / au cours du temps). |
| Porte qualité | Ensemble de règles qui accepte ou rejette une mesure (appui, mouvement, durée propre). |
| Monorepo | Un seul dépôt de code contenant plusieurs applications qui partagent des outils et des types. |
| TDD | Développement piloté par les tests : on écrit le test qui échoue avant le code qui le fait passer. |
| C4 | Méthode de diagrammes d'architecture en 4 niveaux : contexte, conteneurs, composants, code. |
| Orchestrateur | Session d'IA principale qui planifie, délègue à d'autres agents, vérifie et intègre. |
| UC | Cas d'utilisation du cahier des charges (UC1 à UC13). |
| FP / FC | Fonctions principales / fonctions contraintes du cahier des charges. |
