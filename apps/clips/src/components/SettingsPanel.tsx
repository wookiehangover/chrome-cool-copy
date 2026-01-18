import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTtsUrl, DEFAULT_TTS_URL } from "@/hooks/useTtsUrl";

interface ViewerSettings {
  fontFamily: "sans" | "serif" | "mono";
  fontSize: number;
}

const STORAGE_KEY = "clips-viewer-settings";
const DEFAULT_SETTINGS: ViewerSettings = {
  fontFamily: "sans",
  fontSize: 16,
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const { ttsUrl, setTtsUrl } = useTtsUrl();

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        if (result[STORAGE_KEY]) {
          const loadedSettings = result[STORAGE_KEY] as ViewerSettings;
          setSettings(loadedSettings);
          applySettings(loadedSettings);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };

    loadSettings();
  }, []);

  const applySettings = (newSettings: ViewerSettings) => {
    const root = document.documentElement;
    root.style.setProperty("--viewer-font-size", `${newSettings.fontSize}px`);
    root.classList.remove("font-sans", "font-serif", "font-mono");
    root.classList.add(`font-${newSettings.fontFamily}`);
  };

  const saveSettings = async (newSettings: ViewerSettings) => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: newSettings });
      setSettings(newSettings);
      applySettings(newSettings);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const handleFontFamilyChange = (family: "sans" | "serif" | "mono") => {
    saveSettings({ ...settings, fontFamily: family });
  };

  const handleFontSizeChange = (delta: number) => {
    const newSize = Math.max(14, Math.min(22, settings.fontSize + delta));
    saveSettings({ ...settings, fontSize: newSize });
  };

  const btnBase =
    "flex-1 px-2 py-1.5 bg-black/5 dark:bg-white/5 border-none rounded text-xs text-muted-foreground cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground";
  const btnActive = "bg-foreground text-background hover:bg-foreground hover:text-background";

  return (
    <div className="fixed top-14 right-4 bg-background border border-border rounded-lg p-4 w-64 z-40 shadow-lg">
      {/* Font Family */}
      <div className="mb-4">
        <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Font
        </label>
        <div className="flex gap-1">
          {(["sans", "serif", "mono"] as const).map((family) => (
            <button
              key={family}
              onClick={() => handleFontFamilyChange(family)}
              className={cn(btnBase, settings.fontFamily === family && btnActive)}
            >
              {family}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Size
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFontSizeChange(-2)}
            disabled={settings.fontSize <= 14}
            className={cn(btnBase, "flex-none w-8 disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            −
          </button>
          <span className="flex-1 text-center text-xs text-muted-foreground">
            {settings.fontSize}px
          </span>
          <button
            onClick={() => handleFontSizeChange(2)}
            disabled={settings.fontSize >= 22}
            className={cn(btnBase, "flex-none w-8 disabled:opacity-50 disabled:cursor-not-allowed")}
          >
            +
          </button>
        </div>
      </div>

      {/* TTS Server URL */}
      <div>
        <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
          TTS Server
        </label>
        <input
          type="text"
          value={ttsUrl}
          onChange={(e) => setTtsUrl(e.target.value)}
          placeholder={DEFAULT_TTS_URL}
          className="w-full px-2 py-1.5 bg-black/5 dark:bg-white/5 border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}
