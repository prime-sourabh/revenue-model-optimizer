import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Generate OAuth URL for Shopify authentication
   */
  generateOAuthUrl(shopDomain: string, state?: string): string {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/v1/auth/callback`;
    const scopes = 'read_products,read_orders,read_customers,read_analytics';
    const nonce = state || this.generateRandomString(32);

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${apiKey}&` +
      `scope=${scopes}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${nonce}`;

    this.logger.log(`Generated OAuth URL for shop: ${shopDomain}`);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(shopDomain: string, code: string): Promise<string> {
    try {
      const apiKey = process.env.SHOPIFY_API_KEY;
      const apiSecret = process.env.SHOPIFY_API_SECRET;

      const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code: code,
        }),
      });

      if (!response.ok) {
        throw new Error(`OAuth token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Successfully obtained access token for shop: ${shopDomain}`);
      
      return data.access_token;
    } catch (error) {
      this.logger.error(`Failed to exchange code for token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(body: string, signature: string): boolean {
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.warn('Webhook secret not configured');
      return false;
    }

    const hmac = createHmac('sha256', webhookSecret);
    hmac.update(body, 'utf8');
    const computedSignature = hmac.digest('base64');

    return computedSignature === signature;
  }

  /**
   * Validate shop domain format
   */
  validateShopDomain(shopDomain: string): boolean {
    const shopPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    return shopPattern.test(shopDomain);
  }

  /**
   * Test access token validity
   */
  async validateAccessToken(shopDomain: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to validate access token: ${error.message}`);
      return false;
    }
  }

  /**
   * Get shop information using access token
   */
  async getShopInfo(shopDomain: string, accessToken: string): Promise<any> {
    try {
      const response = await fetch(`https://${shopDomain}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shop info: ${response.statusText}`);
      }

      const data = await response.json();
      return data.shop;
    } catch (error) {
      this.logger.error(`Failed to get shop info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate random string for state parameter
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create Shopify API client with access token
   */
  createShopifyClient(shopDomain: string, accessToken: string) {
    const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
    
    const shopify = shopifyApi({
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecretKey: process.env.SHOPIFY_API_SECRET,
      scopes: ['read_products', 'read_orders', 'read_customers', 'read_analytics'],
      hostName: process.env.SHOPIFY_APP_URL?.replace('https://', '') || 'localhost:3000',
      apiVersion: LATEST_API_VERSION,
      isEmbeddedApp: false,
    });

    const session = {
      id: `oauth_${shopDomain}`,
      shop: shopDomain,
      state: 'offline',
      isOnline: false,
      accessToken: accessToken,
    };

    return new shopify.clients.Rest({ session });
  }
}