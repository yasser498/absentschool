
import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';

const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if it's iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    
    // 2. Check if already in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (isStandalone) {
        return; // Already installed, do nothing
    }

    if (isIosDevice) {
        setIsIOS(true);
        // Show instruction after a short delay on iOS
        // Only show if not recently dismissed (using sessionStorage for session-only persistence)
        if (!sessionStorage.getItem('install_prompt_dismissed')) {
            const timer = setTimeout(() => setShow(true), 3000);
            return () => clearTimeout(timer);
        }
    } else {
        // Standard PWA (Android / Desktop)
        const handler = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            if (!sessionStorage.getItem('install_prompt_dismissed')) {
                setShow(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setShow(false);
    } else {
      console.log('User dismissed the install prompt');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
      setShow(false);
      sessionStorage.setItem('install_prompt_dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-fade-in-up">
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-5 rounded-3xl shadow-2xl flex flex-col gap-4 border border-slate-700 max-w-md mx-auto">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg">
                    {isIOS ? <Smartphone size={24} className="text-white" /> : <Download size={24} className="text-white" />}
                </div>
                <div>
                    <h3 className="font-bold text-sm">تثبيت التطبيق</h3>
                    <p className="text-xs text-slate-300 mt-0.5">{isIOS ? 'أضفه للشاشة الرئيسية لسهولة الوصول' : 'تجربة أفضل، أسرع، وبدون إنترنت'}</p>
                </div>
            </div>
            <button onClick={handleDismiss} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-1.5 rounded-full">
                <X size={18} />
            </button>
        </div>
        
        {isIOS ? (
            <div className="text-xs text-slate-200 bg-white/10 p-3 rounded-xl leading-relaxed border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-white/20 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold">1</span>
                    <span>اضغط على زر <strong>مشاركة</strong> <Share size={14} className="inline mx-1"/> في أسفل المتصفح</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-white/20 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold">2</span>
                    <span>اختر <strong>"إضافة إلى الصفحة الرئيسية"</strong> <span className='text-lg inline-block align-middle leading-none'>+</span></span>
                </div>
            </div>
        ) : (
            <button 
                onClick={handleInstall} 
                className="w-full bg-white text-slate-900 py-3 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors shadow-lg active:scale-95"
            >
                تثبيت التطبيق الآن
            </button>
        )}
      </div>
    </div>
  );
};

export default InstallPrompt;
