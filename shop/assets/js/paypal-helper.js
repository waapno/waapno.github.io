/**
 * MapShop PayPal Helper
 * Pomůcka pro správné předávání custom_id (product ID) do PayPal
 * 
 * POUŽITÍ:
 * 1. Přidej tento skript do shop.js nebo admin.js
 * 2. Při vytváření PayPal payment linku, přidej custom_id
 */

class MapShopPayPalHelper {
  /**
   * Vytvoří PayPal payment URL s custom_id pro webhook
   * @param {string} paypalId - PayPal Product ID (tvůj payment link ID)
   * @param {string} productId - ID produktu v MapShop (pro webhook matching)
   * @returns {string} Úplná URL na PayPal checkout
   */
  static createPaymentUrl(paypalId, productId) {
    if (!paypalId) {
      console.warn('[MapShop] PayPal ID is required');
      return null;
    }
    
    // Základní PayPal URL
    let url = `https://www.paypal.com/ncp/payment/${encodeURIComponent(paypalId)}`;
    
    // Přidej custom_id (product ID) - PayPal jej předá v webhook payload
    // TO JE DŮLEŽITÉ - webhook pak bude vědět, která mapa se kupuje!
    if (productId) {
      // Poznámka: Custom ID se předává přes custom parametr
      // Aktuální PayPal API to nemusí podporovat v payment links,
      // ale pokud máš Advanced Checkout, můžeš to udělat
      url += `?custom_id=${encodeURIComponent(productId)}`;
    }
    
    return url;
  }

  /**
   * Ověř, že PayPal webhook obsahuje správný custom_id
   * @param {Object} webhookPayload - Payload z PayPal webhook
   * @returns {string|null} Custom ID nebo null
   */
  static extractProductId(webhookPayload) {
    const resource = webhookPayload.resource || {};
    
    // Zkus z purchase_units
    const purchaseUnits = resource.purchase_units || [];
    if (purchaseUnits[0] && purchaseUnits[0].custom_id) {
      return purchaseUnits[0].custom_id;
    }
    
    // Zkus z custom fieldu (podle PayPal API verze)
    if (resource.custom_id) {
      return resource.custom_id;
    }
    
    if (resource.custom) {
      return resource.custom;
    }
    
    console.warn('[MapShop] No custom_id found in webhook');
    return null;
  }

  /**
   * Vygeneruj debug info pro webhook testování
   */
  static getDebugInfo() {
    return `
🧪 WEBHOOK DEBUG INFO
=====================

1. Zaregistrovaný Webhook URL:
   https://mapshop-webhook.username.workers.dev

2. PayPal Payment Links:
   Každý produkt musí mít PayPal Payment Link ID
   Formát: https://www.paypal.com/ncp/payment/[ID]

3. Custom ID Matching:
   - Webhook pošle custom_id z purchase_units
   - Musí se matchnout s paypal_id v produktu

4. Test Webhook v PayPal Dashboard:
   Webhooks → [tvůj webhook] → Test Event
   Vyber: checkout.order.completed

5. Logs Cloudflare:
   Dashboard → Workers → mapshop-webhook → Logs
    `;
  }
}

// Export pro use v adminovi
window.MapShopPayPalHelper = MapShopPayPalHelper;

console.log('✓ MapShop PayPal Helper loaded');

/**
 * PŘÍKLAD: Jak správně koupit v shopu
 * 
 * Když uživatel klikne na "Buy Now":
 * 1. Vytvoříš PayPal URL s custom_id:
 *    const url = MapShopPayPalHelper.createPaymentUrl(
 *      'PAYPAL_ID_Z_PRODUKTU',
 *      'PRODUCT_ID_Z_MAPSHOP'
 *    );
 * 2. Přesměruješ na URL:
 *    window.open(url, '_blank');
 * 
 * 3. PayPal potvrdí platbu
 * 4. Pošle webhook s custom_id
 * 5. Webhook matches custom_id s paypal_id
 * 6. Email se odešle!
 */

/**
 * POZNÁMKA O PAYPAL PAYMENT LINKS:
 *
 * PayPal Payment Links jsou nejjednodušší způsob:
 * - Vytvoříš je v PayPal dashboard
 * - Dostaneš URL: https://www.paypal.com/ncp/payment/[ID]
 * - Uživatel klikne a jde koupit
 * 
 * PROBLÉM: Custom fields nejsou podporované ve "fast checkout"
 * 
 * ŘEŠENÍ 1: Použij PayPal Buttons (skriptované)
 * - Máš plnou kontrolu nad custom fieldy
 * - Složitější integrace
 * 
 * ŘEŠENÍ 2: Ulož mapování v JSONBin
 * - Pro PayPal ID = Product ID lookup
 * - Webhook se kouká do JSONBin a matchuje
 * 
 * ŘEŠENÍ 3: Kombinuj oba
 * - Payment Links pro jednoduchost
 * - Webhook hledá product metadata
 */
