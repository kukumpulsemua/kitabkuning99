import React, { useState, useEffect, useRef, useCallback } from 'react';
import InputSection from './components/InputSection.tsx';
import ResultDisplay from './components/ResultDisplay.tsx';
import HistorySidebar from './components/HistorySidebar.tsx';
import BookmarkSidebar from './components/BookmarkSidebar.tsx';
import HadithBookmarkSidebar from './components/HadithBookmarkSidebar.tsx';
import BookDetailPage from './components/BookDetailPage.tsx';
import AuthorDetailPage from './components/AuthorDetailPage.tsx';
import PrayerCountdown from './components/PrayerCountdown.tsx';
import LibraryView from './components/LibraryView.tsx'; 
import BottomNav from './components/BottomNav.tsx';
import SettingsView from './components/SettingsView.tsx';
import ScriptureView from './components/ScriptureView.tsx';
import InheritanceView from './components/InheritanceView.tsx';
import ZakatView from './components/ZakatView.tsx';
import TasbihView from './components/TasbihView.tsx';
import CalendarView from './components/CalendarView.tsx';
import DoaView from './components/DoaView.tsx';
import SholawatView from './components/SholawatView.tsx';
import QiblaView from './components/QiblaView.tsx';
import ReadingPracticeView from './components/ReadingPracticeView.tsx';
import QuizView from './components/QuizView.tsx';
import LoadingIndicator from './components/LoadingIndicator.tsx';
import { analyzeKitabText } from './services/geminiService.ts';
import { TranslationResult, AppSettings, HistoryItem } from './types.ts';
import { AlertTriangle, AlertOctagon, Settings } from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

