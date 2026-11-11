# DSFAV

Dispositif de suivi de la fistule artério-veineuse (FAV) : un capteur portable mesure la vibration (« thrill ») de la fistule d'un patient dialysé, le signal est contrôlé en qualité puis comparé à la référence personnelle du patient. **Outil d'aide à la décision, jamais un diagnostic.** Les patients n'existent que sous un pseudonyme et toutes les données actuelles sont synthétiques (appareil virtuel).

> Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.

## Contenu du dépôt

| Dossier | Rôle |
|---|---|
| `apps/web-nextjs/` | Application web (Next.js 16) : infirmier, néphrologue, interne, administrateur |
| `apps/api-nestjs/` | API NestJS, Prisma + PostgreSQL, droits par rôle, synchronisation, banc de formation |
| `apps/dsp-python/` | Traitement du signal (Python, FastAPI) et couche d'IA explicable |
| `packages/shared-types/` | Contrat d'API (`openapi.yaml`) et types TypeScript générés à partir de lui |
| `firmware/esp32c3-dsfav/` | Squelette du firmware ESP32-C3 (testé sur PC, jamais exécuté sur une carte) |
| `scripts/simulator/` | Appareil virtuel (même protocole que le firmware) |
| `scripts/demo/`, `scripts/bench-study/` | Données de démonstration, kit d'étude sur banc |
| `e2e/` | Tests de bout en bout (Playwright) |
| `docs/academic/` | **Dossier technique** : sommaire, lots LT-01 à LT-21, annexe sur les preuves, PDF, affiche et film |

## Prérequis

Node 24 (voir `.nvmrc`), pnpm, Docker, Python géré par `uv` (la commande `python` seule peut être l'alias du Microsoft Store sous Windows).

## Lancer en local

```bash
pnpm install
cp .env.example .env                                   # remplacer les valeurs par défaut
cp apps/api-nestjs/.env.example apps/api-nestjs/.env   # DATABASE_URL, JWT_SECRET
cp apps/web-nextjs/.env.example apps/web-nextjs/.env.local   # ajouter JWT_SECRET=dev-only-local
pnpm contract                                          # génère packages/shared-types/src/generated
pnpm --filter @dsfav/api exec prisma generate              # génère le client Prisma (lit apps/api-nestjs/.env)
docker compose up -d postgres                          # PostgreSQL sur le port 5433
pnpm demo:up                                           # migrations, graine, services (DSP 8010, API 3101, web 3000)
```

Si le port 3000 est occupé, lancer le web sur un autre port : `cd apps/web-nextjs && pnpm exec next dev -p 3300`.

Comptes de démonstration (mot de passe `demo1234`) : `nurse@`, `nephro@`, `intern@`, `admin@` suivis de `dsfav.local`.

Appareil virtuel et jeu de données :

```bash
pnpm demo:reset -- --yes        # remet la base de démonstration à zéro et la remplit
uv run --project scripts/simulator dsfav-sim --help
```

## Tests

```bash
pnpm -r typecheck && pnpm -r lint
pnpm --filter @dsfav/web test        # interface
pnpm --filter @dsfav/api test        # API (base PostgreSQL requise)
(cd apps/dsp-python && uv run pytest)
pnpm e2e                             # bout en bout, pile lancée
```

Les tests portent des étiquettes (`[UC1]`…`[UC13]`, `[G1]`…`[G9]`, `[DISCLAIMER]`, `[NO-LOSS]`, `[PSEUDO-SCAN]`, `[AUTHZ-MATRIX]`) qui renvoient aux cas d'utilisation du dossier technique.

## Règles à respecter (extraites du cahier des charges)

1. **Un seul avertissement**, mot à mot, sur chaque écran, PDF et réponse d'API qui montre une mesure : *Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.* Il se trouve dans une constante unique (`apps/web-nextjs/src/libs/clinical/disclaimer.ts`), à importer et non à recopier.
2. **Aucune donnée personnelle** : un patient n'est qu'un `idPseudo`. Ni nom, ni date de naissance, ni téléphone, ni adresse, nulle part (schéma, API, journaux, jeux de test).
3. **Appui (kPa)** : sous 2,5 bloqué, 2,5 à 3,0 ambre, 3,0 à 8,5 vert, 8,5 à 9,0 ambre, au-dessus de 9,0 bloqué. Appui valide et stable pendant 1,0 s avant le départ.
4. **Qualité** : une seconde est écartée si le mouvement dépasse 0,08 g ; moins de 12 s propres, la mesure est refusée (`REJECTED_QUALITY`) ; 3 tentatives de repositionnement au plus.
5. **Référence** : construite sur les 3 premières mesures valides, puis verrouillée. **Aucune alerte** pendant `BASELINE_BUILDING`. Seul un néphrologue la recalcule, avec un motif et un événement d'audit.
6. **Les seuils sont de la configuration**, pas des constantes. Les valeurs par défaut sont « à calibrer au banc ».
7. **Statuts** (vocabulaire fixe) : `NORMAL`, `TO_CONFIRM`, `UNUSUAL_EVOLUTION`, `REJECTED_QUALITY`, `BASELINE_BUILDING`.
8. **Ne jamais perdre une séance** : les données non synchronisées ne sont jamais écrasées, la synchronisation est idempotente.
9. **Banc de formation** : aucune donnée objective avant l'enregistrement de la réponse de palpation (appliqué côté serveur).
10. **Aucune conclusion clinique à partir de données synthétiques.**

Pratique : tests d'abord, contrat d'API et schéma de base modifiés ensemble, textes d'interface en français, Python via `uv`, aucun secret dans les fichiers versionnés (seulement des `.env.example`).

## Dossier technique (partie académique)

`docs/academic/00-sommaire.md` donne le plan. Les PDF sont dans `docs/academic/pdf/` (dossier complet : `DSFAV-dossier-technique-complet.pdf`), l'affiche dans `docs/academic/poster/`, le film dans `docs/academic/video/`. Le film est fourni déjà rendu. Les PDF sont fournis déjà générés. Certains lots citent des fichiers du dépôt d'origine qui ne figurent pas dans cette copie (environnement de travail, plans, spécifications de pré-développement, outils de génération) : ces renvois décrivent la démarche suivie.

## État

Logiciel complet pour l'appareil virtuel. Matériel : composants non commandés, firmware jamais exécuté sur une carte. Validité clinique : non établie ; les seuils sont des valeurs par défaut à calibrer lors d'une étude sur banc.
