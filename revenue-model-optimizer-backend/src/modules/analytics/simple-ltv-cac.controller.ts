import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

@Controller("ltv-cac")
export class SimpleLtvCacController {
  /**
   * Calculate LTV/CAC from Shopify store data
   * POST /ltv-cac/analyze
   */
  @Post("analyze")
  async analyzeLtvCac(
    @Body()
    body: {
      shopDomain: string;
      accessToken: string;
      adSpend?: number; // Optional, defaults to 0 if not provided
    }
  ): Promise<{
    ltv: number;
    cac: number;
    recommendation: string;
    shopify_data: {
      total_revenue: number;
      total_orders: number;
      total_customers: number;
      churn_rate: number;
      new_customers_acquired: number;
    };
  }> {
    try {
      const { shopDomain, accessToken, adSpend = 0 } = body;

      // Validate inputs
      if (!shopDomain || !accessToken) {
        throw new Error("Shop domain and access token are required");
      }

      // Fetch data from Shopify APIs
      const shopifyData = await this.fetchShopifyData(shopDomain, accessToken);

      // Calculate LTV/CAC
      const result = this.calculateLtvCac(
        shopifyData.total_revenue,
        shopifyData.total_orders,
        shopifyData.total_customers,
        shopifyData.churn_rate,
        adSpend,
        shopifyData.new_customers_acquired
      );

      return {
        ltv: result.ltv,
        cac: result.cac,
        recommendation: result.recommendation,
        shopify_data: shopifyData,
      };
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.BAD_REQUEST,
          error: "LTV/CAC Analysis Failed",
          message: error.message,
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Fetch data from Shopify APIs
   */
  private async fetchShopifyData(
    shopDomain: string,
    accessToken: string
  ): Promise<{
    total_revenue: number;
    total_orders: number;
    total_customers: number;
    churn_rate: number;
    new_customers_acquired: number;
  }> {
    const client = this.createShopifyClient(shopDomain, accessToken);

    // Calculate date range (last 6 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    // Fetch orders data
    const ordersData = await this.fetchOrdersData(client, startDate, endDate);

    // Fetch customers data
    const customersData = await this.fetchCustomersData(
      client,
      startDate,
      endDate
    );

    // Calculate churn rate (simplified - based on customer activity)
    const churnRate = this.calculateChurnRate(
      customersData.total_customers,
      customersData.active_customers
    );

    return {
      total_revenue: ordersData.total_revenue,
      total_orders: ordersData.total_orders,
      total_customers: customersData.total_customers,
      churn_rate: Math.round(churnRate * 1000) / 1000,
      new_customers_acquired: customersData.new_customers,
    };
  }

  /**
   * Create Shopify API client
   */
  private createShopifyClient(shopDomain: string, accessToken: string) {
    return {
      get: async ({ path, query = {} }) => {
        const queryString = new URLSearchParams(query).toString();
        const url = `https://${shopDomain}/admin/api/2024-10/${path}.json${queryString ? `?${queryString}` : ""}`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(
            `Shopify API error: ${response.status} ${response.statusText}`
          );
        }

        return await response.json();
      },
    };
  }

  /**
   * Fetch orders data from Shopify
   */
  private async fetchOrdersData(
    client: any,
    startDate: Date,
    endDate: Date
  ): Promise<{ total_revenue: number; total_orders: number }> {
    try {
      let totalRevenue = 0;
      let totalOrders = 0;
      let pageInfo = null;
      const limit = 250; // Max limit for Shopify API

      do {
        const query: any = {
          limit,
          status: "any",
          created_at_min: startDate.toISOString(),
          created_at_max: endDate.toISOString(),
          fields: "id,total_price,financial_status",
        };

        if (pageInfo) {
          query.page_info = pageInfo;
        }

        const response = await client.get({
          path: "orders",
          query,
        });

        const orders = response.orders || [];

        // Process orders
        for (const order of orders) {
          if (
            order.financial_status === "paid" ||
            order.financial_status === "partially_paid"
          ) {
            totalRevenue += parseFloat(order.total_price) || 0;
            totalOrders++;
          }
        }

        // Simple pagination check (in real implementation, you'd parse Link headers)
        pageInfo = orders.length === limit ? "next" : null;
        if (pageInfo && totalOrders > 1000) break; // Limit for demo
      } while (pageInfo);

      return { total_revenue: totalRevenue, total_orders: totalOrders };
    } catch (error) {
      throw new Error(`Failed to fetch orders data: ${error.message}`);
    }
  }

  /**
   * Fetch customers data from Shopify
   */
  private async fetchCustomersData(
    client: any,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total_customers: number;
    new_customers: number;
    active_customers: number;
  }> {
    try {
      let totalCustomers = 0;
      let newCustomers = 0;
      let activeCustomers = 0;
      let pageInfo = null;
      const limit = 250;

      do {
        const query: any = {
          limit,
          fields: "id,created_at,updated_at,last_order_id,orders_count",
        };

        if (pageInfo) {
          query.page_info = pageInfo;
        }

        const response = await client.get({
          path: "customers",
          query,
        });

        const customers = response.customers || [];

        // Process customers
        for (const customer of customers) {
          totalCustomers++;

          const createdAt = new Date(customer.created_at);
          if (createdAt >= startDate && createdAt <= endDate) {
            newCustomers++;
          }

          // Check if customer is active (has recent orders)
          const updatedAt = new Date(customer.updated_at);
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

          if (updatedAt >= threeMonthsAgo && customer.orders_count > 0) {
            activeCustomers++;
          }
        }

        // Simple pagination check
        pageInfo = customers.length === limit ? "next" : null;
        if (pageInfo && totalCustomers > 1000) break; // Limit for demo
      } while (pageInfo);

      return {
        total_customers: totalCustomers,
        new_customers: newCustomers,
        active_customers: activeCustomers,
      };
    } catch (error) {
      throw new Error(`Failed to fetch customers data: ${error.message}`);
    }
  }

  /**
   * Calculate churn rate based on customer activity
   */
  private calculateChurnRate(
    totalCustomers: number,
    activeCustomers: number
  ): number {
    if (totalCustomers === 0) return 0.05; // Default 5% monthly churn

    // Simple churn calculation: inactive customers / total customers
    const inactiveCustomers = totalCustomers - activeCustomers;
    const churnRate = inactiveCustomers / totalCustomers / 6; // Monthly churn over 6 months

    // Ensure churn rate is within reasonable bounds
    return Math.max(0.01, Math.min(0.5, churnRate));
  }

  /**
   * Calculate LTV/CAC from fetched data
   */
  private calculateLtvCac(
    totalRevenue: number,
    totalOrders: number,
    totalCustomers: number,
    churnRate: number,
    totalAdSpend: number,
    newCustomersAcquired: number
  ): {
    ltv: number;
    cac: number;
    recommendation: string;
  } {
    // Calculate AOV (Average Order Value)
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate Purchase Frequency
    const purchaseFrequency =
      totalCustomers > 0 ? totalOrders / totalCustomers : 0;

    // Calculate Customer Lifespan (in months)
    const customerLifespan = churnRate > 0 ? 1 / churnRate : 20; // Default 20 months if churn_rate is 0

    // Calculate LTV
    const ltv = aov * purchaseFrequency * customerLifespan;

    // Calculate CAC
    const cac =
      newCustomersAcquired > 0 ? totalAdSpend / newCustomersAcquired : 0;

    // Generate recommendation
    const recommendation = this.generateRecommendation(ltv, cac);

    return {
      ltv: Math.round(ltv * 100) / 100,
      cac: Math.round(cac * 100) / 100,
      recommendation,
    };
  }

  /**
   * Generate recommendation based on LTV and CAC
   */
  private generateRecommendation(ltv: number, cac: number): string {
    if (cac === 0) {
      return "Please add your advertising spend to get a complete analysis of your customer acquisition costs.";
    }

    const ratio = ltv / cac;

    if (ratio >= 5) {
      return `Excellent! Your customers are worth ${ltv.toFixed(0)} but only cost ${cac.toFixed(0)} to acquire. You're making great profit - consider increasing your marketing budget to grow faster.`;
    } else if (ratio >= 3) {
      return `Good news! Each customer brings ${ltv.toFixed(0)} in value while costing ${cac.toFixed(0)} to acquire. Your business is profitable - you can safely increase marketing spend.`;
    } else if (ratio >= 1.5) {
      return `Your business is making money. Customers are worth ${ltv.toFixed(0)} and cost ${cac.toFixed(0)} to get. Focus on keeping customers longer to increase profits.`;
    } else if (ratio > 1) {
      return `Warning: You're barely profitable. Customers bring ${ltv.toFixed(0)} but cost ${cac.toFixed(0)} to acquire. Work on customer retention or reduce advertising costs.`;
    } else {
      return `Alert: You're losing money on each customer. They're worth ${ltv.toFixed(0)} but cost ${cac.toFixed(0)} to acquire. Stop paid ads and focus on keeping existing customers happy.`;
    }
  }
}
