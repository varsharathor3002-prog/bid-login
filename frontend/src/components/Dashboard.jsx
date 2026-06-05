import React, { useEffect, useState } from 'react';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLiveProducts = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/save-gem-specs/');
      const data = await response.json();
      setProducts(data);
      setLoading(false);
    } catch (err) {
      console.error("React Fetch Error:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveProducts();
    
    // Auto refresh every 5 seconds taaki background extension ka data live dikhe
    const interval = setInterval(fetchLiveProducts, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-sans">
      {/* Header Panel with Tailwind */}
      <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📦 GeM Technical Specs Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Total Scraped Products: {products.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm font-semibold text-slate-700">Listening to Extension...</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-500 text-lg font-medium">Loading Live Data Hub...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-inner border p-8">
          <p className="text-slate-500 font-medium text-lg">No data captured yet.</p>
          <p className="text-sm text-slate-400 mt-1">Open GeM portal and trigger your bulk Chrome Extension!</p>
        </div>
      ) : (
        /* Grid Cards using Tailwind */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition duration-200">
              <div>
                {/* Image & Main Info */}
                <div className="flex gap-4 items-start mb-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border p-1 shrink-0">
                    <img src={product.image_url || "https://via.placeholder.com/150"} alt="Product" className="object-contain max-h-full max-w-full" />
                  </div>
                  <div>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-md font-mono border border-blue-100">
                      {product.model_no}
                    </span>
                    <h2 className="text-sm font-semibold text-slate-900 line-clamp-2 mt-2" title={product.title}>
                      {product.title || "Title Not Loaded Yet"}
                    </h2>
                  </div>
                </div>

                {/* Technical Specifications Container */}
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Technical Specs:</span>
                  {product.specifications.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {product.specifications.map((spec, index) => (
                        <div key={index} className="text-xs bg-slate-50 text-slate-700 p-2 rounded-lg border border-slate-100 font-medium">
                          {spec}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs italic text-slate-400">No structured specs found on search page view.</span>
                  )}
                </div>
              </div>

              {/* Price Tag Footer */}
              <div className="border-t border-slate-100 pt-3 flex justify-between items-center mt-4">
                <span className="text-xs text-slate-400 font-medium">Est. Price</span>
                <span className="text-lg font-extrabold text-emerald-600">{product.price || "₹ N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}