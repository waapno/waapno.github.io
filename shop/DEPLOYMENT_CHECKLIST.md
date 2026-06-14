# ✅ DEPLOYMENT CHECKLIST - Kontrola Před Nasazením

Máš všechno připraveno? Ověř si to pomocí tohoto checklistu!

---

## 🚀 FASE 1: Cloudflare Setup (5 minut)

### Workers & Pages
- [ ] Cloudflare účet vytvořen
- [ ] Projekt **mapshop-webhook** vytvořen
- [ ] cloudflare-worker.js je deployován
- [ ] Worker URL je: `https://mapshop-webhook.USERNAME.workers.dev`

### Environment Variables (Worker Settings)
- [ ] RESEND_API_KEY = `sk_live_xxxxx` (zkopírováno z Resend)
- [ ] JSONBIN_BIN_ID = `69e8800536566621a8dc1cef`
- [ ] JSONBIN_MASTER_KEY = tvůj klíč (zkopírován z JSONBin)

### KV Storage Namespace
- [ ] Namespace vytvořen: **mapshop-downloads**
- [ ] Binding přidán v Worker:
  - Variable name: `DOWNLOADS`
  - KV Namespace: `mapshop-downloads`
- [ ] Worker re-deployován s bindings

---

## 🔐 FASE 2: KV Storage - Naplnění Download Linkami (10 minut)

### Mapování Produktů → Download URLs

Pro KAŽDÝ produkt v admin panelu:

```
Produkt: [Survival Map]
├─ PayPal ID: survival001
└─ KV Setup:
   Key:   paypal_survival001
   Value: https://github.com/waapno/maps/releases/download/v1/survival.zip

Produkt: [Adventure Map]
├─ PayPal ID: adventure01
└─ KV Setup:
   Key:   paypal_adventure01
   Value: https://github.com/waapno/maps/releases/download/v1/adventure.zip
```

**Postup - Varianta A: Cloudflare Dashboard**
- [ ] Jdi na https://dash.cloudflare.com
- [ ] Workers → KV → mapshop-downloads
- [ ] Pro každý produkt: **Create key**
  - [ ] Key: `paypal_XXXXX`
  - [ ] Value: `https://...`

**Postup - Varianta B: Wrangler CLI (rychlejší)**
```bash
# Přidej jeden klíč
wrangler kv:key put --binding=DOWNLOADS "paypal_survival001" "https://..."

# Přidej více klíčů (skript)
# (viz níže)
```

**Postup - Varianta C: Skript (hromadně)**

Vytvoř `populate-kv.sh`:
```bash
#!/bin/bash

# Přidej své produkty zde:
wrangler kv:key put --binding=DOWNLOADS "paypal_survival001" "https://github.com/.../survival.zip"
wrangler kv:key put --binding=DOWNLOADS "paypal_adventure01" "https://github.com/.../adventure.zip"
wrangler kv:key put --binding=DOWNLOADS "paypal_creative001" "https://github.com/.../creative.zip"

echo "✓ KV Storage naplněn!"
```

Spusti:
```bash
bash populate-kv.sh
```

**Ověření:**
- [ ] Všechny klíče přidány
- [ ] Žádné typo v klíčích (musí být `paypal_XXXXX`)
- [ ] URLs jsou validní a dostupné

---

## 💾 FASE 3: Admin Panel - Kontrola (5 minut)

### Odebrání Download URL Pole
- [ ] admin.html NEMÁ pole `f-download`
- [ ] admin.js NEMÁ `f-download` v `openEdit()`
- [ ] admin.js NEMÁ `f-download` v `clearForm()`
- [ ] admin.js NEMÁ `download_url` v `saveProduct()`

### JSONBin - Kontrol
- [ ] Produkty v JSONBinu:
  - [ ] Mají `title` ✓
  - [ ] Mají `price` ✓
  - [ ] Mají `paypal_id` ✓
  - [ ] NEMAJÍ `download_url` ✓

**Příklad správného produktu:**
```json
{
  "id": "map_survival_001",
  "title": "Survival Map",
  "price": 9.99,
  "paypal_id": "survival001",
  "tags": ["survival", "adventure"],
  "description": "..."
}
```

---

## 📧 FASE 4: PayPal Webhook (10 minut)

### Registrace Webhooku
- [ ] Jdi na https://developer.paypal.com
- [ ] Login
- [ ] Vyber mód: **Sandbox** (test) nebo **Live** (produkce)
- [ ] Webhooks → Create Event
- [ ] Vlož URL: `https://mapshop-webhook.USERNAME.workers.dev`
- [ ] Vyber event:
  - [ ] **checkout.order.completed** ✓
- [ ] Vytvořeno

### Testování Webhooku
- [ ] Zkopíruj URL webhooku
- [ ] Test v Postman/curl:
```bash
curl -X POST https://mapshop-webhook.USERNAME.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "CHECKOUT.ORDER.COMPLETED",
    "resource": {
      "id": "test_order_123",
      "payer": {"email_address": "test@example.com"},
      "purchase_units": [{"custom_id": "paypal_survival001"}]
    }
  }'
```
- [ ] Odpověď: `{"success": true}` ✓

