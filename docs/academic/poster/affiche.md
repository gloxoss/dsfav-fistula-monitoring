# DSFAV · affiche A2, version texte

L'affiche finale est `affiche-dsfav.pdf` (et `affiche-dsfav.png`), dont la source est `affiche.html`. Ce fichier donne le texte, avec la source de chaque chiffre.

## En-tête
**DSFAV** · Mesurer et documenter le thrill d'une fistule artério-veineuse, sans comprimer la fistule. Prototype d'aide à la décision pour l'équipe de dialyse. Encadrement : Pr. ZAZ (`docs/academic/00-sommaire.md`). La ligne des auteurs est à ajouter dans `affiche.html` (élément `#authors`, masqué tant qu'il est vide).

## Message
Un capteur sur la fistule, 25 secondes de signal, une trace comparable d'une séance à l'autre. Données simulées, appareil virtuel.

## Trois étapes
1. **Placer** : zone cible 3,0 à 8,5 kPa; départ bloqué sous 2,5 et au-dessus de 9,0 kPa; appui stable de 1,0 s requis (règle 3 du README).
2. **Mesurer** : mesure de 25 s; mouvement au-dessus de 0,08 g sur 1 s écarté; moins de 12 s propres, mesure refaite (règle 4 du README).
3. **Comparer** : référence = 3 premières mesures valides, puis verrouillée; aucune alerte pendant sa construction (règle 5 du README).

## Chaîne et rôles
Appareil (ESP32-C3, simulé) → API NestJS → traitement du signal Python → PostgreSQL → interface Next.js. Quatre rôles : infirmier, néphrologue, interne, administrateur. Patients identifiés par un pseudonyme seulement (règle 2 du README).

## Vérifié (tests logiciels, données synthétiques)
| Suite | Résultat | Source |
|---|---|---|
| Interface web | 186 | LT-21 §6, `pnpm exec vitest run`, 10/11/2026 |
| API | 145 | LT-20 §6 et LT-21 §6 |
| Traitement du signal | 43 | LT-20 §6 |
| Simulateur | 30 | LT-20 §6 |
| Parcours de bout en bout | 19 | LT-20 §6 |

## Limites
Les résultats synthétiques prouvent le calcul, pas la médecine. Seuils par défaut « à calibrer au banc ». Matériel non commandé, firmware non testé sur carte. Aucune validation clinique ni étude sur patients (LT-20 §8, `docs/academic/ce-qui-est-prouve.md`).

## Avertissement (pied de page)
Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale. (`apps/web-nextjs/src/libs/clinical/disclaimer.ts`)
