---
lot: LT-07
titre: Système de design et génération des interfaces
date: 2026-11-07
jalon: M0 / M5
statut: en cours
---

# LT-07 · Système de design et génération des interfaces

## Résumé
Les 8 écrans de DSFAV sont décrits par un système de design et des prompts de génération qui couvrent **8 écrans, 56 états et 4 visuels**, soit 68 prompts (`artifacts/dsfav-ui-previews/manifest.json`). Une première génération (v4) était fidèle au contenu mais trop dense ; à partir de deux références choisies par le porteur du projet, le langage visuel a été refondu (« Soft Bento », v5) sans modifier aucune règle clinique (D-006).

## 1. Contexte et problématique
L'écran d'acquisition est utilisé debout au fauteuil de dialyse, sur tablette. L'information doit être lisible en quelques secondes et la preuve (signal, qualité) doit précéder l'interprétation (`PRODUCT.md`, principes de design).

## 2. Objectifs
Des maquettes cohérentes entre écrans, conformes aux règles cliniques (zones de pression, mention légale, statuts), et proches du style visuel attendu.

## 3. Démarche et méthode
1. Système de design (couleurs, typographie, grille, composants, mouvements, accessibilité) puis données fictives partagées (`artifacts/DSFAV_FIXTURE.md`) pour que tous les écrans affichent les mêmes chiffres.
2. Un bloc commun + un prompt par écran + un prompt par état (pression basse, compression, rejet, hors ligne, baseline en construction…).
3. Génération, comparaison avec les références, correction du système puis des prompts.
4. Générateur de galerie (`tools/previews/generateDsfavPreviews.ts`) : en mode par défaut, il n'appelle aucun service payant ; la génération réelle exige l'option `--run` et une clé lue dans l'environnement.

## 4. Conception
Avant (v4, sortie réelle) :

![Sortie v4](../../artifacts/design-references/00-current-output-capture-v4.png)

Références cibles : `artifacts/design-references/01-target-medicare-teal-bento.png` et `02-target-medkit-soft-pills.png`.

## 5. Réalisation
- `artifacts/DSFAV_DESIGN.md` v4 « Soft Bento » : fond gris doux, cartes blanches sans bordure (rayon 28 px), grands chiffres légers avec unité grise, pastilles d'icônes, histogrammes en pilules avec barres de référence hachurées, navigation latérale avec pilule sarcelle, une seule carte sombre par écran, avant-bras 3D avec annotations.
- `artifacts/DSFAV_GENERATION_PROMPTS_V5.md` : prompts réécrits, mêmes contenus et états.
- Galerie : `artifacts/dsfav-ui-previews/index.html` (68 cartes, aucune requête réseau).

## 6. Vérification et résultats
| Vérification | Résultat | Source |
|---|---|---|
| Prompts analysés | 8 écrans, 56 états, 4 visuels | sortie du générateur, 2026-11-07 |
| Secrets dans les fichiers du générateur | aucun | recherche du 2026-11-07 |
| Comparaison v4 / références | v4 : bordures, chiffres à chasse fixe, oscilloscope quadrillé, rangées de 4 valeurs | analyse des captures |
| Génération v5 | non mesurée (à générer) | n/a |

## 7. Décisions et justifications
D-006 : le style cible choisi par le porteur du projet prévaut sur l'ancienne liste d'« anti-références » de `PRODUCT.md`, qui a été mise à jour. Restent interdits : photos de visages, noms de patients, cartes commerciales, scores non justifiés. Le contenu clinique (chiffres, états, mention légale) est inchangé.

## 8. Limites et points ouverts
Les maquettes v5 restent à générer et à comparer aux références. Les maquettes ne sont pas l'application : les écrans réels seront construits au jalon M5 et testés (accessibilité WCAG 2.2 AA, lecture à 200 %).

## 9. Ce qu'il faut retenir
- Un système de design est un ensemble de règles, pas une image.
- On change le style sans toucher aux règles cliniques.
- La preuve (signal, qualité) apparaît avant l'interprétation.

## 10. Questions possibles du jury
- **Pourquoi des états séparés ?** Les cas d'erreur (appui insuffisant, compression, mouvement, hors ligne) sont ceux où l'interface protège le patient ; ils doivent être conçus, pas improvisés.
- **Comment éviter qu'une couleur seule porte une information ?** Chaque statut combine icône, mot et teinte (WCAG).

## Références
`PRODUCT.md` · `artifacts/DSFAV_DESIGN.md` · `artifacts/DSFAV_GENERATION_PROMPTS_V5.md` · `docs/DECISIONS.md` D-006
