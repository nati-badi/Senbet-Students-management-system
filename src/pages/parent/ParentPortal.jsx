import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Row, Col, Card, Input, Empty, Descriptions, Tag, Space, Table, Alert, Divider, List, Avatar, Button, Tabs, Form, message, Switch, Segmented, Skeleton } from 'antd';
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
    PictureOutlined,
    SyncOutlined,
    PieChartOutlined,
    FileProtectOutlined,
    SunOutlined,
    MoonOutlined,
    EditOutlined,
    SaveOutlined,
    HistoryOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import StudentProfile from '../../components/StudentProfile';
import LiveCertificate from '../../components/LiveCertificate';
import BottomNavBar from '../../components/BottomNavBar';
import { formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import { getEthiopianYear, formatEthiopianDate } from '../../utils/dateUtils';
import { calculateSingleStudentRank, calculateSubjectRows, isConductAssessment } from '../../utils/analyticsEngine';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export default function ParentPortal({ toggleTheme, toggleLanguage, handleSync, isDarkMode }) {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState('home');
    const [loggedInStudentId, setLoggedInStudentId] = useState(() => {
        const saved = sessionStorage.getItem('senbet_parent_auth');
        return saved ? JSON.parse(saved).id : null;
    });

    // Reactive student source
    const loggedInStudent = useLiveQuery(
        () => loggedInStudentId ? db.students.get(loggedInStudentId) : null,
        [loggedInStudentId]
    );

    // Persistence for logged in student
    useEffect(() => {
        if (loggedInStudent) {
            sessionStorage.setItem('senbet_parent_auth', JSON.stringify(loggedInStudent));
        }
    }, [loggedInStudent]);

    const handleLogin = async (values) => {
        const { studentName, accessCode } = values; 
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
            setLoggedInStudentId(student.id);
            message.success(t('parent.loginSuccess', 'Welcome back!'));
            setActiveTab('home');
        } else {
            message.error(t('parent.loginError', 'Invalid student name or access code. Please try again.'));
        }
    };

    const handleLogout = () => {
        setLoggedInStudentId(null);
        sessionStorage.removeItem('senbet_parent_auth');
        message.info(t('parent.loggedOut', 'You have been logged out.'));
    };

    const navItems = [
        { key: 'home', icon: <HomeOutlined />, label: t('parent.home', 'Home') },
        { key: 'marks', icon: <BookOutlined />, label: t('teacher.marks', 'Marks') },
        { key: 'attendance', icon: <CalendarOutlined />, label: t('teacher.attendance', 'Attendance') },
        { key: 'profile', icon: <UserOutlined />, label: t('teacher.profile', 'Profile') },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'home':
                return <HomeSection onNavigate={setActiveTab} handleSync={handleSync} />;
            case 'marks':
                return <MarksSection student={loggedInStudent} />;
            case 'attendance':
                return <AttendanceSection studentId={loggedInStudentId} />;
            case 'profile':
                return (
                    <ProfileSection 
                        student={loggedInStudent} 
                        onLogout={handleLogout} 
                        toggleTheme={toggleTheme}
                        toggleLanguage={toggleLanguage}
                        isDarkMode={isDarkMode}
                    />
                );
            default:
                return <HomeSection onNavigate={setActiveTab} handleSync={handleSync} />;
        }
    };

    return (
        <div className="max-w-7xl mx-auto w-full pb-24 md:pb-8 px-2 md:px-6">
            {!loggedInStudentId ? (
                <div className="min-h-[80vh] flex items-center justify-center p-4">
                    <LoginSection onLogin={handleLogin} />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[80vh]">
                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden sticky top-24 self-start">
                        <div className="p-6 text-center border-b border-slate-50 dark:border-slate-800 bg-gradient-to-b from-forest-600 to-forest-700">
                            <Avatar size={64} src={`https://api.dicebear.com/7.x/initials/svg?seed=${loggedInStudent?.name}`} className="shadow-lg mb-3 border-2 border-white/30" />
                            <p className="text-white font-bold text-sm leading-snug m-0">{loggedInStudent?.name}</p>
                            <Tag color="green" className="mt-2 text-[10px] uppercase border-none bg-white/20 text-white">{formatGrade(loggedInStudent?.grade)}</Tag>
                        </div>

                        <nav className="flex-1 py-4">
                            {navItems.map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => setActiveTab(item.key)}
                                    className={`w-full flex items-center gap-3 px-6 py-4 text-left transition-all ${
                                        activeTab === item.key
                                            ? 'bg-forest-50 text-forest-700 dark:bg-forest-900/30 dark:text-forest-400 font-bold border-r-4 border-forest-500'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <span className={`text-base ${activeTab === item.key ? 'text-forest-600' : 'text-slate-400'}`}>{item.icon}</span>
                                    <span className="text-sm font-medium">{item.label}</span>
                                </button>
                            ))}
                        </nav>

                        <div className="p-4 border-t border-slate-50 dark:border-slate-800">
                             <Button danger icon={<LogoutOutlined />} block onClick={handleLogout} className="rounded-xl font-bold">
                                {t('common.logout')}
                             </Button>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1 min-w-0">
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {renderContent()}
                        </div>
                    </main>

                    {/* Mobile Bottom Navigation */}
                    <BottomNavBar 
                        activeKey={activeTab} 
                        items={navItems} 
                        onChange={setActiveTab} 
                    />
                </div>
            )}
        </div>
    );
}

// --- Components ---

function HomeSection({ onNavigate, handleSync }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-6">
            {/* Hero Card */}
            <div className="group relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-forest-700 via-forest-600 to-green-500 p-0.5 shadow-2xl transition-all duration-500">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 bg-slate-900/10 p-8 md:p-12 rounded-[2.45rem] backdrop-blur-sm">
                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <Title level={1} className="text-white !m-0 !text-3xl md:!text-5xl font-black italic">
                            {t('app.title')}
                        </Title>
                        <Paragraph className="text-lg text-white/90 font-medium max-w-xl">
                            {t('parent.description')}
                        </Paragraph>
                        <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                            <Button 
                                size="large" 
                                type="primary" 
                                icon={<BookOutlined />}
                                onClick={() => onNavigate('marks')}
                                className="bg-white text-forest-700 border-none hover:!bg-forest-50 font-bold h-12 px-8 rounded-2xl shadow-xl"
                            >
                                {t('teacher.marks', 'View Marks')}
                            </Button>
                            <Button 
                                size="large" 
                                icon={<SyncOutlined />}
                                onClick={() => handleSync()}
                                className="bg-forest-800/40 text-white border-white/20 hover:!bg-forest-700 font-bold h-12 px-8 rounded-2xl"
                            >
                                {t('parent.syncData', 'Sync Now')}
                            </Button>
                        </div>
                    </div>
                </div>
                {/* Visual accents */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-400/20 rounded-full blur-[60px] -ml-24 -mb-24"></div>
            </div>

            <Row gutter={[20, 20]}>
                <Col xs={24} md={16}>
                    <Card 
                        title={<Space><HomeOutlined className="text-forest-600" /> <span className="font-bold">{t('parent.latestAnnouncements')}</span></Space>} 
                        className="shadow-xl border-none rounded-[2rem] overflow-hidden"
                    >
                        <List
                            itemLayout="horizontal"
                            dataSource={[
                                { title: 'Semester Exams Schedule', date: 'March 15, 2026', desc: 'The upcoming semester exams are scheduled to begin on April 1st.', color: 'blue' },
                                { title: 'Parent-Teacher Meeting', date: 'March 20, 2026', desc: 'Join us for a discussion on student progress this Friday at 4 PM.', color: 'green' }
                            ]}
                            renderItem={item => (
                                <List.Item className="px-4 py-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border-none">
                                    <List.Item.Meta
                                        avatar={<Avatar style={{ backgroundColor: item.color === 'blue' ? '#3b82f6' : '#22c55e' }} icon={<InfoCircleOutlined />} />}
                                        title={<span className="font-bold">{t(`parent.announcementTitle${item.title.replace(/\s/g, '')}`, item.title)}</span>}
                                        description={
                                            <div className="mt-1">
                                                <div className="text-xs text-slate-400 mb-1">{item.date}</div>
                                                <p className="text-slate-500 text-sm m-0 leading-relaxed">{t(`parent.announcementDesc${item.title.replace(/\s/g, '')}`, item.desc)}</p>
                                            </div>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                   <Card 
                        title={<Space><InfoCircleOutlined className="text-blue-600" /> <span className="font-bold">{t('parent.quickLinks')}</span></Space>} 
                        className="shadow-xl border-none rounded-[2rem]"
                    >
                        <div className="flex flex-col gap-3">
                            {[
                                { key: 'calendar', emoji: '📅' },
                                { key: 'uniform', emoji: '👔' },
                                { key: 'library', emoji: '📚' },
                            ].map((link, i) => (
                                <button
                                    key={i}
                                    className="group flex items-center justify-between w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-forest-50 dark:hover:bg-forest-900/30 transition-all text-left border-none"
                                >
                                    <Space size="middle">
                                        <span className="text-xl">{link.emoji}</span>
                                        <span className="font-bold text-sm">{t(`parent.${link.key}`)}</span>
                                    </Space>
                                    <span className="text-slate-300 group-hover:text-forest-500 transition-colors">→</span>
                                </button>
                            ))}
                        </div>
                   </Card>
                </Col>
            </Row>
        </div>
    );
}

function MarksSection({ student }) {
    const { t } = useTranslation();
    const [selectedYear, setSelectedYear] = useState(student?.academicYear);
    
    // Core data hooks
    const marks = useLiveQuery(() => student?.id ? db.marks.where('studentId').equals(student.id).toArray() : [], [student?.id]) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const allSubjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    
    const activeSemester = useMemo(() => settingsRows?.find(r => r.key === 'currentSemester')?.value || 'Semester I', [settingsRows]);
    const isLoading = student === undefined || allAssessments === undefined || allSubjects === undefined;

    // Academic logic
    const studentGradeNorm = useMemo(() => normalizeGrade(student?.grade), [student]);
    const gradeAssessments = useMemo(() => {
        if (!allAssessments || !studentGradeNorm || !selectedYear) return [];
        const targetYearNum = getEthiopianYear(selectedYear);
        return allAssessments.filter(a => {
            if (normalizeGrade(a.grade) !== studentGradeNorm) return false;
            const assessmentYearNum = a.academicYear ? getEthiopianYear(a.academicYear) : null;
            if (assessmentYearNum === targetYearNum) return true;
            if (!assessmentYearNum) return true;
            if (assessmentYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም') return true;
            return false;
        });
    }, [allAssessments, studentGradeNorm, selectedYear]);

    const subjectRows = useMemo(() => {
        if (!student || !selectedYear || !gradeAssessments.length) return [];
        const targetYearNum = getEthiopianYear(selectedYear);
        const yearMarks = allMarks.filter(m => {
            const mYearNum = m.academicYear ? getEthiopianYear(m.academicYear) : null;
            return mYearNum === targetYearNum || !mYearNum || (mYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም');
        });
        return calculateSubjectRows(student, gradeAssessments, yearMarks, allSubjects, activeSemester);
    }, [student, gradeAssessments, allMarks, allSubjects, activeSemester, selectedYear]);

    const rankingInfo = useMemo(() => {
        if (!student || !selectedYear || !gradeAssessments.length) return {};
        const targetYearNum = getEthiopianYear(selectedYear);
        const yearMarks = allMarks.filter(m => {
            const mYearNum = m.academicYear ? getEthiopianYear(m.academicYear) : null;
            return mYearNum === targetYearNum || !mYearNum || (mYearNum === '2017 ዓ.ም' && targetYearNum === '2018 ዓ.ም');
        });
        return calculateSingleStudentRank(student, allStudents, gradeAssessments, yearMarks, activeSemester, allSubjects);
    }, [student, allStudents, gradeAssessments, allMarks, activeSemester, allSubjects, selectedYear]);

    const missingAssessments = useMemo(() => {
        return gradeAssessments.filter(a => !marks.find(m => m.assessmentId === a.id));
    }, [gradeAssessments, marks]);

    const averagePercentage = useMemo(() => (rankingInfo.stats?.percentage || 0).toFixed(1), [rankingInfo]);

    if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <Title level={4} style={{ margin: 0 }}><PieChartOutlined className="text-forest-600 mr-2" />{t('teacher.marksHistory')}</Title>
                <Tag color="purple" className="rounded-full px-3 py-1 font-bold">{averagePercentage}% AVG</Tag>
            </div>

            <LiveCertificate 
                student={student}
                subjectRows={subjectRows}
                rankingInfo={rankingInfo}
                missingAssessments={missingAssessments}
                activeYearToUse={selectedYear}
                averagePercentage={averagePercentage}
                gradeAssessments={gradeAssessments}
            />

            <Alert
                message={t('parent.certificateNotice', 'This is a live preview of your current assessments. Final certificates are issued by the school administration.')}
                type="info"
                showIcon
                className="rounded-2xl border-none shadow-sm"
            />
        </div>
    );
}

function AttendanceSection({ studentId }) {
    const { t } = useTranslation();
    const records = useLiveQuery(() => studentId ? db.attendance.where('studentId').equals(studentId).toArray() : [], [studentId]) || [];

    const stats = useMemo(() => {
        const p = records.filter(r => r.status === 'present').length;
        const l = records.filter(r => r.status === 'late').length;
        const a = records.filter(r => r.status === 'absent').length;
        return { present: p, late: l, absent: a, total: p + l + a };
    }, [records]);

    return (
        <div className="space-y-6">
            <Card className="shadow-xl border-none rounded-[2rem] overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-white text-center md:text-left">
                    <Title level={2} className="!text-white mb-2">{t('teacher.attendanceSummary')}</Title>
                    <Paragraph className="text-white/80 italic mb-0">{t('parent.attendanceDesc', 'Monitor daily presence and engagement levels.')}</Paragraph>
                </div>
                
                <div className="p-8">
                    <Row gutter={[16, 16]}>
                        {[
                            { label: t('teacher.present'), value: stats.present, color: 'bg-green-500', icon: <CheckCircleOutlined /> },
                            { label: t('teacher.late'), value: stats.late, color: 'bg-amber-500', icon: <ClockCircleOutlined /> },
                            { label: t('teacher.absent'), value: stats.absent, color: 'bg-red-500', icon: <CloseCircleOutlined /> },
                        ].map((s, i) => (
                            <Col xs={8} key={i}>
                                <div className="text-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
                                    <div className={`w-8 h-8 ${s.color} text-white rounded-full flex items-center justify-center mx-auto mb-2`}>
                                        {s.icon}
                                    </div>
                                    <div className="text-2xl font-black">{s.value}</div>
                                    <div className="text-[10px] uppercase font-bold text-slate-400">{s.label}</div>
                                </div>
                            </Col>
                        ))}
                    </Row>

                    <Divider className="my-8" />

                    <div className="flex items-center justify-center p-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2.5rem] bg-slate-50/30">
                        <div className="text-center opacity-40">
                            <HistoryOutlined className="text-5xl mb-4" />
                            <Paragraph className="italic">
                                {t('common.comingSoon', 'Detailed heatmap visualization coming soon.')}
                            </Paragraph>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function ProfileSection({ student, onLogout, toggleTheme, toggleLanguage, isDarkMode }) {
    const { t, i18n } = useTranslation();
    const [editing, setEditing] = useState(false);
    const [form] = Form.useForm();

    const handleSave = async (values) => {
        try {
            await db.students.update(student.id, {
                baptismalName: values.baptismalName,
                parentContact: values.parentContact,
                synced: 0,
                updated_at: new Date().toISOString()
            });
            setEditing(false);
            message.success(t('common.saveSuccess'));
        } catch (e) {
            message.error(t('common.saveError'));
        }
    };

    return (
        <div className="space-y-6">
            <Card 
                className="shadow-xl border-none rounded-[2.5rem] overflow-hidden"
                title={<Space><UserOutlined className="text-forest-600" /> <span className="font-bold">{t('teacher.profile')}</span></Space>}
                extra={!editing && <Button icon={<EditOutlined />} type="text" onClick={() => {
                    form.setFieldsValue(student);
                    setEditing(true);
                }} />}
            >
                {editing ? (
                    <Form form={form} layout="vertical" onFinish={handleSave} className="px-2">
                        <Form.Item name="baptismalName" label={t('admin.baptismalName')}><Input className="rounded-xl h-12" /></Form.Item>
                        <Form.Item name="parentContact" label={t('admin.parentContact')}><Input className="rounded-xl h-12" /></Form.Item>
                        <Space className="w-full justify-end mt-4">
                            <Button onClick={() => setEditing(false)} className="rounded-xl">{t('common.cancel')}</Button>
                            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} className="rounded-xl px-6 font-bold">{t('common.save')}</Button>
                        </Space>
                    </Form>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl">
                            <Avatar size={80} src={`https://api.dicebear.com/7.x/initials/svg?seed=${student?.name}`} className="shadow-lg border-4 border-white dark:border-slate-700" />
                            <div>
                                <Title level={3} className="!m-0">{student?.name}</Title>
                                <Tag color="green" className="mt-1 border-none font-bold">{formatGrade(student?.grade)}</Tag>
                            </div>
                        </div>

                        <Descriptions column={1} className="px-2">
                            <Descriptions.Item label={t('admin.baptismalName')}>{student?.baptismalName || '—'}</Descriptions.Item>
                            <Descriptions.Item label={t('admin.parentContact')}>{student?.parentContact || '—'}</Descriptions.Item>
                            <Descriptions.Item label={t('admin.gender')}>{student?.gender}</Descriptions.Item>
                            <Descriptions.Item label={t('parent.portalCode')}>{student?.portalCode || student?.portalcode}</Descriptions.Item>
                        </Descriptions>
                    </div>
                )}
            </Card>

            <Card 
                className="shadow-xl border-none rounded-[2.5rem]" 
                title={<Space><GlobalOutlined className="text-blue-600" /> <span className="font-bold">{t('common.settings', 'Settings')}</span></Space>}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                        <Space>
                            <span className="text-xl">{isDarkMode ? <MoonOutlined className="text-blue-400" /> : <SunOutlined className="text-amber-500" />}</span>
                            <span className="font-bold text-sm">{t('common.darkMode', 'Dark Mode')}</span>
                        </Space>
                        <Switch checked={isDarkMode} onChange={toggleTheme} />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                        <Space>
                             <GlobalOutlined className="text-forest-600 text-xl" />
                             <span className="font-bold text-sm">{t('common.language', 'Language')}</span>
                        </Space>
                        <Segmented 
                            value={i18n.language.startsWith('am') ? 'am' : 'en'} 
                            onChange={(v) => i18n.changeLanguage(v)}
                            options={[
                                { label: 'አማ', value: 'am' },
                                { label: 'EN', value: 'en' }
                            ]}
                            className="bg-slate-200 dark:bg-slate-700 h-9"
                        />
                    </div>

                    <Button 
                        danger 
                        block 
                        size="large" 
                        icon={<LogoutOutlined />} 
                        onClick={onLogout}
                        className="h-14 font-black rounded-2xl mt-4 shadow-lg shadow-red-500/10 border-none"
                    >
                        {t('common.logout')}
                    </Button>
                </div>
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
