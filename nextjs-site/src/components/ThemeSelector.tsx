"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    bgDark: string;
  };
  preview: {
    gradient: string;
    dot: string;
    border: string;
  };
}

const themes: Theme[] = [
  {
    id: "default",
    name: "Default",
    colors: { primary: "bg-blue-500", secondary: "bg-blue-600", accent: "bg-blue-700", bg: "bg-gray-800", bgDark: "bg-gray-900" },
    preview: { gradient: "from-gray-700 to-blue-600", dot: "bg-blue-500", border: "border-blue-500" }
  },
  {
    id: "dark",
    name: "Dark",
    colors: { primary: "bg-gray-700", secondary: "bg-gray-800", accent: "bg-gray-900", bg: "bg-gray-800", bgDark: "bg-black" },
    preview: { gradient: "from-gray-800 to-gray-950", dot: "bg-blue-500", border: "border-blue-500" }
  },
  {
    id: "modern-dark",
    name: "Modern Dark",
    colors: { primary: "bg-slate-700", secondary: "bg-slate-800", accent: "bg-slate-900", bg: "bg-gray-800", bgDark: "bg-gray-900" },
    preview: { gradient: "from-gray-900 to-black", dot: "bg-gray-400", border: "border-gray-500" }
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    colors: { primary: "bg-blue-900", secondary: "bg-blue-950", accent: "bg-indigo-900", bg: "bg-slate-900", bgDark: "bg-slate-950" },
    preview: { gradient: "from-slate-900 to-blue-950", dot: "bg-cyan-500", border: "border-cyan-500" }
  },
  {
    id: "dusk",
    name: "Dusk",
    colors: { primary: "bg-amber-900", secondary: "bg-stone-800", accent: "bg-amber-950", bg: "bg-stone-900", bgDark: "bg-stone-950" },
    preview: { gradient: "from-stone-800 to-amber-950", dot: "bg-amber-500", border: "border-amber-600" }
  },
  {
    id: "sunset",
    name: "Sunset",
    colors: { primary: "bg-purple-700", secondary: "bg-pink-700", accent: "bg-purple-900", bg: "bg-purple-900", bgDark: "bg-purple-950" },
    preview: { gradient: "from-purple-800 to-pink-900", dot: "bg-pink-500", border: "border-pink-600" }
  },
  {
    id: "purple",
    name: "Purple",
    colors: { primary: "bg-purple-700", secondary: "bg-purple-800", accent: "bg-purple-900", bg: "bg-purple-900", bgDark: "bg-purple-950" },
    preview: { gradient: "from-purple-900 to-purple-950", dot: "bg-purple-400", border: "border-purple-500" }
  },
  {
    id: "forest",
    name: "Forest",
    colors: { primary: "bg-green-800", secondary: "bg-green-900", accent: "bg-emerald-900", bg: "bg-green-950", bgDark: "bg-emerald-950" },
    preview: { gradient: "from-green-900 to-emerald-950", dot: "bg-green-500", border: "border-green-600" }
  },
  {
    id: "crimson",
    name: "Crimson",
    colors: { primary: "bg-red-800", secondary: "bg-red-900", accent: "bg-rose-900", bg: "bg-red-950", bgDark: "bg-rose-950" },
    preview: { gradient: "from-red-900 to-rose-950", dot: "bg-red-500", border: "border-red-600" }
  },
  {
    id: "cyan",
    name: "Cyan",
    colors: { primary: "bg-cyan-700", secondary: "bg-cyan-800", accent: "bg-cyan-900", bg: "bg-slate-900", bgDark: "bg-slate-950" },
    preview: { gradient: "from-slate-900 to-cyan-950", dot: "bg-cyan-400", border: "border-cyan-500" }
  },
  {
    id: "gold",
    name: "Gold",
    colors: { primary: "bg-yellow-700", secondary: "bg-amber-800", accent: "bg-yellow-900", bg: "bg-yellow-950", bgDark: "bg-amber-950" },
    preview: { gradient: "from-amber-900 to-yellow-950", dot: "bg-yellow-500", border: "border-yellow-600" }
  },
  {
    id: "orange",
    name: "Orange",
    colors: { primary: "bg-orange-700", secondary: "bg-orange-800", accent: "bg-orange-900", bg: "bg-orange-950", bgDark: "bg-red-950" },
    preview: { gradient: "from-orange-900 to-red-950", dot: "bg-orange-500", border: "border-orange-600" }
  },
  {
    id: "pink",
    name: "Pink",
    colors: { primary: "bg-pink-700", secondary: "bg-pink-800", accent: "bg-fuchsia-900", bg: "bg-pink-950", bgDark: "bg-fuchsia-950" },
    preview: { gradient: "from-pink-900 to-fuchsia-950", dot: "bg-pink-400", border: "border-pink-500" }
  },
  {
    id: "mint",
    name: "Mint",
    colors: { primary: "bg-emerald-700", secondary: "bg-teal-800", accent: "bg-emerald-900", bg: "bg-emerald-950", bgDark: "bg-teal-950" },
    preview: { gradient: "from-emerald-900 to-teal-950", dot: "bg-emerald-400", border: "border-emerald-500" }
  },
  {
    id: "lavender",
    name: "Lavender",
    colors: { primary: "bg-violet-700", secondary: "bg-purple-800", accent: "bg-violet-900", bg: "bg-violet-950", bgDark: "bg-purple-950" },
    preview: { gradient: "from-violet-900 to-purple-950", dot: "bg-violet-400", border: "border-violet-500" }
  }
];

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onSelectTheme: (themeId: string) => void;
}

export default function ThemeSelector({ isOpen, onClose, currentTheme, onSelectTheme }: ThemeSelectorProps) {
  if (!isOpen) return null;

  const handleThemeClick = (themeId: string) => {
    onSelectTheme(themeId);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Select Theme</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Theme Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeClick(theme.id)}
                className={`group relative flex flex-col items-center gap-3 p-4 rounded-lg transition-all hover:bg-gray-800 ${
                  currentTheme === theme.id ? "bg-gray-800" : ""
                }`}
              >
                {/* Theme Preview Card */}
                <div className={`w-full h-24 rounded-xl border-2 ${theme.preview.border} bg-gradient-to-br ${theme.preview.gradient} relative overflow-hidden`}>
                  {/* Diagonal accent */}
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent"></div>
                  
                  {/* Dot indicator */}
                  <div className={`absolute bottom-3 right-3 w-3 h-3 rounded-full ${theme.preview.dot}`}></div>
                  
                  {/* Checkmark if selected */}
                  {currentTheme === theme.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Theme Name */}
                <span className="text-white text-sm font-medium">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
