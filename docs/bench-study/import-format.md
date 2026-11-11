# Format d’import des résultats de banc

L’import prend un CSV UTF-8 séparé par des virgules. Les champs texte contenant une virgule doivent être entourés de guillemets doubles; un guillemet dans un champ est doublé. La première ligne contient les en-têtes.

## Colonnes obligatoires

`clamp_stenosis_pct,pump_flow_ml_min,perceived_thrill,perceived_intensity,measured_intensity_level`

`clamp_stenosis_pct` accepte `0`, `30`, `50` ou `75`; `pump_flow_ml_min` doit être strictement positif; `perceived_thrill` utilise un enum du protocole; l’intensité perçue et mesurée sont des entiers de 1 à 5. `intern_notes` est facultative et ne doit contenir que des observations sur le phantom.

Les en-têtes sont normalisés sans tenir compte des accents. Toute colonne identifiant une personne est refusée, notamment nom, prénom, CIN, naissance, téléphone, adresse, e-mail ou patient. Ne jamais ajouter de valeurs personnelles dans les cellules.

Le rapport indique le nombre de lignes, la moyenne et le détail de concordance. Il est marqué synthétique et réservé à l’évaluation du banc; il ne constitue pas une calibration clinique. Les résultats de mesure affichent le disclaimer DSFAV partagé par l’application.
