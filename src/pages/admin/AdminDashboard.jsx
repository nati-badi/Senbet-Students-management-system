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
import { Layout, Menu, Typography, Badge, Tag, Button, Modal, Space } from 'antd';
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

    const ethpoianDateStr = formatEthiopianDate(timeObj, true).replace(/ E\.C\./i, '').trim();
    const amhDays = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "አርብ", "ቅዳሜ"];
    const ethDayName = amhDays[timeObj.getDay()];

    return (
        <div className="w-full relative group">
            {/* Background Glows */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-rose-500/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-75 transition duration-1000"></div>
            
            <div className="relative w-full bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5 overflow-hidden">
                {/* Optimized Static Glows (Previously heavy animated blurs) */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[60px] -mr-32 -mt-32 rounded-full" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-500/5 blur-[40px] -ml-24 -mb-24 rounded-full" />
                
                <div className="relative flex flex-col md:flex-row items-center justify-between py-6 px-8 lg:py-10 lg:px-12 gap-8 md:gap-4">
                    <div className="flex flex-col items-center md:items-start">
                        <div className="flex items-baseline gap-3">
                            <span className="text-5xl lg:text-7xl font-black tracking-tighter bg-gradient-to-br from-slate-800 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                                {etTime}
                            </span>
                            <span className="text-xl lg:text-2xl text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-widest">{etSuffix}</span>
                        </div>
                    </div>

                    <div className="hidden md:block w-px h-24 bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-700 to-transparent mx-8 opacity-50"></div>

                    <div className="flex flex-col items-center md:items-end text-right">
                        <span className="text-xl lg:text-3xl text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mb-2">{ethDayName}</span>
                        <span className="text-3xl lg:text-5xl font-black tracking-tight text-slate-800 dark:text-white">{ethpoianDateStr}</span>
                        <div className="mt-4 flex items-center gap-2">
                             <div className="h-1 w-12 bg-rose-500/30 rounded-full" />
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ፍኖተ ብርሃን ሰ/ቤት</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function AdminDashboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

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
                    label: <span className="text-red-500 font-bold">{t('admin.urgentMatters', 'Urgent Matters')}</span>,
                    className: 'menu-item-urgent'
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
                    background-color: rgba(99, 102, 241, 0.08) !important;
                    color: #6366f1 !important;
                    border-right: 3px solid #6366f1;
                    font-weight: 700;
                }
                .dark .admin-sidebar .ant-menu-item-selected {
                    background-color: rgba(99, 102, 241, 0.15) !important;
                    color: #818cf8 !important;
                    border-right: 3px solid #818cf8;
                }
                .admin-sidebar .ant-menu-item-selected .ant-menu-item-icon,
                .admin-sidebar .ant-menu-item-selected span {
                    color: inherit !important;
                }
                .admin-sidebar .ant-menu-item:hover {
                    background-color: rgba(99, 102, 241, 0.04) !important;
                    color: #6366f1 !important;
                }
                .dark .admin-sidebar .ant-menu-item:hover {
                    background-color: rgba(255, 255, 255, 0.02) !important;
                    color: #818cf8 !important;
                }
                .menu-item-urgent.ant-menu-item-selected {
                    background-color: rgba(244, 63, 94, 0.1) !important;
                    color: #f43f5e !important;
                    border-right-color: #f43f5e !important;
                }
                .dark .menu-item-urgent.ant-menu-item-selected {
                    background-color: rgba(244, 63, 94, 0.2) !important;
                    color: #fb7185 !important;
                    border-right-color: #fb7185 !important;
                }
                .menu-item-coming-soon {
                    filter: blur(1px);
                    opacity: 0.6;
                    cursor: not-allowed !important;
                    pointer-events: none;
                }
            `}</style>
            {/* Tablet/Mobile Navigation Header */}
            <div className="lg:hidden mb-6 glass-card flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                        <DatabaseOutlined className="text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold m-0">{t('admin.portal')}</h2>
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">{t('admin.management')}</span>
                    </div>
                </div>
                <Button 
                    icon={<BookOutlined />} 
                    onClick={() => setIsDrawerVisible(true)}
                    className="rounded-lg"
                >
                    {t('admin.menu')}
                </Button>
            </div>

            <div className="mb-6">
                <EthiopicClockWidget />
            </div>

            <Layout className="bg-transparent">
            <Modal
                title={t('admin.menu')}
                open={isDrawerVisible}
                onCancel={() => setIsDrawerVisible(false)}
                footer={null}
                className="lg:hidden"
                width={280}
                style={{ top: 20, left: 20, margin: 0 }}
            >
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => {
                        navigate(key);
                        setIsDrawerVisible(false);
                    }}
                    className="admin-sidebar border-none"
                />
            </Modal>

            <Sider
                width={240}
                className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mr-4 lg:mr-6 hidden lg:block overflow-hidden"
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
