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
    CheckCircleOutlined,
    NotificationOutlined
} from '@ant-design/icons';
import { Layout, Menu, Typography, Badge, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatEthiopianDate, formatEthiopianTime } from '../../utils/dateUtils';
import { useState, useEffect } from 'react';

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
import AnnouncementManagement from './AnnouncementManagement';


const { Text } = Typography;
const { Content, Sider } = Layout;

const EthiopicClockWidget = () => {
    const [timeObj, setTimeObj] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTimeObj(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fullEtTime = formatEthiopianTime(timeObj); // Returns "8:03 ከሰዓት"
    const [etTime, etSuffix] = fullEtTime.split(' ');

    const gregDateStr = timeObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const ethpoianDateStr = formatEthiopianDate(timeObj, true).replace(/ E\.C\./i, '').trim();
    const amhDays = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "አርብ", "ቅዳሜ"];
    const ethDayName = amhDays[timeObj.getDay()];

    return (
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden relative mb-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 dark:bg-slate-800/80 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50/30 dark:bg-blue-900/20 rounded-full blur-2xl opacity-40 translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>
            
            <div className="flex flex-row items-center justify-between py-6 px-10 relative">
                <div className="flex flex-col items-start">
                    <div className="flex items-baseline gap-2">
                        <span className="text-6xl font-light tracking-tight text-slate-800 dark:text-white">{etTime}</span>
                        <span className="text-2xl text-slate-400 dark:text-slate-500 font-normal">{etSuffix}</span>
                    </div>
                    <span className="text-slate-400 dark:text-slate-500 mt-2 text-base tracking-wide">{formatEthiopianDate(timeObj)}</span>
                </div>

                <div className="w-px h-16 bg-slate-200 dark:bg-slate-700/50 mx-4"></div>

                <div className="flex flex-col items-end text-right">
                    <span className="text-3xl text-slate-400 dark:text-slate-300 font-normal mb-1 tracking-wide">{ethDayName}</span>
                    <span className="text-4xl text-slate-800 dark:text-white font-light">{ethpoianDateStr}</span>
                </div>
            </div>
        </div>
    );
};

export default function AdminDashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const menuItems = React.useMemo(() => [
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
                    key: '/admin/announcements',
                    icon: <NotificationOutlined />,
                    label: t('admin.announcements', 'Announcements')
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

            ]
        },
    ], [t]);

    return (
        <div className="flex flex-col w-full h-full">
            <style>{`
                .admin-sidebar .ant-menu-item-selected {
                    background-color: #f0fdf4 !important;
                    color: #166534 !important;
                    border-right: 3px solid #166534;
                    font-weight: 700;
                }
                .dark .admin-sidebar .ant-menu-item-selected {
                    background-color: rgba(22, 101, 52, 0.2) !important;
                    color: #4ade80 !important;
                    border-right: 3px solid #4ade80;
                }
                .admin-sidebar .ant-menu-item-selected .ant-menu-item-icon,
                .admin-sidebar .ant-menu-item-selected span {
                    color: inherit !important;
                }
                .admin-sidebar .ant-menu-item:hover {
                    background-color: #f8fafc !important;
                    color: #166534 !important;
                }
                .dark .admin-sidebar .ant-menu-item:hover {
                    background-color: #1e293b !important;
                    color: #4ade80 !important;
                }
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
                    className="admin-sidebar border-none w-full overflow-x-auto flex-nowrap hide-scrollbar"
                />
            </div>

            <div className="mb-6">
                <EthiopicClockWidget />
            </div>

            <Layout className="bg-transparent">
            <Sider
                width={240}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mr-6 hidden lg:block overflow-hidden"
            >
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => navigate(key)}
                    className="admin-sidebar border-none pt-2"
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
                    <Route path="/announcements" element={<AnnouncementManagement />} />
                    <Route path="/sync" element={<SyncCenter />} />

                    <Route path="/academic-setup" element={<AcademicSetup />} />
                </Routes>
            </Content>
            </Layout>
        </div>
    );
}
