'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface BackgroundContextType {
  backgroundImage: string | null;
  setBackgroundImage: (image: string | null) => void;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(undefined);

export function BackgroundProvider({ children }: { children: React.ReactNode }) {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

  useEffect(() => {
    const savedImage = localStorage.getItem('app_background_image');
    if (savedImage) {
      setBackgroundImage(savedImage);
    }
  }, []);

  const handleSetBackgroundImage = (image: string | null) => {
    setBackgroundImage(image);
    if (image) {
      localStorage.setItem('app_background_image', image);
    } else {
      localStorage.removeItem('app_background_image');
    }
  };

  return (
    <BackgroundContext.Provider value={{ backgroundImage, setBackgroundImage: handleSetBackgroundImage }}>
      {backgroundImage && (
        <div 
          className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat transition-all duration-500"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      {!backgroundImage && (
        <div className="fixed inset-0 z-[-1] bg-gray-50 transition-all duration-500" />
      )}
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error('useBackground must be used within a BackgroundProvider');
  }
  return context;
}
