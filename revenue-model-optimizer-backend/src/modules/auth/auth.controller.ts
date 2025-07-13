import { Controller, Get, Post, Query, Body, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

export class InitiateOAuthDto {
  shopDomain: string;
  state?: string;
}

export class ValidateTokenDto {
  shopDomain: string;
  accessToken: string;
}

export class GetTokenDto {
  shopDomain: string;
  code: string;
  state?: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Initiate OAuth flow - Step 1
   * POST /api/v1/auth/initiate
   */
  @Post('initiate')
  async initiateOAuth(@Body() body: InitiateOAuthDto) {
    try {
      const { shopDomain, state } = body;

      if (!shopDomain) {
        return {
          error: 'Missing shop domain',
          required: ['shopDomain'],
          example: {
            shopDomain: 'your-shop.myshopify.com',
            state: 'optional_state_parameter'
          }
        };
      }

      // Validate shop domain format
      if (!this.authService.validateShopDomain(shopDomain)) {
        return {
          error: 'Invalid shop domain format',
          message: 'Shop domain must be in format: shop-name.myshopify.com'
        };
      }

      const authUrl = this.authService.generateOAuthUrl(shopDomain, state);

      this.logger.log(`OAuth initiated for shop: ${shopDomain}`);

      return {
        message: 'OAuth URL generated successfully',
        authUrl,
        instructions: [
          '1. Open the authUrl in browser',
          '2. Merchant will login and authorize your app',
          '3. Shopify will redirect to callback URL with authorization code',
          '4. Use the code to get access token via /auth/exchange-token endpoint'
        ]
      };
    } catch (error) {
      this.logger.error(`Failed to initiate OAuth: ${error.message}`);
      return {
        error: 'Failed to initiate OAuth',
        details: error.message
      };
    }
  }

  /**
   * Exchange authorization code for access token - Backend Only
   * POST /api/v1/auth/exchange-token
   */
  @Post('exchange-token')
  async exchangeToken(@Body() body: GetTokenDto) {
    try {
      const { shopDomain, code, state } = body;

      if (!code || !shopDomain) {
        return {
          error: 'Missing required parameters',
          required: ['code', 'shopDomain'],
          example: {
            shopDomain: 'your-shop.myshopify.com',
            code: 'authorization_code_from_callback',
            state: 'optional_state_parameter'
          }
        };
      }

      // Exchange authorization code for access token
      const accessToken = await this.authService.exchangeCodeForToken(shopDomain, code);

      // Get shop information
      const shopInfo = await this.authService.getShopInfo(shopDomain, accessToken);

      this.logger.log(`Token exchange completed successfully for shop: ${shopDomain}`);

      return {
        message: 'Access token obtained successfully',
        shop: {
          domain: shopDomain,
          name: shopInfo.name,
          email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
          country: shopInfo.country_name,
          planName: shopInfo.plan_name
        },
        accessToken,
        tokenType: 'Bearer',
        scopes: ['read_products', 'read_orders', 'read_customers', 'read_analytics'],
        instructions: [
          'Save this access token securely',
          'Use this token in API requests to access shop data',
          'Token is valid until revoked by merchant'
        ]
      };
    } catch (error) {
      this.logger.error(`Token exchange failed: ${error.message}`);
      return {
        error: 'Token exchange failed',
        details: error.message,
        troubleshooting: [
          'Verify the authorization code is correct',
          'Ensure the code has not expired (codes expire quickly)',
          'Check that shop domain matches the one used in OAuth initiation'
        ]
      };
    }
  }

  /**
   * Complete OAuth flow programmatically
   * POST /api/v1/auth/complete-oauth
   */
  @Post('complete-oauth')
  async completeOAuth(@Body() body: { shopDomain: string; username?: string; password?: string }) {
    try {
      const { shopDomain } = body;

      if (!shopDomain) {
        return {
          error: 'Missing shop domain',
          required: ['shopDomain']
        };
      }

      // Generate OAuth URL
      const authUrl = this.authService.generateOAuthUrl(shopDomain);

      return {
        message: 'OAuth flow initiated',
        step: 1,
        authUrl,
        nextSteps: [
          '1. Merchant needs to visit the authUrl',
          '2. After authorization, extract the code from callback URL',
          '3. Use POST /auth/exchange-token with the code to get access token'
        ],
        automatedFlow: {
          note: 'For fully automated flow, you need merchant credentials',
          warning: 'Storing merchant credentials is not recommended for security reasons'
        }
      };
    } catch (error) {
      this.logger.error(`Complete OAuth failed: ${error.message}`);
      return {
        error: 'Failed to complete OAuth',
        details: error.message
      };
    }
  }

  /**
   * Handle OAuth callback - Step 2
   * GET /api/v1/auth/callback?code=xxx&shop=xxx&state=xxx
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('shop') shop: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    try {
      if (!code || !shop) {
        return res.status(400).json({
          error: 'Missing required parameters',
          required: ['code', 'shop'],
          received: { code: !!code, shop: !!shop, state: !!state }
        });
      }

      // Exchange authorization code for access token
      const accessToken = await this.authService.exchangeCodeForToken(shop, code);

      // Get shop information
      const shopInfo = await this.authService.getShopInfo(shop, accessToken);

      this.logger.log(`OAuth completed successfully for shop: ${shop}`);

      // Return success response with token
      return res.json({
        message: 'OAuth completed successfully',
        shop: {
          domain: shop,
          name: shopInfo.name,
          email: shopInfo.email,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
          country: shopInfo.country_name,
          planName: shopInfo.plan_name
        },
        accessToken,
        tokenType: 'Bearer',
        scopes: ['read_products', 'read_orders', 'read_customers', 'read_analytics'],
        instructions: [
          'Save this access token securely',
          'Use this token in API requests to access shop data',
          'For backend-only flow, use POST /auth/exchange-token endpoint'
        ]
      });
    } catch (error) {
      this.logger.error(`OAuth callback failed: ${error.message}`);
      return res.status(500).json({
        error: 'OAuth callback failed',
        details: error.message
      });
    }
  }

  /**
   * Validate access token
   * POST /api/v1/auth/validate
   */
  @Post('validate')
  async validateToken(@Body() body: ValidateTokenDto) {
    try {
      const { shopDomain, accessToken } = body;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required parameters',
          required: ['shopDomain', 'accessToken'],
          example: {
            shopDomain: 'your-shop.myshopify.com',
            accessToken: 'shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
          }
        };
      }

      const isValid = await this.authService.validateAccessToken(shopDomain, accessToken);

      if (isValid) {
        const shopInfo = await this.authService.getShopInfo(shopDomain, accessToken);
        
        return {
          message: 'Access token is valid',
          valid: true,
          shop: {
            domain: shopDomain,
            name: shopInfo.name,
            email: shopInfo.email,
            currency: shopInfo.currency,
            timezone: shopInfo.timezone
          }
        };
      } else {
        return {
          message: 'Access token is invalid or expired',
          valid: false
        };
      }
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      return {
        error: 'Token validation failed',
        details: error.message,
        valid: false
      };
    }
  }

  /**
   * Get shop information using access token
   * POST /api/v1/auth/shop-info
   */
  @Post('shop-info')
  async getShopInfo(@Body() body: ValidateTokenDto) {
    try {
      const { shopDomain, accessToken } = body;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required parameters',
          required: ['shopDomain', 'accessToken']
        };
      }

      const shopInfo = await this.authService.getShopInfo(shopDomain, accessToken);

      return {
        message: 'Shop information retrieved successfully',
        shop: {
          id: shopInfo.id,
          name: shopInfo.name,
          email: shopInfo.email,
          domain: shopInfo.domain,
          myshopifyDomain: shopInfo.myshopify_domain,
          currency: shopInfo.currency,
          timezone: shopInfo.timezone,
          countryName: shopInfo.country_name,
          planName: shopInfo.plan_name,
          createdAt: shopInfo.created_at,
          updatedAt: shopInfo.updated_at
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get shop info: ${error.message}`);
      return {
        error: 'Failed to get shop information',
        details: error.message
      };
    }
  }

  /**
   * Test endpoint to verify OAuth setup
   * GET /api/v1/auth/test
   */
  @Get('test')
  testOAuthSetup() {
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    const appUrl = process.env.SHOPIFY_APP_URL;

    return {
      message: 'OAuth configuration test',
      configuration: {
        apiKey: apiKey ? 'Configured' : 'Missing',
        apiSecret: apiSecret ? 'Configured' : 'Missing',
        appUrl: appUrl || 'Not configured',
        callbackUrl: `${appUrl}/api/v1/auth/callback`
      },
      status: (apiKey && apiSecret && appUrl) ? 'Ready' : 'Incomplete',
      backendEndpoints: [
        'POST /api/v1/auth/initiate - Start OAuth flow',
        'POST /api/v1/auth/exchange-token - Exchange code for token',
        'POST /api/v1/auth/validate - Validate existing token',
        'GET /api/v1/auth/callback - OAuth callback (automatic)'
      ]
    };
  }
}