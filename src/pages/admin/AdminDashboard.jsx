import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
    UserAddOutlined,
    FilePdfOutlined,
    DatabaseOutlined,
    BookOutlined,
    IdcardOutlined,
    HomeOutlined,
    CloudSyncOutlined,
    WarningOutlined,
    EditOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import { Layout, Menu, Typography, Badge, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

// Lazy load or import sub-components
import StudentRegistration from './StudentRegistration';
import DocumentGenerator from './DocumentGenerator';
import SystemDataManagement from './SystemDataManagement';
import SubjectManagement from './SubjectManagement';
import AssessmentManagement from './AssessmentManagement';
import SyncCenter from './SyncCenter';
import UrgentMatters from './UrgentMatters';
import AcademicSetup from './AcademicSetup';
import TeacherManagement from './TeacherManagement';
import ReportsAndBackups from './ReportsAndBackups';
import StudentAnalytics from './StudentAnalytics';
import TemplateDesigner from './TemplateDesigner';

const { Text } = Typography;
const { Content, Sider } = Layout;

export default function AdminDashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const menuItems = [
        {
            key: '/admin',
            icon: <HomeOutlined />,
            label: t('app.title')
        },
        {
            type: 'group',
            label: <span className="text-xs uppercase tracking-widest text-slate-400 px-2">{t('admin.menu')}</span>,
            children: [
                {
                    key: '/admin/analytics',
                    icon: <BookOutlined />,
                    label: t('admin.analyticsDashboard', 'Analytics Dashboard')
                },
                {
                    key: '/admin/urgent',
                    icon: <Badge dot color="red"><WarningOutlined /></Badge>,
                    label: <span className="text-red-500 font-bold">{t('admin.urgentMatters', 'Urgent Matters')}</span>
                },
                {
                    key: '/admin/register',
                    icon: <UserAddOutlined />,
                    label: t('admin.registerStudents')
                },
                {
                    key: '/admin/teachers',
                    icon: <UserAddOutlined />,
                    label: t('admin.teacherManagement', 'Teacher Management')
                },
                {
                    key: '/admin/subjects',
                    icon: <BookOutlined />,
                    label: t('admin.subjects')
                },
                {
                    key: '/admin/assessments',
                    icon: <FilePdfOutlined />,
                    label: t('admin.assessments')
                },
                {
                    key: '/admin/certificates',
                    icon: <FilePdfOutlined />,
                    label: t('admin.certificates')
                },
                {
                    key: '/admin/id-cards',
                    icon: <IdcardOutlined />,
                    label: t('admin.idCards')
                },
                {
                    key: '/admin/data',
                    icon: <DatabaseOutlined />,
                    label: t('admin.systemData')
                },
                {
                    key: '/admin/reports',
                    icon: <DatabaseOutlined />,
                    label: t('admin.reportsBackups', 'Reports & Backups')
                },
                {
                    key: '/admin/academic-setup',
                    icon: <CheckCircleOutlined />,
                    label: t('admin.academicSetup', 'Academic Setup')
                },
                {
                    key: '/admin/sync',
                    icon: <CloudSyncOutlined />,
                    label: t('admin.syncCenter', 'Cloud Sync')
                },
                {
                    key: '/admin/attendance-soon',
                    icon: <CheckCircleOutlined />,
                    label: (
                        <div className="flex items-center justify-between w-full menu-item-coming-soon opacity-50">
                            <span>{t('teacher.attendance', 'Attendance')}</span>
                            <Tag color="orange" className="text-[8px] px-1 py-0 h-fit leading-none">{t('common.comingSoon', 'Soon')}</Tag>
                        </div>
                    ),
                    disabled: true
                },
                {
                    key: '/admin/templates-soon',
                    icon: <EditOutlined />,
                    label: (
                        <div className="flex items-center justify-between w-full menu-item-coming-soon opacity-50">
                            <span>{t('admin.templateDesigner', 'Template Designer')}</span>
                            <Tag color="orange" className="text-[8px] px-1 py-0 h-fit leading-none">{t('common.comingSoon', 'Soon')}</Tag>
                        </div>
                    ),
                    disabled: true
                },
            ]
        },
    ];

    return (
        <div className="flex flex-col w-full h-full">
            <style>{`
                .menu-item-coming-soon {
                    filter: blur(1px);
                    opacity: 0.6;
                    cursor: not-allowed !important;
                    pointer-events: none;
                }
                .ant-menu-item-disabled.menu-item-coming-soon:hover {
                    background: transparent !important;
                }
                .menu-item-coming-soon * {
                    pointer-events: none !important;
                }
            `}</style>
            {/* Tablet/Mobile Navigation (Sidebar is lg+) */}
            <div className="lg:hidden mb-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Menu
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => navigate(key)}
                    className="border-none w-full overflow-x-auto flex-nowrap hide-scrollbar"
                />
            </div>

            <Layout className="bg-transparent">
            <Sider
                width={240}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mr-6 hidden lg:block overflow-hidden"
            >
                <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-800">
                    <img src="/Logo.jpg" alt="Logo" className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow" />
                    <div className="min-w-0">
                        <Text strong className="text-sm leading-tight block truncate">{t('app.shortTitle', 'Senbet School')}</Text>
                        <Text type="secondary" style={{ fontSize: '10px' }} className="uppercase tracking-wider block">{t('admin.menu')}</Text>
                    </div>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => navigate(key)}
                    className="border-none pt-2"
                />
            </Sider>

            <Content className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-3 sm:p-4 md:p-6 min-h-[600px]">
                <Routes>
                    <Route path="/" element={<Navigate to="analytics" replace />} />
                    <Route path="/register" element={<StudentRegistration />} />
                    <Route path="/urgent" element={<UrgentMatters />} />
                    <Route path="/certificates" element={<DocumentGenerator type="certificate" />} />
                    <Route path="/id-cards" element={<DocumentGenerator type="id-card" />} />
                    <Route path="/data" element={<SystemDataManagement />} />
                    <Route path="/subjects" element={<SubjectManagement />} />
                    <Route path="/assessments" element={<AssessmentManagement />} />
                    <Route path="/teachers" element={<TeacherManagement />} />
                    <Route path="/reports" element={<ReportsAndBackups />} />
                    <Route path="/analytics" element={<StudentAnalytics />} />
                    <Route path="/sync" element={<SyncCenter />} />
                    <Route path="/templates" element={<TemplateDesigner />} />
                    <Route path="/academic-setup" element={<AcademicSetup />} />
                </Routes>
            </Content>
            </Layout>
        </div>
    );
}
