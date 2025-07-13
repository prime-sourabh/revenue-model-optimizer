// Predefined categories for tag-based detection
export const PREDEFINED_CATEGORIES = [
  'furniture',
  'fashion',
  'food',
  'fitness',
  'electronics',
] as const;

export type PredefinedCategory = (typeof PREDEFINED_CATEGORIES)[number];

// Time-related constants
export const TIME_CONSTANTS = {
  MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24,
  DAYS_PER_MONTH: 30,
  MINIMUM_MONTHS_LIVE: 0.033, // Minimum 1 day = 0.033 months
} as const;

// Default thresholds
export const DEFAULT_THRESHOLDS = {
  STALE_PERCENTAGE: 10, // 10% threshold for stale analysis
  MINIMUM_STALE_THRESHOLD: 0.5,
} as const;

// Category mapping for product types
export const CATEGORY_MAPPING = {
  clothing: 'fashion',
  accessories: 'fashion',
  electronics: 'electronics',
  home: 'home',
  sports: 'fitness',
  health: 'health',
  beauty: 'beauty',
  toys: 'toys',
  books: 'books',
  automotive: 'automotive',
} as const;

// Product keywords for classification
export const PRODUCT_KEYWORDS = {
  CONSUMABLE: [
    'food',
    'beverage',
    'supplement',
    'consumable',
  ],
  SEASONAL: [
    'winter',
    'summer',
    'spring',
    'fall',
    'autumn',
    'holiday',
    'christmas',
    'seasonal',
    'diwali',
    'holi',
    'rakhi',
  ],
} as const;

// Performance grade thresholds
export const PERFORMANCE_THRESHOLDS = {
  GRADE_A_PLUS: 3, // 3x threshold
  GRADE_A: 2, // 2x threshold
  GRADE_B_PLUS: 1, // 1x threshold
  GRADE_B_MINUS: 0.7, // 0.7x threshold
  GRADE_C: 0.3, // 0.3x threshold
  GRADE_D: 0.1, // 0.1x threshold
  // Below 0.1x = Grade F
} as const;

// Inventory status thresholds (days)
export const INVENTORY_THRESHOLDS = {
  CRITICAL_LOW: 7,
  LOW: 30,
  OPTIMAL: 90,
  HIGH: 180,
} as const;

// Sales acceleration thresholds
export const SALES_ACCELERATION_THRESHOLDS = {
  RAPIDLY_IMPROVING: 0.3,
  IMPROVING: 0.1,
  STABLE_UPPER: 0.1,
  STABLE_LOWER: -0.1,
  DECLINING: -0.3,
  // Below -0.3 = RAPIDLY_DECLINING
} as const;

// LTV/CAC Analysis Constants
export const LTV_CAC_THRESHOLDS = {
  EXCELLENT_RATIO: 5, // LTV > 5x CAC = Excellent
  GREAT_RATIO: 3, // LTV > 3x CAC = Great
  GOOD_RATIO: 2, // LTV > 2x CAC = Good
  MINIMUM_VIABLE: 1, // LTV > 1x CAC = Viable
  BREAK_EVEN: 1, // LTV = CAC = Break even
} as const;

export const CUSTOMER_METRICS_DEFAULTS = {
  DEFAULT_CHURN_RATE: 0.05, // 5% monthly churn if not provided
  MINIMUM_CHURN_RATE: 0.01, // 1% minimum to avoid division by zero
  MAXIMUM_CHURN_RATE: 0.5, // 50% maximum reasonable churn
  DEFAULT_CUSTOMER_LIFESPAN_MONTHS: 20, // 20 months if churn rate unavailable
} as const;

export const BUSINESS_HEALTH_SCORES = {
  EXCELLENT: 90,
  GREAT: 75,
  GOOD: 60,
  FAIR: 45,
  POOR: 30,
  CRITICAL: 15,
} as const;