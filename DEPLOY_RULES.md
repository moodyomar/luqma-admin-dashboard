# 🔥 Deploy Firestore Rules

## Quick Deploy

```bash
cd /Users/moody/Documents/Dev/luqma/admin-dashboard
firebase deploy --only firestore:rules
```

## If Node Version Issue

If you get a Node version error:

```bash
# Use nvm to switch to Node 20 (as specified in .nvmrc)
nvm use 20

# Then deploy
firebase deploy --only firestore:rules
```

## Verify Rules are Deployed

After deploying, the rules should be active immediately. Try the delete operation again.

## Alternative: Deploy via Firebase Console

If CLI doesn't work:

1. Go to [Firebase Console](https://console.firebase.google.com/project/qbmenu-7963c/firestore/rules)
2. Copy the contents of `firestore.rules`
3. Paste into the Rules editor
4. Click **Publish**