---

## 🧪 FASE 5: End-to-End Test (15 minut)

### Test v Sandboxu (Bezpečnější)

**Setup:**
- [ ] Jsi v PayPal Sandbox modu
- [ ] Máš testovací PayPal účet
- [ ] Shop je naistalován na GitHub Pages

**Test Workflow:**
1. [ ] Otevři shop: `https://waapno.github.io/shop`
2. [ ] Vyber produkt: "Survival Map"
3. [ ] Klikni "Koupit"
4. [ ] Jsi přesměrován do PayPal
5. [ ] Přihlas se přes Sandbox účet
6. [ ] Potvrď platbu
7. [ ] Jsi vrácen na shop
8. [ ] Zkontroluj email (měl bys obdržet potvrzení):
   - [ ] Subject: "Potvrzení nákupu: Survival Map" ✓
   - [ ] Body obsahuje:
     - [ ] Produkt: Survival Map ✓
     - [ ] Cena: $9.99 ✓
     - [ ] Download link s tokenem ✓
     - [ ] Expirační informace ✓
9. [ ] Klikni na download link v emailu
10. [ ] Měl bys vidět download.html se:
    - [ ] Jménem produktu ✓
    - [ ] Zbývajícími stahováními (5/5) ✓
    - [ ] Časem do vypršení ✓
11. [ ] Klikni "Download Now"
12. [ ] Soubor se začne stahovat ✓

**Očekávané Logy v Cloudflare:**
```
✓ Order processed: test_order_123 for test@example.com
```

---

## 🚨 FASE 6: Troubleshooting (podle potřeby)

### Email nepřichází
- [ ] Zkontroluj Cloudflare Logs:
  ```
  https://dash.cloudflare.com → Workers → mapshop-webhook → Logs
  ```
- [ ] Hledej chyby:
  - `"Email send failed"` → Resend API chyba
  - `"Product not found"` → PayPal ID ne v JSONBinu
  - `"Download URL not found"` → Klíč ne v KV Storage
- [ ] Zkontroluj Resend API status:
  ```
  https://resend.com → Emails
  ```

### Email přichází ale bez odkazu
- [ ] Email template nekontroluje správně generatedDownloadUrl
- [ ] Zkontroluj worker logs

### Webhook se nevolá
- [ ] Zkontroluj PayPal webhook URL (musí být `https://`, ne `http://`)
- [ ] Zkontroluj, že Worker je deployován
- [ ] Test webhook pomocí curl ↑

### Download link nefunguje
- [ ] Token není validní:
  ```
  Zkontroluj download-manager.js logs v console
  ```
- [ ] localStorage je prázdný
- [ ] Token vypršel (7 dní)

---

## 📋 FASE 7: Produkční Setup (20 minut)

Až bude vše fungovat v Sandboxu:

### PayPal Live Mode
- [ ] Přepni PayPal na **Live** mode
- [ ] Vytvoř nový webhook s Live URL

### Security Review
- [ ] Admin heslo je bezpečné
- [ ] JSONBin Master Key je bezpečný (jen v env, ne v kódu)
- [ ] Resend API klíč je bezpečný
- [ ] KV Storage je private (default)
- [ ] HTTPS všude ✓

### Monitoring
- [ ] Nastavit Cloudflare alerting
- [ ] Kontrolovat logy pravidelně
- [ ] Testovat objednávky měsíčně

---

## ✨ Hotovo!

Když všechno zaškrtneš, máš:
- ✅ Bezpečný webhook systém
- ✅ Automatické potvrzovací emaily
- ✅ Private download linky v KV Storage
- ✅ Omezené a časované tokeny
- ✅ Enterprise-grade bezpečnost

**Gratuluji! 🎉**

---

## 💬 Help

Pokud něco nefunguje:

1. **Zkontroluj Cloudflare Logs**
   ```
   https://dash.cloudflare.com → Workers → mapshop-webhook → Logs
   ```

2. **Test webhook ručně**
   ```bash
   curl -X POST https://mapshop-webhook.USERNAME.workers.dev ...
   ```

3. **Zkontroluj JSON strukturu**
   - JSONBin: https://api.jsonbin.io/v3/b/69e8800536566621a8dc1cef/latest
   - Měl by mít `products` array s tvými produkty

4. **Resend logs**
   - https://resend.com → Emails → čekuj na "Delivered" status

---

Pokud stále nefunguje, zkontroluj:
- [ ] Clouflare Worker je deployován
- [ ] Environment variables jsou nastaveny
- [ ] KV Namespace existuje
- [ ] PayPal Webhook je registrován
- [ ] Email v JSONBinu je `payer.email_address`, ne ncoho jiného

Good luck! 🚀
