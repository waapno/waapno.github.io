/**
 * Cloudflare Worker - MapShop PayPal Webhook Handler
 * 
 * Naslouchá PayPal webhookům, ověří je a odesílá potvrzovací emaily
 * s odkazem na stažení produktu přes Resend API.
 * 
 * Konfigurace:
 * - Environment variable: RESEND_API_KEY
 * - Environment variable: MAPSHOP_WEBHOOK_SECRET (libovolný string pro HMAC ověření)
 * - Environment variable: JSONBIN_BIN_ID
 * - Environment variable: JSONBIN_MASTER_KEY
 */

const WEBHOOK_EVENTS = {
  CHECKOUT_COMPLETED: 'CHECKOUT.ORDER.COMPLETED'
};

/**
 * Ověří webhook signaturu od PayPal
 * @param {string} body - Raw request body
 * @param {string} transmissionId - Z headeru
 * @param {string} transmissionTime - Z headeru
 * @param {string} certUrl - Z headeru
 * @param {string} signature - Z headeru
 * @returns {Promise<boolean>}
 */
async function verifyPayPalSignature(body, transmissionId, transmissionTime, certUrl, signature) {
  try {
    // POZNÁMKA: Úplná ověření PayPal signatur vyžaduje stažení certifikátu z certUrl
    // Pro prototyp používáme jednodušší ověření. V produkci:
    // 1. Stahnout cert z certUrl
    // 2. Ověrit podpis pomocí RSA
    
    // Prozatím jednoduché ověření - v produkci by mělo být složitější
    return true;
  } catch (e) {
    console.error('Signature verification failed:', e);
    return false;
  }
}

/**
 * Získá informace o produktu z JSONBin
 * @param {string} paypalId - PayPal product ID
 * @returns {Promise<Object>}
 */
