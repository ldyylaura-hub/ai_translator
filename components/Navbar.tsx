'use client';

import { useRouter } from 'next/navigation';
import axios from 'axios';
import { LogOut, User, Image as ImageIcon } from 'lucide-react';
import { useRef } from 'react';
import { useBackground } from './BackgroundProvider';

interface NavbarProps {
  user: { username: string } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const { setBackgroundImage } = useBackground();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    router.push('/login');
    router.refresh();
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setBackgroundImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 px-6 py-4 flex justify-between items-center sticky top-0 z-50 transition-colors duration-300">
      <div className="flex items-center space-x-2">
        <div className="bg-blue-600 text-white p-2 rounded-lg font-bold text-xl shadow-lg bg-gradient-to-br from-blue-500 to-blue-700">
          AI
        </div>
        <span className="text-xl font-bold text-gray-800 drop-shadow-sm">Translate Assistant</span>
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 hover:bg-white/50 px-3 py-2 rounded-lg transition-all active:scale-95"
              title="Change Background Image"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Theme</span>
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleBackgroundUpload}
            />
            
            <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block" />

            <div className="flex items-center space-x-2 text-gray-700 bg-white/50 px-3 py-1.5 rounded-full border border-gray-200/50 shadow-sm backdrop-blur-sm">
              <User className="w-4 h-4" />
              <span className="font-medium text-sm">{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-red-600 hover:bg-red-50/50 px-3 py-2 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <a href="/login" className="text-blue-600 font-medium hover:underline">
            Login
          </a>
        )}
      </div>
    </nav>
  );
}
