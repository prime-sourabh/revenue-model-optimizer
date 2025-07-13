import { Controller, Post, Body, Param, Logger } from '@nestjs/common';
import { CustomersService } from './customers.service';

export class ShopCredentialsDto {
  shopDomain: string;
  accessToken: string;
}

export class CustomersRequestDto extends ShopCredentialsDto {
  limit?: number;
  pageInfo?: string;
  search?: string;
}

@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly customersService: CustomersService) {}

  /**
   * Get customers directly from Shopify API with credentials in body
   */
  @Post('fetch')
  async getCustomers(@Body() request: CustomersRequestDto) {
    try {
      const { shopDomain, accessToken, limit = 50, pageInfo, search } = request;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required credentials',
          required: ['shopDomain', 'accessToken'],
          example: {
            shopDomain: 'your-shop.myshopify.com',
            accessToken: 'your_access_token_here',
            limit: 10,
            search: 'john'
          }
        };
      }

      const result = await this.customersService.getCustomersFromShopifyWithCredentials(
        shopDomain,
        accessToken,
        limit,
        pageInfo,
        search
      );
      
      return {
        message: 'Customers retrieved successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get customers:`, error);
      return {
        error: 'Failed to retrieve customers',
        details: error.message,
      };
    }
  }

  /**
   * Get single customer by ID with credentials in body
   */
  @Post('fetch/:customerId')
  async getCustomer(
    @Param('customerId') customerId: string,
    @Body() credentials: ShopCredentialsDto
  ) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required credentials',
          required: ['shopDomain', 'accessToken']
        };
      }

      const customer = await this.customersService.getCustomerFromShopifyWithCredentials(
        shopDomain,
        accessToken,
        customerId
      );
      
      return {
        message: 'Customer retrieved successfully',
        data: customer,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer ${customerId}:`, error);
      return {
        error: 'Failed to retrieve customer',
        details: error.message,
      };
    }
  }

  /**
   * Get customer analytics with credentials in body
   */
  @Post('analytics')
  async getCustomerAnalytics(@Body() credentials: ShopCredentialsDto) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required credentials',
          required: ['shopDomain', 'accessToken']
        };
      }

      const analytics = await this.customersService.calculateCustomerAnalyticsWithCredentials(
        shopDomain,
        accessToken
      );
      
      return {
        message: 'Customer analytics calculated successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate customer analytics:`, error);
      return {
        error: 'Failed to calculate customer analytics',
        details: error.message,
      };
    }
  }
}
