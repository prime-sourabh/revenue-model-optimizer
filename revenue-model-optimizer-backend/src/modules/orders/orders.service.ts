import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  /**
   * Create Shopify client with provided credentials using fetch
   */
  private createClientWithCredentials(shopDomain: string, accessToken: string) {
    return {
      get: async ({ path, query = {} }) => {
        const queryString = new URLSearchParams(query).toString();
        const url = `https://${shopDomain}/admin/api/2023-10/${path}.json${queryString ? `?${queryString}` : ''}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return {
          body: data,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
    };
  }

  /**
   * Get orders directly from Shopify API with provided credentials
   */
  async getOrdersFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    limit: number = 50,
    pageInfo?: string,
    status?: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      const params: any = { limit };
      if (pageInfo) {
        params.page_info = pageInfo;
      }
      if (status) {
        params.status = status;
      }

      const response = await client.get({ 
        path: 'orders', 
        query: params
      });
      
      const orders = response.body.orders;
      const linkHeader = response.headers.link;

      // Parse pagination info
      let nextPageInfo = null;
      let prevPageInfo = null;
      
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        const prevMatch = linkHeader.match(/<([^>]+)>;\s*rel="previous"/);
        
        if (nextMatch) {
          const url = new URL(nextMatch[1]);
          nextPageInfo = url.searchParams.get('page_info');
        }
        
        if (prevMatch) {
          const url = new URL(prevMatch[1]);
          prevPageInfo = url.searchParams.get('page_info');
        }
      }

      this.logger.log(`Retrieved ${orders.length} orders for shop: ${shopDomain}`);
      
      return {
        orders,
        pagination: {
          hasNext: !!nextPageInfo,
          hasPrevious: !!prevPageInfo,
          nextPageInfo,
          prevPageInfo,
        },
        count: orders.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get orders for shop ${shopDomain}:`, error);
      throw error;
    }
  }

  /**
   * Get single order from Shopify API with provided credentials
   */
  async getOrderFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    orderId: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      const response = await client.get({ 
        path: `orders/${orderId}`
      });
      
      this.logger.log(`Retrieved order ${orderId} for shop: ${shopDomain}`);
      
      return response.body.order;
    } catch (error) {
      this.logger.error(`Failed to get order ${orderId} for shop ${shopDomain}:`, error);
      throw error;
    }
  }

  /**
   * Get order count from Shopify with provided credentials
   */
  async getOrderCountWithCredentials(
    shopDomain: string,
    accessToken: string
  ): Promise<number> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      const response = await client.get({ 
        path: 'orders/count'
      });
      
      return response.body.count;
    } catch (error) {
      this.logger.error(`Failed to get order count for shop ${shopDomain}:`, error);
      throw error;
    }
  }

  /**
   * Calculate order analytics from Shopify data with provided credentials
   */
  async calculateOrderAnalyticsWithCredentials(
    shopDomain: string,
    accessToken: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      // Get orders
      const ordersResponse = await client.get({ 
        path: 'orders',
        query: { limit: 250 }
      });
      
      const orders = ordersResponse.body.orders;
      const totalOrders = orders.length;

      // Calculate metrics
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0);
      const averageOrderValue = totalRevenue / totalOrders || 0;

      // Orders by status
      const ordersByStatus = orders.reduce((acc, order) => {
        const status = order.financial_status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      // Recent orders (last 10)
      const recentOrders = orders
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      this.logger.log(`Calculated analytics for ${totalOrders} orders in shop: ${shopDomain}`);

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        ordersByStatus,
        recentOrders,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate order analytics for shop ${shopDomain}:`, error);
      throw error;
    }
  }
}
