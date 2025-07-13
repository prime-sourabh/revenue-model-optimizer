import React from "react";

export default function ResultsViewPanel() {
  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 w-full max-w-md mx-auto min-h-[700px] flex flex-col p-8">
      <h2 className="text-xl font-bold mb-6 tracking-tight">Results View</h2>
      <div className="bg-white rounded-xl border border-gray-100 flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-lg">A- Resoues View</span>
          <button className="text-gray-400"><svg width="20" height="20" fill="none"><circle cx="10" cy="10" r="2" fill="#9CA3AF"/><circle cx="10" cy="5" r="2" fill="#9CA3AF"/><circle cx="10" cy="15" r="2" fill="#9CA3AF"/></svg></button>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">Organic Cotton Shirt A/B</span>
          <span className="text-xs bg-gray-100 rounded px-2 py-1 text-gray-500">Vie:an 1</span>
        </div>
        <span className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded mb-2 w-fit">Winner Auto-Applied</span>
        <div className="flex gap-6 mb-2">
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500">LTV</span>
            <span className="text-lg font-bold">$95</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500">CAC</span>
            <span className="text-lg font-bold">$80</span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500">RTt</span>
            <span className="text-lg font-bold">10%</span>
          </div>
        </div>
        <div className="h-20 w-full bg-blue-50 rounded flex items-center justify-center mb-2">
          {/* Placeholder for chart */}
          <svg viewBox="0 0 120 32" fill="none" className="w-11/12 h-12">
            <polyline fill="none" stroke="#2563EB" strokeWidth="2" points="0,28 20,24 40,20 60,18 80,16 100,20 120,8" />
          </svg>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mb-4">
          <span>Mo.</span>
          <span>Variant A</span>
          <span>Variant B</span>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 flex flex-col gap-2 mt-auto">
          <span className="text-xs font-semibold text-gray-700 mb-1">Recommendations</span>
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <span className="inline-block w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg width="16" height="16" fill="none" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#3B82F6" /></svg>
            </span>
            Consider offering pro+ bundles or tiered priing plans
          </div>
        </div>
      </div>
    </div>
  );
} 