import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

// Define the shape of our settings
interface AppSettings {
  // Chat settings
  autoSaveChats: boolean;
  sendTypingIndicator: boolean;
  messageGrouping: boolean;
  
  // Appearance settings
  darkMode: boolean;
  fontSize: number;
  messageDensity: number; // 0=compact, 1=normal, 2=spacious
  
  // AI features
  autoSuggest: boolean;
  promptImprovement: boolean;
  autoImprove: boolean;
  improvementStyle: string;
  domainContext: string;
  
  // AI model settings
  aiModel: string;
  contextWindow: number;
  responseTokenLimit: number;
  customModelEndpoint: string;
  
  // Accessibility
  highContrastMode: boolean;
  reduceAnimations: boolean;
  screenReaderOptimized: boolean;
  
  // Advanced
  analyticsEnabled: boolean;
  dataSaverMode: boolean;
  autoDeleteHistory: boolean;
  autoDeleteDays: number;
  keyboardShortcuts: Record<string, string>;
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  // Chat settings
  autoSaveChats: true,
  sendTypingIndicator: true,
  messageGrouping: true,
  
  // Appearance settings
  darkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
  fontSize: 16,
  messageDensity: 1,
  
  // AI features
  autoSuggest: true,
  promptImprovement: true,
  autoImprove: false,
  improvementStyle: 'balanced',
  domainContext: '',
  
  // AI model settings
  aiModel: 'gpt-4o',
  contextWindow: 10,
  responseTokenLimit: 1000,
  customModelEndpoint: '',
  
  // Accessibility
  highContrastMode: false,
  reduceAnimations: false,
  screenReaderOptimized: false,
  
  // Advanced
  analyticsEnabled: true,
  dataSaverMode: false,
  autoDeleteHistory: false,
  autoDeleteDays: 30,
  keyboardShortcuts: {
    sendMessage: 'Enter',
    newLine: 'Shift+Enter',
    improvePrompt: 'Control+I',
    clearChat: 'Alt+C',
    newChat: 'Control+N',
    focusInput: '/',
    navigateUp: 'ArrowUp',
    navigateDown: 'ArrowDown'
  }
};

// Type for settings change listener
type SettingsChangeListener = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

// Define the context shape
interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
  getMessageDensityLabel: () => string;
  isKeyboardShortcut: (event: KeyboardEvent, action: string) => boolean;
  addSettingChangeListener: (listener: SettingsChangeListener) => () => void;
}

// Create the context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Provider component
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize settings from localStorage or defaults
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        // Merge saved settings with defaults to handle any new settings
        return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      } catch (error) {
        console.error('Error parsing saved settings:', error);
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Store for change listeners
  const [changeListeners] = useState<Set<SettingsChangeListener>>(new Set());

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('appSettings', JSON.stringify(settings));
      
      // Apply certain settings immediately when they change
      applySettings(settings);
      
      // Notify all listeners of the change
      Object.entries(settings).forEach(([key, value]) => {
        changeListeners.forEach(listener => 
          listener(key as keyof AppSettings, value as AppSettings[keyof AppSettings])
        );
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [settings, changeListeners]);

  // Add a settings change listener
  const addSettingChangeListener = useCallback((listener: SettingsChangeListener) => {
    changeListeners.add(listener);
    
    // Return a function to remove the listener
    return () => {
      changeListeners.delete(listener);
    };
  }, [changeListeners]);

  // Update a specific setting
  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      return newSettings;
    });
  }, []);

  // Reset all settings to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Helper function to get message density label
  const getMessageDensityLabel = useCallback(() => {
    if (settings.messageDensity === 0) return "Compact";
    if (settings.messageDensity === 1) return "Normal";
    return "Spacious";
  }, [settings.messageDensity]);

  // Helper to check if a keyboard event matches a shortcut
  const isKeyboardShortcut = useCallback((event: KeyboardEvent, action: string): boolean => {
    const shortcut = settings.keyboardShortcuts[action];
    if (!shortcut) return false;
    
    const parts = shortcut.split('+');
    
    // Check for required modifiers
    const needsCtrl = parts.includes('Control');
    const needsShift = parts.includes('Shift');
    const needsAlt = parts.includes('Alt');
    const needsMeta = parts.includes('Meta');
    
    if (needsCtrl !== event.ctrlKey) return false;
    if (needsShift !== event.shiftKey) return false;
    if (needsAlt !== event.altKey) return false;
    if (needsMeta !== event.metaKey) return false;
    
    // Check for the main key
    const mainKey = parts.find(part => !['Control', 'Shift', 'Alt', 'Meta'].includes(part));
    return mainKey ? event.key === mainKey : false;
  }, [settings.keyboardShortcuts]);

  // Apply settings that need immediate effect
  const applySettings = (currentSettings: AppSettings) => {
    // Apply dark mode
    document.documentElement.classList.toggle('dark-mode', currentSettings.darkMode);
    
    // Apply font size
    document.documentElement.style.setProperty('--app-font-size', `${currentSettings.fontSize}px`);
    
    // Apply high contrast mode
    document.documentElement.classList.toggle('high-contrast', currentSettings.highContrastMode);
    
    // Apply reduced animations
    document.documentElement.classList.toggle('reduce-motion', currentSettings.reduceAnimations);
    
    // Apply screen reader optimizations
    document.documentElement.classList.toggle('screen-reader-mode', currentSettings.screenReaderOptimized);
    
    // Apply message density
    document.documentElement.style.setProperty('--message-spacing', 
      currentSettings.messageDensity === 0 ? '4px' : 
      currentSettings.messageDensity === 1 ? '8px' : '16px'
    );
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateSetting, 
      resetSettings, 
      getMessageDensityLabel,
      isKeyboardShortcut,
      addSettingChangeListener
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}; 