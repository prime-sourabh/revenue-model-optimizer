import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

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
   * Get customers directly from Shopify API with provided credentials
   */
  async getCustomersFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    limit: number = 50,
    pageInfo?: string,
    search?: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      const params: any = { limit };
      if (pageInfo) {
        params.page_info = pageInfo;
      }
      if (search) {
        params.query = `email:*${search}* OR first_name:*${search}* OR last_name:*${search}*`;
      }

      const response = await client.get({ 
        path: 'customers', 
        query: params
      });
      
      const customers = response.body.customers;
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

      this.logger.log(`Retrieved ${customers.length} customers for shop: ${shopDomain}`);
      
      return {
        customers,
        pagination: {
          hasNext: !!nextPageInfo,
          hasPrevious: !!prevPageInfo,
          nextPageInfo,
          prevPageInfo,
        },
        count: customers.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get customers for shop ${shopDomain}:`, error);
      throw error;
    }
  }

  /**
   * Get single customer from Shopify API with provided credentials
   */
  async getCustomerFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    customerId: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      const response = await client.get({ 
        path: `customers/${customerId}`
      });
      
      this.logger.log(`Retrieved customer ${customerId} for shop: ${shopDomain}`);
      
      return response.body.customer;
    } catch (error) {
      this.logger.error(`Failed to get customer ${customerId} for shop ${shopDomain}:`, error);
      throw error;
    }
  }

  /**
   * Calculate customer analytics from Shopify data with provided credentials
   */
  async calculateCustomerAnalyticsWithCredentials(
    shopDomain: string,
    accessToken: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      
      // Get customers
      const customersResponse = await client.get({ 
        path: 'customers',
        query: { limit: 250 }
      });
      
      const customers = customersResponse.body.customers;
      const totalCustomers = customers.length;

      // Calculate metrics
      const returningCustomers = customers.filter(c => c.orders_count > 1).length;
      const newCustomers = totalCustomers - returningCustomers;

      const totalSpent = customers.reduce((sum, c) => sum + parseFloat(c.total_spent || '0'), 0);
      const averageLifetimeValue = totalSpent / totalCustomers || 0;

      // Top customers by total spent
      const topCustomers = customers
        .sort((a, b) => parseFloat(b.total_spent || '0') - parseFloat(a.total_spent || '0'))
        .slice(0, 10)
        .map(customer => ({
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          totalSpent: parseFloat(customer.total_spent || '0'),
          ordersCount: customer.orders_count,
        }));

      // Customers by state
      const customersByState = customers.reduce((acc, customer) => {
        const state = customer.state || 'enabled';
        acc[state] = (acc[state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      this.logger.log(`Calculated analytics for ${totalCustomers} customers in shop: ${shopDomain}`);

      return {
        totalCustomers,
        newCustomers,
        returningCustomers,
        averageLifetimeValue,
        topCustomers,
        customersByState,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate customer analytics for shop ${shopDomain}:`, error);
      throw error;
    }
  }
}
