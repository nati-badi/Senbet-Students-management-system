import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout, Menu, Button, Space, Typography, ConfigProvider, theme, Badge, Tooltip, message } from 'antd';
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

export default function App() {
  const { t, i18n } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isAdminAuth, setIsAdminAuth] = useState(() => sessionStorage.getItem('admin_auth') === 'true');
  const [activeRole, setActiveRole] = useState(() => sessionStorage.getItem('active_role') || null);
  const [lastSync, setLastSync] = useState(() => localStorage.getItem('last_sync_time') || null);
  const location = useLocation();
  const themeTransitionTimeoutRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (themeTransitionTimeoutRef.current) {
        window.clearTimeout(themeTransitionTimeoutRef.current);
        themeTransitionTimeoutRef.current = null;
      }
    };
  }, []);

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
    // Add a short-lived class that enables CSS transitions during the toggle.
    // This avoids "always-on" transitions that can make the UI feel sluggish.
    document.documentElement.classList.add('theme-transition');
    if (themeTransitionTimeoutRef.current) window.clearTimeout(themeTransitionTimeoutRef.current);
    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
      themeTransitionTimeoutRef.current = null;
    }, 260);
    setIsDarkMode(v => !v);
  };

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
    // Simple admin password for local access - can be improved later
    if (password === 'senbet2026') {
      setIsAdminAuth(true);
      sessionStorage.setItem('admin_auth', 'true');
      sessionStorage.setItem('active_role', 'admin');
      setActiveRole('admin');
      message.success('Logged in successfully!');
    } else {
      message.error('Invalid password!');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuth(false);
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('active_role');
    setActiveRole(null);
    message.info('Logged out.');
  };

  const handleSync = useCallback(async ({ silent = false, force = false } = {}) => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    const hide = silent ? message.loading('Syncing...', 0) : null;
    const result = await syncData({ force });
    setIsSyncing(false);
    if (hide) hide();
    if (result.success) {
      if (!silent) message.success(`Sync successful!`);
      const now = formatEthiopianTime(new Date());
      setLastSync(now);
      localStorage.setItem('last_sync_time', now);
      window.dispatchEvent(new Event('syncComplete'));
    } else {
      message.error("Sync disabled: " + (result.error || "Check your internet connection and .env keys"));
    }
  }, [isOnline, isSyncing]);

  // Sync once when the app first loads (not on every route change)
  const hasSyncedOnLoad = useRef(false);
  useEffect(() => {
    if (!hasSyncedOnLoad.current && isOnline) {
      hasSyncedOnLoad.current = true;
      void handleSync({ silent: true });
    }
  }, [isOnline, handleSync]);

  // Auto-sync every 60 seconds in the background
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        // Run silently to not disrupt the UI
        void handleSync({ silent: true });
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline, handleSync]);

  return (
    <ConfigProvider
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
      <Layout className="min-h-screen flex-1 w-full flex flex-col bg-slate-50 dark:bg-slate-950">
        <Header
          className="px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm bg-white border-b border-slate-100 dark:bg-slate-900 dark:border-slate-800"
          style={{ height: '64px' }}
        >
          <Space align="center" size="small">
            <Link to="/" className="flex items-center gap-2 notranslate" translate="no">
              <img src="/Logo.jpg" alt="Logo" className="w-9 h-9 object-cover rounded-full shadow-sm flex-shrink-0" />
              <Title level={4} style={{ margin: 0, fontSize: '1rem', maxWidth: '220px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} className="hidden sm:block">
                በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት
              </Title>
            </Link>
          </Space>

          <div className="flex items-center gap-1 sm:gap-4">
            <Space size="small">
              <Tooltip title={
                <div className="text-xs">
                  <div>Status: <b>{isOnline ? 'Online' : 'Offline'}</b></div>
                  <div>Sync: <b>{isSyncing ? 'In Progress' : (lastSync ? 'Completed' : 'Pending')}</b></div>
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
                        {isSyncing ? 'Syncing...' : isOnline ? (lastSync ? 'Synced' : 'Ready') : 'Offline'}
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

              {isAdminAuth && (
                 <Button
                    onClick={handleAdminLogout}
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

        <Content className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Home activeRole={activeRole} isDesktop={!!window.__TAURI_INTERNALS__} />} />
            <Route 
              path="/admin/*" 
              element={!window.__TAURI_INTERNALS__ ? <Navigate to="/" replace /> : isAdminAuth ? <AdminDashboard /> : <AdminLogin onLogin={handleAdminLogin} />} 
            />
            <Route 
              path="/teacher/*" 
              element={!window.__TAURI_INTERNALS__ ? <Navigate to="/" replace /> : <TeacherDashboard />} 
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
    </ConfigProvider>
  );
}

function Home({ activeRole, isDesktop }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
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
    <div className="flex items-center justify-center min-h-[50vh]">
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
