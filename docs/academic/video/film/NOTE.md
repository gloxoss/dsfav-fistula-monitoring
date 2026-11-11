# NOTE · film de présentation DSFAV (40,8 s, 1920 x 1080, 30 i/s, sans son)

## L'idée, et pourquoi
**Un anneau de capteur traverse tout le produit.** Il se pose sur la fistule dessinée, devient le repère de la jauge de pression, puis réapparaît sur le schéma interactif. C'est le détail signature de l'interface (`fistula-map.tsx`, anneau du site du capteur) : sans le nom, le film ne servirait aucun autre produit. Le film est un documentaire d'écran d'**une seule mesure** : placer, contrôler, lire, comparer. Alternatives écartées : un essai typographique sur « aide à la décision » (aucune preuve à l'écran) et une démonstration en huit étapes (déjà dans `script-demo.md`, trop longue pour un film de soutenance).

## Les plans et ce que chacun fait croire
| Plan | Image | Ce que le spectateur croit |
|---|---|---|
| 1 Accroche (0 à 5 s) | Schéma de la fistule, anneau qui arrive en grand format et se pose | Un capteur tenu à la main mesure le thrill à la fistule |
| 2 Preuve (5 à 13 s) | Vraie carte « Appui sur la FAV », anneau autour du repère, zone 3,0 à 8,5 kPa | La mesure ne démarre que si l'appui est bon |
| 3 Preuve (13 à 22 s) | Vraie courbe en direct, bande violette de mouvement | Les secondes agitées ne comptent pas, moins de 12 s propres = mesure refaite |
| 4 Preuve (22 à 31,3 s) | Vrai schéma interactif, curseur qui clique deux zones | L'écran est un outil qui répond, chaque zone se lit contre la référence |
| 5 Tournant (31,3 à 37,3 s) | Vraies tuiles de la file, zoom sur « Référence en cours » | L'outil se tait tant qu'il ne peut pas comparer (aucune alerte avant 3 mesures valides) |
| 6 Fin (37,3 à 40,8 s) | Avertissement officiel, mot à mot | La décision d'examen reste médicale |

## Réel, illustratif, généré
- **Réel :** toutes les images d'interface sont des captures de l'application en marche (captures à l’échelle 2,5, démo « Données simulées »). Textes et chiffres sont ceux de l'écran.
- **Illustratif :** le schéma d'ouverture reprend la géométrie de `fistula-map.tsx`, redessinée en SVG. Le curseur est animé (le clic réel donne les captures des états).
- **Généré :** aucune image générée, aucun son.
- **Avertissement :** repris de `apps/web-nextjs/src/libs/clinical/disclaimer.ts`. La règle du projet (règle 1 du README) l'impose sur chaque écran de mesure.

## Portes (calculées sur `final.mp4`)
| Porte | Résultat | Source |
|---|---|---|
| G0 rendu | PASS, durée 40,80 s = attendue 40,80 s, audio aucun (non requis) | `look.py` |
| G2 pas d'image vide | PASS, aucune série de plus de 3 images plates | `look.py` |
| G3 fin courte | PASS, maintien final 1,17 s (0,6 à 1,4), dernier plan 3,47 s = 8 % du film | `look.py --hold-warn 1.4` |
| G5 pas de chrome de page | PASS | `lint.mjs` |
| G1 preuve lisible | par l'œil sur `look-final/sheet.jpg` : fragments d'interface de 0,57 à 0,89 de la largeur, texte lisible | non scripté |
| G4 un héros par image | par l'œil : une carte ou un schéma par image, l'anneau seul comme second élément | non scripté |

## Descriptions image par image (planche `look-final/sheet.jpg`)
1 et 2 : schéma de bras sur fond clair, anneau teal sur la veine, légende qui monte. 3 à 5 : carte de pression agrandie, anneau concentrique au repère, légendes « Appui entre 3,0 et 8,5 kPa » puis « Hors plage, le départ est bloqué ». 6 à 9 : courbe du thrill découverte de gauche à droite, bande violette, trois légendes successives. 10 à 12 : carte de la fistule, curseur qui clique « Veine de drainage » puis « Site du capteur », panneau qui change. 13 à 15 : bande de tuiles, zoom sur « Référence en cours », légende puis « Données simulées. Prototype universitaire. » 16 : fond nuit, anneau, avertissement en deux lignes.

## Ce que je ferais encore
- **Pas de son ni de voix** : aucune clé ElevenLabs sur cette machine (`providers.sh`). Une voix off en français et quelques sons de contact sont à ajouter, la timeline (`window.__events`) donne les instants.
- **Mouvement faible** : variation moyenne 0,4/255 contre 6,8 chez les films de référence, et le plan 2 est quasi fixe 4,4 s. Choix calme volontaire pour un public de jury, à discuter.
- **Police** : Inter (fournie par le moteur) à la place de la police de l'application.
- **Aucune étape de revue humaine** : la vidéo n'a pas été relue par le propriétaire ; l'approbation du rythme reste à faire.
- Les données affichées sont simulées : le film ne montre aucun résultat clinique.

