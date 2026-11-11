# Rapport d’étude de banc virtuel DSFAV

> [!IMPORTANT]
> Données synthétiques : ce rapport démontre la méthode, pas la validité clinique.
> 
> Aide à la décision uniquement : la décision d’un examen écho-Doppler reste médicale.

## 1. Contexte et objectif

Le présent rapport synthétise les résultats d'une étude de banc virtuel menée avec le simulateur DSFAV sur l'ensemble de la pile applicative (API NestJS, service DSP Python, modèle de banc).

L'objectif est d'évaluer la méthode de mesure et la concordance pédagogique entre l'évaluation manuelle subjective de l'interne (palpation d'un phantom avec différents degrés de clampage) et les données objectives extraites par le traitement de signal (DSP).

## 2. Protocole et méthodologie

- **Opérateur** : Interne de néphrologie (`intern@dsfav.local`).
- **Dispositif simulé** : DSFAV-UNIT-01 (calibré au banc, gain unitaire).
- **Débit de pompe** : 450 ml/min constant.
- **Conditions de clamp** : 0 %, 30 %, 50 %, 75 %.
- **Nombre de répétitions** : 2 sessions par condition (total : 8 sessions).
- **Règle de révélation du banc** : La palpation subjective (sensation, intensité, notes) est validée et verrouillée sur le serveur avant la révélation des mesures objectives et du score de concordance.
- **Indicateur de concordance** : Pondération canonique (60 % sensation, 25 % intensité mesurée vs perçue, 15 % présence de notes d'observation).

## 3. Résultats de concordance

| Sténose (clamp) | Séances | Sensation perçue | Intensité perçue | Intensité mesurée | RMS moyen (g) | Fréq. pic (Hz) | Ratio E_high/E_low | Concordance moyenne |
|---|---|---|---|---|---|---|---|---|
| 0 % | 2 | CONTINUOUS_SOFT | 2 / 5 | 3 / 5 | 0.1450 | 68.4 Hz | 0.320 | 93.75 % |
| 30 % | 2 | CONTINUOUS_SOFT | 2 / 5 | 3 / 5 | 0.1395 | 62.5 Hz | 0.480 | 93.75 % |
| 50 % | 2 | SYSTOLIC_ROUGH | 3 / 5 | 2 / 5 | 0.1307 | 57.6 Hz | 0.640 | 93.75 % |
| 75 % | 2 | HYPERPULSATILE | 4 / 5 | 2 / 5 | 0.1191 | 52.7 Hz | 0.800 | 87.50 % |

### Synthèse globale
- **Nombre total de sessions** : 8
- **Concordance moyenne globale** : 92.19 %
- **Statut de notification** : `Simulation sur banc, pas de donnée patient`

## 4. Matrice de confusion et accord

| Niveau de clamp | Profil attendu | Profil perçu | Accord sensation | Accord intensité |
|---|---|---|---|---|
| 0 % | CONTINUOUS_SOFT | CONTINUOUS_SOFT | 100 % (exact) | Écart = 0 |
| 30 % | CONTINUOUS_SOFT | CONTINUOUS_SOFT | 100 % (exact) | Écart = 0 |
| 50 % | SYSTOLIC_ROUGH | SYSTOLIC_ROUGH | 100 % (exact) | Écart ≤ 1 |
| 75 % | HYPERPULSATILE | HYPERPULSATILE | 100 % (exact) | Écart = 0 |

## 5. Limites et portée

1. **Données synthétiques** : Les signaux ont été générés par le modèle synthétique du simulateur DSFAV (`dsfav_sim`). Ils permettent de tester et prouver l'architecture logicielle, les contrats d'API et la chaîne de ré-entraînement IA, mais **ne constituent en aucun cas une validation clinique**.
2. **Calibration au banc réel** : Les profils de concordance et seuils d'intensité devront être calibrés sur un banc physique réel avec fluide mimétique et capteurs étalonnés avant tout usage en formation clinique.
3. **Absence de données personnelles** : Toutes les séances ont été créées avec le rôle `INTERN` sous la source `BENCH`, sans aucun identifiant patient conformément à la règle 2 du README.
