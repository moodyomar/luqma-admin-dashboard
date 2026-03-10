# 🍎 Apple Pay Hosting Options - Which Approach to Use?

## Three Options for Multi-Client Setup

### Option 1: One Central Firebase Hosting (Recommended for Now) ✅

**Setup:**
- Use **one Firebase Hosting project** (e.g., `qbmenu-7963c.web.app`)
- Deploy `tranzila-applepay.html` once to this central project
- Configure **different hosting URLs per client** in admin dashboard:
  - **Luqma:** `https://qbmenu-7963c.web.app`
  - **Safaa:** `https://qbmenu-7963c.web.app` (same, or use custom domain)
  - **Other clients:** Same or custom domains

**Pros:**
- ✅ Single deployment (deploy once, works for all)
- ✅ Easy maintenance (update one file)
- ✅ Lower cost (one Firebase Hosting project)

**Cons:**
- ⚠️ All clients share the same domain (might be an issue for branding)
- ⚠️ If domain verification is required per client, you'll need separate domains

**When to use:**
- When all clients can share the same domain
- When you want minimal maintenance overhead
- **This is the simplest approach for now**

---

### Option 2: Separate Firebase Hosting Per Client (Most Scalable) 🚀

**Setup:**
- Create **separate Firebase Hosting project** for each client
- Deploy `tranzila-applepay.html` to each client's project
- Each client gets their own domain:
  - **Luqma:** `https://qbmenu-7963c.web.app`
  - **Safaa:** `https://safaa-project-id.web.app`
  - **Risto:** `https://risto-project-id.web.app`

**Pros:**
- ✅ Complete isolation per client
- ✅ Each client has their own domain (better for branding)
- ✅ If one client's hosting fails, others aren't affected
- ✅ Better for domain verification (if required per client)

**Cons:**
- ⚠️ More deployments (deploy to each project)
- ⚠️ More maintenance (update multiple files)
- ⚠️ Higher cost (multiple Firebase Hosting projects)

**When to use:**
- When clients need separate domains for branding/verification
- When you want complete isolation
- When you have many clients and want to scale independently

---

### Option 3: Custom Domains on Central Hosting (Best of Both Worlds) 🌟

**Setup:**
- Use **one Firebase Hosting project** (`qbmenu-7963c.web.app`)
- Add **custom domains** for each client:
  - **Luqma:** `https://applepay.luqma.co.il` → points to `qbmenu-7963c.web.app`
  - **Safaa:** `https://applepay.safaa.com` → points to `qbmenu-7963c.web.app`
- Configure custom domains in Firebase Console → Hosting → Add custom domain
- Deploy once, but each client sees their own domain

**Pros:**
- ✅ Single deployment (deploy once)
- ✅ Each client has branded domain
- ✅ Professional appearance
- ✅ Good for domain verification

**Cons:**
- ⚠️ Requires DNS configuration per client
- ⚠️ SSL certificate setup per domain (Firebase handles this automatically)

**When to use:**
- When you want branded domains per client
- When you want single deployment but multiple domains
- **This is the most professional approach**

---

## Recommendation for Your Situation

**Start with Option 1 (Central Hosting):**
1. Use `qbmenu-7963c.web.app` for all clients initially
2. Configure the hosting URL in admin dashboard per client (can all point to same URL)
3. Test that Apple Pay works correctly

**Migrate to Option 3 (Custom Domains) later:**
1. Once everything works, add custom domains per client
2. Update admin dashboard configs to use custom domains
3. No app rebuild needed (just config change)

**Only use Option 2 if:**
- Clients absolutely need separate Firebase projects
- Domain verification requires separate projects
- You want complete isolation

---

## Current Implementation

With the new remote config system:
- ✅ **You can use ANY of these options**
- ✅ Configure hosting URL per client in admin dashboard
- ✅ No code changes needed when switching between options
- ✅ App automatically uses the configured URL

## Quick Setup Commands

### Option 1: Central Hosting (Current)
```bash
# Already done - qbmenu-7963c.web.app is deployed
# Just configure URLs in admin dashboard
```

### Option 2: Separate Hosting Per Client
```bash
# For each client:
cd {client}-mobile
firebase use {client-project-id}
firebase init hosting
cp ../luqma/menu-app/public/tranzila-applepay.html ./public/
firebase deploy --only hosting
# Then configure URL in admin dashboard
```

### Option 3: Custom Domains
```bash
# Deploy once to central project
cd menu-app
firebase deploy --only hosting

# Add custom domains in Firebase Console:
# Hosting → Add custom domain → Enter domain → Configure DNS
# Then configure URLs in admin dashboard
```
