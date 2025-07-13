import { Controller, Post, Body, Param, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';

export class ShopCredentialsDto {
  shopDomain: string;
  accessToken: string;
}

export class OrdersRequestDto extends ShopCredentialsDto {
  limit?: number;
  pageInfo?: string;
  status?: string;
}

@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Get orders directly from Shopify API with credentials in body
   */
  @Post('fetch')
  async getOrders(@Body() request: OrdersRequestDto) {
    try {
      const { shopDomain, accessToken, limit = 50, pageInfo, status } = request;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required credentials',
          required: ['shopDomain', 'accessToken'],
          example: {
            shopDomain: 'your-shop.myshopify.com',
            accessToken: 'your_access_token_here',
            limit: 10,
            status: 'paid'
          }
        };
      }

      const result = await this.ordersService.getOrdersFromShopifyWithCredentials(
        shopDomain,
        accessToken,
        limit,
        pageInfo,
        status
      );
      
      return {
        message: 'Orders retrieved successfully',
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get orders:`, error);
      return {
        error: 'Failed to retrieve orders',
        details: error.message,
      };
    }
  }

  /**
   * Get single order by ID with credentials in body
   */
  @Post('fetch/:orderId')
  async getOrder(
    @Param('orderId') orderId: string,
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

      const order = await this.ordersService.getOrderFromShopifyWithCredentials(
        shopDomain,
        accessToken,
        orderId
      );
      
      return {
        message: 'Order retrieved successfully',
        data: order,
      };
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId}:`, error);
      return {
        error: 'Failed to retrieve order',
        details: error.message,
      };
    }
  }

  /**
   * Get order count with credentials in body
   */
  @Post('count')
  async getOrderCount(@Body() credentials: ShopCredentialsDto) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required credentials',
          required: ['shopDomain', 'accessToken']
        };
      }

      const count = await this.ordersService.getOrderCountWithCredentials(
        shopDomain,
        accessToken
      );
      
      return {
        message: 'Order count retrieved successfully',
        data: { count },
      };
    } catch (error) {
      this.logger.error(`Failed to get order count:`, error);
      return {
        error: 'Failed to retrieve order count',
        details: error.message,
      };
    }
  }

  /**
   * Get order analytics with credentials in body
   */
  @Post('analytics')
  async getOrderAnalytics(@Body() credentials: ShopCredentialsDto) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: 'Missing required credentials',
          required: ['shopDomain', 'accessToken']
        };
      }

      const analytics = await this.ordersService.calculateOrderAnalyticsWithCredentials(
        shopDomain,
        accessToken
      );
      
      return {
        message: 'Order analytics calculated successfully',
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate order analytics:`, error);
      return {
        error: 'Failed to calculate order analytics',
        details: error.message,
      };
    }
  }
}
