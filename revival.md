# SimpliWiki Revival - Transcript Consolidé

> **Note**: Ce document consolide trois fichiers de transcript (`revival.md`, `revival2.md`, `revival3.txt`) créés lors de sessions Claude Code successives sur le revival du Simpli Wiki Engine.

## Historique des Sessions

1. **revival.md** - Session initiale explorant SimpliWiki et son historique
2. **revival2.md** - Continuation après crash, focus sur GitHub OAuth et tunneling
3. **revival3.txt** - Continuation après limite de contexte, focus sur testing et récupération contenu

## Contexte du Projet

**SimpliWiki** est un wiki engine créé vers 2016, utilisé avec le dépôt SimpliWiki. Le code se trouve dans `simpli/` tandis que `SimpliWiki/` est le dépôt git de données.

### Architecture Historique

- **Wiki Engine**: Node.js (0.10 → modernisé vers 18+)
- **Authentification**: Multi-sources (Twitter, Facebook, LinkedIn, Kudocracy, GitHub, pages wiki locales)
- **Stockage**: Système de fichiers avec sous-wikis
- **Session**: Cookies et paramètres URL

## Travaux Réalisés

### 1. Modernisation des Dependencies

**Fichier**: `simpli/package.json`

```json
{
  "name": "simpli",
  "version": "0.2.0",
  "engines": {
    "node": ">=18.0.0"
  },
  // Dependencies nettoyées:
  // - bower, karma, jasmine retirés (obsolètes)
  // - dotenv ajouté pour secrets
  // - express, socket.io, etc. conservés
}
```

- Node.js: 0.10 → 18+
- Dépendances obsolètes retirées (bower, karma, jasmine)
- dotenv ajouté pour gestion des secrets

### 2. GitHub OAuth Integration

**Fichiers créés/modifiés**:
- `lib/github.js` - Module OAuth complet avec CSRF
- `server.js` - Routes `/auth/github` et `/auth/github/callback`
- `sessionlogin.js` - Reconnaissance des cookies GitHub
- `session.js` - Boutons de login GitHub

**Credentials récupérés depuis**: `inseme/.env`
```
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```

### 3. Tunnel Inseme - Mode Standalone

**Fichiers créés**:
- `TUNNEL_README.md` - Documentation du système
- `TUNNEL_QUICK.md` - Guide rapide
- `survey/scripts/get-tunnel-token.js` - Script CLI pour récupérer token

**Modification tunnel.js**:
- Option `--standalone` pour usage hors Inseme
- Option `--env-file` pour charger .env personnalisé
- Token ngrok ajouté à `simpli/.env`

### 4. Système d'Authentification

**Sources historiques identifiées**:

1. **Guest/Anonymous** - Par défaut, sans identité
2. **Twitter** - Abandonné
3. **Facebook** - Abandonné
4. **LinkedIn** - Abandonné
5. **Kudocracy** - Système `?kudocracy=xxxx`
6. **GitHub** - Nouveau, ajouté récemment
7. **Pages wiki locales** - Système wiki avec @Username

**Contexte Kudocracy** (URL-encoded JSON):
```json
{
  "time": 1735620123456,
  "authentic": true,
  "visitor": "@jhr",
  "can_script": true,
  "lang": "en",
  "host": "localhost:8080",
  "github_id": "github123456789",
  "github_login": "jhrobert"
}
```

### 5. Tests et Validation

**Serveur SimpliWiki**:
- ✓ Démarre avec Node.js v24.5
- ✓ Route `/auth/github` redirige vers GitHub
- ✓ Callback `/auth/github/callback` fonctionne
- ✓ Cookies `sw_github_*` reconnus

**Test contexte Kudocracy**:
```
http://localhost:8080/simplijs/HomePage?kudocracy=%7B...%7D
```

Résultat: ✓ Connexion comme @testuser avec droits d'édition

**Sous-wikis identifiés**:
- `/simplijs/HomePage` - Wiki SimpliJs (RAD NodeJs, AngularJs & jQuery)
- Racine cherche `HomePage` dans `simplijs/wiki/`

## Point d'Arrêt Actuel

**Dernier travail en cours**: Recherche de l'ancien contenu Dropbox

**Objectif**: Récupérer les pages wiki historiques depuis la sauvegarde Dropbox

**Statut**: Le modèle a atteint sa limite de contexte lors de la recherche dans Dropbox

## Prochaines Étapes

1. **Récupération contenu Dropbox**
   - Explorer le backup Dropbox
   - Identifier les pages wiki à restaurer
   - Restaurer dans simpli/wiki/

2. **Testing OAuth complet**
   - Flow tunnel + simpli
   - Validation du contexte Kudocracy

3. **CSS ASCII** - À étudier ensemble

4. **Système d'invitation** - Mentionné mais pas encore retrouvé dans le code

5. **Kudocracy revival** - Prévu après Simpli (migration Twitter → GitHub)

## Fichiers de Référence

- `simpli/revival.md` - Session initiale (1417 lignes)
- `revival2.md` - Session 2 (1477 lignes)  
- `simpli/revival3.txt` - Session 3 (1455 lignes)
- `simpli/revival_consolidated.md` - Ce fichier (consolidation)

---

**Date de consolidation**: 2026-07-03
**Statut du projet**: En cours - Prochaine étape: récupération contenu Dropbox
