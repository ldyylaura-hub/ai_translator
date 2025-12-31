'use client';

import { useRouter } from 'next/navigation';
import axios from 'axios';
import { LogOut, User } from 'lucide-react';

interface NavbarProps {
  user: { username: string } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <div className="bg-blue-600 text-white p-2 rounded-lg font-bold text-xl">
          AI
        </div>
        <span className="text-xl font-bold text-gray-800">Translate Assistant</span>
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <div className="flex items-center space-x-2 text-gray-700">
              <User className="w-5 h-5" />
              <span className="font-medium">{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
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
