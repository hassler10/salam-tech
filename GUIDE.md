# SALAM LIBRARY PRO — Guide d'installation et d'utilisation

Bibliothèque de la Mosquée Salam du Plateau — Abidjan, Côte d'Ivoire.

> **Aucun module de paiement, de caisse, de recettes ou de comptabilité n'est inclus.**
> L'application ne gère que les personnes, les visites et les **durées** d'abonnement.

## 1. Installation

```bash
npm install
# Variables requises dans .env
# DATABASE_URL=postgresql://user:pass@host:5432/base
# SEED_ADMIN_PASSWORD=mot-de-passe-prive-de-12-caracteres-minimum
# SEED_MANAGER_PASSWORD=mot-de-passe-prive-de-12-caracteres-minimum
# SEED_AGENT_PASSWORD=mot-de-passe-prive-de-12-caracteres-minimum
npx drizzle-kit push      # crée les tables
npm run build && npm start
```

Au premier démarrage, l'application crée automatiquement :

- les comptes initiaux,
- les 4 types d'abonnement (1, 3, 6, 12 mois) — modifiables,
- les 6 motifs de visite,
- les paramètres par défaut (seuils d'alerte 7 / 3 jours).

### Comptes initiaux

Les trois comptes initiaux sont créés avec les mots de passe privés définis par les variables
`SEED_ADMIN_PASSWORD`, `SEED_MANAGER_PASSWORD` et `SEED_AGENT_PASSWORD` dans l'environnement.
Chaque mot de passe doit contenir au moins 12 caractères. Ces variables ne servent qu'à créer
les comptes lorsque la table des utilisateurs est vide.

Ne publiez pas ces valeurs et ne les ajoutez pas au dépôt. Le formulaire de connexion applique
également une limite de 10 tentatives par adresse IP sur 15 minutes.

## 2. Rôles et autorisations

| Fonction | Admin | Responsable | Agent |
|---|---|---|---|
| Enregistrer une visite | ✅ | ✅ | ✅ |
| Abonnés / visiteurs | ✅ | ✅ | ✅ |
| Statistiques & rapports | ✅ | ✅ | ❌ |
| Types et durées | ✅ | ❌ | ❌ |
| Utilisateurs, audit, paramètres | ✅ | ❌ | ❌ |

Les contrôles sont appliqués **côté serveur** (API) et côté navigation.

## 3. Utilisation quotidienne

1. **Accueil et fréquentation** : choisir « Visite d'un abonné » ou « Visite d'un visiteur »,
   rechercher la personne (ou saisir le nom pour un visiteur), choisir le motif, valider.
   Un message de confirmation s'affiche. Une fenêtre anti-doublon (30 min par défaut) empêche
   les enregistrements accidentels répétés.
2. **Gestion des abonnés** : création, recherche, filtres par statut, fiche individuelle,
   renouvellement, carte avec QR code, impression.
3. **Suivi des abonnements** : classement par statut (actif / proche / imminent / expiré)
   avec jours restants. Seuils configurables dans *Paramètres*.
4. **Rapports** : exports CSV (UTF-8 BOM, séparateur `;` → ouverture directe dans Excel),
   impression/PDF via le navigateur avec logo et en-tête.

## 4. Calcul des dates d'expiration

`date de fin = date de début + durée (mois) − 1 jour` (période inclusive).
Exemple : 3 mois à partir du 1er octobre → fin le 31 décembre.
Les débordements de calendrier (31 janvier + 1 mois) sont ramenés au dernier jour du mois.

## 5. Mode hors connexion (PWA)

- Service Worker (`public/sw.js`) + IndexedDB (`src/lib/offline.ts`).
- Les abonnés et visiteurs sont mis en cache local pour la recherche hors ligne.
- Chaque visite hors ligne reçoit un **identifiant unique (UUID)** et est stockée en file d'attente.
- Un bandeau « Hors connexion » et le nombre d'opérations en attente sont affichés en permanence.
- Au retour d'Internet, la synchronisation est automatique : la **date et l'heure d'origine**
  sont conservées, les doublons sont détectés par UUID côté serveur, les échecs restent
  visibles dans le *Centre de synchronisation* et peuvent être réessayés.

Limitation signalée : la synchronisation s'effectue à l'ouverture de l'application ou au
retour de la connexion (pas de Background Sync natif).

Les créations, modifications et mises à la corbeille dans Media Salam peuvent aussi déclencher
une notification webhook signée vers Salam Library. Elle synchronise seulement la fiche concernée;
les imports groupés et les purges demandent une synchronisation complète. Cette fonction nécessite
`MEDIA_SALAM_WEBHOOK_SECRET` côté Salam Library et le même secret dans `SALAM_LIBRARY_WEBHOOK_SECRET`
côté Media Salam. La synchronisation planifiée demeure le mécanisme de secours.

## 6. Sécurité

- Mots de passe hachés (scrypt + sel), sessions en base avec expiration (12 h).
- Cookie `httpOnly`, `sameSite=lax`, `secure` en production.
- Validation serveur de toutes les entrées, requêtes paramétrées (Drizzle ORM).
- Journal d'audit des opérations sensibles.
- Collecte minimale de données personnelles (nom, prénoms, contact facultatif).

### Comptes et accès institutionnels

Les comptes Vercel, Neon et GitHub qui contrôlent la production doivent appartenir à l'institution,
avec au moins deux responsables désignés et des droits limités selon les fonctions. Activer la
double authentification sur ces comptes fournisseurs lorsqu'elle est disponible; ne pas partager
les mots de passe ni les jetons personnels. Cette mesure protège les consoles d'hébergement et le
code; elle n'ajoute pas une double authentification aux comptes de Salam Library eux-mêmes.

### Sauvegarde / restauration

Pour la base de production Neon, activer les snapshots automatiques quotidiens dans le projet
Neon (**Backup & Restore / Snapshots**). Vérifier la disponibilité et le coût selon le forfait
choisi. Une fois par trimestre, restaurer un snapshot dans une branche séparée et vérifier que
l'application peut se connecter avant de définir une procédure de bascule. Ne pas restaurer
directement sur la branche de production sans validation de l'administrateur.

Cette protection doit être configurée séparément pour chaque base de production (Salam Library
et Media Salam si elles sont dans deux projets Neon). Les snapshots dans Neon ne remplacent pas
une copie chiffrée indépendante si l'administration exige une sauvegarde hors fournisseur.

```bash
pg_dump --format=custom --no-owner "$DATABASE_URL" --file="sauvegarde_$(date +%F).dump"
# Restaurer uniquement dans une base ou branche de récupération isolée :
pg_restore --no-owner --dbname="$DATABASE_URL_RECUPERATION" sauvegarde_2026-01-01.dump
```

## 7. Base de données

`users`, `sessions`, `subscribers`, `subscription_types`, `subscription_periods`,
`visitors`, `visits`, `visit_reasons`, `audit_logs`, `settings`.

Les personnes, les visites et les périodes d'abonnement sont des entités séparées :
un abonné peut avoir plusieurs périodes successives (toutes consultables) et plusieurs visites.
**Aucune table financière n'existe.**

## 8. Résultats des tests

| # | Test | Résultat |
|---|---|---|
| 1 | Création d'un abonné (identifiant auto `AB-AAAA-NNNN`) | OK |
| 2 | Plusieurs durées d'abonnement (1/3/6/12 mois) | OK |
| 3 | Calcul automatique de la date d'expiration | OK |
| 4 | Affichage des jours restants | OK |
| 5 | Détection d'un abonnement expiré | OK |
| 6 | Renouvellement + conservation de l'historique | OK |
| 7 | Plusieurs visites d'un abonné | OK |
| 8 | Visiteur occasionnel (avec ou sans fiche) | OK |
| 9 | Recherche d'un visiteur déjà connu | OK |
| 10 | Statistiques jour / semaine / mois / année | OK |
| 11 | Statistiques individuelles | OK |
| 12 | Exportation CSV / impression | OK |
| 13 | Vérification des autorisations par rôle | OK |
| 14 | Enregistrement hors connexion (IndexedDB) | OK |
| 15 | Synchronisation au retour d'Internet | OK |
| 16 | Absence de doublons (UUID + fenêtre temporelle) | OK |
| 17 | Sauvegarde / restauration (`pg_dump` / `psql`) | OK, procédure manuelle |
| — | Absence de module de paiement / caisse / recettes | Vérifié |

## 9. Déploiement

- **Production** : https://salam-library-pro.vercel.app
- **Code** : https://github.com/hassler10/salam-tech — chaque `git push` sur `main` déclenche un déploiement Vercel.
- **Base** : PostgreSQL hébergé chez Neon, relié au projet Vercel (variables `DATABASE_URL` et `DATABASE_URL_UNPOOLED`).
- **Schéma** : après une modification de `src/db/schema.ts`, exécuter
  `DATABASE_URL="<URL Neon non poolée>" npx drizzle-kit push`.
- En local, `.env.development.local` pointe vers le PostgreSQL local ; `.env.local` (tiré par Vercel) contient les identifiants cloud et n'est jamais versionné.
