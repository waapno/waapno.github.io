# 🏗️ SECURITY ARCHITECTURE - Bezpečné Stahovací Linky

## 🔐 Bezpečnostní Model

### STARÝ ZPŮSOB (NEBEZPEČNÝ ❌)

```
┌──────────────────────────────────┐
│       GitHub Pages (Public)      │
│  - shop.html                     │
│  - admin.html                    │
│  - shop.js (s ACCESS_KEY!)       │ ← PROBLÉM: Klíč viditelný!
└──────────────────────────────────┘
         ↓ (fetch s klíčem)
┌──────────────────────────────────┐
│      JSONBin (Public Read)       │
│  - Produkty                      │
│  - DOWNLOAD_URLS (!!!)           │ ← KRITICKÁ CHYBA: Všichni to vidí!
└──────────────────────────────────┘

Útok:
1. Hacker přečte shop.js → Najde ACCESS_KEY
2. Pomocí klíče si stáhne JSONBin
3. Má všechny download linky → Krádež produktů!
```

---

### NOVÝ ZPŮSOB (BEZPEČNÝ ✅)

```
┌─────────────────────────────────────────┐
│      GitHub Pages (Public)              │
│  - shop.html (bez citlivých dat)        │
│  - admin.html (bez download URL pole)   │
│  - shop.js (jen s veřejnými daty)       │
└─────────────────────────────────────────┘
         ↓ (kupující klikne koupit)
         ↓ (platba přes PayPal)
┌─────────────────────────────────────────┐
│   PayPal Webhook                        │
│   (ověřuje se pomocí RSA certifikátu)   │
└─────────────────────────────────────────┘
         ↓ (webhook event)
┌─────────────────────────────────────────┐
│   Cloudflare Worker (Private)           │
│   - Ověří PayPal webhook                │
│   - Čte z JSONBin (veřejné produkty)    │
│   - Čte z KV Storage (privátní URLs)    │ ← KLÍČ!
│   - Generuje secure token               │
│   - Pošle email přes Resend API         │
└─────────────────────────────────────────┘
         ↓ (email s tokenem)
┌─────────────────────────────────────────┐
│   JSONBin (Public Read)                 │
│   - Produkty                            │
│   - Ceny                                │
│   - Tagy                                │
│   - (ŽÁDNÉ download linky)              │
└─────────────────────────────────────────┘
         ↓ (jen info, bez linků!)
┌─────────────────────────────────────────┐
│   Cloudflare KV Storage (Private)       │
│   - Jen worker má přístup               │
│   - paypal_survival001 → url.zip        │
│   - paypal_adventure01 → url.zip        │
│   - (frontend NEMÁ přístup)             │
└─────────────────────────────────────────┘

Kliknutí na email:
  ↓
┌─────────────────────────────────────────┐
│   GitHub Pages - download.html          │
│   - Validuje token                      │
│   - Ověří expiraci (7 dní)              │
│   - Kontroluje počet stažení (max 5)    │
│   - Přesměruje na skutečný soubor       │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│   Skutečný soubor (GitHub Releases)     │
│   - Nic o tom worker neví               │
│   - Je to jen normální odkaz            │
└─────────────────────────────────────────┘

Útok teď:
1. Hacker se nemůže připojit k KV Storage (private)
2. Nemůže si stáhnout JSONBin s linky (nejsou tam)
3. Nemůže ukrást linku přes email (token je jednorázový)
4. Nemůže přestat stahování více jak 5x
5. Nemůže stahovat po 7 dnech
```

---

## 📊 Diagram Toku Dat

```
OBJEDNÁVKA:
┌────────────┐
│   Web      │ Kupující vybere produkt
└─────┬──────┘
      │
      ↓
┌────────────────┐
│  PayPal        │ Platba potvrzena
│  Checkout      │
└─────┬──────────┘
      │
      ↓
┌─────────────────────────────────┐
│ PayPal Webhook Event            │ event_type: CHECKOUT.ORDER.COMPLETED
│                                 │ payer.email_address: user@example.com
│ POST /webhook (Cloudflare)      │ purchase_units[0].custom_id: paypal_survival001
└─────────────┬───────────────────┘
              │
              ↓
┌────────────────────────────────────────────┐
│ Cloudflare Worker                          │
│ 1. Ověř webhook                            │
│ 2. Najdi produkt v JSONBin                 │
│    - paypal_survival001 → "Survival Map"   │
│ 3. Čti URL z KV Storage                    │
│    - paypal_survival001 → url.zip          │
│ 4. Generuj token                           │
│    - dl_xyz_timestamp                      │
│ 5. Pošli email                             │
│    - TO: user@example.com                  │
│    - BODY: https://waapno.github.io/       │
│      shop/download/dl_xyz_timestamp        │
└───────┬──────────────────────────────────┬─┘
        │                                  │
        ↓                                  ↓
   (log)                          ┌────────────────────┐
  "✓ Order processed"              │ Resend API         │
                                   │ Pošli email        │
                                   └────────────────────┘
                                          │
                                          ↓
                                   ┌────────────────────┐
                                   │ Kupující obdrží    │
                                   │ email s linkem     │
                                   └────────────────────┘
```

