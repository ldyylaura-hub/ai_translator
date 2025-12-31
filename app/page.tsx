import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  const userPayload = token ? verifyToken(token.value) : null;

  if (!userPayload) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <Navbar user={userPayload} />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          <section>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Translate</h1>
            <p className="text-gray-500 mb-6">
              AI-powered translation with OCR and Voice Synthesis
            </p>
            <Dashboard />
          </section>
        </div>
      </main>
    </div>
  );
}