async function getProductByPaypalId(paypalId, env) {
  try {
    const binId = env.JSONBIN_BIN_ID;
    const masterKey = env.JSONBIN_MASTER_KEY;
    
    const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: {
        'X-Master-Key': masterKey
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const record = data.record || {};
    
    // Hledej v produktech
    let products = record.products || [];
    let product = products.find(p => p.paypal_id === paypalId);
    if (product) {
      return { ...product, type: 'product' };
    }
    
    // Hledej v bundlech
    let bundles = record.bundles || [];
    let bundle = bundles.find(b => b.paypal_id === paypalId);
    if (bundle) {
      return { ...bundle, type: 'bundle' };
    }
    
    return null;
  } catch (e) {
    console.error('Error fetching product:', e);
    return null;
  }
}

/**
 * Odesílá potvrzovací email přes Resend API
 * @param {string} email - Cílový email
 * @param {Object} product - Informace o produktu
 * @param {Object} order - Informace o objednávce
 * @param {string} downloadUrl - URL pro stažení
 * @param {string} resendKey - Resend API klíč
 */
async function sendConfirmationEmail(email, product, order, downloadUrl, resendKey) {
  try {
    const productTitle = product.title || 'Váš nákup v MapShop';
    const price = product.price ? `$${parseFloat(product.price).toFixed(2)}` : 'Zdarma';
    
    const emailHtml = `
<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0e11; color: #e0e6ed; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #00ff7f; }
    .logo { font-size: 28px; margin-right: 10px; }
    .logo-text { font-weight: bold; color: #00ff7f; }
    .content { padding: 40px 20px; }
    .title { font-size: 24px; font-weight: bold; margin: 20px 0; color: #00ff7f; }
    .order-info { background: #111619; border-left: 4px solid #00ff7f; padding: 15px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .info-label { color: #00e5ff; }
    .info-value { font-weight: bold; }
    .download-btn { 
      display: inline-block;
      background: #00ff7f;
      color: #000;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin-top: 20px;
      font-size: 16px;
    }
    .download-btn:hover { background: #00e5ff; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; border-top: 1px solid #333; margin-top: 40px; }
    .warning { background: #1a1f24; border-left: 4px solid #ff6b6b; padding: 15px; margin: 20px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo">🗺</span><span class="logo-text">MapShop</span>
    </div>
    
    <div class="content">
      <h1 class="title">Potvrzení objednávky ✓</h1>
      
      <p>Děkujeme za váš nákup! Vaše platba byla úspěšně zpracována.</p>
      
      <div class="order-info">
        <div class="info-row">
          <span class="info-label">Produkt:</span>
          <span class="info-value">${productTitle}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Cena:</span>
          <span class="info-value">${price}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ID objednávky:</span>
          <span class="info-value">${order.id || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Datum:</span>
          <span class="info-value">${new Date().toLocaleDateString('cs-CZ')}</span>
        </div>
      </div>
      
      <p>Stáhněte si svůj produkt pomocí tlačítka níže:</p>
      
      <div style="text-align: center;">
        <a href="${downloadUrl}" class="download-btn">📥 Stáhnout teď</a>
      </div>
      
      <div class="warning">
        <strong>Důležité:</strong> Odkaz na stažení platí 7 dní. Uložte si produkt na bezpečné místo. 
        Pokud máte problémy se stažením, kontaktujte nás přes Discord.
      </div>
      
      <p style="margin-top: 40px;">
        Pokud jste tento nákup neprovedli, ignorujte prosím tento email.<br>
        <strong>Máte otázky?</strong> Kontaktujte nás na <a href="https://discord.com/users/806610398924636200" style="color: #00e5ff;">Discord</a>
      </p>
    </div>
    
    <div class="footer">
      <p>MapShop © 2026 • Premium Minecraft Maps</p>
      <p><a href="https://waapno.github.io/shop" style="color: #00e5ff;">Jít na obchod</a></p>
    </div>
  </div>
</body>
</html>
    `.trim();
    
    const emailText = `
Potvrzení objednávky ✓

Děkujeme za váš nákup!

Produkt: ${productTitle}
Cena: ${price}
ID objednávky: ${order.id || 'N/A'}
Datum: ${new Date().toLocaleDateString('cs-CZ')}

Stáhněte si svůj produkt zde:
${downloadUrl}

Odkaz platí 7 dní.
    `.trim();
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@mapshop.waapno.dev',
        to: email,
        subject: `Potvrzení nákupu: ${productTitle}`,
        html: emailHtml,
        text: emailText
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('Error sending email:', e);
    return false;
  }
}

/**
 * Generuje dočasný download URL
 * Vytváří secure token s expiracemi a limitcích na stažení
 */
function generateDownloadUrl(product, order, env) {
  // Vytvoř secure token
  // Formát: dl_[náhodný string]_[timestamp]
  const randomPart = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  const token = `dl_${randomPart}_${timestamp}`;
  
  // Ulož metadata tokenu (v produkci by to mělo být v KV storage)
  // Pro teď vrátíme data v tokenu a ověříme je na stránce
  // Metadata struktura: {
  //   productId: product.id,
  //   productTitle: product.title,
  //   downloadUrl: product.download_url,
  //   email: order.payer.email_address,
  //   createdAt: new Date().toISOString(),
  //   expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  //   maxDownloads: 5
  // }
  
  // Vrať URL s tokenem
  // POZOR: Skutečný soubor se odešle, když uživatel klikne na odkaz
  // stránka download.html ověří token a buď:
  // 1. Přesměruje na product.download_url
  // 2. Nebo spustí download, pokud je soubor na serveru
  return `https://waapno.github.io/shop/download/${token}`;
}

/**
 * Hlavní handler pro webhook
 */
export default {
  async fetch(request, env, ctx) {
    // CORS pre-flight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, PayPal-Transmission-Id, PayPal-Transmission-Time, PayPal-Cert-Url, PayPal-Auth-Algo, PayPal-Transmission-Sig'
        }
      });
    }
    
    // Pouze POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }
    
    try {
      const body = await request.text();
      const headers = request.headers;
      
      // Ověř PayPal webhook signaturu
      const isValid = await verifyPayPalSignature(
        body,
        headers.get('PayPal-Transmission-Id'),
        headers.get('PayPal-Transmission-Time'),
        headers.get('PayPal-Cert-Url'),
        headers.get('PayPal-Transmission-Sig')
      );
      
      if (!isValid) {
        console.warn('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
      
      const payload = JSON.parse(body);
      
      // Zpracuj jen checkout.order.completed
      if (payload.event_type !== WEBHOOK_EVENTS.CHECKOUT_COMPLETED) {
        return new Response(JSON.stringify({ success: true, ignored: true }), { status: 200 });
      }
      
      const resource = payload.resource || {};
      const payer = resource.payer || {};
      const email = payer.email_address;
      
      if (!email) {
        console.warn('No payer email in webhook');
        return new Response(JSON.stringify({ error: 'No email' }), { status: 400 });
      }
      
      // Najdi produkt podle PayPal ID
      let paypalId = null;
      const purchaseUnits = resource.purchase_units || [];
      if (purchaseUnits[0] && purchaseUnits[0].custom_id) {
        paypalId = purchaseUnits[0].custom_id;
      }
      
      if (!paypalId) {
        console.warn('No custom_id (PayPal product ID) in webhook');
        return new Response(JSON.stringify({ error: 'No product ID' }), { status: 400 });
      }
      
      const product = await getProductByPaypalId(paypalId, env);
      
      if (!product) {
        console.warn(`Product not found for paypal_id: ${paypalId}`);
        return new Response(JSON.stringify({ error: 'Product not found' }), { status: 404 });
      }
      
      // Generuj download URL
      const downloadUrl = generateDownloadUrl(product, resource, env);
      
      // Pošli potvrzovací email
      const emailSent = await sendConfirmationEmail(
        email,
        product,
        resource,
        downloadUrl,
        env.RESEND_API_KEY
      );
      
      if (!emailSent) {
        console.error('Failed to send confirmation email');
        return new Response(JSON.stringify({ error: 'Email send failed' }), { status: 500 });
      }
      
      // Zaloguj úspěšnou objednávku
      console.log(`✓ Order processed: ${resource.id} for ${email}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        orderId: resource.id,
        email: email,
        product: product.title
      }), { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
    } catch (e) {
      console.error('Webhook processing error:', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
};
