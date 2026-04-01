import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Input, Empty, Descriptions, Tag, Space, Table, Alert, Divider, List, Avatar, Button, Tabs, Form, message } from 'antd';
import {
    SearchOutlined,
    UserOutlined,
    CalendarOutlined,
    BookOutlined,
    WarningOutlined,
    CheckCircleOutlined,
    HomeOutlined,
    DashboardOutlined,
    InfoCircleOutlined,
    PhoneOutlined,
    LockOutlined,
    LogoutOutlined,
    EnvironmentOutlined,
    MailOutlined,
    GlobalOutlined,
    PictureOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import StudentProfile from '../../components/StudentProfile';
import { formatGrade } from '../../utils/gradeUtils';

const { Title, Text, Paragraph } = Typography;

export default function ParentDashboard() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('home');
    const [loggedInStudent, setLoggedInStudent] = useState(null);
    const [viewingProfile, setViewingProfile] = useState(false);

    // Persistence for logged in student (session only)
    useEffect(() => {
        const saved = sessionStorage.getItem('senbet_parent_auth');
        if (saved) {
            try {
                setLoggedInStudent(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved auth", e);
            }
        }
    }, []);

    // Auto-switch Language to Amharic on entry, revert on exit
    const { i18n } = useTranslation();
    const prevLangRef = React.useRef(null);

    useEffect(() => {
        // Capture language ONCE on entry, then force Amharic for Parent Portal.
        prevLangRef.current = i18n.language;
        if (!String(i18n.language || '').startsWith('am')) {
            i18n.changeLanguage('am');
        }

        return () => {
            const prev = prevLangRef.current;
            if (prev && !String(prev).startsWith('am')) {
                i18n.changeLanguage(prev);
            }
        };
        // Intentionally run only on mount/unmount of this portal.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogin = async (values) => {
        const { studentName, accessCode } = values; // Destructure values from Form
        if (!studentName?.trim() || !accessCode?.trim()) {
            message.error(t('parent.loginFieldsRequired', 'Both Student Name and Access Code are required.'));
            return;
        }

        const student = await db.students
            .where('name')
            .equalsIgnoreCase(studentName.trim())
            .filter(s => {
                const code = s.portalCode || s.portalcode;
                return code && String(code).trim() === accessCode.trim();
            })
            .first();

        if (student) {
            setLoggedInStudent(student);
            sessionStorage.setItem('senbet_parent_auth', JSON.stringify(student));
            message.success(t('parent.loginSuccess', 'Welcome back!'));
            setActiveTab('home'); // Now that everything is locked, start at Home
        } else {
            message.error(t('parent.loginError', 'Invalid student name or access code. Please try again.'));
        }
    };

    const handleLogout = () => {
        setLoggedInStudent(null);
        sessionStorage.removeItem('senbet_parent_auth');
        message.info(t('parent.loggedOut', 'You have been logged out.'));
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <HomeSection onNavigate={setActiveTab} />;
            case 'about':
                return <AboutSection />;
            case 'contact':
                return <ContactSection />;
            case 'progress':
                return (
                    <ProgressSection 
                        student={loggedInStudent} 
                        onLogout={handleLogout} 
                        onViewProfile={() => setViewingProfile(true)}
                    />
                );
            case 'gallery':
                return <OurSchoolSection />;
            default:
                return <HomeSection onNavigate={setActiveTab} />;
        }
    };

    return (
        <div className="max-w-7xl mx-auto w-full py-4 px-2 md:py-8 md:px-6">
            {/* Tablet/Mobile Nav (Sidebar is lg+) */}
            {loggedInStudent && (
                <div className="lg:hidden mb-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative z-30">
                    <div className="flex flex-wrap gap-2 p-3 items-center">
                        {[
                            { key: 'home', icon: <HomeOutlined />, label: t('parent.home', 'Home') },
                            { key: 'progress', icon: <DashboardOutlined />, label: t('parent.studentProgress', 'Student Progress') },
                            { key: 'about', icon: <InfoCircleOutlined />, label: t('parent.aboutSchool', 'About Our School') },
                            { key: 'gallery', icon: <PictureOutlined />, label: t('parent.gallery', 'Our School Gallery') },
                            { key: 'contact', icon: <PhoneOutlined />, label: t('parent.contactUs', 'Contact & Support') },
                        ].map(item => (
                            <button
                                key={item.key}
                                onClick={() => setActiveTab(item.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                                    activeTab === item.key 
                                        ? 'bg-forest-600 text-white shadow-lg' 
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                            >
                                {item.icon}
                                <span className="text-sm font-medium">{item.label}</span>
                            </button>
                        ))}
                        <div className="flex-1 flex justify-end items-center gap-2">
                            <Tag color="green" className="truncate max-w-[100px] border-none bg-forest-50 text-forest-700">{loggedInStudent.name}</Tag>
                            <Button danger size="small" type="text" icon={<LogoutOutlined />} onClick={handleLogout} />
                        </div>
                    </div>
                </div>
            )}

            {!loggedInStudent ? (
                <div className="min-h-[80vh] flex items-center justify-center p-4">
                    <LoginSection onLogin={handleLogin} />
                </div>
            ) : (
                <div className="flex gap-6 min-h-[80vh]">
                    {/* Sidebar */}
                    <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                        {/* Logo and school name */}
                        <div className="p-5 text-center border-b border-slate-50 dark:border-slate-800 bg-gradient-to-b from-forest-600 to-forest-700">
                            <img src="/logo.png" alt="School Logo" className="w-16 h-16 rounded-full object-cover mx-auto shadow-lg border-4 border-white/30 mb-3" />
                            <p className="text-white font-bold text-sm leading-snug">{t('app.title', 'Senbet School')}</p>
                            <Tag color="green" className="mt-2 text-xs">{t('parent.portalSuffix', 'Parent & Student Portal')}</Tag>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 py-4">
                            {[
                                { key: 'home', icon: <HomeOutlined />, label: t('parent.home', 'Home') },
                                { key: 'progress', icon: <DashboardOutlined />, label: t('parent.studentProgress', 'Student Progress') },
                                { key: 'about', icon: <InfoCircleOutlined />, label: t('parent.aboutSchool', 'About Our School') },
                                { key: 'gallery', icon: <PictureOutlined />, label: t('parent.gallery', 'Our School Gallery') },
                                { key: 'contact', icon: <PhoneOutlined />, label: t('parent.contactUs', 'Contact & Support') },
                            ].map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => setActiveTab(item.key)}
                                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all ${
                                        activeTab === item.key
                                            ? 'bg-forest-50 text-forest-700 dark:bg-forest-900/30 dark:text-forest-400 font-bold border-r-4 border-forest-500'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className={`text-base ${activeTab === item.key ? 'text-forest-600' : 'text-slate-400'}`}>{item.icon}</span>
                                    <span className="text-sm">{item.label}</span>
                                </button>
                            ))}
                        </nav>

                        {/* Logout button */}
                        <div className="p-4 border-t border-slate-50 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/10">
                            <Button 
                                type="primary" 
                                danger 
                                icon={<LogoutOutlined />} 
                                block 
                                onClick={handleLogout} 
                                className="rounded-xl h-12 font-bold shadow-lg shadow-red-500/20 hover:scale-[1.02] transition-transform text-white"
                            >
                                {t('common.logout', 'Sign Out')}
                            </Button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            {renderContent()}
                        </div>
                    </main>
                </div>
            )}

            {loggedInStudent && viewingProfile && (
                <StudentProfile
                    studentId={loggedInStudent.id}
                    visible={viewingProfile}
                    onClose={() => setViewingProfile(false)}
                />
            )}
        </div>
    );
}

// --- Components ---

function HomeSection({ onNavigate }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-8">
            <div className="group relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-forest-700 via-forest-600 to-green-500 p-1 shadow-2xl transition-all duration-500 hover:shadow-forest-200/50">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 bg-forest-900/10 p-8 md:p-12 rounded-[2.4rem] backdrop-blur-sm">
                    <div className="flex-1 space-y-6">
                        <Title level={1} className="text-white !m-0 !text-3xl md:!text-5xl font-black leading-tight">
                            {t('parent.welcomeTitle', 'Welcome to Senbet School Dashboard')}
                        </Title>
                        <Paragraph className="text-lg text-white/90 font-medium max-w-xl">
                            {t('parent.description')}
                        </Paragraph>
                        <div className="flex gap-4">
                            <Button 
                                size="large" 
                                type="primary" 
                                onClick={() => onNavigate('progress')}
                                className="bg-white text-forest-700 border-none hover:!bg-forest-50 font-bold h-12 px-8 rounded-2xl shadow-xl transition-all hover:scale-105"
                            >
                                {t('parent.studentProgress', 'Student Progress')}
                            </Button>
                        </div>
                    </div>
                    <div className="hidden md:block w-56 h-56 relative animate-float">
                        <img 
                            src="/images/banner.png" 
                            alt="Banner" 
                            className="w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(255,255,255,0.3)] transform group-hover:rotate-6 transition-transform duration-700"
                        />
                    </div>
                </div>
                {/* Visual accents */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -mr-48 -mt-48 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-400/20 rounded-full blur-[80px] -ml-32 -mb-32"></div>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={16}>
                    <Card 
                        title={<Space><div className="w-8 h-8 bg-forest-50 rounded-xl flex items-center justify-center"><CalendarOutlined className="text-forest-600" /></div> <span className="font-bold">{t('parent.latestAnnouncements', 'Latest Announcements')}</span></Space>} 
                        className="shadow-xl border-none rounded-[2rem] h-full overflow-hidden hover:shadow-2xl transition-all duration-300"
                    >
                        <List
                            itemLayout="horizontal"
                            dataSource={[
                                { title: 'Semester Exams Schedule', date: 'March 15, 2026', desc: 'The upcoming semester exams are scheduled to begin on April 1st.', color: 'blue' },
                                { title: 'Parent-Teacher Meeting', date: 'March 20, 2026', desc: 'Join us for a discussion on student progress this Friday at 4 PM.', color: 'green' },
                                { title: 'Easter Holiday Break', date: 'March 25, 2026', desc: 'The school will be closed for the holiday from April 10th to 20th.', color: 'orange' }
                            ]}
                            renderItem={item => (
                                <List.Item className="hover:bg-slate-50 dark:hover:bg-slate-800/50 px-4 py-5 transition-colors">
                                    <List.Item.Meta
                                        avatar={<Avatar style={{ backgroundColor: item.color === 'blue' ? '#3b82f6' : item.color === 'green' ? '#22c55e' : '#f97316' }} icon={<InfoCircleOutlined />} />}
                                        title={<span className="font-bold">{t(`parent.announcementTitle${item.title.replace(/\s/g, '')}`, item.title)}</span>}
                                        description={<div className="mt-1 flex flex-col gap-1"><Tag color={item.color} className="rounded-full w-fit">{t(`parent.announcementDate${item.title.replace(/\s/g, '')}`, item.date)}</Tag><p className="text-slate-500 text-sm m-0">{t(`parent.announcementDesc${item.title.replace(/\s/g, '')}`, item.desc)}</p></div>}
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                   <Card 
                        title={<Space><div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center"><InfoCircleOutlined className="text-blue-600" /></div> <span className="font-bold">{t('parent.quickLinks')}</span></Space>} 
                        className="shadow-xl border-none rounded-[2rem] h-full"
                    >
                        <div className="flex flex-col sm:flex-row gap-3">
                            {[
                                { key: 'calendar', emoji: '📅' },
                                { key: 'uniform', emoji: '👔' },
                                { key: 'library', emoji: '📚' },
                            ].map((link, i) => (
                                <button
                                    key={i}
                                    className="group flex items-center gap-3 w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-forest-50 dark:hover:bg-forest-900/30 hover:text-forest-700 border-none transition-all text-left"
                                >
                                    <span className="text-lg w-8 text-center flex-shrink-0">{link.emoji}</span>
                                    <span className="font-medium text-sm flex-1">{t(`parent.${link.key}`)}</span>
                                    <span className="text-slate-300 group-hover:text-forest-500 transition-colors">→</span>
                                </button>
                            ))}
                        </div>
                   </Card>
                </Col>
            </Row>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-15px) rotate(2deg); }
                }
                .animate-float { animation: float 6s ease-in-out infinite; }
            `}</style>
        </div>
    );
}

function AboutSection() {
    const { t } = useTranslation();
    return (
        <Card className="shadow-2xl border-none rounded-[3rem] p-4 md:p-12 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-forest-50/50 dark:bg-forest-900/10 skew-x-[-12deg] translate-x-32 z-0"></div>
            <Row gutter={[64, 64]} align="middle" className="relative z-10">
                <Col xs={24} lg={12}>
                    <Space orientation="vertical" size="large">
                        <Tag color="green" className="rounded-full px-4 py-1 text-sm font-bold uppercase tracking-widest">{t('parent.aboutSchool', 'About Us')}</Tag>
                        <Title level={1} className="!text-5xl font-black">{t('parent.aboutSchoolLong', 'About Our School')}</Title>
                        <Paragraph className="text-xl leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                            {t('parent.description')}
                        </Paragraph>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-4">
                            <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border-l-8 border-forest-500 hover:scale-105 transition-transform">
                                <Title level={4} className="flex items-center gap-3"><CheckCircleOutlined className="text-forest-500" /> {t('parent.ourMission')}</Title>
                                <Paragraph className="m-0 text-slate-500">{t('parent.ourMissionDesc')}</Paragraph>
                            </div>
                            <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border-l-8 border-blue-500 hover:scale-105 transition-transform">
                                <Title level={4} className="flex items-center gap-3"><CheckCircleOutlined className="text-blue-500" /> {t('parent.ourVision')}</Title>
                                <Paragraph className="m-0 text-slate-500">{t('parent.ourVisionDesc')}</Paragraph>
                            </div>
                        </div>
                    </Space>
                </Col>
                <Col xs={24} lg={12}>
                    <div className="relative group perspective-[1000px]">
                        <div className="bg-slate-100 dark:bg-slate-800 aspect-square rounded-[4rem] flex items-center justify-center border-[12px] border-white dark:border-slate-700 shadow-2xl overflow-hidden transform group-hover:rotate-y-12 group-hover:rotate-x-6 transition-all duration-700">
                            <img 
                                src="/images/campus.png" 
                                alt="Campus" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-forest-600 rounded-full flex items-center justify-center text-white text-center p-4 shadow-xl transform group-hover:scale-110 transition-transform font-bold">
                            {t('parent.joinJourney')}
                        </div>
                    </div>
                </Col>
            </Row>
        </Card>
    );
}

function ContactSection() {
    const { t } = useTranslation();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-12 -translate-y-12">
                     <img src="/images/support.png" className="w-64" alt="Contact Icon" />
                </div>
                
                <Title level={2} className="!text-white mb-8">{t('parent.visitUs', 'Get in Touch')}</Title>
                
                <div className="space-y-8 relative z-10">
                    <div className="flex gap-6 items-center group cursor-pointer">
                        <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center flex-shrink-0 group-hover:bg-forest-500 transition-colors">
                            <EnvironmentOutlined className="text-2xl" />
                        </div>
                        <div>
                            <Title level={5} className="!text-white !m-0 mb-1">{t('parent.address')}</Title>
                            <Text className="text-white/60 text-lg">{t('parent.addressLines')}</Text>
                        </div>
                    </div>
                    
                    <div className="flex gap-6 items-center group cursor-pointer">
                        <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500 transition-colors">
                            <PhoneOutlined className="text-2xl" />
                        </div>
                        <div>
                            <Title level={5} className="!text-white !m-0 mb-1">{t('parent.phone')}</Title>
                            <Text className="text-white/60 text-lg">+251 11 XXX XXXX</Text>
                        </div>
                    </div>

                    <div className="flex gap-6 items-center group cursor-pointer">
                        <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500 transition-colors">
                            <MailOutlined className="text-2xl" />
                        </div>
                        <div>
                            <Title level={5} className="!text-white !m-0 mb-1">{t('parent.email')}</Title>
                            <Text className="text-white/60 text-lg">info@senbetschool.et</Text>
                        </div>
                    </div>
                </div>

                <div className="mt-12 p-8 bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-md">
                    <Title level={4} className="!text-white mb-2">{t('parent.officeHours')}</Title>
                    <div className="flex justify-between text-white/60">
                        <span>{t('parent.monFri')}</span>
                        <span className="text-white font-bold">8:00 AM - 5:00 PM</span>
                    </div>
                </div>
            </Card>

            <Card className="shadow-2xl border-none rounded-[3rem] p-8 md:p-12">
                <Title level={2} className="mb-8">{t('parent.sendMessage')}</Title>
                <Form layout="vertical" size="large">
                    <Form.Item label={t('parent.yourName')}><Input placeholder={t('parent.yourName')} className="rounded-2xl h-14 bg-slate-50 border-none" /></Form.Item>
                    <Form.Item label={t('parent.subject')}><Input placeholder={t('parent.subject')} className="rounded-2xl h-14 bg-slate-50 border-none" /></Form.Item>
                    <Form.Item label={t('parent.message')}><Input.TextArea rows={4} placeholder={t('parent.message')} className="rounded-3xl bg-slate-50 border-none p-6" /></Form.Item>
                    <Button type="primary" size="large" block className="h-16 font-bold rounded-2xl mt-4 shadow-xl shadow-forest-100 bg-forest-600 border-none hover:scale-[1.02] transition-transform">
                        {t('parent.sendNow')}
                    </Button>
                </Form>
            </Card>
        </div>
    );
}

function LoginSection({ onLogin }) {
    const { t } = useTranslation();
    return (
        <div className="max-w-md mx-auto py-12">
            <Card className="shadow-2xl border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
                <div className="p-8 text-center bg-forest-600 text-white rounded-b-[4rem]">
                    <LockOutlined style={{ fontSize: '48px' }} />
                    <Title level={3} className="text-white mt-4">{t('parent.secureAccess')}</Title>
                    <Paragraph className="text-white/80">{t('parent.loginDesc')}</Paragraph>
                </div>
                <div className="p-8">
                    <Form layout="vertical" onFinish={onLogin} size="large">
                        <Form.Item 
                            label={t('common.studentName')} 
                            name="studentName" 
                            rules={[{ required: true, message: t('parent.loginError') }]}
                        >
                            <Input prefix={<UserOutlined className="text-slate-300" />} placeholder={t('common.studentName')} />
                        </Form.Item>
                        <Form.Item 
                            label={t('parent.accessCode')} 
                            name="accessCode" 
                            rules={[{ required: true, message: t('parent.accessCode') }]}
                            extra={t('parent.accessCode')}
                        >
                            <Input.Password prefix={<LockOutlined className="text-slate-300" />} placeholder="******" maxLength={6} />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" block className="h-12 font-bold rounded-xl mt-4 shadow-lg shadow-forest-200 dark:shadow-none">
                            {t('common.login')}
                        </Button>
                    </Form>
                </div>
            </Card>
        </div>
    );
}

function ProgressSection({ student, onLogout, onViewProfile }) {
    const { t } = useTranslation();
    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <Card className="hover:shadow-md transition-shadow border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-3xl overflow-hidden">
                <div className="p-1 bg-gradient-to-r from-forest-500 to-green-400"></div>
                <div className="p-8">
                    <Row gutter={[24, 24]} align="middle">
                        <Col xs={24} md={16}>
                            <Space orientation="vertical" size="middle">
                                <div className="flex items-center gap-3">
                                    <Avatar size={80} src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} className="shadow-lg border-4 border-slate-50 dark:border-slate-800" />
                                    <div>
                                        <Tag color="green" className="font-bold text-xs uppercase tracking-widest">{formatGrade(student.grade)}</Tag>
                                        <Title level={2} style={{ margin: 0 }}>{student.name}</Title>
                                        <Text type="secondary" className="text-lg">{student.baptismalName}</Text>
                                    </div>
                                </div>
                            </Space>
                        </Col>
                        <Col xs={24} md={8} className="md:text-right">
                            <Space size="middle">
                                <Button
                                    type="primary"
                                    size="large"
                                    icon={<DashboardOutlined />}
                                    onClick={onViewProfile}
                                    className="h-12 px-8 rounded-xl shadow-lg font-bold"
                                >
                                    {t('parent.viewFullProfile', 'Detailed Progress')}
                                </Button>
                            </Space>
                        </Col>
                    </Row>

                    <Divider className="my-8" />

                    <Row gutter={[32, 32]}>
                        <Col xs={24} sm={12} md={8}>
                            <Card size="small" className="bg-slate-50 dark:bg-slate-800/50 border-none rounded-2xl p-2">
                                <Descriptions column={1} title={<span className="text-forest-600"><CalendarOutlined /> Quick Info</span>}>
                                    <Descriptions.Item label="Academic Year">{student.academicYear ? (String(student.academicYear).includes('E.C.') ? student.academicYear : `${dayjs(student.academicYear).format('YYYY')} E.C.`) : '—'}</Descriptions.Item>
                                    <Descriptions.Item label="Contact">{student.parentContact || student.parentcontact || '—'}</Descriptions.Item>
                                    <Descriptions.Item label="Status"><Tag color="processing">Active</Tag></Descriptions.Item>
                                </Descriptions>
                            </Card>
                        </Col>
                        <Col xs={24} sm={12} md={16}>
                           <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-full flex items-center justify-center bg-slate-50/50 dark:bg-white/5">
                                <div className="text-center">
                                    <CheckCircleOutlined className="text-4xl text-green-500 mb-2" />
                                    <Paragraph className="m-0 text-slate-500 italic">
                                        Click the button above to see full attendance streaks, assessment marks, and dynamic certificate preview.
                                    </Paragraph>
                                </div>
                           </div>
                        </Col>
                    </Row>
                </div>
            </Card>

            <Alert
                message="Data Privacy"
                description="This access code is linked specifically to this student. Keep your access code confidential."
                type="info"
                showIcon
                className="rounded-xl border-none shadow-sm"
            />
        </div>
    );
}

function OurSchoolSection() {
    const { t } = useTranslation();
    const images = [
        { src: '/images/campus.png', alt: t('parent.galleryCampus', 'Campus View'), span: 'col-span-2 row-span-2' },
        { src: '/images/banner.png', alt: t('parent.galleryActivities', 'School Activities'), span: 'col-span-1 row-span-1' },
    ];

    return (
        <div className="space-y-6">
            <Title level={2} className="!mb-6"><PictureOutlined className="text-forest-600 mr-2" />{t('parent.gallery', 'Our School Gallery')}</Title>
            <Paragraph className="text-lg text-slate-500 mb-8 max-w-2xl">
                {t('parent.galleryDesc', 'Explore the vibrant life and beautiful campus of our school.')}
            </Paragraph>
            
            <div className="grid grid-cols-3 grid-rows-2 gap-4 h-[600px] mb-8">
                {images.map((img, i) => (
                    <div key={i} className={`rounded-3xl overflow-hidden shadow-lg group relative ${img.span}`}>
                        <img 
                            src={img.src} 
                            alt={img.alt} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                            <span className="text-white font-bold text-lg">{img.alt}</span>
                        </div>
                    </div>
                ))}
                <div className="col-span-1 row-span-1 rounded-3xl bg-forest-600 flex flex-col items-center justify-center text-white shadow-lg shadow-forest-500/30 p-6 text-center group overflow-hidden relative">
                    <div className="absolute inset-0 bg-[url('/images/pattern.png')] opacity-10 mix-blend-overlay group-hover:scale-110 transition-transform duration-1000"></div>
                    <BookOutlined className="text-5xl mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold text-xl mb-1">{t('parent.galleryEstablished', 'Established')}</h3>
                    <p className="text-white/80">{t('parent.gallerySince', 'Since 1990s')}</p>
                </div>
                <div className="col-span-1 row-span-1 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center text-white shadow-lg overflow-hidden relative p-6 text-center group">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                    <UserOutlined className="text-5xl mb-4 group-hover:scale-110 transition-transform" />
                    <h3 className="font-bold text-xl mb-1">{t('parent.galleryLeadership', 'Leadership')}</h3>
                    <p className="text-white/80">{t('parent.galleryLeadershipDesc', 'Dedicated guidance')}</p>
                </div>
            </div>
            
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-forest-50/50">
                <div className="text-center p-8">
                    <CheckCircleOutlined className="text-4xl text-forest-500 mb-4" />
                    <Title level={3}>{t('parent.galleryCommitmentTitle', 'Committed to Excellence')}</Title>
                    <Paragraph className="text-slate-600 max-w-lg mx-auto">
                        {t('parent.galleryCommitmentDesc', 'Our school environment is designed to foster learning, creativity, and personal growth for every student.')}
                    </Paragraph>
                </div>
            </Card>
        </div>
    );
}
