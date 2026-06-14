/**
 * MapShop - Download Link Handler
 * Generuje a ověřuje secure download linky s expiracemi
 * 
 * Vlož mezi <head> nebo do shop.js
 */

class MapShopDownloadManager {
  constructor(config = {}) {
    this.storageKey = 'mapshop_downloads';
    this.tokenExpiryHours = config.tokenExpiryHours || 168; // 7 dní
    this.maxDownloads = config.maxDownloads || 5; // Max 5 stažení per token
    this.initStorage();
  }

  initStorage() {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify({}));
    }
  }

  /**
   * Generuje secure token pro download (simulace - v produkci by mělo být na serveru)
   * @param {string} productId - ID produktu
   * @param {string} productTitle - Název produktu
   * @param {string} downloadUrl - URL pro stažení (soubor/GitHub release apod)
   * @param {string} customerEmail - Email zákazníka (pro audit log)
   * @returns {string} Token
   */
  generateToken(productId, productTitle, downloadUrl, customerEmail) {
    const token = this.createToken();
    const expiresAt = new Date(Date.now() + this.tokenExpiryHours * 60 * 60 * 1000).toISOString();
    
    const downloads = JSON.parse(localStorage.getItem(this.storageKey)) || {};
    
    downloads[token] = {
      productId,
      productTitle,
      downloadUrl,
      customerEmail,
      createdAt: new Date().toISOString(),
      expiresAt,
      accessCount: 0,
      maxDownloads: this.maxDownloads
    };
    
    localStorage.setItem(this.storageKey, JSON.stringify(downloads));
    
    return token;
  }

  /**
   * Ověří a vrátí download URL
   * @param {string} token - Secure token
   * @returns {Object|null} { downloadUrl, accessCount, expiresAt } nebo null
   */
  validateAndUseToken(token) {
    const downloads = JSON.parse(localStorage.getItem(this.storageKey)) || {};
    const record = downloads[token];
    
    if (!record) {
      console.warn('[MapShop] Invalid token:', token);
      return null;
    }
    
    // Kontrola expirce
    if (new Date() > new Date(record.expiresAt)) {
      delete downloads[token];
      localStorage.setItem(this.storageKey, JSON.stringify(downloads));
      console.warn('[MapShop] Token expired:', token);
      return null;
    }
    
    // Kontrola počtu stažení
    if (record.accessCount >= record.maxDownloads) {
      console.warn('[MapShop] Max downloads reached:', token);
      return null;
    }
    
    // Inkrementuj počet přístupů
    record.accessCount += 1;
    downloads[token] = record;
    localStorage.setItem(this.storageKey, JSON.stringify(downloads));
    
    return {
      downloadUrl: record.downloadUrl,
      accessCount: record.accessCount,
      maxDownloads: record.maxDownloads,
      expiresAt: record.expiresAt,
      productTitle: record.productTitle
    };
  }

  createToken() {
    // Vytvoř bezpečný token
    return 'dl_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           '_' + Date.now().toString(36);
  }

  /**
   * Čistá už prošlé tokeny
   */
  cleanupExpiredTokens() {
    const downloads = JSON.parse(localStorage.getItem(this.storageKey)) || {};
    const now = new Date();
    
    let cleaned = 0;
    for (const token in downloads) {
      if (new Date(downloads[token].expiresAt) < now) {
        delete downloads[token];
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      localStorage.setItem(this.storageKey, JSON.stringify(downloads));
      console.log(`[MapShop] Cleaned up ${cleaned} expired tokens`);
    }
  }
}

// Inicializuj manager
window.MapShopDownloadMgr = new MapShopDownloadManager({
  tokenExpiryHours: 168,  // 7 dní
  maxDownloads: 5         // Max 5 stažení per linku
});

// Periodicky čisti expirované tokeny
setInterval(() => {
  window.MapShopDownloadMgr.cleanupExpiredTokens();
}, 60 * 60 * 1000); // Každou hodinu

/**
 * Příklad: Jak vytvořit download email s secure linkem
 * 
 * // V Cloudflare Workeru (cloudflare-worker.js):
 * 
 * function generateDownloadUrl(product, order, env) {
 *   // Vytvoř secure token
 *   const token = generateSecureToken(
 *     product.id,
 *     product.title,
 *     product.download_url || 'https://github.com/...',
 *     order.payer.email_address
 *   );
 *   
 *   // Vrať URL s tokenem
 *   return `https://waapno.github.io/shop/download/${token}`;
 * }
 * 
 * // Na stránce download/:
 * // 1. Načti token z URL
 * // 2. Ověř token pomocí validateAndUseToken()
 * // 3. Přesměruj na downloadUrl nebo stáhni soubor
 */

console.log('✓ MapShop Download Manager loaded');
