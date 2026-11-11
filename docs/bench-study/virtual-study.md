# Étude de banc virtuel DSFAV

> [!IMPORTANT]
> **Données synthétiques : ce rapport démontre la méthode, pas la validité clinique.**
> 
> *Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.*

Ce guide décrit comment exécuter l'étude de banc virtuel DSFAV et ré-entraîner la couche d'apprentissage automatique explicable à partir des données de banc synthétiques.

---

## Exécution en 3 commandes

Assurez-vous que la pile locale DSFAV est active (API sur `http://localhost:3101`, service DSP sur `http://localhost:8010`).

### 1. Lancer l'étude de banc virtuel
Exécute la simulation des 4 niveaux de clamp (0 %, 30 %, 50 %, 75 %), valide les observations de palpation, effectue les captures simulées et génère le fichier de caractéristiques ainsi que le rapport de concordance :

```bash
node scripts/bench-study/run-virtual-study.mjs --sessions 5
```

- Produit le CSV : `apps/dsp-python/data/virtual-bench-features.csv`
- Produit le rapport : `docs/bench-study/virtual-study-report.md`

### 2. Ré-entraîner le modèle explicable
Entraîne la régression logistique déterministe (NumPy uniquement) à partir du jeu de données du banc virtuel et sauvegarde l'artefact versionné ainsi que ses métriques :

```bash
cd apps/dsp-python && uv run python scripts/train.py --csv data/virtual-bench-features.csv --output data/model.json
```

- Produit le modèle : `apps/dsp-python/data/model.json`
- Produit les métriques : `apps/dsp-python/data/model.metrics.json`

### 3. Valider le modèle contre le seuil d'acceptation
Vérifie que le modèle satisfait aux critères d'acceptation clinique minimaux (exactitude globale $\ge$ 80 %, exactitude par classe $\ge$ 70 %) :

```bash
cd apps/dsp-python && uv run python scripts/validate_model.py --model data/model.json --csv data/virtual-bench-features.csv --min-accuracy 0.80
```

---

## Paramètres optionnels

Le script `run-virtual-study.mjs` accepte les options suivantes :
- `--sessions <N>` : Nombre de répétitions par niveau de clamp (défaut : 5, soit 20 sessions au total).
- `--api <URL>` : URL de l'API locale (défaut : `http://localhost:3101`). *Refuse toute URL non-locale.*
- `--seed <N>` : Graine aléatoire pour la reproductibilité déterministe (défaut : 42).
- `--csv <chemin>` : Chemin de sortie du CSV de caractéristiques.
- `--report <chemin>` : Chemin de sortie du rapport Markdown de concordance.
