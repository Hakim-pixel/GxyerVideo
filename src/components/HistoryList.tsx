"use client";

import React from "react";
import { History, Play, Trash2, ExternalLink } from "lucide-react";

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

interface HistoryListProps {
  items: HistoryItem[];
  onSelect: (url: string) => void;
  onClear: () => void;
}

export default function HistoryList({
  items,
  onSelect,
  onClear,
}: HistoryListProps) {
  if (items.length === 0) return null;

  return (
    <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
          <History className="w-4 h-4 text-indigo-400" />
          <span>Riwayat Tontonan Terakhir</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-rose-400 transition flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" /> Hapus Riwayat
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item.url)}
            className="group flex items-center justify-between p-3 bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-800/60 hover:border-indigo-500/40 rounded-xl cursor-pointer transition"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                  {item.title || "Video"}
                </p>
                <p className="text-[11px] text-zinc-500 truncate max-w-[200px]">
                  {item.url}
                </p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 shrink-0 ml-2 transition" />
          </div>
        ))}
      </div>
    </div>
  );
}
