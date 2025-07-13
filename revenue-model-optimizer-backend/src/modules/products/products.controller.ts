import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Logger,
} from "@nestjs/common";
import { ProductsService } from "./products.service";

export class ShopCredentialsDto {
  shopDomain: string;
  accessToken: string;
}

export class ProductsRequestDto extends ShopCredentialsDto {
  limit?: number;
  pageInfo?: string;
  search?: string;
}

export class ProductSearchDto extends ShopCredentialsDto {
  // Basic search
  title?: string;
  vendor?: string;
  product_type?: string;
  status?: string;

  // Advanced search
  search?: string; // Multi-field search
  tags?: string; // Search in tags
  sku?: string; // Search in variant SKUs
  barcode?: string; // Search in variant barcodes

  // Filters
  price_min?: number; // Minimum price
  price_max?: number; // Maximum price
  inventory_quantity_min?: number;
  inventory_quantity_max?: number;

  // Date filters
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;

  // Pagination
  limit?: number;
  page_info?: string;

  // Sorting
  sort_by?: "title" | "created_at" | "updated_at" | "price";
  sort_order?: "asc" | "desc";
}

@Controller("products")
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  /**
   * Get products directly from Shopify API with credentials in body
   */
  @Post("fetch")
  async getProducts(@Body() request: ProductsRequestDto) {
    try {
      const { shopDomain, accessToken, limit = 50, pageInfo, search } = request;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
          example: {
            shopDomain: "your-shop.myshopify.com",
            accessToken: "your_access_token_here",
            limit: 10,
            search: "optional_search_term",
          },
        };
      }

      const result =
        await this.productsService.getProductsFromShopifyWithCredentials(
          shopDomain,
          accessToken,
          limit,
          pageInfo,
          search,
        );

      return {
        message: "Products retrieved successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to get products:`, error);
      return {
        error: "Failed to retrieve products",
        details: error.message,
      };
    }
  }

  /**
   * Advanced product search with filters and variants support
   * POST /api/v1/products/search
   */
  @Post("search")
  async searchProducts(@Body() request: ProductSearchDto) {
    try {
      const { shopDomain, accessToken } = request;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
          example: {
            shopDomain: "your-shop.myshopify.com",
            accessToken: "your_access_token_here",
            search: "blue shirt",
            price_min: 10,
            price_max: 100,
            sku: "SHIRT-L-BLUE",
            sort_by: "price",
            sort_order: "asc",
          },
        };
      }

      const result = await this.productsService.searchProductsAdvanced(
        shopDomain,
        accessToken,
        request,
      );

      return {
        message: "Products search completed successfully",
        data: result,
        searchParams: {
          search: request.search,
          filters: {
            price_range:
              request.price_min || request.price_max
                ? `${request.price_min || 0} - ${request.price_max || "∞"}`
                : null,
            vendor: request.vendor,
            product_type: request.product_type,
            sku: request.sku,
            barcode: request.barcode,
          },
          sorting: request.sort_by
            ? `${request.sort_by} ${request.sort_order || "asc"}`
            : null,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to search products:`, error);
      return {
        error: "Failed to search products",
        details: error.message,
      };
    }
  }

  /**
   * Search products by SKU or Barcode
   * POST /api/v1/products/search-variants
   */
  @Post("search-variants")
  async searchVariants(@Body() request: ProductSearchDto) {
    try {
      const { shopDomain, accessToken, sku, barcode } = request;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
        };
      }

      if (!sku && !barcode) {
        return {
          error: "Missing search criteria",
          required: ["sku OR barcode"],
          example: {
            shopDomain: "your-shop.myshopify.com",
            accessToken: "your_access_token_here",
            sku: "SHIRT-L-BLUE",
            barcode: "123456789012",
          },
        };
      }

      const result = await this.productsService.searchProductsByVariants(
        shopDomain,
        accessToken,
        request,
      );

      return {
        message: "Variant search completed successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to search variants:`, error);
      return {
        error: "Failed to search variants",
        details: error.message,
      };
    }
  }

  /**
   * Get single product by ID with credentials in body
   */
  @Post("fetch/:productId")
  async getProduct(
    @Param("productId") productId: string,
    @Body() credentials: ShopCredentialsDto,
  ) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
        };
      }

      const product =
        await this.productsService.getProductFromShopifyWithCredentials(
          shopDomain,
          accessToken,
          productId,
        );

      return {
        message: "Product retrieved successfully",
        data: product,
      };
    } catch (error) {
      this.logger.error(`Failed to get product ${productId}:`, error);
      return {
        error: "Failed to retrieve product",
        details: error.message,
      };
    }
  }

  /**
   * Get single variant details by variant ID
   * POST /api/v1/products/variant/:variantId
   */
  @Post("variant/:variantId")
  async getVariant(
    @Param("variantId") variantId: string,
    @Body() credentials: ShopCredentialsDto,
  ) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
          example: {
            shopDomain: "your-shop.myshopify.com",
            accessToken: "your_access_token_here",
          },
        };
      }

      const variant =
        await this.productsService.getVariantFromShopifyWithCredentials(
          shopDomain,
          accessToken,
          variantId,
        );

      return {
        message: "Variant retrieved successfully",
        data: variant,
      };
    } catch (error) {
      this.logger.error(`Failed to get variant ${variantId}:`, error);
      return {
        error: "Failed to retrieve variant",
        details: error.message,
      };
    }
  }

  /**
   * Get product count with credentials in body
   */
  @Post("count")
  async getProductCount(@Body() credentials: ShopCredentialsDto) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
        };
      }

      const count = await this.productsService.getProductCountWithCredentials(
        shopDomain,
        accessToken,
      );

      return {
        message: "Product count retrieved successfully",
        data: { count },
      };
    } catch (error) {
      this.logger.error(`Failed to get product count:`, error);
      return {
        error: "Failed to retrieve product count",
        details: error.message,
      };
    }
  }

  /**
   * Get AI-ready data for specific variant (both productId and variantId required)
   * POST /api/v1/products/ai-data/:productId/:variantId
   */
  @Post("ai-data/:productId/:variantId")
  async getAIVariantData(
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() credentials: ShopCredentialsDto,
  ) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
          example: {
            shopDomain: "your-shop.myshopify.com",
            accessToken: "your_access_token_here",
          },
        };
      }

      const aiData = await this.productsService.generateAIProductData(
        shopDomain,
        accessToken,
        productId,
        variantId,
      );

      return {
        message: "AI product data generated successfully",
        data: aiData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate AI data for product ${productId}, variant ${variantId}:`,
        error,
      );
      return {
        error: "Failed to generate AI product data",
        details: error.message,
      };
    }
  }

  /**
   * Get focused variant analytics with stale inventory detection
   * POST /api/v1/products/variant-analytics/:productId/:variantId
   */
  @Post("variant-analytics/:productId/:variantId")
  async getVariantAnalytics(
    @Param("productId") productId: string,
    @Param("variantId") variantId: string,
    @Body() request: ShopCredentialsDto & { threshold_percent?: number },
  ) {
    try {
      const { shopDomain, accessToken, threshold_percent } = request;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
          example: {
            shopDomain: "your-shop.myshopify.com",
            accessToken: "your_access_token_here",
            stale_threshold: 2,
          },
        };
      }

      const analytics =
        await this.productsService.generateFocusedVariantAnalytics(
          shopDomain,
          accessToken,
          productId,
          variantId,
          threshold_percent,
        );

      return {
        message: "Variant analytics generated successfully",
        data: analytics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate variant analytics for ${productId}/${variantId}:`,
        error,
      );
      return {
        error: "Failed to generate variant analytics",
        details: error.message,
      };
    }
  }

  /**
   * Get product analytics with credentials in body
   */
  @Post("analytics")
  async getProductAnalytics(@Body() credentials: ShopCredentialsDto) {
    try {
      const { shopDomain, accessToken } = credentials;

      if (!shopDomain || !accessToken) {
        return {
          error: "Missing required credentials",
          required: ["shopDomain", "accessToken"],
        };
      }

      const analytics =
        await this.productsService.calculateProductAnalyticsWithCredentials(
          shopDomain,
          accessToken,
        );

      return {
        message: "Product analytics calculated successfully",
        data: analytics,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate product analytics:`, error);
      return {
        error: "Failed to calculate product analytics",
        details: error.message,
      };
    }
  }
}
