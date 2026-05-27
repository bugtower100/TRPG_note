import React from 'react';

interface StartupSplashScreenProps {
  title?: string;
  message?: string;
}

const StartupSplashScreen: React.FC<StartupSplashScreenProps> = ({
  title = 'TRPG 备团工具',
  message = '正在启动，请稍候...',
}) => {
  return (
    <div className="min-h-screen theme-page flex items-center justify-center p-6">
      <div className="w-full max-w-md theme-card border rounded-xl shadow-lg p-8 text-center">
        <div className="mx-auto mb-5 h-10 w-10 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
        <div className="text-2xl font-semibold">{title}</div>
        <div className="mt-3 text-sm theme-text-secondary">{message}</div>
      </div>
    </div>
  );
};

export default StartupSplashScreen;
