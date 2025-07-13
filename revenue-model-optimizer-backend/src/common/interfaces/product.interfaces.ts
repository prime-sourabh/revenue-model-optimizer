// LTV/CAC Analysis Interfaces
export interface LTVCACInput {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  churn_rate?: number; // Optional, will use default if not provided
  total_ad_spend: number;
  new_customers_acquired: number;
  time_period_months?: number; // Optional, defaults to 12 months
}

export interface LTVCACMetrics {
  ltv: number;
  cac: number;
  aov: number; // Average Order Value
  purchase_frequency: number;
  customer_lifespan_months: number;
  ltv_cac_ratio: number;
  payback_period_months: number;
  monthly_cohort_profit: number;
}

export interface LTVCACRecommendation {
  status: "excellent" | "great" | "good" | "fair" | "poor" | "critical";
  score: number; // 0-100 business health score
  primary_message: string;
  detailed_analysis: string;
  action_items: string[];
  risk_factors: string[];
  growth_opportunities: string[];
}

export interface LTVCACAnalysis {
  metrics: LTVCACMetrics;
  recommendation: LTVCACRecommendation;
  benchmark_comparison: {
    industry_average_ltv_cac_ratio: number;
    your_performance: "above_average" | "average" | "below_average";
    percentile_rank: number;
  };
  scenario_analysis: {
    optimistic: LTVCACMetrics;
    realistic: LTVCACMetrics;
    pessimistic: LTVCACMetrics;
  };
  calculated_at: string;
}

export interface CustomerCohortData {
  cohort_month: string;
  customers_acquired: number;
  total_revenue: number;
  retention_rate: number;
  avg_monthly_revenue_per_customer: number;
}

export interface LTVCACTrendData {
  month: string;
  ltv: number;
  cac: number;
  ltv_cac_ratio: number;
  new_customers: number;
  revenue: number;
}

// Product search and analytics interfaces
export interface ProductSearchParams {
  limit?: number;
  page_info?: string;
  search?: string;
  title?: string;
  category?: string;
  status?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  vendor?: string;
  product_type?: string;
  created_at_min?: string;
  created_at_max?: string;
  updated_at_min?: string;
  updated_at_max?: string;
  sku?: string;
  barcode?: string;
  tags?: string;
  price_min?: number;
  price_max?: number;
  inventory_quantity_min?: number;
  inventory_quantity_max?: number;
}

export interface VariantInfo {
  variant_id: number;
  product_id: number;
  sku: string;
  price: number;
  current_quantity: number;
  total_quantity_sold: number;
}

export interface InventoryStatus {
  status: string;
  days_of_stock_remaining: number;
  reorder_point: number;
  safety_stock_level: number;
}

export interface SalesAnalytics {
  monthly_sales_rate: number;
  daily_sales_rate: number;
  total_revenue: number;
  total_orders: number;
  days_live: number;
  months_live: number;
}

export interface PercentageBasedStaleAnalysis {
  is_stale: boolean;
  monthly_sales_rate: number;
  percent_sold_per_month: number;
  months_live: number;
  threshold_percent_used: number;
  calculation_method: string;
}

export interface IntelligentSuggestions {
  primary_action: string;
  secondary_actions: string[];
  risk_level: string;
  confidence_score: number;
  expected_impact: string;
}

export interface VariantAnalytics {
  variant_info: VariantInfo;
  inventory_status: InventoryStatus;
  sales_analytics: SalesAnalytics;
  stale_analysis: PercentageBasedStaleAnalysis;
  intelligent_suggestions: IntelligentSuggestions;
}

export interface StockStatus {
  status: string;
  days_remaining: number;
  reorder_recommended: boolean;
}

export interface ThresholdFactors {
  category_factor: number;
  seasonality_factor: number;
  price_tier_factor: number;
  final_threshold: number;
}

export interface AIMetrics {
  price: number;
  category: string;
  return_rate: number;
  repeat_rate: number;
  churn_rate: number;
  is_consumable: number;
  is_seasonal: number;
  shipping_cost: number;
  traffic_source: string;
}

export interface PaginationInfo {
  has_next_page: boolean;
  has_previous_page: boolean;
  next_page_info?: string;
  previous_page_info?: string;
}

export interface ProductSearchResult {
  products: any[];
  pagination: PaginationInfo;
  total_count: number;
  search_metadata: {
    query: string;
    filters_applied: string[];
    sort_applied: string;
    execution_time_ms: number;
  };
}
