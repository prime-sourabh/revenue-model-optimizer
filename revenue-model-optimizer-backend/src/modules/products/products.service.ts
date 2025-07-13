import { Injectable, Logger } from "@nestjs/common";
import {
  PREDEFINED_CATEGORIES,
  PredefinedCategory,
  TIME_CONSTANTS,
  DEFAULT_THRESHOLDS,
  CATEGORY_MAPPING,
  PRODUCT_KEYWORDS,
} from "../../common/constants/product.constants";
import {
  ProductSearchParams,
  PercentageBasedStaleAnalysis,
} from "../../common/interfaces/product.interfaces";

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  /**
   * Create Shopify client with provided credentials using fetch
   */
  private createClientWithCredentials(shopDomain: string, accessToken: string) {
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

        const data = await response.json();
        return {
          body: data,
          headers: Object.fromEntries(response.headers.entries()),
        };
      },
    };
  }

  /**
   * Get products from Shopify with credentials
   */
  async getProductsFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    limit: number = 50,
    pageInfo?: string,
    search?: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);

      const queryParams: any = { limit };
      if (pageInfo) queryParams.page_info = pageInfo;
      if (search) queryParams.title = search; // Basic search by title

      const response = await client.get({
        path: "products",
        query: queryParams,
      });

      const products = response.body.products;
      this.logger.log(
        `Retrieved ${products.length} products for shop: ${shopDomain}`
      );

      return {
        products,
        pagination: this.extractPagination(response.headers.link),
        count: products.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get products for shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Advanced product search with filters and variants support - searches ALL products
   */
  async searchProductsAdvanced(
    shopDomain: string,
    accessToken: string,
    searchParams: ProductSearchParams
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);

      // If we have search criteria that require filtering, fetch ALL products
      const needsFullSearch = this.needsCustomFiltering(searchParams);

      let allProducts = [];
      let totalBeforeFiltering = 0;

      if (needsFullSearch) {
        // Fetch ALL products from the store to ensure we don't miss any
        allProducts = await this.getAllProducts(client, shopDomain);
        totalBeforeFiltering = allProducts.length;

        this.logger.log(
          `Retrieved ${allProducts.length} total products for comprehensive search in shop: ${shopDomain}`
        );

        // Apply custom filters
        allProducts = this.applyCustomSearch(allProducts, searchParams);
        this.logger.log(
          `Filtered to ${allProducts.length} products after custom search for shop: ${shopDomain}`
        );
      } else {
        // If no custom filtering needed, use standard pagination
        const queryParams = this.buildSearchQuery(searchParams);
        const response = await client.get({
          path: "products",
          query: queryParams,
        });
        allProducts = response.body.products;
        totalBeforeFiltering = response.body.products.length;

        this.logger.log(
          `Retrieved ${allProducts.length} products with standard search for shop: ${shopDomain}`
        );
      }

      // Sort results if requested
      if (searchParams.sort_by) {
        allProducts = this.sortProducts(
          allProducts,
          searchParams.sort_by,
          searchParams.sort_order
        );
      }

      // Add search scoring for relevance
      if (searchParams.search || searchParams.title) {
        const searchTerm = searchParams.search || searchParams.title;
        allProducts = this.addSearchScoring(allProducts, searchTerm);
      }

      return {
        products: allProducts,
        count: allProducts.length,
        searchParams,
        pagination: {
          hasNext: false,
          hasPrevious: false,
          nextPageInfo: null,
          prevPageInfo: null,
        },
        totalBeforeFiltering: totalBeforeFiltering,
        searchedAllProducts: needsFullSearch,
      };
    } catch (error) {
      this.logger.error(
        `Advanced search failed for shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch ALL products from Shopify store using pagination
   */
  private async getAllProducts(
    client: any,
    shopDomain: string
  ): Promise<any[]> {
    let allProducts = [];
    let pageInfo = null;
    let hasNextPage = true;
    let pageCount = 0;

    while (hasNextPage && pageCount < 50) {
      // Safety limit to prevent infinite loops
      const queryParams: any = { limit: 250 }; // Use max limit per request
      if (pageInfo) {
        queryParams.page_info = pageInfo;
      }

      const response = await client.get({
        path: "products",
        query: queryParams,
      });
      const products = response.body.products;

      allProducts = allProducts.concat(products);

      // Check pagination
      const pagination = this.extractPagination(response.headers.link);
      hasNextPage = pagination.hasNext;
      pageInfo = pagination.nextPageInfo;
      pageCount++;

      this.logger.log(
        `Fetched page ${pageCount}: ${products.length} products (Total so far: ${allProducts.length})`
      );

      // If we got less than 250 products, we've reached the end
      if (products.length < 250) {
        hasNextPage = false;
      }
    }

    this.logger.log(
      `Completed fetching all products: ${allProducts.length} total products from ${pageCount} pages`
    );
    return allProducts;
  }

  /**
   * Search products by variants (SKU, Barcode)
   */
  async searchProductsByVariants(
    shopDomain: string,
    accessToken: string,
    searchParams: ProductSearchParams
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);

      // Get all products (we need to search through variants)
      const response = await client.get({
        path: "products",
        query: { limit: searchParams.limit || 250 },
      });

      let products = response.body.products;

      // Filter products that have matching variants
      const matchingProducts = products.filter((product) => {
        return product.variants?.some((variant) => {
          let matches = true;

          if (searchParams.sku) {
            matches =
              matches &&
              variant.sku
                ?.toLowerCase()
                .includes(searchParams.sku.toLowerCase());
          }

          if (searchParams.barcode) {
            matches =
              matches &&
              variant.barcode
                ?.toLowerCase()
                .includes(searchParams.barcode.toLowerCase());
          }

          if (searchParams.price_min) {
            matches =
              matches && parseFloat(variant.price) >= searchParams.price_min;
          }

          if (searchParams.price_max) {
            matches =
              matches && parseFloat(variant.price) <= searchParams.price_max;
          }

          if (searchParams.inventory_quantity_min) {
            matches =
              matches &&
              (variant.inventory_quantity || 0) >=
                searchParams.inventory_quantity_min;
          }

          if (searchParams.inventory_quantity_max) {
            matches =
              matches &&
              (variant.inventory_quantity || 0) <=
                searchParams.inventory_quantity_max;
          }

          return matches;
        });
      });

      // Add matching variant details to each product
      const productsWithMatchingVariants = matchingProducts.map((product) => ({
        ...product,
        matchingVariants: product.variants.filter((variant) => {
          let matches = true;

          if (searchParams.sku) {
            matches =
              matches &&
              variant.sku
                ?.toLowerCase()
                .includes(searchParams.sku.toLowerCase());
          }

          if (searchParams.barcode) {
            matches =
              matches &&
              variant.barcode
                ?.toLowerCase()
                .includes(searchParams.barcode.toLowerCase());
          }

          return matches;
        }),
      }));

      this.logger.log(
        `Found ${matchingProducts.length} products with matching variants for shop: ${shopDomain}`
      );

      return {
        products: productsWithMatchingVariants,
        count: matchingProducts.length,
        searchParams,
        variantSearchResults: true,
      };
    } catch (error) {
      this.logger.error(`Variant search failed for shop ${shopDomain}:`, error);
      throw error;
    }
  }

  /**
   * Build Shopify API query parameters
   */
  private buildSearchQuery(params: ProductSearchParams): any {
    const query: any = {};

    // Basic Shopify parameters
    // Note: We don't use Shopify's title parameter here because we want case-insensitive search
    // Title search is handled in applyCustomSearch for case-insensitive matching
    if (params.vendor) query.vendor = params.vendor;
    if (params.product_type) query.product_type = params.product_type;
    if (params.status) query.status = params.status;
    if (params.created_at_min) query.created_at_min = params.created_at_min;
    if (params.created_at_max) query.created_at_max = params.created_at_max;
    if (params.updated_at_min) query.updated_at_min = params.updated_at_min;
    if (params.updated_at_max) query.updated_at_max = params.updated_at_max;

    // Pagination
    query.limit = Math.min(params.limit || 50, 250); // Shopify max is 250
    if (params.page_info) query.page_info = params.page_info;

    return query;
  }

  /**
   * Check if custom filtering is needed
   */
  private needsCustomFiltering(params: ProductSearchParams): boolean {
    return !!(
      params.search ||
      params.title ||
      params.sku ||
      params.barcode ||
      params.tags ||
      params.price_min ||
      params.price_max ||
      params.inventory_quantity_min ||
      params.inventory_quantity_max
    );
  }

  /**
   * Apply custom search filters
   */
  private applyCustomSearch(
    products: any[],
    params: ProductSearchParams
  ): any[] {
    return products.filter((product) => {
      // Multi-field search
      if (params.search) {
        const searchTerm = params.search.toLowerCase();
        const searchFields = [
          product.title,
          product.body_html,
          product.vendor,
          product.product_type,
          product.tags,
          ...(product.variants?.map((v) => v.title) || []),
          ...(product.variants?.map((v) => v.sku) || []),
          ...(product.variants?.map((v) => v.barcode) || []),
        ].filter(Boolean);

        const matchesSearch = searchFields.some((field) =>
          field?.toLowerCase().includes(searchTerm)
        );

        if (!matchesSearch) return false;
      }

      // Title-only search (case-insensitive) - searches both product title and variant titles
      if (params.title) {
        const titleSearch = params.title.toLowerCase();

        // Check product title
        const productTitleMatch = product.title
          ?.toLowerCase()
          .includes(titleSearch);

        // Check variant titles
        const variantTitleMatch = product.variants?.some((variant) =>
          variant.title?.toLowerCase().includes(titleSearch)
        );

        // Must match either product title or variant title
        if (!productTitleMatch && !variantTitleMatch) return false;
      }

      // Tags search
      if (params.tags) {
        const tagSearch = params.tags.toLowerCase();
        if (!product.tags?.toLowerCase().includes(tagSearch)) return false;
      }

      // SKU search in variants
      if (params.sku) {
        const matchesSku = product.variants?.some((variant) =>
          variant.sku?.toLowerCase().includes(params.sku.toLowerCase())
        );
        if (!matchesSku) return false;
      }

      // Barcode search in variants
      if (params.barcode) {
        const matchesBarcode = product.variants?.some((variant) =>
          variant.barcode?.toLowerCase().includes(params.barcode.toLowerCase())
        );
        if (!matchesBarcode) return false;
      }

      // Price range filter
      if (params.price_min || params.price_max) {
        const prices = product.variants?.map((v) => parseFloat(v.price)) || [];
        if (prices.length === 0) return false;

        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        if (params.price_min && maxPrice < params.price_min) return false;
        if (params.price_max && minPrice > params.price_max) return false;
      }

      // Inventory filter
      if (params.inventory_quantity_min || params.inventory_quantity_max) {
        const totalInventory =
          product.variants?.reduce(
            (sum, v) => sum + (v.inventory_quantity || 0),
            0
          ) || 0;

        if (
          params.inventory_quantity_min &&
          totalInventory < params.inventory_quantity_min
        )
          return false;
        if (
          params.inventory_quantity_max &&
          totalInventory > params.inventory_quantity_max
        )
          return false;
      }

      return true;
    });
  }

  /**
   * Sort products by specified criteria
   */
  private sortProducts(
    products: any[],
    sortBy: string,
    sortOrder: string = "asc"
  ): any[] {
    return products.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case "title":
          aValue = a.title?.toLowerCase() || "";
          bValue = b.title?.toLowerCase() || "";
          break;
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "updated_at":
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
        case "price":
          aValue = Math.min(
            ...(a.variants?.map((v) => parseFloat(v.price)) || [0])
          );
          bValue = Math.min(
            ...(b.variants?.map((v) => parseFloat(v.price)) || [0])
          );
          break;
        default:
          return 0;
      }

      if (sortOrder === "desc") {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });
  }

  /**
   * Add search scoring for relevance
   */
  private addSearchScoring(products: any[], searchTerm: string): any[] {
    return products
      .map((product) => {
        let score = 0;
        const term = searchTerm.toLowerCase();

        // Title match (highest weight)
        if (product.title?.toLowerCase().includes(term)) score += 10;
        if (product.title?.toLowerCase().startsWith(term)) score += 5;

        // Vendor match
        if (product.vendor?.toLowerCase().includes(term)) score += 3;

        // Product type match
        if (product.product_type?.toLowerCase().includes(term)) score += 3;

        // Tags match
        if (product.tags?.toLowerCase().includes(term)) score += 2;

        // Variant matches
        product.variants?.forEach((variant) => {
          if (variant.title?.toLowerCase().includes(term)) score += 2;
          if (variant.sku?.toLowerCase().includes(term)) score += 4;
          if (variant.barcode?.toLowerCase().includes(term)) score += 4;
        });

        return {
          ...product,
          searchScore: score / 10, // Normalize to 0-1 scale
          matchedFields: this.getMatchedFields(product, term),
        };
      })
      .sort((a, b) => b.searchScore - a.searchScore); // Sort by relevance
  }

  /**
   * Get fields that matched the search term
   */
  private getMatchedFields(product: any, searchTerm: string): string[] {
    const matched = [];
    const term = searchTerm.toLowerCase();

    if (product.title?.toLowerCase().includes(term)) matched.push("title");
    if (product.vendor?.toLowerCase().includes(term)) matched.push("vendor");
    if (product.product_type?.toLowerCase().includes(term))
      matched.push("product_type");
    if (product.tags?.toLowerCase().includes(term)) matched.push("tags");

    product.variants?.forEach((variant, index) => {
      if (variant.title?.toLowerCase().includes(term))
        matched.push(`variants[${index}].title`);
      if (variant.sku?.toLowerCase().includes(term))
        matched.push(`variants[${index}].sku`);
      if (variant.barcode?.toLowerCase().includes(term))
        matched.push(`variants[${index}].barcode`);
    });

    return matched;
  }

  /**
   * Get single product from Shopify with credentials
   */
  async getProductFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    productId: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      const response = await client.get({ path: `products/${productId}` });

      this.logger.log(`Retrieved product ${productId} for shop: ${shopDomain}`);
      return response.body.product;
    } catch (error) {
      this.logger.error(
        `Failed to get product ${productId} for shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get single variant from Shopify with credentials
   */
  async getVariantFromShopifyWithCredentials(
    shopDomain: string,
    accessToken: string,
    variantId: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      const response = await client.get({ path: `variants/${variantId}` });

      this.logger.log(`Retrieved variant ${variantId} for shop: ${shopDomain}`);
      return response.body.variant;
    } catch (error) {
      this.logger.error(
        `Failed to get variant ${variantId} for shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get product count with credentials
   */
  async getProductCountWithCredentials(
    shopDomain: string,
    accessToken: string
  ): Promise<number> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      const response = await client.get({ path: "products/count" });

      const count = response.body.count;
      this.logger.log(
        `Retrieved product count ${count} for shop: ${shopDomain}`
      );
      return count;
    } catch (error) {
      this.logger.error(
        `Failed to get product count for shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculate product analytics with credentials
   */
  async calculateProductAnalyticsWithCredentials(
    shopDomain: string,
    accessToken: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);
      const response = await client.get({
        path: "products",
        query: { limit: 250 },
      });

      const products = response.body.products;

      const analytics = {
        totalProducts: products.length,
        publishedProducts: products.filter((p) => p.status === "active").length,
        draftProducts: products.filter((p) => p.status === "draft").length,
        archivedProducts: products.filter((p) => p.status === "archived")
          .length,
        productsByVendor: this.groupBy(products, "vendor"),
        productsByType: this.groupBy(products, "product_type"),
        averageVariantsPerProduct:
          products.reduce((sum, p) => sum + (p.variants?.length || 0), 0) /
          products.length,
        totalVariants: products.reduce(
          (sum, p) => sum + (p.variants?.length || 0),
          0
        ),
        priceRange: this.calculatePriceRange(products),
        inventoryStats: this.calculateInventoryStats(products),
      };

      this.logger.log(
        `Calculated analytics for ${products.length} products in shop: ${shopDomain}`
      );
      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to calculate analytics for shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Extract pagination info from Link header
   */
  private extractPagination(linkHeader?: string): any {
    if (!linkHeader) {
      return {
        hasNext: false,
        hasPrevious: false,
        nextPageInfo: null,
        prevPageInfo: null,
      };
    }

    const links = linkHeader.split(",").reduce((acc: any, link) => {
      const match = link.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        const url = new URL(match[1]);
        const pageInfo = url.searchParams.get("page_info");
        acc[match[2]] = pageInfo;
      }
      return acc;
    }, {});

    return {
      hasNext: !!links.next,
      hasPrevious: !!links.previous,
      nextPageInfo: links.next || null,
      prevPageInfo: links.previous || null,
    };
  }

  /**
   * Group items by a property
   */
  private groupBy(items: any[], property: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const key = item[property] || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Calculate price range across all products
   */
  private calculatePriceRange(products: any[]): any {
    const allPrices = products
      .flatMap((p) => p.variants?.map((v) => parseFloat(v.price)) || [])
      .filter((price) => !isNaN(price));

    if (allPrices.length === 0) {
      return { min: 0, max: 0, average: 0 };
    }

    return {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
      average:
        allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length,
    };
  }

  /**
   * Calculate inventory statistics
   */
  private calculateInventoryStats(products: any[]): any {
    const allInventory = products.flatMap(
      (p) => p.variants?.map((v) => v.inventory_quantity || 0) || []
    );

    const totalInventory = allInventory.reduce((sum, qty) => sum + qty, 0);
    const lowStockVariants = allInventory.filter((qty) => qty < 10).length;
    const outOfStockVariants = allInventory.filter((qty) => qty === 0).length;

    return {
      totalInventory,
      averageInventoryPerVariant:
        allInventory.length > 0 ? totalInventory / allInventory.length : 0,
      lowStockVariants,
      outOfStockVariants,
      totalVariants: allInventory.length,
    };
  }

  /**
   * Generate AI-ready product data by aggregating multiple Shopify APIs
   */
  async generateAIProductData(
    shopDomain: string,
    accessToken: string,
    productId: string,
    variantId?: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);

      // Get product details
      const productResponse = await client.get({
        path: `products/${productId}`,
      });
      const product = productResponse.body.product;

      // Get category from external AI service
      const category = await this.getProductCategoryFromAI(
        product,
        shopDomain,
        accessToken
      );
      console.log("🚀 ~  ~  ProductsService  ~  category: ==================== ", category);

      // Get orders for this product to calculate metrics
      const ordersResponse = await client.get({
        path: "orders",
        query: { limit: 250, status: "any" },
      });
      const allOrders = ordersResponse.body.orders;
      console.log("🚀 ~  ~  ProductsService  ~  allOrders: ==================== ", allOrders);

      // Filter orders that contain this product
      const productOrders = allOrders.filter((order) =>
        order.line_items?.some((item) => item.product_id == productId)
      );
      console.log("🚀 ~  ~  ProductsService  ~  productOrders: ==================== ", productOrders);

      // Calculate AI metrics with external category
      const aiData = this.calculateAIMetrics(
        product,
        productOrders,
        variantId,
        category
      );
      console.log("🚀 ~  ~  ProductsService  ~  aiData: ==================== ", aiData);

      // Call strategy prediction API with the AI data
      const strategyPrediction = await this.getStrategyPrediction(aiData);
      console.log("🚀 ~  ~  ProductsService  ~  strategyPrediction: ==================== ", strategyPrediction);

      this.logger.log(
        `Generated AI data and strategy prediction for product ${productId} in shop: ${shopDomain}`
      );
      return strategyPrediction;
    } catch (error) {
      this.logger.error(
        `Failed to generate AI data for product ${productId} in shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get product category from external AI classification service
   * First checks product tags for predefined categories, then calls AI API if not found
   */
  private async getProductCategoryFromAI(
    product: any,
    shopDomain: string,
    accessToken: string
  ): Promise<string> {
    try {
      // STEP 1: Check product tags for predefined categories first
      const categoryFromTags = this.getCategoryFromTags(product.tags);
      if (categoryFromTags) {
        this.logger.log(
          `Found category "${categoryFromTags}" in product tags for product ${product.id}`
        );
        return categoryFromTags;
      }

      // STEP 2: If not found in tags, call AI API
      const aiCategoryApiUrl = process.env.AI_CATEGORY_API_BASE_URL;
      if (!aiCategoryApiUrl) {
        this.logger.warn(
          "AI_CATEGORY_API_BASE_URL not configured, using fallback category"
        );
        return this.getProductCategory(product.product_type);
      }

      // Format product data for AI service (remove variants as requested)
      const productForAI = {
        id: product.id,
        title: product.title,
        body_html: product.body_html,
        vendor: product.vendor,
        product_type: product.product_type,
        created_at: product.created_at,
        handle: product.handle,
        updated_at: product.updated_at,
        published_at: product.published_at,
        template_suffix: product.template_suffix,
        published_scope: product.published_scope,
        tags: product.tags,
        status: product.status,
        admin_graphql_api_id: product.admin_graphql_api_id,
        images: product.images,
        image: product.image,
      };

      const requestPayload = {
        data: {
          products: [productForAI],
          count: 1,
          searchParams: {
            shopDomain: shopDomain,
            accessToken: accessToken,
            title: product.title,
            limit: 100,
          },
        },
        searchParams: {
          filters: {
            price_range: null,
          },
          sorting: null,
        },
      };

      const response = await fetch(
        `${aiCategoryApiUrl}/classify-existing-categories`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        }
      );

      if (!response.ok) {
        throw new Error(
          `AI Category API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Extract category from AI response
      // Your AI service returns: { "categories_in_training_data": ["fashion"] }
      const aiCategory =
        result?.categories_in_training_data?.[0] ||
        result?.category ||
        result?.data?.category ||
        result?.predicted_category ||
        result?.classification ||
        result?.result?.category;

      if (aiCategory) {
        this.logger.log(
          `AI classified product ${product.id} as category: ${aiCategory}`
        );
        return aiCategory;
      } else {
        this.logger.warn(
          `AI service did not return category for product ${product.id}, using fallback`
        );
        return this.getProductCategory(product.product_type);
      }
    } catch (error) {
      this.logger.error(
        `Failed to get category from AI service for product ${product.id}:`,
        error.message
      );
      // Fallback to local category mapping
      return this.getProductCategory(product.product_type);
    }
  }

  /**
   * Get strategy prediction from external AI service
   */
  private async getStrategyPrediction(aiData: any): Promise<any> {
    try {
      const aiCategoryApiUrl = process.env.AI_CATEGORY_API_BASE_URL;
      if (!aiCategoryApiUrl) {
        this.logger.warn(
          "AI_CATEGORY_API_BASE_URL not configured, returning original AI data"
        );
        return aiData;
      }

      const response = await fetch(`${aiCategoryApiUrl}/predict-strategy`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiData),
      });

      if (!response.ok) {
        throw new Error(
          `Strategy Prediction API error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      this.logger.log(`Strategy prediction completed successfully`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to get strategy prediction:`, error.message);
      // Fallback to original AI data if strategy prediction fails
      return aiData;
    }
  }

  /**
   * Calculate AI metrics from product and order data
   */
  private calculateAIMetrics(
    product: any,
    orders: any[],
    variantId?: string,
    externalCategory?: string
  ): any {
    // Get specific variant or primary variant for pricing
    let targetVariant = product.variants?.[0] || {};
    if (variantId) {
      const specificVariant = product.variants?.find((v) => v.id == variantId);
      if (specificVariant) {
        targetVariant = specificVariant;
      }
    }
    const price = parseFloat(targetVariant.price) || 0;

    // Calculate return rate (orders with refunds / total orders)
    const ordersWithRefunds = orders.filter(
      (order) => order.refunds && order.refunds.length > 0
    ).length;
    const returnRate =
      orders.length > 0 ? ordersWithRefunds / orders.length : 0;

    // Calculate repeat rate (customers who ordered more than once)
    const customerOrderCounts = {};
    orders.forEach((order) => {
      if (order.customer?.id) {
        customerOrderCounts[order.customer.id] =
          (customerOrderCounts[order.customer.id] || 0) + 1;
      }
    });
    const repeatCustomers = Object.values(customerOrderCounts).filter(
      (count: number) => count > 1
    ).length;
    const totalCustomers = Object.keys(customerOrderCounts).length;
    const repeatRate =
      totalCustomers > 0 ? repeatCustomers / totalCustomers : 0;

    // Calculate churn rate (inverse of repeat rate, simplified)
    const churnRate = 1 - repeatRate;

    // Determine if consumable based on category, product type and tags
    const isConsumable = 
      // Check if AI category is consumable
      (externalCategory && PRODUCT_KEYWORDS.CONSUMABLE.some(keyword => 
        externalCategory.toLowerCase().includes(keyword)
      )) ||
      // Check product type and tags
      PRODUCT_KEYWORDS.CONSUMABLE.some(
        (keyword) =>
          product.product_type?.toLowerCase().includes(keyword) ||
          product.tags?.toLowerCase().includes(keyword)
      )
        ? 1
        : 0;

    // Determine if seasonal based on tags and title
    const isSeasonal = PRODUCT_KEYWORDS.SEASONAL.some(
      (keyword) =>
        product.title?.toLowerCase().includes(keyword) ||
        product.tags?.toLowerCase().includes(keyword)
    )
      ? 1
      : 0;

    // Calculate actual shipping cost from order data - NO FALLBACK, REAL DATA ONLY
    let totalShippingCost = 0;
    let totalOrders = 0;

    orders.forEach((order) => {
      if (order.total_shipping_price_set?.shop_money?.amount !== undefined) {
        const shippingAmount = parseFloat(
          order.total_shipping_price_set.shop_money.amount
        );
        totalShippingCost += shippingAmount; // Include 0.00 shipping costs
        totalOrders++;
      }
    });

    // Calculate average shipping cost from real data only
    let shippingCost = 0; // Default to 0 if no order data
    if (totalOrders > 0) {
      shippingCost = totalShippingCost / totalOrders;
    }

    // Determine traffic source (simplified - would need analytics integration)
    const trafficSource = "organic"; // Default, would need Google Analytics integration

    // Use external AI category if provided, otherwise fallback to local mapping
    const category =
      externalCategory || this.getProductCategory(product.product_type);

    return {
      "price": price,
      "category": category,
      "return_rate": Math.round(returnRate * 100) / 100,
      "repeat_rate": Math.round(repeatRate * 100) / 100,
      "churn_rate": Math.round(churnRate * 100) / 100,
      "is_consumable": isConsumable,
      "is_seasonal": isSeasonal,
      "shipping_cost": Math.round(shippingCost * 100) / 100,
      "traffic_source": trafficSource,
    };
  }

  /**
   * Generate focused variant analytics with stale inventory detection
   */
  async generateFocusedVariantAnalytics(
    shopDomain: string,
    accessToken: string,
    productId: string,
    variantId: string,
    staleThreshold?: number
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);

      // Get product and variant details
      const productResponse = await client.get({
        path: `products/${productId}`,
      });
      const product = productResponse.body.product;
      const variant = product.variants?.find((v) => v.id == variantId);

      if (!variant) {
        throw new Error(
          `Variant ${variantId} not found in product ${productId}`
        );
      }

      // Get all orders to analyze sales for this specific variant
      const ordersResponse = await client.get({
        path: "orders",
        query: { limit: 250, status: "any" },
      });
      const allOrders = ordersResponse.body.orders;

      // Filter orders that contain this specific variant
      const variantOrders = allOrders.filter((order) =>
        order.line_items?.some((item) => item.variant_id == variantId)
      );

      // Calculate focused analytics with new percentage-based logic
      const analytics = this.calculateFocusedVariantAnalytics(
        variant,
        variantOrders,
        product,
        staleThreshold
      );

      this.logger.log(
        `Generated focused variant analytics for ${productId}/${variantId} in shop: ${shopDomain}`
      );
      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to generate focused variant analytics for ${productId}/${variantId} in shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculate focused variant analytics with stale inventory detection
   */
  private calculateFocusedVariantAnalytics(
    variant: any,
    orders: any[],
    product: any,
    staleThreshold?: number
  ): any {
    // Basic variant info
    const variantInfo = {
      variant_id: variant.id,
      product_id: variant.product_id,
      title: variant.title,
      sku: variant.sku,
      price: parseFloat(variant.price) || 0,
      created_at: variant.created_at,
      updated_at: variant.updated_at,
    };

    // Calculate sales data from orders
    let totalQuantitySold = 0;
    let totalRevenue = 0;
    let firstSaleDate = null;
    let lastSaleDate = null;

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);

      order.line_items?.forEach((item) => {
        if (item.variant_id == variant.id) {
          const quantity = item.quantity || 0;
          const itemRevenue = parseFloat(item.price) * quantity;

          totalQuantitySold += quantity;
          totalRevenue += itemRevenue;

          // Track first and last sale dates
          if (!firstSaleDate || orderDate < new Date(firstSaleDate)) {
            firstSaleDate = order.created_at;
          }
          if (!lastSaleDate || orderDate > new Date(lastSaleDate)) {
            lastSaleDate = order.created_at;
          }
        }
      });
    });

    // Calculate time-based metrics
    const publishedAt = new Date(product.published_at || product.created_at);
    const currentDate = new Date();
    const daysLive = Math.ceil(
      (currentDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const monthsLive = daysLive / 30;

    // Calculate inventory metrics
    const currentInventory = variant.inventory_quantity || 0;
    // We don't have historical inventory data, so we estimate initial inventory
    // This could be improved with inventory tracking over time
    const estimatedInitialInventory = currentInventory + totalQuantitySold;

    // Calculate monthly sales rate
    const monthlySalesRate =
      monthsLive > 0 ? totalQuantitySold / monthsLive : 0;

    // NEW: Calculate percentage-based stale analysis
    const thresholdPercent = staleThreshold || 10; // Default 10% threshold

    const staleAnalysis = this.calculatePercentageBasedStaleAnalysis(
      totalQuantitySold,
      estimatedInitialInventory,
      publishedAt,
      currentDate,
      thresholdPercent
    );

    // Calculate additional ML-ready metrics
    const averageDailySales = daysLive > 0 ? totalQuantitySold / daysLive : 0;
    const daysOfStockRemaining =
      averageDailySales > 0 ? currentInventory / averageDailySales : 0;
    const inventoryTurnoverRate =
      estimatedInitialInventory > 0
        ? totalQuantitySold / estimatedInitialInventory
        : 0;
    const stockoutRisk = daysOfStockRemaining <= 30 ? 1 : 0;
    const salesAcceleration = this.calculateSalesAcceleration(
      orders,
      variant.id
    );
    const seasonalityScore = this.calculateSeasonalityScore(orders, variant.id);
    const priceElasticity = this.calculatePriceElasticity(variant, orders);

    // Generate intelligent suggestions based on percentage-based analysis
    const suggestions = this.generateVariantSuggestions(
      variant,
      product,
      monthlySalesRate,
      thresholdPercent,
      currentInventory,
      daysOfStockRemaining,
      totalRevenue,
      monthsLive,
      salesAcceleration,
      seasonalityScore,
      staleAnalysis,
      totalQuantitySold
    );

    return {
      // Basic variant information
      variant_id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      price: parseFloat(variant.price) || 0,

      // Inventory metrics for ML
      current_quantity: currentInventory,
      estimated_initial_quantity: estimatedInitialInventory,
      total_quantity_sold: totalQuantitySold,
      inventory_turnover_rate: Math.round(inventoryTurnoverRate * 100) / 100,
      current_stock_value:
        Math.round(currentInventory * parseFloat(variant.price) * 100) / 100,

      // Sales velocity metrics
      monthly_sales_rate: Math.round(monthlySalesRate * 100) / 100,
      daily_sales_rate: Math.round(averageDailySales * 100) / 100,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_orders: orders.length,

      // Time-based features (6-month analysis)
      days_live: daysLive,
      months_live: Math.round(monthsLive * 100) / 100,
      days_since_last_sale: lastSaleDate
        ? Math.ceil(
            (currentDate.getTime() - new Date(lastSaleDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : daysLive,
      analysis_period: "Last 6 months from published date",

      // Risk indicators (NEW: percentage-based)
      is_stale: staleAnalysis
        ? staleAnalysis.is_stale
          ? 1
          : 0
        : monthlySalesRate < staleThreshold
          ? 1
          : 0,
      stockout_risk: stockoutRisk,

      // NEW: Percentage-based stale metrics
      percent_sold_per_month: staleAnalysis
        ? staleAnalysis.percent_sold_per_month
        : 0,
      threshold_percent_used: staleAnalysis
        ? staleAnalysis.threshold_percent_used
        : staleThreshold,
      days_of_stock_remaining: Math.round(daysOfStockRemaining),

      // Advanced ML features
      sales_acceleration: Math.round(salesAcceleration * 100) / 100,
      seasonality_score: Math.round(seasonalityScore * 100) / 100,
      price_elasticity_indicator: Math.round(priceElasticity * 100) / 100,

      // Product characteristics
      product_category: this.getProductCategory(product.product_type),
      is_consumable: this.isConsumableProduct(
        product.product_type,
        product.tags
      )
        ? 1
        : 0,
      is_seasonal: this.isSeasonalProduct(product.title, product.tags) ? 1 : 0,
      weight: variant.weight || 0,
      requires_shipping: variant.requires_shipping ? 1 : 0,

      // Market position
      price_vs_compare_at: variant.compare_at_price
        ? Math.round(
            (parseFloat(variant.price) / parseFloat(variant.compare_at_price)) *
              100
          ) / 100
        : 1,

      // Timestamps for ML
      created_timestamp: new Date(variant.created_at).getTime(),
      first_sale_timestamp: firstSaleDate
        ? new Date(firstSaleDate).getTime()
        : null,
      last_sale_timestamp: lastSaleDate
        ? new Date(lastSaleDate).getTime()
        : null,

      // AI-powered intelligent suggestions
      intelligent_suggestions: suggestions,
    };
  }

  /**
   * Generate simple, actionable suggestions based on calculated data
   */
  private generateVariantSuggestions(
    variant: any,
    product: any,
    monthlySalesRate: number,
    staleThreshold: number,
    currentInventory: number,
    daysOfStockRemaining: number,
    totalRevenue: number,
    monthsLive: number,
    salesAcceleration: number,
    seasonalityScore: number,
    staleAnalysis?: any,
    totalQuantitySold?: number
  ): any {
    const price = parseFloat(variant.price) || 0;
    const suggestions = [];

    // Inventory-based suggestions
    if (currentInventory === 0) {
      suggestions.push({
        type: "CRITICAL_INVENTORY",
        action: "Emergency restock required immediately",
        reason: "Product is out of stock",
        priority: "URGENT",
      });
    } else if (daysOfStockRemaining <= 7) {
      suggestions.push({
        type: "LOW_INVENTORY",
        action: `Reorder immediately - only ${Math.round(daysOfStockRemaining)} days of stock remaining`,
        reason: "Critical low inventory level",
        priority: "HIGH",
      });
    } else if (daysOfStockRemaining <= 30) {
      suggestions.push({
        type: "INVENTORY_WARNING",
        action: `Plan reorder within 1 week - ${Math.round(daysOfStockRemaining)} days remaining`,
        reason: "Low inventory approaching",
        priority: "MEDIUM",
      });
    } else if (daysOfStockRemaining > 180) {
      suggestions.push({
        type: "OVERSTOCK",
        action: "Consider clearance strategy - excess inventory detected",
        reason: `${Math.round(daysOfStockRemaining)} days of stock remaining`,
        priority: "MEDIUM",
      });
    }

    // Performance-based suggestions
    if (monthlySalesRate === 0) {
      suggestions.push({
        type: "NO_SALES",
        action: "Apply 40-50% discount or consider discontinuation",
        reason: "No sales recorded in analysis period",
        priority: "CRITICAL",
      });
    } else if (monthlySalesRate < staleThreshold * 0.3) {
      suggestions.push({
        type: "POOR_PERFORMANCE",
        action: "Apply 25-35% discount and run targeted ads",
        reason: `Very low sales rate: ${monthlySalesRate.toFixed(1)} units/month`,
        priority: "HIGH",
      });
    } else if (monthlySalesRate < staleThreshold) {
      suggestions.push({
        type: "BELOW_TARGET",
        action: "Apply 15-20% discount and optimize product visibility",
        reason: `Below target sales rate: ${monthlySalesRate.toFixed(1)} units/month (target: ${staleThreshold})`,
        priority: "MEDIUM",
      });
    } else if (monthlySalesRate >= staleThreshold * 2) {
      suggestions.push({
        type: "HIGH_PERFORMER",
        action: "Test 10-15% price increase and scale marketing",
        reason: `Excellent sales rate: ${monthlySalesRate.toFixed(1)} units/month`,
        priority: "LOW",
      });
    }

    // Trend-based suggestions
    if (salesAcceleration < -0.3) {
      suggestions.push({
        type: "DECLINING_TREND",
        action: "Investigate cause and implement recovery strategy",
        reason: "Rapidly declining sales trend detected",
        priority: "HIGH",
      });
    } else if (salesAcceleration > 0.3) {
      suggestions.push({
        type: "POSITIVE_MOMENTUM",
        action: "Increase marketing budget to capitalize on momentum",
        reason: "Strong positive sales trend detected",
        priority: "MEDIUM",
      });
    }

    // Revenue optimization suggestions
    if (monthlySalesRate >= staleThreshold && price > 0) {
      const potentialIncrease = Math.round(price * 0.15 * 100) / 100;
      suggestions.push({
        type: "PRICING_OPPORTUNITY",
        action: `Test price increase to $${(price + potentialIncrease).toFixed(2)}`,
        reason: "Strong demand indicates pricing power",
        priority: "LOW",
      });
    }

    // Seasonal suggestions
    if (seasonalityScore > 0.5) {
      suggestions.push({
        type: "SEASONAL_PLANNING",
        action: "Plan seasonal inventory and marketing campaigns",
        reason: "High seasonality pattern detected",
        priority: "MEDIUM",
      });
    }

    // Bundle suggestions for slow movers
    if (monthlySalesRate < staleThreshold && totalRevenue > 0) {
      suggestions.push({
        type: "BUNDLING_OPPORTUNITY",
        action: "Create bundles with popular products",
        reason: "Slow sales could benefit from bundling strategy",
        priority: "MEDIUM",
      });
    }

    return {
      total_suggestions: suggestions.length,
      suggestions: suggestions,
      performance_summary: {
        monthly_sales_rate: monthlySalesRate,
        stale_threshold_used: staleThreshold,
        vs_threshold: staleAnalysis
          ? `${staleAnalysis.percent_sold_per_month.toFixed(2)}% vs ${staleAnalysis.threshold_percent_used}% threshold`
          : `${((monthlySalesRate / staleThreshold) * 100).toFixed(0)}% of target`,
        inventory_status: this.getSimpleInventoryStatus(
          daysOfStockRemaining,
          currentInventory
        ),
        trend:
          salesAcceleration > 0.1
            ? "IMPROVING"
            : salesAcceleration < -0.1
              ? "DECLINING"
              : "STABLE",
      },
      threshold_explanation: {
        stale_threshold: staleThreshold,
        calculation_method: staleAnalysis
          ? staleAnalysis.calculation_method
          : this.getThresholdCalculationMethod(variant, product),
        interpretation: {
          above_threshold:
            "Product is selling >10% of inventory per month - performing well",
          at_threshold:
            "Product is selling exactly 10% of inventory per month - meeting expectations",
          below_threshold:
            "Product is selling <10% of inventory per month - considered stale",
        },
        current_performance: staleAnalysis
          ? staleAnalysis.is_stale
            ? "BELOW_THRESHOLD"
            : "ABOVE_THRESHOLD"
          : monthlySalesRate >= staleThreshold
            ? "ABOVE_THRESHOLD"
            : "BELOW_THRESHOLD",
        performance_ratio: staleAnalysis
          ? Math.round(
              (staleAnalysis.percent_sold_per_month /
                staleAnalysis.threshold_percent_used) *
                100
            ) / 100
          : Math.round((monthlySalesRate / staleThreshold) * 100) / 100,
        percentage_based_analysis: staleAnalysis
          ? {
              percent_sold_per_month: staleAnalysis.percent_sold_per_month,
              threshold_percent_used: staleAnalysis.threshold_percent_used,
              months_live: staleAnalysis.months_live,
              total_inventory_considered:
                currentInventory + (totalQuantitySold || 0),
            }
          : null,
        threshold_factors: this.getThresholdFactors(
          variant,
          product,
          totalRevenue
        ),
      },
    };
  }

  /**
   * Calculate percentage-based stale inventory analysis
   *
   * @param unitsSold - Total units sold since product launch
   * @param totalInventoryAdded - Total inventory ever added (current + sold)
   * @param publishDate - Product publish/launch date
   * @param currentDate - Current date for calculation
   * @param thresholdPercent - Percentage threshold for stale determination (default: 10%)
   * @returns Object with stale analysis results
   */
  private calculatePercentageBasedStaleAnalysis(
    unitsSold: number,
    totalInventoryAdded: number,
    publishDate: Date,
    currentDate: Date,
    thresholdPercent: number = DEFAULT_THRESHOLDS.STALE_PERCENTAGE
  ): PercentageBasedStaleAnalysis {
    // Calculate months live
    const daysLive = Math.ceil(
      (currentDate.getTime() - publishDate.getTime()) /
        TIME_CONSTANTS.MILLISECONDS_PER_DAY
    );
    const monthsLive = Math.max(
      daysLive / TIME_CONSTANTS.DAYS_PER_MONTH,
      TIME_CONSTANTS.MINIMUM_MONTHS_LIVE
    );

    // Calculate monthly sales rate
    const monthlySalesRate = unitsSold / monthsLive;

    // Calculate percentage sold per month
    const percentSoldPerMonth =
      totalInventoryAdded > 0
        ? (monthlySalesRate / totalInventoryAdded) * 100
        : 0;

    // Determine if stale
    const isStale = percentSoldPerMonth < thresholdPercent;

    return {
      is_stale: isStale,
      monthly_sales_rate: Math.round(monthlySalesRate * 100) / 100,
      percent_sold_per_month: Math.round(percentSoldPerMonth * 100) / 100,
      months_live: Math.round(monthsLive * 100) / 100,
      threshold_percent_used: thresholdPercent,
      calculation_method: `Percentage-based: ${percentSoldPerMonth.toFixed(2)}% vs ${thresholdPercent}% threshold`,
    };
  }

  /**
   * Get threshold calculation method description
   */
  private getThresholdCalculationMethod(variant: any, product: any): string {
    const currentInventory = variant.inventory_quantity || 0;
    const price = parseFloat(variant.price) || 0;

    if (currentInventory === 0) {
      return "Dynamic threshold based on product age and price (out of stock)";
    }

    const publishedAt = new Date(product.published_at || product.created_at);
    const currentDate = new Date();
    const daysLive = Math.ceil(
      (currentDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysLive <= 7) {
      return "Dynamic threshold based on new product status, inventory percentage, and price point";
    } else {
      return "Dynamic threshold based on inventory percentage remaining, price point, and product age";
    }
  }

  /**
   * Get threshold calculation factors
   */
  private getThresholdFactors(
    variant: any,
    product: any,
    totalRevenue: number
  ): any {
    const currentInventory = variant.inventory_quantity || 0;
    const price = parseFloat(variant.price) || 0;

    // Calculate total quantity sold (simplified for factors)
    const estimatedSold =
      totalRevenue > 0 ? Math.round(totalRevenue / price) : 0;
    const estimatedInitialInventory = currentInventory + estimatedSold;
    const inventoryPercentageRemaining =
      estimatedInitialInventory > 0
        ? Math.round((currentInventory / estimatedInitialInventory) * 100)
        : 0;

    // Product age
    const publishedAt = new Date(product.published_at || product.created_at);
    const currentDate = new Date();
    const daysLive = Math.ceil(
      (currentDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Price category
    let priceCategory = "very_low";
    if (price >= 500) priceCategory = "high";
    else if (price >= 100) priceCategory = "medium";
    else if (price >= 20) priceCategory = "low";

    // Inventory category
    let inventoryCategory = "out_of_stock";
    if (inventoryPercentageRemaining >= 80) inventoryCategory = "high";
    else if (inventoryPercentageRemaining >= 50) inventoryCategory = "medium";
    else if (inventoryPercentageRemaining >= 20) inventoryCategory = "low";
    else if (inventoryPercentageRemaining > 0) inventoryCategory = "very_low";

    // Age category
    let ageCategory = "new";
    if (daysLive > 30) ageCategory = "established";
    else if (daysLive > 7) ageCategory = "recent";

    return {
      inventory_percentage_remaining: inventoryPercentageRemaining,
      inventory_category: inventoryCategory,
      price_category: priceCategory,
      age_category: ageCategory,
      days_live: daysLive,
      estimated_initial_inventory: estimatedInitialInventory,
      factors_considered: [
        "inventory_percentage",
        "price_point",
        "product_age",
        "estimated_sales_velocity",
      ],
    };
  }

  /**
   * Get simple inventory status
   */
  private getSimpleInventoryStatus(
    daysRemaining: number,
    currentStock: number
  ): string {
    if (currentStock === 0) return "OUT_OF_STOCK";
    if (daysRemaining <= 7) return "CRITICAL_LOW";
    if (daysRemaining <= 30) return "LOW";
    if (daysRemaining <= 90) return "OPTIMAL";
    if (daysRemaining <= 180) return "HIGH";
    return "OVERSTOCKED";
  }

  /**
   * Classify performance into structured categories
   */
  private classifyPerformance(
    monthlySalesRate: number,
    threshold: number
  ): any {
    if (monthlySalesRate === 0) {
      return {
        grade: "F",
        urgency: "CRITICAL",
        primaryAction:
          "Immediate intervention required - consider discontinuation or major pivot",
        expectedImpact: "Prevent total loss, recover some inventory value",
        timeline: "1-2 weeks",
      };
    } else if (monthlySalesRate < threshold * 0.3) {
      return {
        grade: "D",
        urgency: "HIGH",
        primaryAction:
          "Major performance improvement needed - significant discount and promotion",
        expectedImpact:
          "50-100% sales increase expected with aggressive action",
        timeline: "2-4 weeks",
      };
    } else if (monthlySalesRate < threshold * 0.7) {
      return {
        grade: "C",
        urgency: "MEDIUM",
        primaryAction:
          "Performance optimization required - moderate promotion and visibility boost",
        expectedImpact: "25-50% sales increase with targeted improvements",
        timeline: "4-8 weeks",
      };
    } else if (monthlySalesRate < threshold) {
      return {
        grade: "B-",
        urgency: "LOW",
        primaryAction:
          "Minor optimization needed - fine-tune marketing and pricing",
        expectedImpact: "10-25% improvement with optimization",
        timeline: "1-2 months",
      };
    } else if (monthlySalesRate < threshold * 2) {
      return {
        grade: "B+",
        urgency: "LOW",
        primaryAction: "Maintain performance and explore growth opportunities",
        expectedImpact: "Sustained growth with strategic expansion",
        timeline: "Ongoing",
      };
    } else if (monthlySalesRate < threshold * 3) {
      return {
        grade: "A",
        urgency: "LOW",
        primaryAction: "Scale operations and maximize revenue potential",
        expectedImpact: "2x revenue growth with proper scaling",
        timeline: "2-3 months",
      };
    } else {
      return {
        grade: "A+",
        urgency: "LOW",
        primaryAction: "Premium positioning and market expansion",
        expectedImpact: "3x+ revenue potential with strategic positioning",
        timeline: "3-6 months",
      };
    }
  }

  /**
   * Classify inventory status
   */
  private classifyInventoryStatus(
    daysRemaining: number,
    currentStock: number
  ): any {
    if (currentStock === 0) {
      return {
        status: "OUT_OF_STOCK",
        priority: "CRITICAL",
        action: "Emergency restock required",
      };
    } else if (daysRemaining <= 7) {
      return {
        status: "CRITICAL_LOW",
        priority: "HIGH",
        action: "Immediate reorder required",
      };
    } else if (daysRemaining <= 30) {
      return {
        status: "LOW_STOCK",
        priority: "MEDIUM",
        action: "Plan reorder within 1 week",
      };
    } else if (daysRemaining <= 90) {
      return {
        status: "OPTIMAL",
        priority: "LOW",
        action: "Monitor and maintain current levels",
      };
    } else if (daysRemaining <= 180) {
      return {
        status: "HIGH_STOCK",
        priority: "LOW",
        action: "Consider reducing future orders",
      };
    } else {
      return {
        status: "OVERSTOCKED",
        priority: "MEDIUM",
        action: "Implement clearance strategy",
      };
    }
  }

  /**
   * Classify trend status
   */
  private classifyTrend(salesAcceleration: number): any {
    if (salesAcceleration > 0.3) {
      return {
        direction: "RAPIDLY_IMPROVING",
        momentum: "HIGH",
        action: "Capitalize on momentum",
      };
    } else if (salesAcceleration > 0.1) {
      return {
        direction: "IMPROVING",
        momentum: "MEDIUM",
        action: "Support positive trend",
      };
    } else if (salesAcceleration > -0.1) {
      return {
        direction: "STABLE",
        momentum: "LOW",
        action: "Maintain current strategy",
      };
    } else if (salesAcceleration > -0.3) {
      return {
        direction: "DECLINING",
        momentum: "MEDIUM",
        action: "Address negative trend",
      };
    } else {
      return {
        direction: "RAPIDLY_DECLINING",
        momentum: "HIGH",
        action: "Emergency intervention",
      };
    }
  }

  /**
   * Get immediate actions based on performance and inventory status
   */
  private getImmediateActions(
    performanceClass: any,
    inventoryStatus: any,
    daysRemaining: number
  ): string[] {
    const actions = [];

    // Performance-based actions
    if (performanceClass.grade === "F") {
      actions.push("🚨 EMERGENCY: Stop all marketing spend immediately");
      actions.push(
        "📊 Analyze root cause: pricing, quality, or market fit issues"
      );
      actions.push("💰 Apply 40-50% discount to recover inventory value");
      actions.push("📦 Consider bundling with popular products");
    } else if (performanceClass.grade === "D") {
      actions.push("🎯 Launch aggressive 25-35% discount campaign");
      actions.push("📸 Refresh product images and descriptions");
      actions.push("📱 Run targeted social media ads");
      actions.push("🔍 Analyze competitor positioning");
    } else if (performanceClass.grade.startsWith("C")) {
      actions.push("💡 Implement 15-20% promotional discount");
      actions.push("🔍 Optimize product SEO and visibility");
      actions.push("📧 Include in email marketing campaigns");
      actions.push("🤝 Set up cross-selling with related products");
    } else if (performanceClass.grade.startsWith("A")) {
      actions.push("📈 Increase marketing budget by 50%");
      actions.push("💎 Test premium pricing strategy");
      actions.push("🌍 Explore new market segments");
      actions.push("🏆 Feature as hero product in campaigns");
    }

    // Inventory-based actions
    if (inventoryStatus.status === "OUT_OF_STOCK") {
      actions.unshift(
        "🚨 CRITICAL: Emergency restock required within 24 hours"
      );
    } else if (inventoryStatus.status === "CRITICAL_LOW") {
      actions.unshift(
        `⚡ URGENT: Reorder immediately - only ${Math.round(daysRemaining)} days remaining`
      );
    } else if (inventoryStatus.status === "OVERSTOCKED") {
      actions.push("📦 Implement inventory clearance strategy");
      actions.push("🎁 Create bundle deals to move excess stock");
    }

    return actions.slice(0, 5); // Limit to top 5 actions
  }

  /**
   * Get revenue optimization strategies
   */
  private getRevenueOptimization(
    performanceClass: any,
    price: number,
    compareAtPrice: number,
    totalRevenue: number
  ): any {
    const strategies = {
      pricing_tests: [],
      bundle_opportunities: [],
      upsell_strategies: [],
      revenue_projections: {},
    };

    if (performanceClass.grade.startsWith("A")) {
      strategies.pricing_tests.push({
        strategy: "Premium Pricing Test",
        action: "Test 10-15% price increase",
        expected_impact: "15-25% revenue increase",
        risk_level: "LOW",
      });
      strategies.bundle_opportunities.push({
        strategy: "Premium Bundle Creation",
        action: "Create high-value product bundles",
        expected_impact: "30-50% AOV increase",
        implementation: "2-3 weeks",
      });
    } else if (
      performanceClass.grade === "F" ||
      performanceClass.grade === "D"
    ) {
      strategies.pricing_tests.push({
        strategy: "Clearance Pricing",
        action: "Implement graduated discount strategy",
        expected_impact: "2-3x sales velocity increase",
        risk_level: "LOW",
      });
      strategies.bundle_opportunities.push({
        strategy: "Value Bundle Creation",
        action: "Bundle with popular products at discount",
        expected_impact: "50-100% sales increase",
        implementation: "1 week",
      });
    }

    // Revenue projections
    const currentMonthlyRevenue = totalRevenue;
    strategies.revenue_projections = {
      conservative: Math.round(currentMonthlyRevenue * 1.2 * 100) / 100,
      optimistic: Math.round(currentMonthlyRevenue * 1.8 * 100) / 100,
      aggressive: Math.round(currentMonthlyRevenue * 2.5 * 100) / 100,
    };

    return strategies;
  }

  /**
   * Get inventory strategy recommendations
   */
  private getInventoryStrategy(
    inventoryStatus: any,
    performanceClass: any,
    daysRemaining: number,
    stockValue: number
  ): any {
    const strategy = {
      reorder_recommendations: {},
      safety_stock_levels: {},
      clearance_strategy: {},
      automation_setup: [],
    };

    if (performanceClass.grade.startsWith("A")) {
      strategy.reorder_recommendations = {
        frequency: "Weekly monitoring",
        quantity_multiplier: 1.5,
        lead_time_buffer: "2x current lead time",
        seasonal_adjustment: "Increase by 25% during peak seasons",
      };
      strategy.safety_stock_levels = {
        minimum_days: 45,
        optimal_days: 60,
        maximum_days: 90,
      };
    } else if (
      performanceClass.grade === "F" ||
      performanceClass.grade === "D"
    ) {
      strategy.clearance_strategy = {
        timeline: "4-6 weeks",
        discount_schedule: "Week 1: 25%, Week 3: 35%, Week 5: 50%",
        bundle_integration: "Include in value bundles",
        liquidation_threshold: `If stock value exceeds $${Math.round(stockValue * 0.7)}`,
      };
    }

    strategy.automation_setup = [
      "Set up low stock alerts at 30 days remaining",
      "Configure automatic reorder points",
      "Implement seasonal demand forecasting",
      "Set up overstock clearance triggers",
    ];

    return strategy;
  }

  /**
   * Get marketing approach recommendations
   */
  private getMarketingApproach(
    performanceClass: any,
    trendStatus: any,
    seasonalityScore: number
  ): any {
    const approach = {
      campaign_strategy: {},
      channel_recommendations: [],
      content_strategy: {},
      budget_allocation: {},
    };

    if (performanceClass.grade.startsWith("A")) {
      approach.campaign_strategy = {
        primary_goal: "Scale and expand market reach",
        campaign_type: "Growth and awareness campaigns",
        messaging: "Premium positioning and social proof",
        frequency: "Continuous with seasonal boosts",
      };
      approach.channel_recommendations = [
        "Google Ads (Search + Shopping)",
        "Facebook/Instagram premium targeting",
        "Influencer partnerships",
        "Email marketing to VIP segments",
      ];
    } else if (
      performanceClass.grade === "F" ||
      performanceClass.grade === "D"
    ) {
      approach.campaign_strategy = {
        primary_goal: "Drive immediate sales and clear inventory",
        campaign_type: "Clearance and urgency campaigns",
        messaging: "Limited time offers and value propositions",
        frequency: "Intensive 4-6 week campaign",
      };
      approach.channel_recommendations = [
        "Facebook/Instagram retargeting",
        "Google Shopping with promotional pricing",
        "Email clearance campaigns",
        "Social media flash sales",
      ];
    }

    if (seasonalityScore > 0.5) {
      approach.content_strategy = {
        ...approach.content_strategy,
        seasonal_focus:
          "High seasonality detected - create season-specific campaigns",
      };
      approach.budget_allocation = {
        ...approach.budget_allocation,
        seasonal_boost: "Increase budget by 40% during peak seasons",
      };
    }

    return approach;
  }

  /**
   * Get pricing strategy recommendations
   */
  private getPricingStrategy(
    performanceClass: any,
    price: number,
    compareAtPrice: number,
    trendStatus: any
  ): any {
    const strategy = {
      current_analysis: {},
      recommended_tests: [],
      psychological_pricing: {},
      competitive_positioning: {},
    };

    strategy.current_analysis = {
      current_price: price,
      compare_at_price: compareAtPrice || null,
      discount_percentage: compareAtPrice
        ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
        : 0,
      price_position: performanceClass.grade.startsWith("A")
        ? "Can support premium pricing"
        : "May need value positioning",
    };

    if (performanceClass.grade.startsWith("A")) {
      strategy.recommended_tests = [
        {
          test_type: "Premium Pricing",
          new_price: Math.round(price * 1.15 * 100) / 100,
          duration: "2-4 weeks",
          success_metric: "Maintain 80%+ of current sales volume",
        },
        {
          test_type: "Psychological Pricing",
          new_price: Math.ceil(price * 1.1) - 0.01,
          duration: "2 weeks",
          success_metric: "Increase conversion rate by 5%+",
        },
      ];
    } else if (
      performanceClass.grade === "F" ||
      performanceClass.grade === "D"
    ) {
      strategy.recommended_tests = [
        {
          test_type: "Clearance Pricing",
          new_price: Math.round(price * 0.7 * 100) / 100,
          duration: "2 weeks",
          success_metric: "Double sales velocity",
        },
        {
          test_type: "Flash Sale Pricing",
          new_price: Math.round(price * 0.6 * 100) / 100,
          duration: "48-72 hours",
          success_metric: "Clear 25%+ of inventory",
        },
      ];
    }

    return strategy;
  }

  /**
   * Get performance percentile
   */
  private getPerformancePercentile(
    monthlySalesRate: number,
    threshold: number
  ): string {
    const ratio = monthlySalesRate / threshold;
    if (ratio >= 3) return "Top 5% (Exceptional)";
    if (ratio >= 2) return "Top 15% (Excellent)";
    if (ratio >= 1.5) return "Top 30% (Above Average)";
    if (ratio >= 1) return "Top 50% (Average)";
    if (ratio >= 0.5) return "Bottom 30% (Below Average)";
    return "Bottom 10% (Poor)";
  }

  /**
   * Get weekly actions for action plan
   */
  private getWeeklyActions(
    week: number,
    performanceClass: any,
    inventoryStatus: any
  ): string[] {
    if (week === 1) {
      const actions = [
        "📊 Implement primary recommendations",
        "📈 Set up tracking and monitoring",
      ];
      if (
        inventoryStatus.priority === "CRITICAL" ||
        inventoryStatus.priority === "HIGH"
      ) {
        actions.unshift("📦 Execute inventory action plan");
      }
      if (
        performanceClass.urgency === "CRITICAL" ||
        performanceClass.urgency === "HIGH"
      ) {
        actions.push("🎯 Launch emergency marketing campaign");
      }
      return actions;
    } else {
      return [
        "📊 Analyze initial results and adjust strategy",
        "🔄 Optimize based on performance data",
        "📈 Scale successful initiatives",
        "🎯 Prepare for next phase implementation",
      ];
    }
  }

  /**
   * Get monthly actions for action plan
   */
  private getMonthlyActions(performanceClass: any, trendStatus: any): string[] {
    const actions = [
      "📊 Comprehensive performance review",
      "🔄 Strategy refinement based on results",
    ];

    if (performanceClass.grade.startsWith("A")) {
      actions.push("🌍 Explore market expansion opportunities");
      actions.push("💎 Develop premium product variations");
    } else if (
      performanceClass.grade === "F" ||
      performanceClass.grade === "D"
    ) {
      actions.push("🔍 Conduct deep market analysis");
      actions.push("🛠️ Consider product repositioning or discontinuation");
    }

    return actions;
  }

  /**
   * Get success metrics for tracking
   */
  private getSuccessMetrics(
    monthlySalesRate: number,
    threshold: number,
    currentInventory: number
  ): any {
    return {
      sales_targets: {
        week_1: Math.round(monthlySalesRate * 1.2 * 100) / 100,
        month_1: Math.round(monthlySalesRate * 1.5 * 100) / 100,
        month_3: Math.round(threshold * 1.2 * 100) / 100,
      },
      inventory_targets: {
        optimal_stock_days: "45-90 days",
        turnover_rate: "Increase by 25%",
        stockout_prevention: "Zero stockouts",
      },
      revenue_targets: {
        monthly_growth: "20-50% increase",
        profit_margin: "Maintain or improve current margins",
        customer_acquisition: "Reduce CAC by 15%",
      },
    };
  }

  /**
   * Calculate opportunity score
   */
  private calculateOpportunityScore(
    performanceClass: any,
    inventoryStatus: any,
    trendStatus: any
  ): number {
    let score = 0;

    // Performance contribution (40%)
    if (performanceClass.grade.startsWith("A")) score += 40;
    else if (performanceClass.grade.startsWith("B")) score += 30;
    else if (performanceClass.grade.startsWith("C")) score += 20;
    else score += 10;

    // Trend contribution (30%)
    if (trendStatus.direction === "RAPIDLY_IMPROVING") score += 30;
    else if (trendStatus.direction === "IMPROVING") score += 25;
    else if (trendStatus.direction === "STABLE") score += 15;
    else score += 5;

    // Inventory contribution (30%)
    if (inventoryStatus.status === "OPTIMAL") score += 30;
    else if (inventoryStatus.status === "LOW_STOCK") score += 20;
    else if (inventoryStatus.status === "HIGH_STOCK") score += 15;
    else score += 10;

    return Math.round(score);
  }

  /**
   * Get investment priority
   */
  private getInvestmentPriority(
    performanceClass: any,
    stockValue: number,
    totalRevenue: number
  ): string {
    if (
      performanceClass.grade.startsWith("A") &&
      totalRevenue > stockValue * 0.5
    ) {
      return "HIGH - Scale this winner";
    } else if (
      performanceClass.grade === "F" &&
      stockValue > totalRevenue * 2
    ) {
      return "LOW - Consider divestment";
    } else if (performanceClass.urgency === "CRITICAL") {
      return "URGENT - Immediate attention required";
    } else {
      return "MEDIUM - Monitor and optimize";
    }
  }

  /**
   * Get automation recommendations
   */
  private getAutomationRecommendations(
    performanceClass: any,
    inventoryStatus: any
  ): string[] {
    const recommendations = [];

    if (performanceClass.grade.startsWith("A")) {
      recommendations.push("🤖 Set up automatic reorder points");
      recommendations.push("📈 Implement dynamic pricing based on demand");
      recommendations.push("🎯 Automate high-performer marketing campaigns");
    }

    if (
      inventoryStatus.status === "LOW_STOCK" ||
      inventoryStatus.status === "CRITICAL_LOW"
    ) {
      recommendations.push("⚠️ Configure low stock alerts");
      recommendations.push("📦 Set up emergency reorder triggers");
    }

    if (performanceClass.grade === "F" || performanceClass.grade === "D") {
      recommendations.push("🚨 Automate clearance pricing triggers");
      recommendations.push("📧 Set up automated clearance email campaigns");
    }

    recommendations.push("📊 Implement performance monitoring dashboards");
    recommendations.push("🔄 Set up monthly performance review alerts");

    return recommendations;
  }

  /**
   * Get market position based on performance
   */
  private getMarketPosition(
    monthlySalesRate: number,
    threshold: number
  ): string {
    if (monthlySalesRate >= threshold * 3) return "Market Leader";
    if (monthlySalesRate >= threshold * 2) return "Strong Performer";
    if (monthlySalesRate >= threshold) return "Average Performer";
    if (monthlySalesRate >= threshold * 0.5) return "Below Average";
    return "Poor Performer";
  }

  /**
   * Get recommended focus area
   */
  private getRecommendedFocus(
    isStale: boolean,
    isHighPerformer: boolean,
    isLowStock: boolean,
    salesAcceleration: number
  ): string {
    if (isLowStock && isHighPerformer) return "Inventory Replenishment";
    if (isHighPerformer) return "Scale & Optimize";
    if (isStale && salesAcceleration < -0.1) return "Urgent Intervention";
    if (isStale) return "Performance Improvement";
    return "Maintenance & Monitoring";
  }

  /**
   * Get next review date based on urgency
   */
  private getNextReviewDate(urgencyLevel: string): string {
    const now = new Date();
    let daysToAdd = 30; // Default monthly review

    switch (urgencyLevel) {
      case "CRITICAL":
        daysToAdd = 7; // Weekly review
        break;
      case "HIGH":
        daysToAdd = 14; // Bi-weekly review
        break;
      case "MEDIUM":
        daysToAdd = 21; // Every 3 weeks
        break;
      default:
        daysToAdd = 30; // Monthly review
    }

    now.setDate(now.getDate() + daysToAdd);
    return now.toISOString().split("T")[0]; // Return YYYY-MM-DD format
  }

  /**
   * Generate recommendation for stale inventory
   */
  private generateStaleRecommendation(
    isStale: boolean,
    monthlySalesRate: number,
    threshold: number
  ): string {
    if (!isStale) {
      return "Product is performing well - no action needed";
    }

    if (monthlySalesRate === 0) {
      return "No sales recorded - consider heavy promotion, bundle deals, or discontinuation";
    } else if (monthlySalesRate < threshold * 0.5) {
      return "Very low sales - apply significant discount (20-30%) or run targeted ads";
    } else {
      return "Below target sales - consider promotion through ads or small discount (10-15%)";
    }
  }

  /**
   * Get urgency level for stale inventory
   */
  private getUrgencyLevel(monthlySalesRate: number, threshold: number): string {
    if (monthlySalesRate === 0) return "CRITICAL";
    if (monthlySalesRate < threshold * 0.3) return "HIGH";
    if (monthlySalesRate < threshold * 0.7) return "MEDIUM";
    if (monthlySalesRate < threshold) return "LOW";
    return "NONE";
  }

  /**
   * Get stock status based on days remaining
   */
  private getStockStatus(daysRemaining: number): string {
    if (daysRemaining <= 0) return "OUT_OF_STOCK";
    if (daysRemaining <= 7) return "CRITICAL_LOW";
    if (daysRemaining <= 30) return "LOW";
    if (daysRemaining <= 90) return "MODERATE";
    return "HIGH";
  }

  /**
   * Generate comprehensive variant analytics including inventory, sales, and history
   */
  async generateVariantAnalytics(
    shopDomain: string,
    accessToken: string,
    productId: string,
    variantId: string
  ): Promise<any> {
    try {
      const client = this.createClientWithCredentials(shopDomain, accessToken);

      // Get product and variant details
      const productResponse = await client.get({
        path: `products/${productId}`,
      });
      const product = productResponse.body.product;
      const variant = product.variants?.find((v) => v.id == variantId);

      if (!variant) {
        throw new Error(
          `Variant ${variantId} not found in product ${productId}`
        );
      }

      // Get all orders to analyze sales history
      const ordersResponse = await client.get({
        path: "orders",
        query: { limit: 250, status: "any" },
      });
      const allOrders = ordersResponse.body.orders;

      // Filter orders that contain this specific variant
      const variantOrders = allOrders.filter((order) =>
        order.line_items?.some((item) => item.variant_id == variantId)
      );

      // Get inventory levels from Shopify Inventory API
      let inventoryLevels = null;
      try {
        if (variant.inventory_item_id) {
          const inventoryResponse = await client.get({
            path: `inventory_levels`,
            query: { inventory_item_ids: variant.inventory_item_id },
          });
          inventoryLevels = inventoryResponse.body.inventory_levels;
        }
      } catch (error) {
        this.logger.warn(
          `Could not fetch inventory levels for variant ${variantId}:`,
          error.message
        );
      }

      // Calculate comprehensive analytics
      const analytics = this.calculateVariantAnalytics(
        variant,
        variantOrders,
        inventoryLevels,
        product
      );

      this.logger.log(
        `Generated variant analytics for ${productId}/${variantId} in shop: ${shopDomain}`
      );
      return analytics;
    } catch (error) {
      this.logger.error(
        `Failed to generate variant analytics for ${productId}/${variantId} in shop ${shopDomain}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Calculate comprehensive variant analytics
   */
  private calculateVariantAnalytics(
    variant: any,
    orders: any[],
    inventoryLevels: any[],
    product: any
  ): any {
    // Basic variant info
    const variantInfo = {
      variant_id: variant.id,
      product_id: variant.product_id,
      title: variant.title,
      sku: variant.sku,
      barcode: variant.barcode,
      price: parseFloat(variant.price) || 0,
      compare_at_price: parseFloat(variant.compare_at_price) || null,
      created_at: variant.created_at,
      updated_at: variant.updated_at,
    };

    // Current inventory status
    const inventoryStatus = {
      current_quantity: variant.inventory_quantity || 0,
      inventory_policy: variant.inventory_policy,
      inventory_management: variant.inventory_management,
      requires_shipping: variant.requires_shipping,
      weight: variant.weight || 0,
      weight_unit: variant.weight_unit || "kg",
    };

    // Sales analytics from orders
    let totalQuantitySold = 0;
    let totalRevenue = 0;
    let firstSaleDate = null;
    let lastSaleDate = null;
    const salesByMonth = {};
    const salesByDay = {};

    orders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
      const dayKey = orderDate.toISOString().split("T")[0];

      order.line_items?.forEach((item) => {
        if (item.variant_id == variant.id) {
          const quantity = item.quantity || 0;
          const itemRevenue = parseFloat(item.price) * quantity;

          totalQuantitySold += quantity;
          totalRevenue += itemRevenue;

          // Track first and last sale dates
          if (!firstSaleDate || orderDate < new Date(firstSaleDate)) {
            firstSaleDate = order.created_at;
          }
          if (!lastSaleDate || orderDate > new Date(lastSaleDate)) {
            lastSaleDate = order.created_at;
          }

          // Group sales by month
          if (!salesByMonth[monthKey]) {
            salesByMonth[monthKey] = { quantity: 0, revenue: 0, orders: 0 };
          }
          salesByMonth[monthKey].quantity += quantity;
          salesByMonth[monthKey].revenue += itemRevenue;
          salesByMonth[monthKey].orders += 1;

          // Group sales by day
          if (!salesByDay[dayKey]) {
            salesByDay[dayKey] = { quantity: 0, revenue: 0, orders: 0 };
          }
          salesByDay[dayKey].quantity += quantity;
          salesByDay[dayKey].revenue += itemRevenue;
          salesByDay[dayKey].orders += 1;
        }
      });
    });

    // Calculate performance metrics
    const daysSinceFirstSale = firstSaleDate
      ? Math.ceil(
          (new Date().getTime() - new Date(firstSaleDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    const averageDailySales =
      daysSinceFirstSale > 0 ? totalQuantitySold / daysSinceFirstSale : 0;
    const averageOrderValue =
      totalQuantitySold > 0 ? totalRevenue / totalQuantitySold : 0;

    // Inventory turnover and stock status
    const stockStatus = this.calculateStockStatus(
      variant.inventory_quantity,
      averageDailySales
    );

    // Recent sales trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSales = orders.filter(
      (order) =>
        new Date(order.created_at) >= thirtyDaysAgo &&
        order.line_items?.some((item) => item.variant_id == variant.id)
    );

    const recentQuantitySold = recentSales.reduce((total, order) => {
      return (
        total +
        order.line_items
          .filter((item) => item.variant_id == variant.id)
          .reduce((sum, item) => sum + (item.quantity || 0), 0)
      );
    }, 0);

    return {
      // Basic Info
      variant_info: variantInfo,
      product_title: product.title,

      // Current Inventory
      inventory: {
        ...inventoryStatus,
        stock_status: stockStatus.status,
        days_of_stock_remaining: stockStatus.daysRemaining,
        reorder_recommended: stockStatus.reorderRecommended,
      },

      // Sales Performance
      sales_analytics: {
        total_quantity_sold: totalQuantitySold,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_orders: orders.length,
        first_sale_date: firstSaleDate,
        last_sale_date: lastSaleDate,
        days_since_first_sale: daysSinceFirstSale,
        average_daily_sales: Math.round(averageDailySales * 100) / 100,
        average_order_value: Math.round(averageOrderValue * 100) / 100,
      },

      // Recent Performance (Last 30 days)
      recent_performance: {
        quantity_sold_last_30_days: recentQuantitySold,
        orders_last_30_days: recentSales.length,
        sales_velocity: Math.round((recentQuantitySold / 30) * 100) / 100,
      },

      // Sales Trends
      sales_by_month: salesByMonth,
      sales_by_day: Object.keys(salesByDay)
        .sort()
        .slice(-30) // Last 30 days
        .reduce((result, key) => {
          result[key] = salesByDay[key];
          return result;
        }, {}),

      // Inventory Insights
      inventory_insights: {
        current_stock_value:
          Math.round(
            (variant.inventory_quantity || 0) * parseFloat(variant.price) * 100
          ) / 100,
        turnover_rate:
          daysSinceFirstSale > 0
            ? Math.round((totalQuantitySold / daysSinceFirstSale) * 365 * 100) /
              100
            : 0,
        stock_to_sales_ratio:
          totalQuantitySold > 0
            ? Math.round(
                ((variant.inventory_quantity || 0) / totalQuantitySold) * 100
              ) / 100
            : 0,
      },
    };
  }

  /**
   * Calculate stock status and recommendations
   */
  private calculateStockStatus(
    currentStock: number,
    averageDailySales: number
  ): any {
    const stock = currentStock || 0;
    const dailySales = averageDailySales || 0;

    let status = "unknown";
    let daysRemaining = 0;
    let reorderRecommended = false;

    if (stock === 0) {
      status = "out_of_stock";
      daysRemaining = 0;
      reorderRecommended = true;
    } else if (dailySales > 0) {
      daysRemaining = Math.ceil(stock / dailySales);

      if (daysRemaining <= 7) {
        status = "low_stock";
        reorderRecommended = true;
      } else if (daysRemaining <= 30) {
        status = "moderate_stock";
        reorderRecommended = false;
      } else {
        status = "high_stock";
        reorderRecommended = false;
      }
    } else {
      // No sales history
      if (stock < 10) {
        status = "low_stock";
      } else if (stock < 50) {
        status = "moderate_stock";
      } else {
        status = "high_stock";
      }
    }

    return {
      status,
      daysRemaining: Math.round(daysRemaining),
      reorderRecommended,
    };
  }

  /**
   * Calculate sales acceleration (trend over time)
   */
  private calculateSalesAcceleration(orders: any[], variantId: string): number {
    const variantOrders = orders
      .filter((order) =>
        order.line_items?.some((item) => item.variant_id == variantId)
      )
      .sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

    if (variantOrders.length < 2) return 0;

    const midPoint = Math.floor(variantOrders.length / 2);
    const firstHalf = variantOrders.slice(0, midPoint);
    const secondHalf = variantOrders.slice(midPoint);

    const firstHalfSales = firstHalf.reduce((sum, order) => {
      return (
        sum +
        order.line_items
          .filter((item) => item.variant_id == variantId)
          .reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
      );
    }, 0);

    const secondHalfSales = secondHalf.reduce((sum, order) => {
      return (
        sum +
        order.line_items
          .filter((item) => item.variant_id == variantId)
          .reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
      );
    }, 0);

    const firstHalfDays =
      firstHalf.length > 0
        ? (new Date(firstHalf[firstHalf.length - 1].created_at).getTime() -
            new Date(firstHalf[0].created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        : 1;
    const secondHalfDays =
      secondHalf.length > 0
        ? (new Date(secondHalf[secondHalf.length - 1].created_at).getTime() -
            new Date(secondHalf[0].created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        : 1;

    const firstHalfRate = firstHalfSales / Math.max(firstHalfDays, 1);
    const secondHalfRate = secondHalfSales / Math.max(secondHalfDays, 1);

    return firstHalfRate > 0
      ? (secondHalfRate - firstHalfRate) / firstHalfRate
      : 0;
  }

  /**
   * Calculate seasonality score based on sales patterns
   */
  private calculateSeasonalityScore(orders: any[], variantId: string): number {
    const salesByMonth = {};

    orders.forEach((order) => {
      const month = new Date(order.created_at).getMonth();
      order.line_items?.forEach((item) => {
        if (item.variant_id == variantId) {
          salesByMonth[month] =
            (salesByMonth[month] || 0) + (item.quantity || 0);
        }
      });
    });

    const monthlyValues = Object.values(salesByMonth) as number[];
    if (monthlyValues.length < 2) return 0;

    const mean =
      monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length;
    const variance =
      monthlyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      monthlyValues.length;

    return mean > 0 ? Math.sqrt(variance) / mean : 0;
  }

  /**
   * Calculate price elasticity indicator
   */
  private calculatePriceElasticity(variant: any, orders: any[]): number {
    const currentPrice = parseFloat(variant.price) || 0;
    const compareAtPrice = parseFloat(variant.compare_at_price) || 0;

    if (compareAtPrice > 0 && currentPrice > 0) {
      const priceChange = (currentPrice - compareAtPrice) / compareAtPrice;
      const totalSales = orders.reduce((sum, order) => {
        return (
          sum +
          order.line_items
            .filter((item) => item.variant_id == variant.id)
            .reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
        );
      }, 0);

      // Simple elasticity indicator based on price difference and sales
      return priceChange !== 0 ? totalSales / Math.abs(priceChange) : 0;
    }

    return 0;
  }

  /**
   * Get product category for ML
   */
  private getProductCategory(productType: string): string {
    return CATEGORY_MAPPING[productType?.toLowerCase()] || "general";
  }

  /**
   * Check if product is consumable
   */
  private isConsumableProduct(productType: string, tags: string): boolean {
    return PRODUCT_KEYWORDS.CONSUMABLE.some(
      (keyword) =>
        productType?.toLowerCase().includes(keyword) ||
        tags?.toLowerCase().includes(keyword)
    );
  }

  /**
   * Check if product is seasonal
   */
  private isSeasonalProduct(title: string, tags: string): boolean {
    return PRODUCT_KEYWORDS.SEASONAL.some(
      (keyword) =>
        title?.toLowerCase().includes(keyword) ||
        tags?.toLowerCase().includes(keyword)
    );
  }

  /**
   * Extract category from product tags by checking for predefined categories
   */
  private getCategoryFromTags(tags: string): PredefinedCategory | null {
    if (!tags) return null;

    const tagsLower = tags.toLowerCase();

    // Check each predefined category against the tags
    for (const category of PREDEFINED_CATEGORIES) {
      if (tagsLower.includes(category)) {
        return category;
      }
    }

    return null;
  }
}
