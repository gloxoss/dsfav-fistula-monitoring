# Ce qui est prouvé, et ce qui ne l’est pas

## Prouvé par les tests logiciels
- Des cas synthétiques ciblés vérifient le calcul DSP et ses portes qualité; le compte rendu rapporte 25 tests réussis (journal du hub, T-s04; `apps/dsp-python/tests/`).
- Des tests web vérifient les états affichés, les routes et les composants; un run final rapporte 98 tests réussis (journal du hub, T-s20).
- La démonstration Playwright relie les services sur la pile active; le run rapporté a dix tests réussis (journal du hub, T-s14).
- Après la refonte des écrans (LT-21), la suite web rapporte 186 tests réussis sur 32 fichiers, avec types et lint sans erreur (`pnpm exec vitest run` dans `apps/web-nextjs`, 2026-11-10); les défauts visuels sont vérifiés par captures dans un navigateur et non par les seuls tests (LT-21 §5).
- Le serveur protège la révélation du banc et une logique de concordance est testée (`apps/api-nestjs/src/modules/bench/`; journal du hub, T-s12).

## Limites de preuve
- Les tests DSP et les scénarios de démonstration utilisent des données synthétiques. Ils prouvent le comportement des calculs dans les cas construits, pas une valeur clinique (AGENTS.md, §4 règle 10; `pre-dev/10-build-plan.md`, §1 principe 4).
- Les valeurs de profils et seuils de banc sont des placeholders à calibrer (`apps/api-nestjs/src/modules/bench/bench.constants.ts`).
- Plusieurs tests d’intégration API n’ont pas démarré dans les runs des builders parce que Jest ne résolvait pas `@prisma/adapter-pg` (journal du hub, T-s07, T-s11, T-s12, T-s19).
- Le test de coupure du simulateur ne prouve pas la mise en file puis la reprise du téléversement (`e2e/tests/demo.spec.ts`; `docs/BACKLOG.md`).

- Les valeurs de la page Appareils (batterie, gain, dernière synchronisation, éléments en échec) viennent du jeu de départ et de tests négatifs; la page n'est pas en temps réel (LT-21 §8; `apps/api-nestjs/prisma/seed.ts:78-81`).

## Critères avant toute conclusion clinique
Une étude sur banc avec matériel mesuré doit calibrer les seuils; la spécification indique que les valeurs ouvertes sont des valeurs par défaut à calibrer au jalon M9 (`pre-dev/10-build-plan.md`, §1 principe 6; §3 M9). Toute décision d’examen reste médicale (AGENTS.md, §4 règle 1).
