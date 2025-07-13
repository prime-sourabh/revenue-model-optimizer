import React from "react";

export default function DashboardCard({ sidebar, children }) {
  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 flex w-full max-w-3xl mx-auto min-h-[700px] overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 flex flex-col p-6 pr-0 border-r border-gray-100 bg-white">
        {sidebar}
      </div>
      {/* Main Content */}
      <div className="flex-1 p-8 pl-10 bg-white">
        {children}
      </div>
    </div>
  );
} 