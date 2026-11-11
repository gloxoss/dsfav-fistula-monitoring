# DSFAV: Shared mock data (use in every prompt)

All screens must show **these** numbers so the generated pages tell one consistent story. Fictional, not clinical evidence. Decimal comma in French UI.

## Clinic and people
- Clinique: "Centre d'hémodialyse Casablanca (démonstration)". Date: mardi 3 novembre 2026, vacation du matin.
- Staff (initials + role only): "S.B. Infirmière", "Dr S.E.M. Néphrologue", "M.B. Interne".

## Patients (pseudonyms only)

| idPseudo | Fistule | Séances | Baseline | Dernière mesure | État |
|---|---|---|---|---|---|
| **PT-CAS-8841** | radio-céphalique gauche | 42 | ACTIVE | 03/11 07:52 | Évolution inhabituelle (2 séances de suite) |
| PT-CAS-7120 | brachio-céphalique droite | 31 | ACTIVE | 03/11 07:40 | Mesure correcte |
| PT-CAS-6603 | radio-céphalique droite | 2 | BUILDING (2/3) | 03/11 07:31 | Référence 2/3 |
| PT-CAS-9015 | brachio-basilique gauche | 18 | ACTIVE | 03/11 07:18 | Mesure à refaire (artéfacts) |
| PT-CAS-5530 | radio-céphalique gauche | 56 | ACTIVE | 01/11 | À confirmer |
| PT-CAS-9277 | brachio-céphalique gauche | 0 | none | none | Aucun historique |

## Hero patient PT-CAS-8841 (the one every detail screen shows)
- Baseline (verrouillée le 14/05/2026 après 3 mesures): RMS **0,145 g** (écart-type 0,018), rapport sténose **0,32** (0,05), fréquence dominante **68 Hz** (4 Hz).
- Dernière séance (03/11 07:52, DSFAV-UNIT-01, opératrice S.B.): RMS **0,089 g**, crête à crête 0,412 g, fréquence dominante **184 Hz**, énergie 20 à 80 Hz 0,41, énergie 100 à 350 Hz 0,59, rapport **1,44**, pression moyenne **4,6 kPa**, artéfacts **8,2 %**, durée propre **22,9 s** sur 25,0 s.
- Écart à la baseline: **3,8** (seuil 3,4). Séance précédente (31/10): 3,6. Avant: 1,1.
- Texte d'explication: "Par rapport à la référence : RMS −38 %, fréquence dominante de 68 Hz à 184 Hz, rapport haute/basse fréquence ×4,5. Deux séances de suite au-dessus du seuil."
- Historique RMS (g) sur 8 séances: 0,148 · 0,142 · 0,150 · 0,139 · 0,143 · 0,121 · 0,102 · 0,089. Rapport: 0,31 · 0,33 · 0,30 · 0,34 · 0,35 · 0,71 · 1,10 · 1,44.
- Note clinique existante: "Dr S.E.M., 02/11 09:14 : à revoir à la prochaine séance."

## Flotte

| Série | MAC (fin) | Wi-Fi | Batterie | Dernier contact | Firmware | Écart de gain | File locale |
|---|---|---|---|---|---|---|---|
| DSFAV-UNIT-01 | …A4:1F | En ligne | 86 % | il y a 12 s | 1.3.2 | +0,8 % | 0 |
| DSFAV-UNIT-02 | …7C:09 | Synchronisation en cours | 64 % | il y a 40 s | 1.3.2 | −1,1 % | 2 |
| DSFAV-UNIT-03 | …E2:5B | En attente hors ligne | 78 % | il y a 26 min | 1.3.1 | +2,4 % | 3 |
| DSFAV-UNIT-04 | …19:D0 | En ligne | **12 %** (sous le seuil de blocage 15 %) | il y a 5 s | 1.3.2 | **+3,9 %** (hors tolérance 3 %) | 0 |

- Jour: 68 mesures réalisées, durée moyenne 25 s, 3 patients "Évolution inhabituelle" ou "À confirmer", 2 mesures à refaire.
- Continuité PT-CAS-8841: lundi 02/11 mesuré par UNIT-01, mercredi 28/10 par UNIT-03, rapprochement de baseline automatique effectué.

## Banc d'entraînement (simulation; présélections reprises du fichier source)

| Rétrécissement | RMS | Pic FFT | Rapport HF/BF | Sensation attendue (à valider) |
|---|---|---|---|---|
| 0 % | 0,152 g | 62 Hz | 0,28 | Thrill continu doux |
| 30 % | 0,138 g | 115 Hz | 0,64 | Léger frémissement systolique |
| **50 %** | **0,094 g** | **178 Hz** | **1,42** | Renforcement systolique rugueux |
| 75 % | 0,041 g | 245 Hz | 2,15 | Thrill très faible / hyperpulsatile |

- Interne M.B., banc pompe péristaltique n°02, débit **450 mL/min**, rétrécissement **50 %**.
- Palpation notée: "Renforcement systolique rugueux", intensité 4/5.
- Concordance: **92 %** (catégorie 55/60, intensité 22/25, note 15/15). Libellé: "Indicateur pédagogique".
- Explication: à 50 %, la vitesse du jet augmente (effet Venturi), le nombre de Reynolds monte, l'énergie passe vers la bande 100 à 350 Hz (pic à 178 Hz).

## Configuration active (v7)
Publiée par Dr S.E.M. le 28/10/2026 14:05. ADXL355 1000 Hz, LIS2DW12 200 Hz, filtre 15 à 450 Hz, artefact 0,08 g RMS, durée propre minimale 12 s, appui reco 3,0 à 8,5 kPa (toléré 2,5 à 9,0), seuil 3,4, persistance 2 séances, batterie avertissement 20 %, blocage 15 %, tolérance de gain 3 %.