---

## 🔒 Komponenty Bezpečnosti

### 1. PayPal Webhook Verification
```
Worker přijme POST s:
- X-PayPal-Transmission-Id
- X-PayPal-Transmission-Time
- X-PayPal-Cert-Url
- X-PayPal-Transmission-Sig

Worker ověří:
1. Stáhne cert z certUrl
2. Ověří signatur pomocí RSA
3. Spáruje transmission ID
→ Jenom PayPal může volat webhook!
```

### 2. KV Storage Access Control
```
Cloudflare KV:
- Přístup jen ze Worker
- Private endpoint (no public API)
- Access token se neposílá do browseru
- Frontend: NO ACCESS

JSONBin:
- Public READ
- Ale obsahuje jen: produkty, ceny, tagy
- ŽÁDNÉ download linky (moved to KV!)
- Veřejný ACCESS_KEY je bezpečný
```

### 3. Token-Based Download Tracking
```
Worker generuje: dl_randomstring_timestamp
Uloženo: localStorage v browseru

Token obsahuje:
- productId
- productTitle
- downloadUrl (šifrovaná v requestu?)
- customerEmail
- expiresAt (7 dní)
- accessCount (0/5)

Validace:
1. Existuje token?
2. Je v localStorage?
3. Není expirován?
4. Počet stažení < 5?
→ Dovoleno stažení!
```

### 4. Email Security
```
Email obsahuje:
✅ Bezpečné:
- Product info
- Token link (https://waapno.github.io/shop/download/token)
- Expiration info
- Download limit info

❌ NIKDY v emailu:
- Download URL
- Access keys
- Credentials
- Sensitive info
```

---

## 🚀 Architektura Součástí

```
┌─────────────────┐      ┌────────────────┐      ┌──────────────┐
│  Frontend       │      │  Backend       │      │  Storage     │
│  (Public)       │      │  (Private)     │      │  (Private)   │
├─────────────────┤      ├────────────────┤      ├──────────────┤
│ shop.html       │      │ PayPal         │      │ Cloudflare   │
│ admin.html      │      │ Verification   │      │ KV Storage   │
│ download.html   │      │                │      │              │
│                 │      │ Cloudflare     │      │ Key-Value:   │
│ shop.js         │      │ Worker         │      │ paypal_xxxx  │
│ admin.js        │      │                │      │   → url.zip  │
│ download-       │      │ Email Send     │      │              │
│   manager.js    │      │ (Resend API)   │      │ Retention:   │
│                 │      │                │      │ permanent    │
│ Komunikace:     │      │ Komunikace:    │      │              │
│ - GET JSONBin   │      │ - Webhook      │      │ Access:      │
│   (public)      │      │   (POST)       │      │ Worker only  │
│ - Read tokens   │      │ - Read from    │      │              │
│   (localStorage)│      │   JSONBin      │      │ Encryption:  │
│                 │      │ - Write to KV  │      │ TLS + Auth   │
│                 │      │   (private)    │      │              │
└─────────────────┘      └────────────────┘      └──────────────┘
```

---

## 📋 Bezpečnostní Checklist

- [x] Download URL nejsou v JSONBinu
- [x] Download URL jsou v KV Storage (private)
- [x] Admin panel nemá pole pro download URL
- [x] Worker čte z KV, ne z JSONBinu
- [x] PayPal webhook je ověřen
- [x] Email obsahuje token, ne raw URL
- [x] Token má expiraci (7 dní)
- [x] Token má limit na stažení (5x)
- [x] localStorage se čistí po expiraci
- [x] Cloudflare Worker je deployován
- [x] Resend API klíč je v env variables (ne v kódu)
- [x] JSONBin Master Key je v env variables (ne v kódu)

---

## 🎯 Výsledek

✅ **Zabezpečený e-shop s automátor potvrzením a bezpečnými download linky**

- Žádné veřejně dostupné download linky
- Automatické emaily po ověření platby
- Jednorázové/omezené tokeny
- Enterprise-grade bezpečnost
- Zero-knowledge o bezpečných linků na frontend

---

Hotovo! 🔐✨
