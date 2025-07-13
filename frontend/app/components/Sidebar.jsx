import React from "react";

export default function Sidebar() {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          {/* AI Logo SVG */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#111827"/><text x="7" y="20" fontSize="16" fontWeight="bold" fill="white">AI</text></svg>
          <span className="font-semibold text-base tracking-tight ml-1">Revenue Model Optimizer</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">ⓘ</span>
      </div>
      {/* Navigation */}
      <nav className="flex flex-col gap-1 mb-8">
        <SidebarNavItem selected icon={<CircleIcon selected />} label="Dashboard" />
        <SidebarNavItem icon={<CircleIcon />} label="Experiments" />
        <SidebarNavItem icon={<CircleIcon />} label="Settings" />
      </nav>
      {/* User Info */}
      <div className="mt-auto flex items-center gap-2 text-xs text-gray-400">
        <span className="font-medium">Hale/lifes</span>
      </div>
    </>
  );
}

function SidebarNavItem({ selected, icon, label }) {
  return (
    <button
      className={`flex items-center gap-3 px-2 py-2 rounded-lg w-full text-left font-medium text-sm transition-colors ${selected ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-700"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function CircleIcon({ selected }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="7" stroke={selected ? "#2563EB" : "#D1D5DB"} strokeWidth="2" fill={selected ? "#2563EB" : "none"} />
    </svg>
  );
} 