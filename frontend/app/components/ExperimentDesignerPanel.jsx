import React from "react";

export default function ExperimentDesignerPanel() {
  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 w-full max-w-md mx-auto min-h-[700px] flex flex-col p-8">
      <h2 className="text-xl font-bold mb-6 tracking-tight">Experiment Designer</h2>
      <div className="bg-white rounded-xl border border-gray-100 flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-lg">Select SKUs</span>
          <span className="text-gray-400">&gt;</span>
        </div>
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-500 mb-1">Selekt SKUs</label>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2">
            <input type="checkbox" checked readOnly className="accent-blue-600 w-4 h-4" />
            <span className="text-sm">Orgaic Cotton Shirt</span>
            <span className="ml-auto text-gray-400">O</span>
          </div>
        </div>
        <div className="flex items-center text-xs text-gray-500 mb-6">
          <span>AI Suggests:</span>
          <span className="ml-1 font-semibold text-gray-900">Limited-Edition Drop</span>
          <button className="ml-2 text-blue-600 text-xs underline">Edit</button>
        </div>
        <button className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-base shadow hover:bg-blue-700 transition-colors mt-auto">Launch A/B Test</button>
      </div>
    </div>
  );
} 