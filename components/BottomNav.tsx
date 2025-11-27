import React from 'react';
import { Home, Book, BookOpen, ScrollText, Settings } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface BottomNavProps {
  currentView: string;
  onChangeView: (view: any) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: 'HOME', label: 'Beranda', icon: <Home className="w-5 h-5" /> },
    { id: 'LIBRARY_VIEW', label: 'Kitab', icon: <Book className="w-5 h-5" /> },
    { id: 'QURAN', label: 'Al-Quran', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'HADITH', label: 'Hadist', icon: <ScrollText className="w-5 h-5" /> },
    { id: 'SETTINGS', label: 'Atur', icon: <Settings className="w-5 h-5" /> },
  ];

  const handlePress = async (viewId: any) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Haptics not available on this device
    }
    onChangeView(viewId);
  };

  // Helper to determine active state (handling sub-views like RESULT as part of HOME context or separate)
  const isActive = (id: string) => {
    if (id === 'HOME' && (currentView === 'HOME' || currentView === 'RESULT')) return true;
    if (id === 'LIBRARY_VIEW' && (currentView === 'LIBRARY_VIEW' || currentView === 'BOOK_DETAIL' || currentView === 'AUTHOR_DETAIL')) return true;
    return currentView === id;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-50 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-between px-2">
        {navItems.map((item) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handlePress(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 w-full transition-all duration-300 ${
                active 
                  ? 'text-emerald-600 dark:text-emerald-400 transform -translate-y-1' 
                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-emerald-50 dark:bg-emerald-900/30' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-bold mt-1 ${active ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNav;