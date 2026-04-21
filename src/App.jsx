import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout, Menu, Button, Space, Typography, ConfigProvider, theme, Badge, Tooltip, App as AntApp } from 'antd';
import enUS from 'antd/locale/en_US';
import {
  BookOutlined,
  UserOutlined,
  TeamOutlined,
  GlobalOutlined,
  CloudOutlined,
  DatabaseOutlined,
  SyncOutlined,
  HomeOutlined,
  MoonOutlined,
  SunOutlined,
  LockOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { Form, Input, Card, Result } from 'antd';
import AdminDashboard from './pages/admin/AdminDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ParentPortal from './pages/parent/ParentPortal';
import { syncData } from './utils/sync';
import { formatEthiopianTime } from './utils/dateUtils';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

function AppContent({ isDarkMode, toggleTheme }) {
  const { t, i18n } = useTranslation();
  const { message } = AntApp.useApp(); // Context-aware message for dark mode
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdminAuth, setIsAdminAuth] = useState(() => sessionStorage.getItem('admin_auth') === 'true');
  const [teacherSession, setTeacherSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem('senbet_teacher_auth');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [activeRole, setActiveRole] = useState(() => sessionStorage.getItem('active_role') || null);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem('last_sync_time') || null);
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('am') ? 'en' : 'am';
    i18n.changeLanguage(newLang);
  };

  const handleAdminLogin = (password) => {
    if (password === 'senbet2026') {
      setIsAdminAuth(true);
      sessionStorage.setItem('admin_auth', 'true');
      sessionStorage.setItem('active_role', 'admin');
      setActiveRole('admin');
      message.success(t('parent.loginSuccess'));
    } else {
      message.error(t('parent.loginError'));
    }
  };

  const navigate = useNavigate();
  const handleAdminLogout = () => {
    setIsAdminAuth(false);
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('active_role');
    setActiveRole(null);
    navigate('/');
    message.info(t('parent.loggedOut'));
  };

  const handleTeacherLogout = () => {
    setTeacherSession(null);
    sessionStorage.removeItem('senbet_teacher_auth');
    sessionStorage.removeItem('active_role');
    setActiveRole(null);
    navigate('/');
    message.info(t('common.logout', 'Logged out'));
  };

  const handleSync = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    const hide = silent ? message.loading(t('common.syncing'), 0) : null;
    const result = await syncData({ force });
    setIsSyncing(false);
    if (hide) hide();
    if (result.success) {
      if (!silent) message.success(t('common.syncSuccess'));
      const now = formatEthiopianTime(new Date());
      setLastSync(now);
      localStorage.setItem('last_sync_time', now);
      window.dispatchEvent(new Event('syncComplete'));
    } else {
      message.error(t('common.syncError') + ": " + (result.error || t('common.syncDisabled')));
    }
  }, [isOnline, isSyncing, t, message]);

  // Sync once when the app first loads
  const hasSyncedOnLoad = useRef(false);
  useEffect(() => {
    if (!hasSyncedOnLoad.current && isOnline) {
      hasSyncedOnLoad.current = true;
      void handleSync({ silent: true });
    }
  }, [isOnline, handleSync]);

  // Auto-sync every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        void handleSync({ silent: true });
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline, handleSync]);

  return (
    <Layout className="min-h-screen w-full flex flex-col bg-slate-50 dark:bg-slate-950" style={{ minHeight: '100vh' }}>
      <Header
        className="px-4 md:px-8 flex items-center justify-between sticky top-0 z-50 shadow-sm bg-white border-b border-slate-100 dark:bg-slate-900 dark:border-slate-800"
        style={{ height: '64px' }}
      >
        <Space align="center" size="small">
          <Link to="/" className="flex items-center gap-2 notranslate" translate="no">
            <img src="/logo.png" alt="Logo" className="w-9 h-9 object-cover rounded-full shadow-sm flex-shrink-0" />
            <span 
              className="hidden lg:block font-bold text-slate-800 dark:text-slate-100"
              style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                maxWidth: '500px', 
                overflow: 'hidden', 
                whiteSpace: 'nowrap', 
                textOverflow: 'ellipsis',
                letterSpacing: '-0.01em'
              }}
            >
              በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት
            </span>
          </Link>
        </Space>

        <div className="flex items-center gap-1 sm:gap-4">
          <Space size="small">
            <Tooltip title={
              <div className="text-xs">
                <div>{t('teacher.attendanceModule')}: <b>{isOnline ? t('common.online', 'Online') : t('common.offline')}</b></div>
                <div>Sync: <b>{isSyncing ? t('common.syncing') : (lastSync ? t('common.synced') : t('common.ready'))}</b></div>
                {lastSync && <div className="mt-1 opacity-80 italic">Last synced: {lastSync}</div>}
              </div>
            }>
              <Badge
                status={isSyncing ? 'processing' : isOnline ? (lastSync ? 'success' : 'warning') : 'error'}
                text={
                  <Button
                    type="text"
                    onClick={() => handleSync()}
                    disabled={!isOnline || isSyncing}
                    className="flex items-center gap-1 p-0 hover:text-forest-700 cursor-pointer"
                  >
                    {isSyncing ? <SyncOutlined spin /> : isOnline ? <CloudOutlined /> : <DatabaseOutlined />}
                    <span className="text-xs font-medium hidden sm:inline">
                      {isSyncing ? t('common.syncing') : isOnline ? (lastSync ? t('common.synced') : t('common.ready')) : t('common.offline')}
                    </span>
                  </Button>
                }
              />
            </Tooltip>

            <Button
              onClick={toggleTheme}
              icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
              className="cursor-pointer"
              type="text"
              size="small"
            />

            <Button
              onClick={toggleLanguage}
              icon={<GlobalOutlined />}
              className="font-bold cursor-pointer"
              size="small"
            >
              {i18n.language.startsWith('am') ? 'EN' : 'አማ'}
            </Button>

            {(isAdminAuth || teacherSession) && (
               <Button
                  onClick={isAdminAuth ? handleAdminLogout : handleTeacherLogout}
                  icon={<LogoutOutlined />}
                  type="primary"
                  danger
                  className="font-bold shadow-md shadow-red-500/20"
              >
                  {t('common.logout')}
              </Button>
            )}
          </Space>
        </div>
      </Header>

      <Content className="flex-1 flex flex-col p-4 md:p-8 max-w-7xl mx-auto w-full min-h-[70vh]">
        <Routes>
          <Route path="/" element={<Home activeRole={activeRole} isDesktop={!!window.__TAURI_INTERNALS__} />} />
          <Route 
            path="/admin/*" 
            element={!window.__TAURI_INTERNALS__ ? <Navigate to="/" replace /> : isAdminAuth ? <AdminDashboard /> : <AdminLogin onLogin={handleAdminLogin} />} 
          />
          <Route 
            path="/teacher/*" 
            element={!window.__TAURI_INTERNALS__ ? <Navigate to="/" replace /> : <TeacherDashboard teacherSession={teacherSession} setTeacherSession={setTeacherSession} />} 
          />
          <Route 
            path="/parent" 
            element={window.__TAURI_INTERNALS__ ? <Navigate to="/" replace /> : <ParentPortal />} 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>

      <Footer className="text-center text-slate-400 bg-slate-50 dark:bg-slate-900 notranslate" translate="no">
        በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት ©{new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}

export default function SenbetApp() {
  const { t, i18n } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const themeTransitionTimeoutRef = useRef(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transition');
    if (themeTransitionTimeoutRef.current) window.clearTimeout(themeTransitionTimeoutRef.current);
    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
      themeTransitionTimeoutRef.current = null;
    }, 260);
    setIsDarkMode(v => !v);
  };

  const isAmharic = i18n.language.startsWith('am');
  const antdLocale = isAmharic ? {
    ...enUS,
    Pagination: {
      ...enUS.Pagination,
      items_per_page: t('common.perPage', ' / ገጽ'),
      jump_to: 'ወደ',
      jump_to_confirm: 'አረጋግጥ',
      page: 'ገጽ',
      prev_page: 'ያለፈው ገጽ',
      next_page: 'ቀጣዩ ገጽ',
      prev_5: 'ያለፉት 5 ገጾች',
      next_5: 'ቀጣይ 5 ገጾች',
      prev_3: 'ያለፉት 3 ገጾች',
      next_3: 'ቀጣይ 3 ገጾች',
    },
    Table: {
      ...enUS.Table,
      filterTitle: 'ማጣሪያ',
      filterConfirm: 'እሺ',
      filterReset: 'አጽዳ',
      selectAll: 'ሁሉንም ምረጥ',
      selectInvert: 'ምርጫውን ገልብጥ',
    },
    Empty: {
      description: 'ምንም መረጃ የለም'
    }
  } : enUS;

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        cssVar: true,
        token: {
          colorPrimary: isDarkMode ? '#22c55e' : '#166534',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
          colorBgContainer: isDarkMode ? '#0f172a' : '#ffffff',
          colorBgLayout: isDarkMode ? '#020617' : '#f8fafc',
          colorBgElevated: isDarkMode ? '#1e293b' : '#ffffff',
          colorTextHeading: isDarkMode ? '#f8fafc' : '#0f172a',
        },
        components: {
          Layout: {
            headerBg: isDarkMode ? '#0f172a' : '#ffffff',
            siderBg: isDarkMode ? '#0f172a' : '#ffffff',
          },
          Menu: {
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
          }
        }
      }}
    >
      <AntApp style={{ width: '100%', height: '100%' }}>
        <AppContent isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      </AntApp>
    </ConfigProvider>
  );
}