type ViewState = 'HOME' | 'RESULT' | 'BOOK_DETAIL' | 'AUTHOR_DETAIL' | 'LIBRARY_VIEW' | 'QURAN' | 'HADITH' | 'SETTINGS' | 'INHERITANCE' | 'ZAKAT' | 'TASBIH' | 'CALENDAR' | 'DOA' | 'SHOLAWAT' | 'QIBLA' | 'READING_PRACTICE' | 'QUIZ';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('HOME');
  
  const [selectedBook, setSelectedBook] = useState<{title: string, author?: string} | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [selectedLibraryBook, setSelectedLibraryBook] = useState<string | null>(null);

  const [result, setResult] = useState<TranslationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [isBookmarkOpen, setIsBookmarkOpen] = useState(false);
  const [isHadithBookmarkOpen, setIsHadithBookmarkOpen] = useState(false);
  const [bookmarkTarget, setBookmarkTarget] = useState<{surah: number, ayah: number} | null>(null);
  const [hadithBookmarkTarget, setHadithBookmarkTarget] = useState<{bookId: string, hadithNumber: number} | null>(null);

  // Initialize history lazily to avoid overwriting with empty array on mount
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const savedHistory = localStorage.getItem('kitabHistory');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });
  
  const [initialInputText, setInitialInputText] = useState<string>('');

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      return savedSettings ? JSON.parse(savedSettings) : {
        arabicFont: 'scheherazade',
        latinFont: 'sans',
        textSize: 'medium',
        darkMode: false,
      };
    } catch (e) {
      return {
        arabicFont: 'scheherazade',
        latinFont: 'sans',
        textSize: 'medium',
        darkMode: false,
      };
    }
  });

  const isMounted = useRef(false);

  const handleBottomNavChange = useCallback((view: ViewState) => {
    if (view === 'HOME') {
      setInitialInputText('');
      setResult(null);
    }
    if (view === 'LIBRARY_VIEW') {
      setSelectedLibraryBook(null);
    }
    if (view !== 'QURAN') {
      setBookmarkTarget(null);
    }
    if (view !== 'HADITH') {
      setHadithBookmarkTarget(null);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // --- NATIVE INTEGRATION: Status Bar ---
  useEffect(() => {
    const configureStatusBar = async () => {
      // Hanya berjalan di platform native (Capacitor)
      if (typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isPluginAvailable('StatusBar')) {
        try {
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setStyle({
            style: settings.darkMode ? Style.Dark : Style.Light,
          });
          await StatusBar.setBackgroundColor({ color: '#00000000' }); // Transparan
        } catch (e) {
          console.error("Gagal mengkonfigurasi status bar", e);
        }
      }
    };
    configureStatusBar();
  }, [settings.darkMode]);

  // --- NATIVE INTEGRATION: Back Button ---
  useEffect(() => {
    // This effect should only run on Capacitor platforms.
    if (typeof (window as any).Capacitor === 'undefined' || !(window as any).Capacitor.isPluginAvailable('App')) {
      return;
    }

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      // Because this effect re-runs on state changes, the closure here
      // will always have the latest state values to work with.
      
      // Priority 1: Close any open sidebars/modals
      if (isHistoryOpen) {
        setIsHistoryOpen(false);
        return;
      }
      if (isBookmarkOpen) {
        setIsBookmarkOpen(false);
        return;
      }
      if (isHadithBookmarkOpen) {
        setIsHadithBookmarkOpen(false);
        return;
      }

      // Priority 2: Navigate back to HOME from other views
      if (currentView !== 'HOME') {
        handleBottomNavChange('HOME');
        return;
      }

      // Priority 3: If on HOME, exit the app
      CapacitorApp.exitApp();
    });
    
    // Return a cleanup function that removes the listener by resolving the promise
    return () => {
      listenerPromise.then(listener => listener.remove());
    };
  }, [currentView, isHistoryOpen, isBookmarkOpen, isHadithBookmarkOpen, handleBottomNavChange]);


  useEffect(() => {
    try {
      localStorage.setItem('appSettings', JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to save settings to localStorage", e);
    }
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    if (isMounted.current) {
      try {
        localStorage.setItem('kitabHistory', JSON.stringify(history));
      } catch (e) {
        console.warn("Failed to save history to localStorage", e);
      }
    } else {
      isMounted.current = true;
    }
  }, [history]);

  const addToHistory = (data: TranslationResult) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      arabicPreview: data.arabicText.substring(0, 50) + (data.arabicText.length > 50 ? '...' : ''),
      translationPreview: data.translationIndonesia.substring(0, 80) + (data.translationIndonesia.length > 80 ? '...' : ''),
      fullResult: data
    };
    setHistory(prev => [newItem, ...prev].slice(0, 20));
  };

  const handleHistorySelect = (item: HistoryItem) => {
    setResult(item.fullResult);
    setIsHistoryOpen(false);
    setError(null);
    setCurrentView('RESULT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookmarkSelect = (surah: number, ayah: number) => {
    setBookmarkTarget({ surah, ayah });
    setIsBookmarkOpen(false);
    setCurrentView('QURAN');
  };

  const handleHadithBookmarkSelect = (bookId: string, hadithNumber: number) => {
    setHadithBookmarkTarget({ bookId, hadithNumber });
    setIsHadithBookmarkOpen(false);
    setCurrentView('HADITH');
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllHistory = () => {
    if (confirm('Hapus semua riwayat?')) setHistory([]);
  };

  const handleAnalyze = async (text: string, image: string | undefined) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setInitialInputText(text);
    
    try {
      // FX-981: Removed customApiKey from call to align with guidelines
      const data = await analyzeKitabText(text, image);
      setResult(data);
      addToHistory(data);
      setCurrentView('RESULT');
    } catch (err: any) {
      console.error(err);
      if (err.toString().includes("429") || err.status === 429) {
         setError("QUOTA_EXCEEDED");
      } else {
         setError(`Terjadi kesalahan: ${err.message || "Gagal memproses"}`);
      }
      setCurrentView('HOME'); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeFromLibrary = async (text: string) => {
    setInitialInputText(text);
    await handleAnalyze(text, undefined);
  };

  const handleBookSelect = (bookTitle: string) => {
    setSelectedLibraryBook(bookTitle);
    setCurrentView('LIBRARY_VIEW');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBookDetail = (title: string, author?: string) => {
    setSelectedBook({ title, author });
    setCurrentView('BOOK_DETAIL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuthorDetail = (authorName: string) => {
    setSelectedAuthor(authorName);
    setCurrentView('AUTHOR_DETAIL');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToInput = () => {
    setCurrentView('HOME');
    setSelectedLibraryBook(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToolNavigation = (toolId: string) => {
    if (toolId === 'INHERITANCE') setCurrentView('INHERITANCE');
    else if (toolId === 'ZAKAT') setCurrentView('ZAKAT');
    else if (toolId === 'TASBIH') setCurrentView('TASBIH');
    else if (toolId === 'CALENDAR') setCurrentView('CALENDAR');
    else if (toolId === 'DOA') setCurrentView('DOA');
    else if (toolId === 'SHOLAWAT') setCurrentView('SHOLAWAT');
    else if (toolId === 'QIBLA') setCurrentView('QIBLA');
    else if (toolId === 'READING_PRACTICE') setCurrentView('READING_PRACTICE');
    else if (toolId === 'QUIZ') setCurrentView('QUIZ');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    // Global Loading Indicator takes priority
    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (currentView === 'SETTINGS') {
      return (
        <SettingsView 
          settings={settings} 
          onSettingsChange={setSettings} 
          onHistoryClick={() => setIsHistoryOpen(true)} 
          onBookmarksClick={() => setIsBookmarkOpen(true)}
          onHadithBookmarksClick={() => setIsHadithBookmarkOpen(true)}
        />
      );
    }
    if (currentView === 'QURAN') {
      return <ScriptureView type="QURAN" settings={settings} onSelect={(t) => handleAnalyze(t, undefined)} initialJump={bookmarkTarget} onOpenBookmarks={() => setIsBookmarkOpen(true)} />;
    }
    if (currentView === 'HADITH') {
      return <ScriptureView type="HADITH" settings={settings} onSelect={(t) => handleAnalyze(t, undefined)} initialHadithJump={hadithBookmarkTarget} />;
    }
    if (currentView === 'INHERITANCE') return <InheritanceView onBack={handleBackToInput} onAnalyze={(t) => handleAnalyze(t, undefined)} isLoading={isLoading} />;
    if (currentView === 'ZAKAT') return <ZakatView onBack={handleBackToInput} />;
    if (currentView === 'TASBIH') return <TasbihView onBack={handleBackToInput} />;
    if (currentView === 'CALENDAR') return <CalendarView onBack={handleBackToInput} />;
    if (currentView === 'DOA') return <DoaView onBack={handleBackToInput} onAnalyze={(t) => handleAnalyze(t, undefined)} />;
    if (currentView === 'SHOLAWAT') return <SholawatView onBack={handleBackToInput} onAnalyze={(t) => handleAnalyze(t, undefined)} />;
    if (currentView === 'QIBLA') return <QiblaView onBack={handleBackToInput} />;
    // FX-981: Removed apiKey prop
    if (currentView === 'READING_PRACTICE') return <ReadingPracticeView onBack={handleBackToInput} />;
    // FX-981: Removed apiKey prop
    if (currentView === 'QUIZ') return <QuizView onBack={handleBackToInput} />;
    if (currentView === 'LIBRARY_VIEW') {
      return (
        <LibraryView 
          settings={settings} 
          onAnalyzeText={handleAnalyzeFromLibrary}
          initialQuery={selectedLibraryBook || undefined}
          onBack={handleBackToInput}
          onOpenAuthor={handleOpenAuthorDetail}
        />
      );
    }
    if (currentView === 'AUTHOR_DETAIL' && selectedAuthor) {
      return (
        <AuthorDetailPage 
          authorName={selectedAuthor} 
          onBack={() => setCurrentView('BOOK_DETAIL')} 
          onOpenAuthor={handleOpenAuthorDetail}
          onOpenBook={handleBookSelect}
          // FX-981: Removed apiKey prop
        />
      );
    }
    if (currentView === 'BOOK_DETAIL' && selectedBook) {
      // FX-981: Removed apiKey prop
      return <BookDetailPage title={selectedBook.title} author={selectedBook.author} onBack={handleBackToInput} onOpenAuthor={handleOpenAuthorDetail} />;
    }
    if (currentView === 'RESULT' && result) {
      return (
        <main className="max-w-5xl mx-auto px-4 pt-8 mb-20 animate-fade-in">
          <ResultDisplay 
            result={result} 
            settings={settings} 
            onOpenBookTOC={handleBookSelect} 
            onBack={handleBackToInput} 
          />
        </main>
      );
    }

    return (
      <main className="max-w-5xl mx-auto px-4 py-6 md:py-10 flex flex-col items-center pb-24">
          <div className="w-full relative z-10">
            <InputSection 
              onAnalyze={handleAnalyze} 
              onBookSelect={handleBookSelect}
              isAnalyzing={isLoading} 
              settings={settings} 
              onSettingsChange={setSettings} 
              initialValue={initialInputText}
              onHistoryClick={() => setIsHistoryOpen(true)} 
              onOpenTool={handleToolNavigation}
            />
            {error && (
              <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3 text-red-700 dark:text-red-300 animate-pulse shadow-sm mx-auto max-w-2xl">
                {error === "QUOTA_EXCEEDED" ? <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <h4 className="font-semibold">{error === "QUOTA_EXCEEDED" ? "Kuota Server Habis" : "Gagal Memproses"}</h4>
                  <p className="text-sm opacity-90 mb-2">
                    {error === "QUOTA_EXCEEDED" 
                      ? "Server sedang sibuk karena banyak pengguna. Mohon gunakan API Key Anda sendiri di menu Pengaturan." 
                      : error}
                  </p>
                  {error === "QUOTA_EXCEEDED" && (
                    <button 
                      onClick={() => setCurrentView('SETTINGS')}
                      className="text-xs font-bold px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1 w-fit"
                    >
                      <Settings className="w-3 h-3" />
                      Buka Pengaturan
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
      </main>
    );
  };

  return (
    <div className={settings.darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#FAFAF9] dark:bg-gray-950 text-gray-800 dark:text-gray-100 font-sans transition-colors duration-300 flex flex-col" style={{ colorScheme: settings.darkMode ? 'dark' : 'light' }}>
         
         <div className="flex flex-col relative z-50">
            <PrayerCountdown />
         </div>
         
         <div className="flex-grow relative z-10">
            <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-emerald-50/80 to-transparent dark:from-emerald-900/10 -z-10 pointer-events-none"></div>
            {renderContent()}
         </div>

         <BottomNav currentView={currentView} onChangeView={handleBottomNavChange} />

         <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={history} onSelect={handleHistorySelect} onDelete={handleDeleteHistory} onClearAll={handleClearAllHistory} />
         <BookmarkSidebar isOpen={isBookmarkOpen} onClose={() => setIsBookmarkOpen(false)} onSelect={handleBookmarkSelect} />
         <HadithBookmarkSidebar isOpen={isHadithBookmarkOpen} onClose={() => setIsHadithBookmarkOpen(false)} onSelect={handleHadithBookmarkSelect} />
      </div>
    </div>
  );
};

export default App;
