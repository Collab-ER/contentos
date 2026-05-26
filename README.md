# ContentOS — Guide de déploiement complet

## Étape 1 — Créer un projet Firebase (5 min)

1. Va sur **console.firebase.google.com**
2. Clique **"Créer un projet"**
3. Nomme-le `contentos` → Continue → Continue → Créer le projet

## Étape 2 — Activer Firestore (base de données)

1. Dans le menu gauche, clique **"Firestore Database"**
2. Clique **"Créer une base de données"**
3. Choisis **"Démarrer en mode test"** → Suivant → Activer

## Étape 3 — Récupérer ta config Firebase

1. Dans Firebase Console, clique l'icône ⚙️ (Paramètres du projet)
2. Descends jusqu'à **"Tes applications"**
3. Clique **"</> Web"** → nomme l'app `contentos-web` → Enregistrer
4. Copie le bloc `firebaseConfig` qui apparaît — il ressemble à :

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "contentos-xxxxx.firebaseapp.com",
  projectId: "contentos-xxxxx",
  storageBucket: "contentos-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Étape 4 — Coller ta config dans le projet

Ouvre le fichier `src/firebase.js` et remplace chaque valeur :
- `COLLE_ICI_TON_apiKey` → ta valeur apiKey
- `COLLE_ICI_TON_authDomain` → ta valeur authDomain
- etc.

## Étape 5 — Mettre sur GitHub

1. Va sur **github.com** → "New repository" → nomme-le `contentos`
2. Clique "uploading an existing file"
3. Dézippe `contentos.zip` et glisse TOUT le dossier
4. Clique "Commit changes"

## Étape 6 — Déployer sur Vercel

1. Va sur **vercel.com** → "Sign up with GitHub"
2. Clique "Add New Project" → importe `contentos`
3. Clique "Deploy" — attends 2 minutes
4. Tu reçois ton URL (ex: contentos.vercel.app)

## Étape 7 — Autoriser ton domaine Vercel dans Firebase

1. Dans Firebase Console → Paramètres du projet → Domaines autorisés
2. Ajoute ton URL Vercel (ex: `contentos.vercel.app`)

## C'est terminé !

Partage l'URL avec ton collab. Toutes les modifications
sont synchronisées en temps réel entre vous deux.
