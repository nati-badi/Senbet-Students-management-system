import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
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
  SunOutlined
} from '@ant-design/icons';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import { syncData } from './utils/sync';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

export default function App() {
  const { t, i18n } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const location = useLocation();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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

  const handleSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    const result = await syncData();
    setIsSyncing(false);
    if (result.success) {
      message.success('Synchronization completed successfully!');
    } else {
      message.error("Sync failed: " + (result.error || "Check server connection"));
    }
  };

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
              <BookOutlined style={{ fontSize: '24px', color: isDarkMode ? '#22c55e' : '#166534' }} />
              <Title level={4} style={{ margin: 0, fontSize: '1rem', maxWidth: '220px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} className="hidden sm:block">
                በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት
              </Title>
            </Link>
          </Space>

          <div className="flex items-center gap-1 sm:gap-4">
            <Space size="small">
              <Tooltip title={isOnline ? 'Network Online' : 'Network Offline'}>
                <Badge
                  status={isSyncing ? 'processing' : isOnline ? 'success' : 'warning'}
                  text={
                    <Button
                      type="text"
                      onClick={handleSync}
                      disabled={!isOnline || isSyncing}
                      className="flex items-center gap-1 p-0 hover:text-forest-700 cursor-pointer"
                    >
                      {isSyncing ? <SyncOutlined spin /> : isOnline ? <CloudOutlined /> : <DatabaseOutlined />}
                      <span className="text-xs font-medium hidden sm:inline">
                        {isSyncing ? 'Syncing...' : isOnline ? 'Sync Ready' : t('teacher.savedLocal')}
                      </span>
                    </Button>
                  }
                />
              </Tooltip>

              <Button
                onClick={() => setIsDarkMode(!isDarkMode)}
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
            </Space>
          </div>
        </Header>

        <Content className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/teacher/*" element={<TeacherDashboard />} />
          </Routes>
        </Content>

        <Footer className="text-center text-slate-400 bg-slate-50 dark:bg-slate-900 notranslate" translate="no">
          በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት ©{new Date().getFullYear()}
        </Footer>
      </Layout>
    </ConfigProvider>
  );
}

function Home() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
      {/* Bilingual title — always show both languages */}
      <Title level={1} style={{ marginBottom: '16px' }}>ወደ በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት እንኳን በደህና መጡ</Title>
      <Text type="secondary" style={{ fontSize: '1.125rem', maxWidth: '600px', marginBottom: '32px' }}>
        {t('app.description')}
      </Text>
      <Space size="large">
        <Link to="/admin">
          <Button type="primary" size="large" className="px-8 flex items-center gap-2">
            <UserOutlined />
            {t('app.adminPortal')}
          </Button>
        </Link>
        <Link to="/teacher">
          <Button size="large" className="px-8 flex items-center gap-2">
            <TeamOutlined />
            {t('app.teacherPortal')}
          </Button>
        </Link>
      </Space>
    </div>
  );
}
