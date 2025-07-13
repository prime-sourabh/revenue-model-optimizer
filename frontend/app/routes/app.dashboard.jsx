import React, { useState, useEffect } from "react";

const BASE_URL = "https://0cfdd25182e1.ngrok-free.app";
const FETCH_API = `${BASE_URL}/api/v1/products/fetch`;
const SEARCH_API = `${BASE_URL}/api/v1/products/search`;
const SHOP_DOMAIN = process.env.SHOP_DOMAIN 
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const accent = "#008060";
const bg = "#f6f8fa";
const cardBg = "#fff";
const shadow = "0 2px 12px 0 rgba(0,0,0,0.07)";
const border = "1px solid #e3e6ea";
const pillBg = "#f0f7f4";
const pillSelected = accent;
const pillSelectedBg = "#e6f7e6";
const summaryBg = "linear-gradient(90deg,#e6f7e6 0,#f6f8fa 100%)";
const font = "Inter,Roboto,sans-serif";

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [productLoading, setProductLoading] = useState(false);
  const [variantAnalytics, setVariantAnalytics] = useState(null);
  const [ltvCacLoading, setLtvCacLoading] = useState(false);
  const [ltvCacData, setLtvCacData] = useState(null);
  const [adSpend, setAdSpend] = useState(0);
  const [isSubmit,setIsSubmit] = useState(false);


  // Function to get pricing model data
  const getPricingModelData = (pricingModel) => {
    const model = pricingModel?.toUpperCase();
    
    switch (model) {
      case 'SUBSCRIPTION':
        return {
          benefits: [
            "Predictable recurring revenue",
            "30–60% higher LTV",
            "Churn-resistance with bundled perks",
            "71% of merchants report revenue increase using subscriptions"
          ],
          impactProbability: "Very High (~70–80%)"
        };

      case 'FREEMIUM':
        return {
          benefits: [
            "High signup rate (~31%)",
            "Only 2–5% conversion to paid unless value gated",
            "Conversion improves by ~60% when features are gated strategically"
          ],
          impactProbability: "Moderate (~40–60%)"
        };

      case 'MEMBERSHIP ONLY':
        return {
          benefits: [
            "2x–3x repeat purchase behavior",
            "Pura Vida reports 2x AOV via membership",
            "150% revenue increase within 6 months reported by creator stores"
          ],
          impactProbability: "High (~60–75%)"
        };

      case 'RENTAL':
        return {
          benefits: [
            "Recurring usage without full purchase commitment",
            "Growing trend in fashion and sustainability sectors",
            "Higher repeat use in rental businesses, especially in Gen Z audiences"
          ],
          impactProbability: "Moderate (~40–60%)"
        };

      case 'ONE-TIME PURCHASE':
        return {
          benefits: [
            "Fast conversion",
            "Requires fewer technical setups",
            "Needs repeat purchase engine to sustain growth"
          ],
          limitations: [
            "No recurring revenue",
            "LTV plateau risk if no automation or upselling"
          ],
          impactProbability: "Moderate (~30–50%)"
        };

      default:
        return {
          benefits: [],
          impactProbability: "Unknown",
          fallbackReason: aiData?.data?.reason?.replace(/\*/g, "")
        };
    }
  };


  // Fetch all products on mount
  useEffect(() => {
    setLoading(true);
    fetch(FETCH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopDomain: SHOP_DOMAIN,
        accessToken: ACCESS_TOKEN,
        limit: 200,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        let products = [];
        if (Array.isArray(data)) {
          products = data;
        } else if (data.products && Array.isArray(data.products)) {
          products = data.products;
        } else if (
          data.data &&
          data.data.products &&
          Array.isArray(data.data.products)
        ) {
          products = data.data.products;
        } else if (data.data && Array.isArray(data.data)) {
          products = data.data;
        }
        setProducts(products);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch all products when search box is cleared
  useEffect(() => {
    if (search === "") {
      setLoading(true);
      fetch(FETCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: SHOP_DOMAIN,
          accessToken: ACCESS_TOKEN,
          limit: 200,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          let products = [];
          if (Array.isArray(data)) {
            products = data;
          } else if (data.products && Array.isArray(data.products)) {
            products = data.products;
          } else if (
            data.data &&
            data.data.products &&
            Array.isArray(data.data.products)
          ) {
            products = data.data.products;
          } else if (data.data && Array.isArray(data.data)) {
            products = data.data;
          }
          setProducts(products);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [search]);

  // Search handler (only on button click or Enter)
  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    if (!search) {
      // If search is empty, fetch all products
      fetch(FETCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: SHOP_DOMAIN,
          accessToken: ACCESS_TOKEN,
          limit: 18000,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          let products = [];
          if (Array.isArray(data)) {
            products = data;
          } else if (data.products && Array.isArray(data.products)) {
            products = data.products;
          } else if (
            data.data &&
            data.data.products &&
            Array.isArray(data.data.products)
          ) {
            products = data.data.products;
          } else if (data.data && Array.isArray(data.data)) {
            products = data.data;
          }
          setProducts(products);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }
    fetch(SEARCH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopDomain: SHOP_DOMAIN,
        accessToken: ACCESS_TOKEN,
        title: search,
        limit: 18000,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        let products = [];
        if (Array.isArray(data)) {
          products = data;
        } else if (data.products && Array.isArray(data.products)) {
          products = data.products;
        } else if (
          data.data &&
          data.data.products &&
          Array.isArray(data.data.products)
        ) {
          products = data.data.products;
        } else if (data.data && Array.isArray(data.data)) {
          products = data.data;
        }
        setProducts(products);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // Handle product click: set selected and fetch AI data for first variant
  const handleProductClick = (p) => {
    setSelectedProduct(p);
    setSelectedVariantIndex(0);
    setAiData(null);
    setAiError(null);
    if (!p.id || !p.variants || !p.variants[0]?.id) return;
    fetchAiData(p, 0);
  };

  // Fetch AI data for a given variant index (and show loader for product details)
  const fetchAiData = (product, variantIdx) => {
    setAiData(null);
    setAiError(null);
    setAiLoading(true);
    setProductLoading(true);
    setVariantAnalytics(null);
    const variant = product.variants && product.variants[variantIdx];
    if (!variant?.product_id || !variant?.id) {
      setAiError("No variant id found");
      setAiLoading(false);
      setProductLoading(false);
      return;
    }
    fetch(
      `${BASE_URL}/api/v1/products/ai-data/${variant.product_id}/${variant.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: SHOP_DOMAIN,
          accessToken: ACCESS_TOKEN,
        }),
      },
    )
      .then((res) => res.json())
      .then((data) => {
        setSelectedProduct(data);
        setAiData(data);
        setAiLoading(false);
        setProductLoading(false);
        // Fetch variant analytics after AI data
        console.log("Fetching analytics for:", variant.product_id, variant.id);

        // First try GET request
        fetch(
          `${BASE_URL}/api/v1/products/variant-analytics/${variant.product_id}/${variant.id}`,
        )
          .then((res) => {
            console.log("Analytics GET response status:", res.status);
            if (res.ok) {
              return res.json();
            } else {
              throw new Error(`GET failed with status: ${res.status}`);
            }
          })
          .then((analytics) => {
            console.log("Analytics GET response:", analytics);
            setVariantAnalytics(analytics);
          })
          .catch((err) => {
            console.log("GET failed, trying POST:", err.message);
            // If GET fails, try POST with parameters
            fetch(
              `${BASE_URL}/api/v1/products/variant-analytics/${variant.product_id}/${variant.id}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  shopDomain: SHOP_DOMAIN,
                  accessToken: ACCESS_TOKEN,
                }),
              },
            )
              .then((res) => {
                console.log("Analytics POST response status:", res.status);
                return res.json();
              })
              .then((analytics) => {
                console.log("Analytics POST response:", analytics);
                setVariantAnalytics(analytics);
              })
              .catch((postErr) => {
                console.error("Both GET and POST failed:", postErr);
                setVariantAnalytics(null);
              });
          });
      })
      .catch((err) => {
        setAiError("Failed to fetch product data");
        setAiLoading(false);
        setProductLoading(false);
      });
  };

  // Fetch LTV-CAC data
  useEffect(() => {
    setLtvCacLoading(true);
    fetch(`${BASE_URL}/api/v1/ltv-cac/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopDomain: SHOP_DOMAIN,
        accessToken: ACCESS_TOKEN,
        adSpend: adSpend,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("LTV-CAC response:", data);
        setLtvCacData(data);
        setLtvCacLoading(false);
      })
      .catch((err) => {
        console.error("LTV-CAC error:", err);
        setLtvCacLoading(false);
      });
  }, [adSpend]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        boxSizing: "border-box",
        padding: 24,
        background: bg,
        fontFamily: font,
        gap: 24,
      }}
    >
      <div
        style={{
          width: 400,
          minWidth: 400,
          background: cardBg,
          borderRadius: 18,
          boxShadow: shadow,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          border,
        }}
      >
        <form
          onSubmit={handleSearch}
          style={{
            border: border,
            borderRadius: 12,
            marginBottom: 18,
            padding: 8,
            display: "flex",
            alignItems: "center",
            background: "#f6f6f7",
            boxShadow: "0 1px 4px 0 rgba(0,0,0,0.03)",
          }}
        >
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 18,
              flex: 1,
              padding: 4,
              fontFamily: font,
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            style={{
              background: accent,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              marginLeft: 4,
              padding: 6,
              display: "flex",
              alignItems: "center",
              transition: "background 0.2s",
              color: "#fff",
            }}
            title="Search"
          >
            <svg width="18" height="18" style={{ opacity: 0.7 }}>
              <circle
                cx="8"
                cy="8"
                r="7"
                stroke="#fff"
                strokeWidth="2"
                fill="none"
              />
              <line
                x1="13"
                y1="13"
                x2="17"
                y2="17"
                stroke="#fff"
                strokeWidth="2"
              />
            </svg>
          </button>
        </form>
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
          {loading ? (
            <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
              Loading...
            </div>
          ) : products.length === 0 ? (
            <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>
              No products found
            </div>
          ) : (
            products.map((p) => {
              const productImage =
                p.image?.src || (p.images && p.images[0]?.src);
              return (
                <div
                  key={p.id}
                  style={{
                    marginBottom: 22,
                    borderBottom: border,
                    paddingBottom: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      marginBottom: 6,
                    }}
                  >
                    <img
                      src={
                        productImage ||
                        "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                      }
                      alt={p.title}
                      style={{
                        width: 70,
                        height: 70,
                        objectFit: "cover",
                        borderRadius: 12,
                        background: "#f6f6f7",
                        border: border,
                        flexShrink: 0,
                        boxShadow: "0 1px 6px 0 rgba(0,0,0,0.06)",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 17,
                          marginBottom: 4,
                          color: "#222",
                        }}
                      >
                        {p.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        {(p.variants || []).map((variant, idx) => (
                          <button
                            key={variant.id}
                            onClick={() => {
                              setSelectedProduct(p);
                              setSelectedVariantIndex(idx);
                              fetchAiData(p, idx);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 12px",
                              margin: "2px 6px 2px 0",
                              border:
                                selectedProduct?.id === p.id &&
                                selectedVariantIndex === idx
                                  ? `2px solid ${pillSelected}`
                                  : border,
                              borderRadius: 16,
                              background:
                                selectedProduct?.id === p.id &&
                                selectedVariantIndex === idx
                                  ? pillSelectedBg
                                  : pillBg,
                              color:
                                selectedProduct?.id === p.id &&
                                selectedVariantIndex === idx
                                  ? pillSelected
                                  : "#222",
                              fontWeight: 600,
                              fontSize: 14,
                              cursor: "pointer",
                              minWidth: 0,
                              height: 30,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              boxShadow:
                                selectedProduct?.id === p.id &&
                                selectedVariantIndex === idx
                                  ? shadow
                                  : undefined,
                              transition: "all 0.18s",
                            }}
                          >
                            <span style={{ flex: 1 }}>
                              {variant.title || `Variant ${idx + 1}`}
                            </span>
                            <span
                              style={{
                                color: "#888",
                                fontSize: 13,
                                marginLeft: 6,
                              }}
                            >
                              {variant.price
                                ? `$${parseFloat(variant.price).toFixed(2)}`
                                : "N/A"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Main Panel */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}
      >
        {/* Top summary cards */}
        <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
          {/* LTV-CAC Card */}
          <div
            style={{
              flex: 1,
              background: summaryBg,
              borderRadius: 16,
              boxShadow: shadow,
              padding: 24,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
              color: accent,
              border,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ltvCacLoading ? (
              <div style={{ fontSize: 15, color: "#888" }}>Loading...</div>
            ) : ltvCacData ? (
              <>
                <div
                  style={{
                    fontSize: 15,
                    color: "#888",
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  New Customers Acquired
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>
                  {ltvCacData.shopify_data.new_customers_acquired}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: "#888" }}>No data</div>
            )}
          </div>

          <div
            style={{
              flex: 1,
              background: summaryBg,
              borderRadius: 16,
              boxShadow: shadow,
              padding: 24,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
              color: accent,
              border,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ltvCacLoading ? (
              <div style={{ fontSize: 15, color: "#888" }}>Loading...</div>
            ) : ltvCacData ? (
              <>
                <div
                  style={{
                    fontSize: 15,
                    color: "#888",
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  Last 6 Month Revenue
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>
                  {ltvCacData.shopify_data.total_revenue}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: "#888" }}>No data</div>
            )}
          </div>

          {/* LTV Card */}
          <div
            style={{
              flex: 1,
              background: summaryBg,
              borderRadius: 16,
              boxShadow: shadow,
              padding: 24,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
              color: accent,
              border,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ltvCacLoading ? (
              <div style={{ fontSize: 15, color: "#888" }}>Loading...</div>
            ) : ltvCacData ? (
              <>
                <div
                  style={{
                    fontSize: 15,
                    color: "#888",
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  Total Orders
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>
                  {ltvCacData.shopify_data.total_orders}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: "#888" }}>No data</div>
            )}
          </div>

          {/* CAC Card */}
          <div
            style={{
              flex: 1,
              background: summaryBg,
              borderRadius: 16,
              boxShadow: shadow,
              padding: 24,
              textAlign: "center",
              fontSize: 18,
              fontWeight: 600,
              color: accent,
              border,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {ltvCacLoading ? (
              <div style={{ fontSize: 15, color: "#888" }}>Loading...</div>
            ) : ltvCacData ? (
              <>
                <div
                  style={{
                    fontSize: 15,
                    color: "#888",
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  Total Customers
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>
                  {ltvCacData.shopify_data.total_customers}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: "#888" }}>No data</div>
            )}
          </div>
        </div>

        {ltvCacData && (
            <div
              style={{
                // marginTop: 32,
                background: "#f6f8fa",
                borderRadius: 12,
                boxShadow: shadow,
                padding: 18,
                textAlign: "left",
                border: "1px solid #e3e6ea",
              }}
            >
              <h4
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: accent,
                  marginBottom: 10,
                }}
              >
                LTV-CAC Analysis
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  {isSubmit === false ? (
                    <div style={{ fontSize: 13, color: "#666" }}>
                      <div
                        style={{
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <label
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "#333",
                              minWidth: 120,
                            }}
                          >
                            Ad Spend Last 6 Months:
                          </label>
                          <input
                            type="number"
                            value={adSpend}
                            onChange={(e) =>
                              setAdSpend(parseFloat(e.target.value))
                            }
                            style={{
                              border: border,
                              borderRadius: 8,
                              padding: "8px 12px",
                              fontSize: 16,
                              width: 150,
                              outline: "none",
                              fontFamily: font,
                            }}
                            placeholder="Enter ad spend"
                          />

                          <button
                            onClick={() => {
                              setLtvCacLoading(true);
                              fetch(`${BASE_URL}/api/v1/ltv-cac/analyze`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  shopDomain: SHOP_DOMAIN,
                                  accessToken: ACCESS_TOKEN,
                                  adSpend: adSpend,
                                }),
                              })
                                .then((res) => res.json())
                                .then((data) => {
                                  console.log("LTV-CAC response:", data);
                                  setLtvCacData(data);
                                  setLtvCacLoading(false);
                                  setIsSubmit(true);
                                })
                                .catch((err) => {
                                  console.error("LTV-CAC error:", err);
                                  setLtvCacLoading(false);
                                });
                            }}
                            style={{
                              background: accent,
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 16px",
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <p>CAC: {ltvCacData.cac}</p>
                        <p>LTV: {ltvCacData.ltv}</p>
                      </div>
                      <div>
                        <p>
                          CAC vs LTV:{" "}
                          {(ltvCacData.cac / ltvCacData.ltv).toFixed(2)}
                        </p>
                        <button onClick={()=>setIsSubmit(false)} style={{ color:'white', background:'blue', fontSize: 14, padding: 6, paddingLeft: 15,paddingRight: 15, border: 'none', borderRadius: 8, }}>Reset</button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#333",
                      marginBottom: 4,
                    }}
                  >
                    Recommendation:
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {ltvCacData.recommendation}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Main details area (AI Suggestion) */}
        <div
          className="hide-scrollbar"
          style={{
            flex: 1,
            background: cardBg,
            borderRadius: 18,
            boxShadow: shadow,
            padding: 36,
            border,
            overflow: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {productLoading ? (
            <div
              style={{
                color: accent,
                fontSize: 20,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              <span
                className="loader"
                style={{ marginRight: 10, verticalAlign: "middle" }}
              >
                ⏳
              </span>
              Loading AI suggestion...
            </div>
          ) : aiLoading ? (
            <div
              style={{
                color: accent,
                fontSize: 20,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              <span
                className="loader"
                style={{ marginRight: 10, verticalAlign: "middle" }}
              >
                ⏳
              </span>
              Loading AI suggestion...
            </div>
          ) : aiError ? (
            <div
              style={{ color: "#d72c0d", fontSize: 18, textAlign: "center" }}
            >
              {aiError}
            </div>
          ) : aiData && aiData.data ? (
            <div style={{ width: "100%", textAlign: "center" }}>
              <p style={{fontSize: "26px", fontWeight: 'bold', marginBottom: '16px'}}>AI Suggestion</p>
              <div
                style={{
                  background: "#f6f8fa",
                  borderRadius: 12,
                  boxShadow: shadow,
                  padding: 18,
                  textAlign: "left",
                  border: "1px solid #e3e6ea",
                }}
              >
                <h3
                  style={{
                    fontSize: 22,
                    marginBottom: 18,
                    color: accent,
                    fontWeight: 700,
                  }}
                >
                  Suggested Price Model
                </h3>
                <div style={{ marginBottom: 18 }}>
                  <span
                    style={{
                      display: "inline-block",
                      background: accent,
                      color: "#fff",
                      padding: "7px 22px",
                      borderRadius: 18,
                      fontWeight: 700,
                      fontSize: 18,
                      marginRight: 8,
                      letterSpacing: 1,
                      boxShadow: shadow,
                    }}
                  >
                    {aiData.data.suggested_pricing_model?.toUpperCase()}
                  </span>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <span
                    style={{
                    fontSize:'16px',
                    fontWeight: 'bold'
                     
                    }}
                  >
                    {aiData.data.reason}
                  </span>
                </div>

                <div
                  style={{
                    color: "#333",
                    fontSize: 17,
                    whiteSpace: "pre-line",
                    lineHeight: 1.7,
                    background: "#f6f8fa",
                    borderRadius: 12,
                    padding: 18,
                    // boxShadow: shadow,
                    textAlign: "left",
                  }}
                >
                  {(() => {
                    const modelData = getPricingModelData(aiData.data.suggested_pricing_model);
                    
                    if (modelData.fallbackReason) {
                      return modelData.fallbackReason;
                    }
                    
                    return (
                      <div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: accent, marginBottom: 8 }}>
                            Expected Benefits:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {modelData.benefits.map((benefit, index) => (
                              <li key={index} style={{ marginBottom: 6, fontSize: 15 }}>
                                {benefit}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {modelData.limitations && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "#d72c0d", marginBottom: 8 }}>
                              Limitations:
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {modelData.limitations.map((limitation, index) => (
                                <li key={index} style={{ marginBottom: 6, fontSize: 15, color: "#666" }}>
                                  {limitation}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div style={{ 
                          background: accent, 
                          color: "#fff", 
                          padding: "8px 12px", 
                          borderRadius: 8, 
                          display: "inline-block",
                          fontSize: 14,
                          fontWeight: 600
                        }}>
                          Impact Probability: {modelData.impactProbability}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                color: "#888",
                fontSize: 18,
                textAlign: "center",
                marginTop: 60,
              }}
            >
              Click a variant to see the AI suggestion
            </div>
          )}

          {/* Variant Analytics */}
          {variantAnalytics && (
            <div
              style={{
                marginTop: 32,
                background: "#f6f8fa",
                borderRadius: 12,
                boxShadow: shadow,
                padding: 18,
                textAlign: "left",
                border: "1px solid #e3e6ea",
              }}
            >
              <h4
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: accent,
                  marginBottom: 10,
                }}
              >
                Variant Analytics
              </h4>

              {/* Analysis Period */}
              <div style={{ marginBottom: 16 }}>
                {/* <div
                  style={{
                    fontSize: 15,
                    color: "#333",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Analysis Period:
                </div> */}
                <div style={{ fontSize: 14, color: "#666" }}>
                  {variantAnalytics.data?.analysis_period}
                </div>
              </div>

              {/* Threshold Explanation */}
              {variantAnalytics.data?.intelligent_suggestions
                ?.threshold_explanation && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 15,
                      color: "#333",
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Threshold Analysis
                  </div>
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 8,
                      padding: 12,
                      border: "1px solid #e3e6ea",
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <span
                        style={{ fontSize: 14, fontWeight: 600, color: "#333" }}
                      >
                        Stale Threshold:{" "}
                        {
                          variantAnalytics.data.intelligent_suggestions
                            .threshold_explanation.stale_threshold
                        }
                        %
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#000" }}>
                      <strong>Interpretation:</strong>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: 16 }}>
                        <li style={{ marginBottom: 2 }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Above threshold:
                          </span>{" "}
                          {
                            variantAnalytics.data.intelligent_suggestions
                              .threshold_explanation.interpretation
                              .above_threshold
                          }
                        </li>
                        <li style={{ marginBottom: 2 }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            At threshold:
                          </span>{" "}
                          {
                            variantAnalytics.data.intelligent_suggestions
                              .threshold_explanation.interpretation.at_threshold
                          }
                        </li>
                        <li style={{ marginBottom: 2 }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            Below threshold:
                          </span>{" "}
                          {
                            variantAnalytics.data.intelligent_suggestions
                              .threshold_explanation.interpretation
                              .below_threshold
                          }
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {variantAnalytics.data?.intelligent_suggestions &&
                variantAnalytics.data.intelligent_suggestions.suggestions && (
                  <div style={{marginTop: '34px'}}>
                    <div
                      style={{
                        fontSize: 26,
                        color: "#333",
                        fontWeight: 600,
                        marginBottom: 14,
                      }}
                    >
                      Intelligent Suggestions:
                    </div>
                    {variantAnalytics.data.intelligent_suggestions.suggestions.map(
                      (suggestion, index) => (
                        <div
                          key={index}
                          style={{
                            background: "#fff",
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 8,
                            border: "1px solid #e3e6ea",
                            onHover : {
                              background: 'blue'
                            }
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              marginBottom: 4,
                              color: accent,
                            }}
                          >
                            {suggestion.type.replace(/_/g, " ")}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: "#000",
                              marginBottom: 4,
                            }}
                          >
                            {suggestion.action}
                          </div>
                          <div style={{ fontSize: 12, color: "#000" }}>
                            {suggestion.reason}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
            </div>
          )}

          {/* LTV-CAC Details */}
          {/* {ltvCacData && (
            <div
              style={{
                marginTop: 32,
                background: "#f6f8fa",
                borderRadius: 12,
                boxShadow: shadow,
                padding: 18,
                textAlign: "left",
                border: "1px solid #e3e6ea",
              }}
            >
              <h4
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: accent,
                  marginBottom: 10,
                }}
              >
                LTV-CAC Analysis
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  {isSubmit === false ? (
                    <div style={{ fontSize: 13, color: "#666" }}>
                      <div
                        style={{
                          padding: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <label
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "#333",
                              minWidth: 120,
                            }}
                          >
                            Ad Spend Last 6 Months:
                          </label>
                          <input
                            type="number"
                            value={adSpend}
                            onChange={(e) =>
                              setAdSpend(parseFloat(e.target.value))
                            }
                            style={{
                              border: border,
                              borderRadius: 8,
                              padding: "8px 12px",
                              fontSize: 16,
                              width: 150,
                              outline: "none",
                              fontFamily: font,
                            }}
                            placeholder="Enter ad spend"
                          />

                          <button
                            onClick={() => {
                              setLtvCacLoading(true);
                              fetch(`${BASE_URL}/api/v1/ltv-cac/analyze`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  shopDomain: SHOP_DOMAIN,
                                  accessToken: ACCESS_TOKEN,
                                  adSpend: adSpend,
                                }),
                              })
                                .then((res) => res.json())
                                .then((data) => {
                                  console.log("LTV-CAC response:", data);
                                  setLtvCacData(data);
                                  setLtvCacLoading(false);
                                  setIsSubmit(true);
                                })
                                .catch((err) => {
                                  console.error("LTV-CAC error:", err);
                                  setLtvCacLoading(false);
                                });
                            }}
                            style={{
                              background: accent,
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "8px 16px",
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "background 0.2s",
                            }}
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <p>CAC: {ltvCacData.cac}</p>
                        <p>LTV: {ltvCacData.ltv}</p>
                      </div>
                      <div>
                        <p>
                          CAC vs LTV:{" "}
                          {(ltvCacData.cac / ltvCacData.ltv).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#333",
                      marginBottom: 4,
                    }}
                  >
                    Recommendation:
                  </div>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {ltvCacData.recommendation}
                  </div>
                </div>
              </div>
            </div>
          )} */}
        </div>
      </div>
    </div>
  );
}
