# 🔐 CLOUDFLARE KV STORAGE - Správa Download Linků

## Bezpečnost

Download linky jsou nyní uloženy v **PRIVATE Cloudflare KV Storage**, ne v veřejném JSONBinu.

✅ **Výhody:**
- Linky vidí jen Cloudflare Worker
- Nemohou je ukrást čtením JSONBinu
- Worker je pošle jen v emailu po ověření platby
- Bezpečná autentifikace PayPal webhook

---

## Setup Cloudflare KV Storage

### 1. Vytvoř KV Namespace

1. Jdi na **https://dash.cloudflare.com**
2. Vyber účet → **Workers & Pages**
3. Klikni na **mapshop-webhook** worker
4. **Settings** → **Bindings**
5. Klikni **Edit bindings**
6. Přidej nový binding:
   ```
   Variable name: DOWNLOADS
   KV Namespace: [Create new]
   → Pojmenuj: mapshop-downloads
   ```
7. Klikni **Add binding**
8. Klikni **Save and Deploy**

### 2. Přidej Download Linky do KV

Máš 2 možnosti:

#### Varianta A: Přes Cloudflare Dashboard (manuálně)

1. **Workers** → **KV**
2. Vyber namespace: **mapshop-downloads**
3. Klikni **Create key**
4. Vlož:
   ```
   Key: paypal_XXXXXXXXXX
   Value: https://github.com/.../releases/download/map.zip
   ```

Postup:
```
1. V admin panelu jsi vytvořil produkt s PayPal ID: "abc123"
2. V KV Storage vytvoříš:
   Key:   paypal_abc123
   Value: https://github.com/waapno/maps/releases/download/survival-map-v1.zip
```

#### Varianta B: Přes API/CLI (doporučeno pro hromadné)

```bash
# Musíš mít nainstalovaný Wrangler
# npm install -g @cloudflare/wrangler

# Login
wrangler login

# Přidej klíč
wrangler kv:key put --binding=DOWNLOADS "paypal_abc123" "https://github.com/.../map.zip"

# Čti klíč
wrangler kv:key get --binding=DOWNLOADS "paypal_abc123"

# Vymaž klíč
wrangler kv:key delete --binding=DOWNLOADS "paypal_abc123"
```

#### Varianta C: Hromadný import (JSON)

Vytvoř soubor `downloads.json`:
```json
{
  "paypal_abc123": "https://github.com/waapno/maps/releases/download/survival.zip",
  "paypal_def456": "https://github.com/waapno/maps/releases/download/adventure.zip",
  "paypal_ghi789": "https://github.com/waapno/maps/releases/download/creative.zip"
}
```

Pak importuj přes API.

---

## 📋 Mapování PayPal ID → Download URL

### Jak najít PayPal ID tvých produktů?

1. V admin panelu: **Products**
2. Každý produkt má **PayPal ID** (např. "abc123")
3. V KV Storage: `key = paypal_abc123`

### Příklad Setup

```
Admin Panel:
┌─────────────────────────┐
│ Produkt: Survival Map   │
│ PayPal ID: survival001  │
│ Cena: $9.99            │
└─────────────────────────┘

KV Storage:
┌─────────────────────────────────────────────────┐
│ Key: paypal_survival001                         │
│ Value: https://github.com/.../survival-map.zip │
└─────────────────────────────────────────────────┘

Webhook:
┌──────────────────────────────────┐
│ Platba potvrzena                 │
│ PayPal ID: survival001           │
│ Worker čte z KV:                 │
│ → Najde URL                      │
│ → Pošle email s linkem ✓         │
└──────────────────────────────────┘
```

---

## 🔍 Debugging

### Zkontroluj, že klíč existuje

```bash
wrangler kv:key get --binding=DOWNLOADS "paypal_survival001"
```

Měl bys vidět URL.

### Zkontroluj Cloudflare Logs

```
Dashboard → Workers → mapshop-webhook → Logs
```

Hledej:
- ✅ `✓ Order processed` = OK
- ❌ `Download URL not found` = Chybí klíč v KV

### Simuluj webhook

```bash
# Test
curl -X POST https://mapshop-webhook.USERNAME.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "CHECKOUT.ORDER.COMPLETED",
    "resource": {
      "id": "test_order",
      "payer": {"email_address": "test@example.com"},
      "purchase_units": [{"custom_id": "paypal_survival001"}]
    }
  }'
```

---

## 🆘 Troubleshooting

| Problém | Řešení |
|---------|--------|
| "Download URL not found" v logs | Zkontroluj KV klíč: `paypal_XXXXX` (bez mezer!) |
| Email nepřichází | Zkontroluj Resend logs + Cloudflare logs |
| KV neexistuje | Vytvoř nový namespace v Workers → KV |
| Wrangler nejde | `npm install -g @cloudflare/wrangler` |

---

## 📝 Checklist

- [ ] KV Namespace vytvořen: `mapshop-downloads`
- [ ] Binding v Workeru: `DOWNLOADS`
- [ ] Worker deployován s novým bindingem
- [ ] Download URL přidány do KV Storage
- [ ] Formát klíče: `paypal_XXXXX`
- [ ] Test webhook:
  - [ ] Email přichází
  - [ ] Email obsahuje download odkaz
  - [ ] Odkaz funguje

---

## 🔒 Bezpečnost - Shrnutí

```
STARÝ ZPŮSOB (NEBEZPEČNÝ):
┌─────────────────┐
│   JSONBin       │ ← Veřejný přístup!
│ - Products      │
│ - Download URLs │ ← VIDÍ KDO CHCE!
└─────────────────┘

NOVÝ ZPŮSOB (BEZPEČNÝ):
┌─────────────────┐          ┌──────────────┐
│   JSONBin       │          │ Cloudflare   │
│ - Products      │          │ KV Storage   │
│ (BEZ LINKŮ) ✓   │          │ - Download   │
└─────────────────┘          │   URLs ✓     │
     Veřejný ✓                │ Jen Worker!  │
                              └──────────────┘
                                 Private ✓
```

---

**Hotovo! ✅**

Download linky jsou teď bezpečně v Cloudflare KV Storage!
