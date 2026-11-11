---
lot: LT-15
titre: Interfaces et graphiques médicaux
date: 2026-11-09
jalon: M5 (reprise)
statut: terminé (finitions en cours)
---

# LT-15 · Interfaces et graphiques médicaux

## Résumé
Un audit des écrans a montré que les interfaces ressemblaient à un prototype fait main : les bibliothèques de conception approuvées étaient installées mais presque inutilisées, 16 fichiers dessinaient leurs graphiques en SVG à la main et 100 valeurs de couleur étaient écrites en dur (sources en §6). Deux lots ont corrigé les parties qui portent des graphiques et du contenu médical : l'acquisition en direct, le suivi du patient et le spectrogramme. Le reste de l'interface n'a volontairement pas été remplacé.

## 1. Contexte et problématique
Le propriétaire du projet a constaté que la page d'acquisition n'affichait que des nombres à la place du graphique, et que la page patient paraissait « codée en dur ». Un audit (`docs/UI-AUDIT.md`) a listé les causes et les défauts page par page.

## 2. Objectifs
- Un graphique du signal en direct avec axes, unités, légende et état d'attente, même sans appareil.
- Un mode démonstration qui joue une acquisition complète enregistrée, étiquetée « Données simulées ».
- Des graphiques d'analyse (tendance des séances, spectrogramme, mini-courbes) lisibles et accessibles.

## 3. Démarche et méthode
Captures d'écran avant et après (`docs/visual/screens/`), revue de chaque livraison par comparaison visuelle et non seulement par les tests. Une première livraison a été rejetée parce que les tests passaient mais que la mise en page était inchangée ; une seconde a corrigé l'essentiel et neuf défauts résiduels ont fait l'objet d'une tâche de finition.

## 4. Conception
| Besoin | Choix |
|---|---|
| Signal en direct 1 kHz | uPlot (déjà installé) : axes 0 à 25 s, échelle symétrique en g, masque de mouvement au-delà de 0,08 g, bande de pression 3,0 à 8,5 kPa |
| Tendances, mini-courbes, barres | Recharts (déjà installé) : ligne de référence de la baseline, points colorés par statut avec texte |
| Spectrogramme | Dessin direct, sans dépendance, derrière des propriétés stables pour pouvoir passer plus tard à ECharts |
Aucune bibliothèque médicale spécialisée adaptée n'existe (recherche : Medplum, Terra UI, composants React du NHS, Carbon) ; l'approche retenue est celle des applications de santé : bibliothèque générale et composants cliniques par-dessus.

## 5. Réalisation
- Page d'acquisition : axes, grille, légende, message d'attente, bande de pression, mode démonstration.
- Page patient : graphique RMS par séance avec dates en français (l'API renvoie désormais la date de chaque mesure, changement de contrat), ligne de baseline, tableau de données accessible, liste des 10 dernières séances avec « Voir tout », virgule décimale française, spectrogramme avec axes en Hz et en secondes.
- Remplacement des graphiques dessinés à la main par des composants réutilisables ; zéro valeur de couleur en dur dans les graphiques et les fonctionnalités.

## 6. Vérification et résultats
| Vérification | Résultat | Source |
|---|---|---|
| Tests web | 138 passent, 0 échec | `pnpm --filter @dsfav/web test`, 2026-11-09 |
| Valeurs de couleur en dur dans graphiques et fonctionnalités | 100 avant, 0 après | recherche par expression régulière dans `src/` |
| Fichiers dessinant du SVG à la main | 16 avant l'audit | `docs/UI-AUDIT.md` |
| Captures | avant et après de la page patient et de la page d'acquisition | `docs/visual/screens/before-*.png`, `t17r1-patient.png`, `mid-capture-demo.png` |

## 7. Décisions et justifications
- Pas de refonte complète de l'interface : seules les parties graphiques et médicales changent.
- Aucune dépendance nouvelle sans accord : ECharts reste une option soumise au propriétaire.
- Les nouvelles couleurs viennent des jetons de conception, jamais du code.

## 8. Limites et points ouverts
Neuf défauts visuels résiduels (badges qui passent à la ligne, mini-courbes trop exagérées, axes qui chevauchent le signal sur la page d'acquisition) sont confiés à une tâche de finition. Les pages devices, notes, historiques, journal d'audit et utilisateurs n'ont pas encore été capturées une par une. Les données affichées sont synthétiques.

## 9. Ce qu'il faut retenir
- Des tests qui passent ne prouvent pas qu'un écran est correct : il faut regarder les captures.
- Installer une bibliothèque ne suffit pas : encore faut-il l'utiliser.
- Un graphique médical se juge à ses axes, ses unités et sa lecture sans la couleur seule.

## 10. Questions possibles du jury
- **Pourquoi pas une bibliothèque médicale dédiée ?** Aucune ne couvre un signal vibratoire avec baseline personnelle ; les applications de santé assemblent des composants généraux.
- **Les graphiques sont-ils fiables cliniquement ?** Ils affichent correctement des données synthétiques ; aucune conclusion clinique n'en découle.
- **Que se passe-t-il sans l'appareil ?** Le graphique reste affiché avec « En attente de l'appareil », et le mode démonstration joue une acquisition simulée.

## Références
`docs/UI-AUDIT.md` · `apps/web-nextjs/src/components/charts/` · `docs/visual/screens/` · `docs/DECISIONS.md` (D-010)
