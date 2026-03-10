import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
    UserAddOutlined,
    FilePdfOutlined,
    DatabaseOutlined,
    BookOutlined,
    IdcardOutlined,
    HomeOutlined,
    CloudSyncOutlined
} from '@ant-design/icons';
import { Layout, Menu, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

// Lazy load or import sub-components
import StudentRegistration from './StudentRegistration';
import DocumentGenerator from './DocumentGenerator';
import SystemDataManagement from './SystemDataManagement';
import SubjectManagement from './SubjectManagement';
import AssessmentManagement from './AssessmentManagement';
import SyncCenter from './SyncCenter';

const { Text } = Typography;
const { Content, Sider } = Layout;

export default function AdminDashboard() {
    const location = useLocation();
    const { t } = useTranslation();

    const menuItems = [
        {
            key: '/',
            icon: <HomeOutlined />,
            label: <Link to="/">{t('app.title')}</Link>
        },
        {
            key: '/admin',
            icon: <UserAddOutlined />,
            label: <Link to="/admin">{t('admin.registerStudents')}</Link>
        },
        {
            key: '/admin/certificates',
            icon: <FilePdfOutlined />,
            label: <Link to="/admin/certificates">{t('admin.certificates')}</Link>
        },
        {
            key: '/admin/id-cards',
            icon: <IdcardOutlined />,
            label: <Link to="/admin/id-cards">{t('admin.idCards')}</Link>
        },
        {
            key: '/admin/data',
            icon: <DatabaseOutlined />,
            label: <Link to="/admin/data">{t('admin.systemData')}</Link>
        },
        {
            key: '/admin/subjects',
            icon: <BookOutlined />,
            label: <Link to="/admin/subjects">{t('admin.subjects')}</Link>
        },
        {
            key: '/admin/assessments',
            icon: <FilePdfOutlined />,
            label: <Link to="/admin/assessments">{t('admin.assessments')}</Link>
        },
        {
            key: '/admin/sync',
            icon: <CloudSyncOutlined />,
            label: <Link to="/admin/sync">{t('admin.sync') || 'Cloud Sync'}</Link>
        },
    ];

    return (
        <Layout className="bg-transparent">
            <Sider
                width={240}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mr-6 hidden md:block"
            >
                <div style={{ padding: '16px' }}>
                    <Text strong type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                        {t('admin.menu')}
                    </Text>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    className="border-none"
                />
            </Sider>

            <Content className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 min-h-[600px]">
                <Routes>
                    <Route path="/" element={<StudentRegistration />} />
                    <Route path="/certificates" element={<DocumentGenerator type="certificate" />} />
                    <Route path="/id-cards" element={<DocumentGenerator type="id-card" />} />
                    <Route path="/data" element={<SystemDataManagement />} />
                    <Route path="/subjects" element={<SubjectManagement />} />
                    <Route path="/assessments" element={<AssessmentManagement />} />
                    <Route path="/sync" element={<SyncCenter />} />
                </Routes>
            </Content>
        </Layout>
    );
}