function Home({ activeRole, isDesktop }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center p-4">
      {/* Bilingual title — always show both languages */}
      <Title level={1} style={{ marginBottom: '16px' }}>ወደ በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት እንኳን በደህና መጡ</Title>
      <Text type="secondary" style={{ fontSize: '1.125rem', maxWidth: '600px', marginBottom: '32px' }}>
        {t('app.description')}
      </Text>
      <Space size="large">
        {isDesktop && (
          <>
            <Link to="/admin">
              <Button type="primary" size="large" className="px-8 flex items-center gap-2">
                <UserOutlined />
                {t('app.adminPortal')}
              </Button>
            </Link>
            {activeRole !== 'admin' && (
              <Link to="/teacher">
                <Button size="large" className="px-8 flex items-center gap-2">
                  <TeamOutlined />
                  {t('app.teacherPortal')}
                </Button>
              </Link>
            )}
          </>
        )}
        {!isDesktop && (
          <Link to="/parent">
            <Button type="primary" size="large" className="px-8 flex items-center gap-2">
              <GlobalOutlined />
              {t('parent.title', 'Parent Portal')}
            </Button>
          </Link>
        )}
      </Space>
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex items-center justify-center w-full py-12">
      <Card 
        className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden border-slate-100 dark:border-slate-800"
        title={
          <div className="text-center pt-4">
            <LockOutlined className="text-3xl text-forest-600 mb-2" />
            <br/>
            <Title level={4}>{t('admin.portalAccess', 'Staff Portal Access')}</Title>
          </div>
        }
      >
        <Form 
          layout="vertical" 
          onFinish={(v) => onLogin(v.password)}
          requiredMark={false}
        >
          <Form.Item 
            label={t('common.password', 'Master Password')} 
            name="password" 
            rules={[{ required: true, message: 'Password required' }]}
            extra={t('parent.masterPwdExtra')}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-300" />} placeholder="Enter password" size="large" className="rounded-xl" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" className="h-12 font-bold rounded-xl shadow-lg mt-2">
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
}
