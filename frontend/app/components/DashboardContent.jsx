import React from "react";

export default function DashboardContent() {
  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>
      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-100 p-4 mb-4">
        <LineChart />
      </div>
      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-100 mb-4">
        <div className="grid grid-cols-2 text-xs font-medium border-b border-gray-100 px-4 py-2">
          <span>Revenue Model Type.</span>
          <span className="text-right">Simesspend</span>
        </div>
        <div className="grid grid-cols-2 text-sm px-4 py-2 border-b border-gray-100">
          <span className="font-semibold text-gray-800">Green Tax Extract</span>
          <span className="text-right text-gray-500">Subscription</span>
        </div>
        <div className="grid grid-cols-2 text-sm px-4 py-2 border-b border-gray-100">
          <span className="font-semibold text-gray-800">Yoga Mat</span>
          <span className="text-right text-gray-500">One itime</span>
        </div>
        <div className="grid grid-cols-2 text-sm px-4 py-2 border-b border-gray-100">
          <span className="font-semibold text-gray-800">Organic Cotton Shirt</span>
          <span className="text-right text-gray-500">Limited Ed</span>
        </div>
        <div className="grid grid-cols-2 text-sm px-4 py-2">
          <span className="font-semibold text-gray-800">Fitness Tracker</span>
          <span className="text-right text-gray-500">Fitness Trac</span>
        </div>
      </div>
      {/* Revenue Model Card */}
      <div className="bg-white rounded-lg border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Revenue Model</span>
          <span className="text-xs font-semibold text-gray-500">M-SM0</span>
        </div>
        <LineChart />
      </div>
    </div>
  );
}

function LineChart() {
  // Simple SVG line chart placeholder
  return (
    <svg viewBox="0 0 120 32" fill="none" className="w-full h-12">
      <polyline
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        points="0,20 20,22 40,18 60,22 80,16 100,24 120,12"
      />
    </svg>
  );
} 