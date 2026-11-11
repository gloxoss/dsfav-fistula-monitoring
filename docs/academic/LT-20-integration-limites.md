---
lot: LT-20
titre: Intégration, limites et suite
date: 2026-11-09
jalon: synthèse
statut: terminé (chiffres à jour au 2026-11-10)
---

# LT-20 · Intégration, limites et suite

## Résumé
Le projet est un système logiciel complet et testé pour un **appareil virtuel** : simulateur, API, traitement du signal, interface par rôle, banc de formation, synchronisation sans perte et couche d'IA explicable. Il n'est pas prêt pour le matériel réel ni pour un usage clinique : les composants ne sont pas commandés, les seuils ne sont pas étalonnés et toutes les données sont synthétiques (sources en §6).

## 1. Contexte et problématique
Après le jalon du 2026-11-07, un plan de 30 jours a été condensé en une journée de travail avec plusieurs agents : fermeture des lacunes de contrat, résilience hors ligne, droits et pages par rôle, écrans de flotte et de suivi, firmware, kit de banc, durcissement, IA explicable, graphiques médicaux.

## 2. Objectifs
Dire honnêtement où en est le projet, avec des chiffres vérifiables, ce qui est prouvé, ce qui ne l'est pas et la suite.

## 3. Démarche et méthode
Chaque tâche : test d'abord, revue indépendante, vérification par l'orchestrateur, commit. Quand les agents externes n'étaient plus disponibles, l'orchestrateur a assuré la revue avec l'accord explicite du propriétaire, et la note de chaque acceptation le dit.

## 4. Conception
Chaîne : simulateur ou appareil → API (WebSocket et envoi brut) → service de traitement du signal → base de données → interface web par rôle. Documentation : `docs/ARCHITECTURE.md`, `docs/GUIDE-PAGES.md`.

## 5. Réalisation
| Domaine | État |
|---|---|
| Contrat et données | 20 chemins, route des notes, champs de synchronisation, date de chaque mesure |
| Traitement du signal | règles G1 à G9, modèle de signal paramétrique, couche d'IA |
| Interface | rôles, accès, graphiques du signal et de la tendance, spectrogramme |
| Synchronisation | idempotente, sans perte, reprise après session expirée |
| Banc | formation, révélation côté serveur, kit d'étude |
| Matériel | squelette et liste de contrôle seulement |

## 6. Vérification et résultats
| Suite | Résultat | Commande, date |
|---|---|---|
| API (base de données neuve) | 144 passent, 8 ignorés, 23 suites | `pnpm --filter @dsfav/api test`, 2026-11-10 |
| Web | 147 passent, 24 fichiers | `pnpm --filter @dsfav/web test`, 2026-11-10 |
| Traitement du signal | 43 passent | `uv run pytest`, 2026-11-10 |
| Simulateur | 30 passent | `uv run pytest`, 2026-11-10 |
| Parcours de bout en bout | 19 passent (démonstration en 8 étapes, hors ligne, rôles, accessibilité, captures) | `pnpm e2e`, 2026-11-10 |
| Scripts de démonstration | 4 passent | `node --test scripts/demo`, 2026-11-10 |
| Firmware natif | trames, absence d’identifiants, tampon sans perte | `test/run-native.mjs`, 2026-11-10 |
| Contrat d’API | valide | `pnpm contract`, 2026-11-10 |

## 7. Décisions et justifications
Voir `docs/DECISIONS.md` (D-001 à D-013). Les plus structurantes : thresholds en configuration, pas de dépendance sans accord, modèles transparents, port 3101.

## 8. Limites et points ouverts
- **Aucune validité clinique** : données synthétiques, seuils par défaut.
- **Matériel** : non commandé, firmware jamais exécuté sur une carte.
- **Étude sur banc** : kit prêt, aucune donnée réelle.
- **Production** : pas de déploiement, pas de revue de sécurité externe, pas de limitation de débit.
- **Interface** : la page des appareils affiche « seuils indisponibles » car la configuration ne contient pas de seuils de batterie ni de gain ; des dates brutes apparaissent encore sur la page des notes.
- **Backlog** (`docs/BACKLOG.md`) : liste des éléments en échec de synchronisation non affichée, historique des versions de configuration et brouillons d'administration sans API, bande de dispersion de la baseline, avis IA dans l'historique du patient.

## 9. Ce qu'il faut retenir
- Le logiciel et sa méthode sont prêts ; la preuve médicale ne l'est pas.
- Chaque chiffre de ce dossier renvoie à une commande ou à un fichier.
- La suite dépend d'une action humaine : commander le matériel, réaliser l'étude sur banc.

## 10. Questions possibles du jury
- **Peut-on l'utiliser sur des patients ?** Non : aucune validation clinique, aucune certification.
- **Que reste-t-il avant un prototype réel ?** Commander les composants, mettre en service les capteurs, relier le firmware à la bibliothèque de trames, étalonner la pression.
- **Quand les seuils seront-ils fiables ?** Après l'étude sur banc, avec approbation du superviseur.

## Références
`docs/BACKLOG.md` · `docs/DECISIONS.md` · `docs/ARCHITECTURE.md` · `docs/GUIDE-PAGES.md` · `docs/PLAN-30-JOURS.md`
