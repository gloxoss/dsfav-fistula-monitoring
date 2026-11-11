# Script vidéo de démonstration · DSFAV

Durée cible : 3 minutes. Les étapes ci-dessous suivent les huit scénarios couverts par `e2e/tests/demo.spec.ts`; le minutage proposé est un découpage de tournage, pas un résultat mesuré.

## Préparation de l’enregistrement

- Lancer la pile de démonstration selon `README.md` et confirmer les services avant l’enregistrement.
- Préparer le compte seedé infirmier et le patient pseudonymisé utilisé par les fixtures e2e (`e2e/tests/demo.spec.ts`). Ne pas filmer de vraies données patient.
- Ouvrir l’interface en français, vérifier que l’avertissement canonique est visible sur l’écran de mesure (`apps/web-nextjs/src/libs/clinical/disclaimer.ts`).
- Démarrer le simulateur depuis `scripts/simulator/`; identifier explicitement les valeurs comme synthétiques.
- Enregistrer une capture d’écran sans jeton, mot de passe ni identifiant personnel.

## Déroulé en huit étapes

| Temps indicatif | Action et narration | Preuve attendue |
|---|---|---|
| 0:00–0:20 | **Connexion et données seedées.** « Je me connecte avec un rôle de démonstration; le patient est représenté par un identifiant pseudonyme. » | Liste de patients accessible au rôle infirmier (`e2e/tests/demo.spec.ts`, étape 1). |
| 0:20–0:40 | **Capture normale simulée.** « Le simulateur envoie un scénario contrôlé vers l’API. » | Téléversement accepté par le serveur (`e2e/tests/demo.spec.ts`, étape 2). |
| 0:40–1:00 | **Pression basse puis reprise.** « La pression hors plage est signalée; une nouvelle capture normale est ensuite envoyée. » | État de rejet puis scénario normal (`e2e/tests/demo.spec.ts`, étape 3; seuils de pression : règle 3 du README). |
| 1:00–1:20 | **Mouvement bref.** « Un artefact court laisse suffisamment de signal exploitable dans ce scénario de test. » | Capture acceptée (`e2e/tests/demo.spec.ts`, étape 4). |
| 1:20–1:40 | **Mouvement important.** « Le scénario chargé en mouvement est rejeté pour qualité. » | Motif ARTIFACT ou statut de rejet (`e2e/tests/demo.spec.ts`, étape 5). |
| 1:40–2:00 | **Évolution simulée.** « Deux captures synthétiques illustrent l’état de confirmation ou d’évolution; ce n’est pas une preuve clinique. » | Statut de confirmation/évolution dans la réponse (`e2e/tests/demo.spec.ts`, étape 6). |
| 2:00–2:30 | **Historique et banc.** « Le néphrologue consulte l’historique et l’avertissement. Le banc révèle les résultats après la palpation. » | Historique et avertissement visibles; test de banc séparé (`e2e/tests/demo.spec.ts`, étape 7; `e2e/tests/bench.spec.ts`). |
| 2:30–3:00 | **Coupure de connexion et limites.** « La démonstration arrête le scénario avant le téléversement brut. La reprise depuis une file reste à démontrer. » | Événement de coupure, aucun téléversement brut dans ce test (`e2e/tests/demo.spec.ts`, étape 8; `docs/BACKLOG.md`). |

## Fin de vidéo

Afficher l’avertissement canonique depuis `apps/web-nextjs/src/libs/clinical/disclaimer.ts:2-3`, puis conclure : « Les tests synthétiques vérifient le logiciel; ils ne démontrent ni diagnostic ni efficacité clinique » (règle 10 du README).

## Liste de contrôle de tournage

- [ ] Les quatre services de démonstration répondent, sans redémarrer le conteneur partagé.
- [ ] Tous les comptes et données affichés sont seedés et pseudonymisés (`e2e/tests/demo.spec.ts`; règle 2 du README).
- [ ] L’avertissement visible est identique à la constante canonique (`apps/web-nextjs/src/libs/clinical/disclaimer.ts`).
- [ ] La vidéo nomme chaque mesure simulée comme synthétique (règle 10 du README).
- [ ] Aucun mot de passe, jeton ou donnée personnelle n’apparaît à l’écran (règles 2 et « aucun secret » du README).
- [ ] La coupure réseau n’est pas décrite comme preuve de reprise ou de synchronisation sans perte (`e2e/tests/demo.spec.ts`).
- [ ] Le fichier vidéo et les captures restent locaux; aucun déploiement ou téléversement (le projet ne se déploie pas depuis cette copie).
