import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import { BookOpen, Users, GraduationCap } from 'lucide-react';

function App() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('am') ? 'en' : 'am';
    i18n.changeLanguage(newLang);
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        <header className="bg-white shadow-sm sticky top-0 z-10 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-2">
                <BookOpen className="h-8 w-8 text-forest-700" style={{ color: 'var(--color-forest)' }} />
                <span className="font-bold text-xl tracking-tight" style={{ color: 'var(--color-navy)' }}>{t('app.title')}</span>
              </div>
              <nav className="flex items-center gap-2 md:gap-4">
                <Link to="/admin" className="hidden md:flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  <Users className="h-4 w-4" /> {t('app.adminPortal')}
                </Link>
                <Link to="/teacher" className="hidden md:flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                  <GraduationCap className="h-4 w-4" /> {t('app.teacherPortal')}
                </Link>
                <button
                  onClick={toggleLanguage}
                  className="ml-2 px-3 py-1 bg-slate-100 text-slate-700 font-bold rounded-md hover:bg-slate-200 transition-colors shadow-sm"
                >
                  {i18n.language.startsWith('am') ? 'EN' : 'አማ'}
                </button>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/teacher/*" element={<TeacherDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function Home() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--color-navy)' }}>{t('app.welcome')}</h1>
      <p className="text-lg text-slate-600 max-w-2xl mb-8">
        {t('app.description')}
      </p>
      <div className="flex gap-4">
        <Link to="/admin" className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium shadow-sm hover:bg-slate-800 transition-colors">
          {t('app.adminPortal')}
        </Link>
        <Link to="/teacher" className="px-6 py-3 border border-slate-300 bg-white text-slate-700 rounded-lg font-medium shadow-sm hover:bg-slate-50 transition-colors">
          {t('app.teacherPortal')}
        </Link>
      </div>
    </div>
  )
}

export default App;
