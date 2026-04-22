import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    EditOutlined,
    CheckCircleOutlined,
    SaveOutlined,
    UserOutlined,
    CalendarOutlined,
    BookOutlined,
    CheckOutlined,
    ClockCircleOutlined,
    CloseOutlined,
    ScanOutlined,
    TeamOutlined,
    HomeOutlined,
    MinusCircleOutlined,
    DeleteOutlined,
    SearchOutlined,
    BarChartOutlined,
    WarningOutlined,
    SyncOutlined,
    CloudSyncOutlined,
    ClearOutlined,
    GlobalOutlined,
    MoonOutlined,
    SunOutlined,
    LogoutOutlined
} from '@ant-design/icons';
import {
    Layout,
    Menu,
    Typography,
    Space,
    Card,
    Select,
    Input,
    Form,
    Table,
    Button,
    Row,
    Col,
    Tag,
    Divider,
    DatePicker,
    Modal,
    Badge,
    Skeleton,
    Empty,
    App,
    Switch,
    Segmented,
    Descriptions,
    Radio
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { syncData } from '../../utils/sync';
import { supabase } from '../../utils/supabaseClient';
import { formatEthiopianDate, formatEthiopianTime, getEthiopianYear } from '../../utils/dateUtils';
import dayjs from 'dayjs';
import { Scanner } from '@yudiel/react-qr-scanner';
import StudentProfile from '../../components/StudentProfile';
import StudentAnalytics from '../admin/StudentAnalytics';
import TeacherUrgentMatters from './TeacherUrgentMatters';
import TeacherAssessmentManagement from './TeacherAssessmentManagement';
import { formatGrade, normalizeGrade, GRADE_OPTIONS } from '../../utils/gradeUtils';
import { Navigate } from 'react-router-dom';
import BottomNavBar from '../../components/BottomNavBar';

const { Title, Text, Paragraph } = Typography;
const { Sider, Content } = Layout;


const EthiopicClockWidget = () => {
    const [timeObj, setTimeObj] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTimeObj(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fullEtTime = formatEthiopianTime(timeObj);
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
                    <span className="text-slate-400 dark:text-slate-500 mt-2 text-base tracking-wide">{gregDateStr}</span>
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

export default function TeacherDashboard({ teacherSession, setTeacherSession, toggleTheme, toggleLanguage, handleSync, isDarkMode }) {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { message, notification, modal } = App.useApp();
    const [profileStudentId, setProfileStudentId] = useState(null);

    const [syncKey, setSyncKey] = useState(0);
    useEffect(() => {
        const handleSync = () => setSyncKey(k => k + 1);
        window.addEventListener('syncComplete', handleSync);
        return () => window.removeEventListener('syncComplete', handleSync);
    }, []);

    // IMPORTANT:
    // Local Dexie `teachers` table uses an auto-increment primary key (historical schema: `++id`).
    // When syncing from Supabase (UUID ids), this can result in duplicate rows locally rather than in-place updates.
    // Therefore, resolve the active teacher by a stable identifier (`accessCode`) instead of the numeric local `id`.
    const liveTeacher = useLiveQuery(
        async () => {
            const accessCode = teacherSession?.accessCode || teacherSession?.accesscode;
            if (!accessCode) return null;
            return await db.teachers.where('accessCode').equals(accessCode).first();
        },
        [teacherSession?.accessCode, teacherSession?.accesscode, syncKey]
    );

    const activeTeacher = liveTeacher || teacherSession;

    // If we got a fresher record from Dexie (e.g. updated permissions), refresh the session cache.
    useEffect(() => {
        if (!liveTeacher) return;
        try {
            sessionStorage.setItem('senbet_teacher_auth', JSON.stringify(liveTeacher));
        } catch {}
        setTeacherSession(liveTeacher);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveTeacher?.id]);

    if (!activeTeacher) {
        return <TeacherLogin onLogin={setTeacherSession} />;
    }

    const canManageAssessments = !!(activeTeacher?.canCreateAssessments ?? activeTeacher?.cancreateassessments);

    const menuItems = [
        {
            key: '/teacher/analytics',
            icon: <BarChartOutlined />,
            label: t('admin.analyticsDashboard', 'Analytics Dashboard')
        },
        {
            key: '/teacher/urgent',
            icon: <Badge dot color="red"><WarningOutlined /></Badge>,
            label: <span className="text-red-500 font-bold">{t('admin.urgentMatters', 'Urgent Matters')}</span>
        },
        {
            key: '/teacher/mark-entry',
            icon: <EditOutlined />,
            label: t('teacher.markEntry')
        },
        ...(canManageAssessments ? [{
            key: '/teacher/assessments',
            icon: <BookOutlined />,
            label: t('admin.assessments', 'Assessments')
        }] : []),
        {
            key: '/teacher/attendance-soon',
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
            key: '/teacher/profile',
            icon: <UserOutlined />,
            label: t('teacher.profile', 'Profile & Settings')
        },
    ];

    const mobileNavItems = [
        { key: '/teacher/mark-entry', icon: <EditOutlined />, label: t('teacher.markEntry') },
        { key: '/teacher/analytics', icon: <BarChartOutlined />, label: t('admin.analytics') },
        { key: '/teacher/urgent', icon: <WarningOutlined />, label: t('admin.urgent') },
        { key: '/teacher/profile', icon: <UserOutlined />, label: t('teacher.profile') },
    ];

    return (
        <div className="flex flex-col w-full gap-4 pt-4">
            <div className="mb-2">
                <EthiopicClockWidget />
            </div>
            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                        <Text type="secondary" className="text-xs uppercase tracking-wider">
                            {t('teacher.signedInAs', 'Signed in as')}
                        </Text>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Title level={4} style={{ margin: 0 }} className="truncate">
                                {activeTeacher.name}
                            </Title>
                            <Tag color="purple">{t('teacher.portal', 'Teacher Portal')}</Tag>
                        </div>
                        <div className="flex flex-col gap-2 mt-3">
                            {activeTeacher.assignedGrades?.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold">{t('teacher.grades', 'Grades')}:</Text>
                                    {activeTeacher.assignedGrades.slice(0, 6).map(g => (
                                        <Tag key={`g-${g}`} color="blue" className="m-0">{formatGrade(g)}</Tag>
                                    ))}
                                </div>
                            )}
                            {activeTeacher.assignedSubjects?.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Text type="secondary" className="text-xs uppercase tracking-wider font-semibold">{t('teacher.subjects', 'Subjects')}:</Text>
                                    {activeTeacher.assignedSubjects.slice(0, 6).map(s => (
                                        <Tag key={`s-${s}`} color="geekblue" className="m-0">{s}</Tag>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            <Routes>
                <Route path="/profile" element={
                    <div className="space-y-6">
                        <Card 
                            title={<Space><GlobalOutlined className="text-blue-600" /> <span className="font-bold">{t('common.settings', 'Portal Settings')}</span></Space>}
                            className="shadow-xl border-none rounded-[2rem]"
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
                                    type="primary"
                                    size="large"
                                    block 
                                    icon={<SyncOutlined />} 
                                    onClick={() => handleSync()}
                                    className="h-14 font-black rounded-2xl mt-4 shadow-lg shadow-forest-500/20 bg-forest-600 border-none"
                                >
                                    {t('common.syncNow', 'Manual Sync')}
                                </Button>

                                <Button 
                                    danger 
                                    block 
                                    size="large" 
                                    icon={<LogoutOutlined />} 
                                    onClick={() => {
                                        setTeacherSession(null);
                                        sessionStorage.removeItem('senbet_teacher_auth');
                                        navigate('/');
                                    }}
                                    className="h-14 font-black rounded-2xl mt-2 shadow-lg shadow-red-500/10 border-none"
                                >
                                    {t('common.logout')}
                                </Button>
                            </div>
                        </Card>

                        <Card 
                            className="shadow-xl border-none rounded-[2rem] overflow-hidden"
                            title={<Space><UserOutlined className="text-forest-600" /> <span className="font-bold">{t('teacher.profile')}</span></Space>}
                        >
                             <Descriptions column={1} className="px-2">
                                <Descriptions.Item label={t('admin.name')}>{activeTeacher?.name}</Descriptions.Item>
                                <Descriptions.Item label={t('admin.gender')}>{activeTeacher?.gender}</Descriptions.Item>
                                <Descriptions.Item label={t('parent.accessCode')}>{activeTeacher?.accessCode || activeTeacher?.accesscode}</Descriptions.Item>
                            </Descriptions>
                        </Card>
                    </div>
                } />
            </Routes>

            {/* Mobile Bottom Navigation (Visible on lg-) */}
            <BottomNavBar 
                activeKey={location.pathname}
                items={mobileNavItems}
                onChange={(key) => navigate(key)}
            />

            {/* Desktop: Sidebar + Content */}
            <div className="flex flex-row gap-6 items-start">
                <div className="hidden lg:flex flex-col flex-shrink-0 w-[240px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden teacher-sidebar">
                    <div>
                        <div style={{ padding: '16px' }}>
                            <Text strong type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                                {t('teacher.menu')}
                            </Text>
                        </div>
                        <Menu
                            mode="inline"
                            selectedKeys={[location.pathname]}
                            items={menuItems}
                            onClick={({ key }) => navigate(key)}
                            className="border-none"
                        />
                    </div>
                    
                    <style>{`
                        .teacher-sidebar .ant-menu-item-selected {
                            background-color: #eff6ff !important;
                            color: #2563eb !important;
                            border-right: 3px solid #2563eb;
                            font-weight: 600;
                        }
                        .dark .teacher-sidebar .ant-menu-item-selected {
                            background-color: #1e3a5f !important;
                            color: #60a5fa !important;
                            border-right: 3px solid #60a5fa;
                        }
                        .teacher-sidebar .ant-menu-item-selected .ant-menu-item-icon,
                        .teacher-sidebar .ant-menu-item-selected span {
                            color: inherit !important;
                        }
                        .teacher-sidebar .ant-menu-item:hover {
                            background-color: #f0f9ff !important;
                            color: #2563eb !important;
                        }
                        .dark .teacher-sidebar .ant-menu-item:hover {
                            background-color: #1e293b !important;
                            color: #60a5fa !important;
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
                </div>

                <div className="flex-1 min-w-0 min-h-[600px] mt-4">
                    <Routes>
                        <Route path="/" element={<Navigate to="mark-entry" replace />} />
                        <Route path="/mark-entry" element={<SpeedEntryMarks teacher={activeTeacher} setProfileStudentId={setProfileStudentId} />} />
                        <Route path="/attendance" element={<AttendanceModule teacher={activeTeacher} setProfileStudentId={setProfileStudentId} />} />
                        <Route path="/analytics" element={<StudentAnalytics isTeacherView={true} teacher={activeTeacher} />} />
                        <Route path="/urgent" element={<TeacherUrgentMatters teacher={activeTeacher} />} />
                        {canManageAssessments && (
                            <Route path="/assessments" element={<TeacherAssessmentManagement teacher={activeTeacher} />} />
                        )}
                    </Routes>
                </div>
            </div>

            <StudentProfile
                studentId={profileStudentId}
                visible={!!profileStudentId}
                onClose={() => setProfileStudentId(null)}
            />
        </div>

    );
}

function TeacherLogin({ onLogin }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const teachers = useLiveQuery(() => db.teachers?.toArray()) || [];

    const handleSubmit = async (values) => {
        const name = String(values.teacherName || '').trim().toLowerCase();
        const accessCode = String(values.accessCode || '').trim();
        const match = teachers.find(tt => String(tt.name || '').trim().toLowerCase() === name && String(tt.accessCode || '').trim() === accessCode);

        if (!match) {
            message.error(t('teacher.loginError'));
            return;
        }
        sessionStorage.setItem('senbet_teacher_auth', JSON.stringify(match));
        onLogin(match);
        message.success(t('teacher.loginSuccess'));
    };

    return (
        <div className="flex-1 flex items-center justify-center w-full py-10">
            <Card className="shadow-xl rounded-2xl border-slate-200 dark:border-slate-800">
                <Title level={3} style={{ marginTop: 0 }}>{t('teacher.portalLogin', 'Teacher Portal Login')}</Title>
                <Text type="secondary">{t('teacher.portalLoginDesc', 'Enter your access code provided by the admin.')}</Text>
                <Divider />
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="teacherName"
                        label={<span className="dark:text-white">{t('admin.name', 'Name')}</span>}
                        rules={[{ required: true, message: t('teacher.enterNameRequired') }]}
                    >
                        <Input 
                            placeholder={t('teacher.fullNamePlaceholder')} 
                            className="dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:placeholder:text-slate-500 h-12 rounded-xl"
                        />
                    </Form.Item>
                    <Form.Item
                        name="accessCode"
                        label={<span className="dark:text-white">{t('parent.accessCode', 'Access Code')}</span>}
                        rules={[{ required: true, message: t('teacher.enterCodeRequired') }]}
                    >
                        <Input.Password 
                            placeholder={t('teacher.accessCodePlaceholder')} 
                            maxLength={6} 
                            className="dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:placeholder:text-slate-500 h-12 rounded-xl"
                        />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block size="large">
                        {t('common.login', 'Login')}
                    </Button>
                </Form>
                {teachers.length === 0 && (
                    <div className="mt-8 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl">
                        <Text type="warning" strong className="block mb-2 text-center">
                            <WarningOutlined /> {t('teacher.noDataFound', 'No teacher data found locally.')}
                        </Text>
                        <Paragraph className="text-xs text-center text-slate-500 mb-4">
                            {t('teacher.syncNeededDesc')}
                        </Paragraph>
                        <Button 
                            block 
                            icon={<CloudSyncOutlined />} 
                            onClick={async () => {
                                message.loading(t('common.syncingCloud'), 1.5);
                                await syncData();
                                window.dispatchEvent(new Event('syncComplete'));
                            }}
                        >
                            {t('teacher.syncFromCloud')}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}

function SpeedEntryMarks({ teacher, setProfileStudentId }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // Persist selection state in sessionStorage so navigation between sidebar items doesn't reset it
    const [selectedGrade, setSelectedGrade] = useState(() => sessionStorage.getItem('sem_mark_grade') || '');
    const [selectedAssessmentId, setSelectedAssessmentId] = useState(() => sessionStorage.getItem('sem_mark_assessment') || '');
    const [selectedSubject, setSelectedSubject] = useState(() => sessionStorage.getItem('sem_mark_subject') || '');
    const [marks, setMarks] = useState({});
    const [modifiedMarks, setModifiedMarks] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const lastRoutedNonce = useRef(null);
    const [modal, contextHolder] = Modal.useModal();

    // Keep sessionStorage in sync
    useEffect(() => { sessionStorage.setItem('sem_mark_grade', selectedGrade); }, [selectedGrade]);
    useEffect(() => { sessionStorage.setItem('sem_mark_assessment', selectedAssessmentId); }, [selectedAssessmentId]);
    useEffect(() => { sessionStorage.setItem('sem_mark_subject', selectedSubject); }, [selectedSubject]);

    const [syncKey, setSyncKey] = useState(0);
    useEffect(() => {
        const handleSync = () => setSyncKey(k => k + 1);
        window.addEventListener('syncComplete', handleSync);
        return () => window.removeEventListener('syncComplete', handleSync);
    }, []);

    const allStudentsData = useLiveQuery(() => db.students.toArray(), [syncKey]);
    const assessmentsData = useLiveQuery(() => db.assessments.toArray(), [syncKey]);
    const subjectsData = useLiveQuery(() => db.subjects.toArray(), [syncKey]);
    const settingsRows = useLiveQuery(() => db.settings?.toArray(), [syncKey]) || [];

    const allStudents = allStudentsData || [];
    const allAssessments = assessmentsData || [];
    const allSubjects = subjectsData || [];
    const isLoading = allStudentsData === undefined || assessmentsData === undefined || subjectsData === undefined;

    const currentSemesterSetting = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    const allowedGrades = Array.isArray(teacher?.assignedGrades) ? teacher.assignedGrades : [];
    const allowedSubjects = Array.isArray(teacher?.assignedSubjects) ? teacher.assignedSubjects : [];
    const normalizeSubject = (raw) => {
        if (!raw) return '';
        return String(raw).toLowerCase().trim();
    };

    const hasTeacherAssignedGrades = Array.isArray(teacher?.assignedGrades);
    const normalizedAllowedGrades = allowedGrades.map(g => normalizeGrade(g));
    const normalizedAllowedSubjects = allowedSubjects.map(s => normalizeSubject(s)).filter(Boolean);
    const teacherStudents = hasTeacherAssignedGrades
        ? (normalizedAllowedGrades.length > 0
            ? allStudents.filter(s => normalizedAllowedGrades.includes(normalizeGrade(s.grade)))
            : [])
        : allStudents;

    // Guard: if sessionStorage has a grade that this teacher isn't assigned to, clear it.
    useEffect(() => {
        if (!selectedGrade) return;
        if (!hasTeacherAssignedGrades) return;
        const isAllowed = normalizedAllowedGrades.includes(normalizeGrade(selectedGrade));
        if (!isAllowed) {
            setSelectedGrade('');
            setSelectedSubject('');
            setSelectedAssessmentId('');
            setSearchQuery('');
        }
    }, [hasTeacherAssignedGrades, allowedGrades, selectedGrade]);

    // Only allow teachers to grade assessments that match their assigned subjects/grades + current semester.
    // Subject selection (selectedSubject) is applied after this base filter.
    const assessmentsForGrade = allAssessments.filter(a => {
        const subject = allSubjects.find(s => normalizeSubject(s.name) === normalizeSubject(a.subjectName));
        const assessmentSemester = subject?.semester || 'Semester I';
        const currentYear = settingsRows.find(s => s.key === 'currentAcademicYear')?.value;
        const targetYearNum = currentYear ? getEthiopianYear(currentYear) : null;
        const assessmentYearNum = a.academicYear ? getEthiopianYear(a.academicYear) : null;

        return normalizeGrade(a.grade) === normalizeGrade(selectedGrade) &&
            assessmentSemester === currentSemesterSetting &&
            (!targetYearNum || assessmentYearNum === targetYearNum) &&
            (allowedGrades.length === 0 || allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade))) &&
            (allowedSubjects.length === 0 || normalizedAllowedSubjects.includes(normalizeSubject(a.subjectName)));
    });

    // Build subject dropdown options directly from the teacher-assigned subject list
    // (like the desktop "SUBJECTS:" box). Assessments will be filtered separately by grade/semester.
    const allowedSubjectKeyToLabel = new Map();
    (allowedSubjects || []).forEach((s) => {
        const key = normalizeSubject(s);
        if (!key) return;
        if (!allowedSubjectKeyToLabel.has(key)) allowedSubjectKeyToLabel.set(key, s);
    });
    const subjectOptions = [...allowedSubjectKeyToLabel.entries()]
        .map(([key, label]) => ({ value: key, label }));

    const filteredAssessments = selectedSubject
        ? assessmentsForGrade.filter(a => normalizeSubject(a.subjectName) === selectedSubject)
        : assessmentsForGrade;
    const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);

    // Guard: clear stale sessionStorage ID if it no longer matches any available assessment
    // This prevents the <Select> from showing a raw UUID before data loads
    useEffect(() => {
        if (selectedAssessmentId && !isLoading && filteredAssessments.length > 0 && !filteredAssessments.find(a => a.id === selectedAssessmentId)) {
            setSelectedAssessmentId('');
        }
    }, [selectedAssessmentId, filteredAssessments, isLoading]);

    // Guard: if selectedSubject no longer exists in teacher's assigned subjects, clear it (and assessment too).
    useEffect(() => {
        if (!selectedSubject) return;
        if (isLoading) return;
        if (!normalizedAllowedSubjects.includes(selectedSubject)) {
            setSelectedSubject('');
            setSelectedAssessmentId('');
        }
    }, [selectedSubject, normalizedAllowedSubjects, isLoading]);

    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions = dbGrades
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const gradeOptionsUnrestricted = [...GRADE_OPTIONS, ...extraGradeOptions];
    const gradeOptions = hasTeacherAssignedGrades && allowedGrades.length > 0
        ? gradeOptionsUnrestricted.filter(o => allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(o.value)))
        : [];
    const [highlightEmptyData, setHighlightEmptyData] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const studentsInGrade = teacherStudents
        .filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade))
        .filter(s => s.archived !== 1) // Exclude archived/graduated students
        .filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return s.name?.toLowerCase().includes(q);
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    useEffect(() => {
        if (!allAssessments || allAssessments.length === 0 || isLoading) return;

        const nonce = location.state?.nonce;
        if (location.state?.assessmentId && lastRoutedNonce.current !== nonce) {
            const ass = allAssessments.find(a => a.id === location.state.assessmentId);
            if (ass) {
                setSelectedGrade(String(ass.grade));
                setSelectedSubject(normalizeSubject(ass.subjectName));
                setSelectedAssessmentId(ass.id);
            }
            if (location.state?.highlightEmpty) {
                // 1. Prepare: Switch to the target page first
                const firstMissingIndex = studentsInGrade.findIndex(s => !marks[s.id] || marks[s.id] === '');
                if (firstMissingIndex !== -1) {
                    const targetPage = Math.floor(firstMissingIndex / pageSize) + 1;
                    setCurrentPage(targetPage);
                    const studentId = studentsInGrade[firstMissingIndex].id;

                    // 2. Scroll: Wait for page/table render then scroll
                    setTimeout(() => {
                        const el = document.getElementById(`row-${studentId}`);
                        if (el) {
                            // Ensure the entire page centers on this row first
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                            const tableBody = el.closest('.ant-table-body');
                            if (tableBody) {
                                const relativeTop = el.offsetTop;
                                tableBody.scrollTo({
                                    top: relativeTop - 8, 
                                    behavior: 'smooth'
                                });
                            }
                            lastRoutedNonce.current = nonce;

                            // 3. Highlight: Only pulse AFTER the scroll animation finishes (~600ms)
                            setTimeout(() => {
                                setHighlightEmptyData(true);
                                // 4. Cleanup: Clear pulse after 2 seconds
                                setTimeout(() => setHighlightEmptyData(false), 2000);
                            }, 700);
                        }
                    }, 500);
                }
            }
        } else if (location.state?.grade) {
            setSelectedGrade(location.state.grade);
            // If navigation targets only a grade, reset dependent selections.
            if (!location.state?.assessmentId) {
                setSelectedSubject('');
                setSelectedAssessmentId('');
                setSearchQuery('');
            }
        }
    }, [location.state, allAssessments, isLoading, studentsInGrade.length]);

    useEffect(() => {
        if (!selectedAssessmentId) return;

        async function loadMarks() {
            const marks = await db.marks
                .where('assessmentId').equals(selectedAssessmentId)
                .toArray();

            // If duplicates exist for a student+assessment (can happen after sync conflicts),
            // prefer the newest non-null score so a newer "empty" record doesn't wipe a valid mark.
            const bestByStudent = new Map();
            for (const m of marks) {
                const sid = m.studentId;
                if (!sid) continue;
                const t = m.updated_at ? new Date(m.updated_at).getTime() : 0;
                const hasScore = m.score !== null && m.score !== undefined && m.score !== '';

                const prev = bestByStudent.get(sid);
                if (!prev) {
                    bestByStudent.set(sid, { rec: m, t, hasScore });
                    continue;
                }

                // Prefer any record with a real score over empty ones.
                if (hasScore && !prev.hasScore) {
                    bestByStudent.set(sid, { rec: m, t, hasScore });
                    continue;
                }
                if (!hasScore && prev.hasScore) continue;

                // Same score-emptiness class: keep the newest.
                if (t >= prev.t) {
                    bestByStudent.set(sid, { rec: m, t, hasScore });
                }
            }

            const markMap = {};
            for (const [sid, v] of bestByStudent.entries()) {
                markMap[sid] = v.rec.score;
            }
            setMarks(markMap);
            setModifiedMarks(new Set()); // Clear modified marks on assessment change
        }
        loadMarks();
    }, [selectedAssessmentId, syncKey]);

    const handleMarkChange = (studentId, value) => {
        const score = parseFloat(value);
        if (value !== '' && !isNaN(score) && selectedAssessment && score > selectedAssessment.maxScore) {
            message.warning(t('teacher.invalidScoreRange', { max: selectedAssessment.maxScore }));
            return;
        }
        setMarks(prev => ({ ...prev, [studentId]: value }));
        setModifiedMarks(prev => {
            const next = new Set(prev);
            next.add(studentId);
            return next;
        });
    };

    const handleSaveMarks = async (passedMarks = null, passedModified = null) => {
        if (!selectedAssessmentId) return;
        
        // Safety guard: if passedMarks is a React Event object, ignore it
        const actualPassedMarks = (passedMarks && !passedMarks.nativeEvent) ? passedMarks : null;
        const actualPassedModified = (passedModified && !(passedModified instanceof Event)) ? passedModified : null;
        
        const marksToUse = actualPassedMarks || marks;
        const modifiedToUse = actualPassedModified || modifiedMarks;

        if (modifiedToUse.size === 0) {
            message.info(t('teacher.noChanges', 'No changes to save.'));
            return;
        }

        setIsSaving(true);
        try {
            const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);
            const idsToDelete = [];

            for (const studentId of modifiedToUse) {
                const value = marksToUse[studentId];
                const score = parseFloat(value);

                const student = allStudents.find(s => s.id === studentId);
                const studentYear = student?.academicYear;

                const allExisting = await db.marks
                    .where('[studentId+assessmentId]').equals([studentId, selectedAssessmentId])
                    .toArray();

                // Sort by updated_at ascending to identify the absolute newest record
                allExisting.sort((a, b) => {
                    const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                    const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    return timeA - timeB;
                });

                const existingMark = allExisting.pop(); // The newest one

                // Self-healing: queue any orphaned duplicates for deletion
                for (const old of allExisting) {
                    idsToDelete.push(old.id);
                    await db.marks.delete(old.id);
                }

                const isCleared = value === '' || value === null || value === undefined;
                if (isCleared || isNaN(score)) {
                    // If value is cleared, delete existing mark if any
                    if (existingMark) {
                        idsToDelete.push(existingMark.id);
                        await db.marks.delete(existingMark.id);
                    }
                    continue;
                }

                if (score > selectedAssessment.maxScore) {
                    message.error(t('teacher.markExceedsMax', { max: selectedAssessment.maxScore }));
                    continue;
                }

                if (existingMark) {
                    await db.marks.update(existingMark.id, { 
                        score,
                        subject: selectedAssessment.subjectName,
                        assessmentDate: selectedAssessment.date,
                        semester: currentSemesterSetting,
                        academicYear: studentYear || existingMark.academicYear,
                        markedBy: teacher.id,
                        synced: 0,
                        updated_at: new Date().toISOString()
                    });
                } else {
                    const genUUID = () => {
                        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
                        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                            return v.toString(16);
                        });
                    };

                    await db.marks.add({
                        id: genUUID(),
                        studentId: studentId,
                        assessmentId: selectedAssessmentId,
                        subject: selectedAssessment.subjectName,
                        assessmentDate: selectedAssessment.date,
                        score,
                        markedBy: teacher.id,
                        synced: 0,
                        semester: currentSemesterSetting,
                        academicYear: studentYear,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Perform explicit Supabase deletion for cleared marks (Plan B)
            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from('marks').delete().in('id', idsToDelete);
                if (delError) console.warn("Supabase deletion warning:", delError);
            }

            setModifiedMarks(new Set());
            message.success(t('teacher.saveSuccess', 'Marks saved successfully!'));
            await syncData().catch(console.error);
        } catch (err) {
            console.error("Save failed:", err);
            message.error(t('teacher.saveError', 'Failed to save marks!'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleFillConstantMark = () => {
        if (!selectedAssessment) return;

        const studentsWithoutMarks = studentsInGrade.filter(s => marks[s.id] === undefined || marks[s.id] === '');
        if (studentsWithoutMarks.length === 0) {
            message.info(t('teacher.fullyGraded', 'All students already have marks.'));
            return;
        }

        modal.confirm({
            title: t('teacher.fillConstant'),
            content: (
                <div className="py-4">
                    <Text>{t('teacher.fillPrompt', { max: selectedAssessment.maxScore })}</Text>
                    <Input
                        type="number"
                        min={0}
                        max={selectedAssessment.maxScore}
                        placeholder={t('teacher.fillValue')}
                        className="mt-2"
                        onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            window._tempBulkValue = isNaN(val) ? '' : val;
                        }}
                    />
                </div>
            ),
            onOk: () => {
                const val = window._tempBulkValue;
                if (val === undefined || val === '') return;
                if (val > selectedAssessment.maxScore) {
                    message.error(t('teacher.invalidScoreRange', { max: selectedAssessment.maxScore }));
                    return;
                }

                const newMarks = { ...marks };
                const newlyModified = new Set(modifiedMarks);
                let count = 0;
                for (const student of studentsWithoutMarks) {
                    newMarks[student.id] = val.toString();
                    newlyModified.add(student.id);
                    count++;
                }
                
                setMarks(newMarks);
                setModifiedMarks(newlyModified);
                
                // Background execute to make modal snappy
                (async () => {
                    try {
                        await handleSaveMarks(newMarks, newlyModified);
                        message.success(t('teacher.fillSuccess', { count }));
                    } catch (e) {
                        console.error("Fill failed:", e);
                    }
                })();
                delete window._tempBulkValue;
            }
        });
    };

    const handleClearAssessmentMarks = () => {
        if (!selectedAssessment) return;
        
        // Check if there's actually anything to clear (non-empty marks)
        const hasMarksToClear = studentsInGrade.some(s => marks[s.id] !== undefined && marks[s.id] !== '');
        
        if (!hasMarksToClear) {
            message.info(t('teacher.alreadyCleared'));
            return;
        }

        modal.confirm({
            title: t('teacher.clearAllMarks'),
            content: t('teacher.confirmClearAll'),
            okText: t('teacher.yesClearAll'),
            okType: 'danger',
            onOk: () => {
                const newMarks = { ...marks };
                const newlyModified = new Set(modifiedMarks);
                
                // Fix: Clear ALL students in grade, not just those currently filtered by search UI
                const studentsToClear = teacherStudents.filter(s => 
                    normalizeGrade(s.grade) === normalizeGrade(selectedGrade) && 
                    s.archived !== 1
                );

                for (const student of studentsToClear) {
                    newMarks[student.id] = '';
                    newlyModified.add(student.id);
                }
                setMarks(newMarks);
                setModifiedMarks(newlyModified);
                
                // Background execute to make modal snappy
                (async () => {
                    try {
                        await handleSaveMarks(newMarks, newlyModified);
                        message.success(t('teacher.clearSuccess'));
                    } catch (e) {
                        console.error("Clear failed:", e);
                    }
                })();
            }
        });
    };

    const handlePredictMarks = async () => {
        if (!selectedAssessment) return;

        const allStudentsInGrade = teacherStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade));
        const studentsWithoutMarks = allStudentsInGrade.filter(s => marks[s.id] === undefined || marks[s.id] === '');
        if (studentsWithoutMarks.length === 0) {
            message.info(t('teacher.fullyGraded'));
            return;
        }

        const normS = (s) => String(s || "").trim().toLowerCase().normalize('NFC');
        const targetSubject = normS(selectedAssessment.subjectName);

        // Pre-fetch a map of assessment subject names for fast fallback lookup
        const allAssMap = new Map((assessmentsData || []).map(a => [a.id, normS(a.subjectName)]));

        // Pre-filter: only include students who have AT LEAST ONE mark in this subject already
        const studentsWithHistory = [];
        for (const student of studentsWithoutMarks) {
            const studentMarks = await db.marks.where('studentId').equals(student.id).toArray();
            
            // Check both the explicitly stored subject AND the assessment lookup for robustness
            const hasSubjectHistory = studentMarks.some(m => {
                const markSub = normS(m.subject);
                if (markSub === targetSubject) return true;
                
                const assessmentSub = allAssMap.get(m.assessmentId);
                return assessmentSub === targetSubject;
            });
            
            if (hasSubjectHistory) {
                studentsWithHistory.push(student);
            }
        }

        if (studentsWithHistory.length === 0) {
            message.warning(t('teacher.noHistoryFound'));
            return;
        }

        modal.confirm({
            title: t('teacher.predictMarks'),
            content: t('teacher.confirmPredict', { count: studentsWithHistory.length, subject: selectedAssessment.subjectName }),
            onOk: () => {
                // Background Execute to close modal instantly
                (async () => {
                    const normS = (s) => String(s || "").trim().toLowerCase().normalize('NFC');
                    const targetSubject = normS(selectedAssessment.subjectName);
                    const allAssMap = new Map((assessmentsData || []).map(a => [a.id, normS(a.subjectName)]));
                    
                    // Bulk fetch ALL marks for these students in one go for 10x performance
                    const studentIds = studentsWithHistory.map(s => s.id);
                    const allRecentMarks = await db.marks.where('studentId').anyOf(studentIds).toArray();
                    
                    // Group marks by student for easy lookup
                    const marksByStudent = allRecentMarks.reduce((acc, m) => {
                        if (!acc[m.studentId]) acc[m.studentId] = [];
                        acc[m.studentId].push(m);
                        return acc;
                    }, {});

                    const predictions = [];
                    for (const student of studentsWithHistory) {
                        const studentMarks = marksByStudent[student.id] || [];
                        
                        const subjectMarks = studentMarks.filter(m => {
                            const markSub = normS(m.subject);
                            if (markSub === targetSubject) return true;
                            const assessmentSub = allAssMap.get(m.assessmentId);
                            return assessmentSub === targetSubject;
                        });

                        if (subjectMarks.length > 0) {
                            let totalPercentage = 0;
                            let validCount = 0;
                            for (const m of subjectMarks) {
                                const assessment = allAssessments.find(a => a.id === m.assessmentId);
                                const maxScore = assessment?.maxScore || 100; 
                                if (maxScore > 0) {
                                    totalPercentage += (Number(m.score) / maxScore);
                                    validCount++;
                                }
                            }
                            if (validCount > 0) {
                                const avgPercentage = totalPercentage / validCount;
                                const predictedScore = Math.round(avgPercentage * selectedAssessment.maxScore * 10) / 10;
                                predictions.push({ id: student.id, score: predictedScore });
                            }
                        }
                    }

                    let count = 0;
                    for (const p of predictions) {
                        handleMarkChange(p.id, p.score.toString());
                        count++;
                    }
                    message.success(t('teacher.predictSuccess', { count }));
                })();
            }
        });
    };

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name' },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => formatGrade(text) },
        {
            title: selectedAssessment ? `${t('teacher.score')} (/${selectedAssessment.maxScore})` : t('teacher.score'),
            key: 'score',
            align: 'right',
            width: 150,
            render: (_, record) => {
                const isMissing = marks[record.id] === undefined || marks[record.id] === null || marks[record.id] === '';
                const shouldHighlight = highlightEmptyData && isMissing;
                return (
                <Input
                    type="number"
                    placeholder={selectedAssessment ? `0-${selectedAssessment.maxScore}` : ''}
                    value={!isMissing ? marks[record.id] : ''}
                    onChange={e => handleMarkChange(record.id, e.target.value)}
                    className={shouldHighlight ? 'pulse-focus' : ''}
                    style={{ 
                        textAlign: 'right',
                        ...(shouldHighlight ? { border: '2px solid #3b82f6', backgroundColor: 'transparent' } : {})
                    }}
                    max={selectedAssessment?.maxScore}
                    min={0}
                />
            )}
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<UserOutlined />}
                    onClick={() => setProfileStudentId(record.id)}
                >
                    {t('teacher.viewProfile')}
                </Button>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <style>{`
                @keyframes pulse-border-blue {
                    0% { border-color: #3b82f6; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
                    50% { border-color: #93c5fd; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
                    100% { border-color: #3b82f6; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                }
                .pulse-focus {
                    animation: pulse-border-blue 0.8s infinite;
                    z-index: 10;
                }
            `}</style>
            <div>
                <Title level={2}>{t('teacher.speedEntryMarks')}</Title>
                <Text type="secondary">{t('teacher.enterMarksInfo')}</Text>
            </div>

            {contextHolder}
            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form layout="vertical">
                    <Row gutter={16} align="bottom">
                        <Col xs={24} md={6}>
                            <Form.Item label={t('teacher.selectGrade')} style={{ marginBottom: 0 }}>
                                <Select
                                    placeholder={t('teacher.selectGrade')}
                                    value={selectedGrade}
                                    onChange={(val) => {
                                        setSelectedGrade(val);
                                        setSelectedSubject('');
                                        setSelectedAssessmentId('');
                                        setSearchQuery('');
                                    }}
                                    options={gradeOptions}
                                    allowClear
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item label={t('teacher.selectSubject')} style={{ marginBottom: 0 }}>
                                <Select
                                    placeholder={t('teacher.selectSubject')}
                                    value={selectedSubject || undefined}
                                    onChange={(val) => {
                                        setSelectedSubject(val || '');
                                        setSelectedAssessmentId('');
                                    }}
                                    options={subjectOptions}
                                    allowClear
                                    showSearch
                                    disabled={!selectedGrade || subjectOptions.length === 0}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                            <Form.Item label={t('teacher.selectAssessment')} style={{ marginBottom: 0 }}>
                                <Select
                                    placeholder={t('teacher.selectAssessment')}
                                    value={selectedAssessmentId && selectedAssessment ? selectedAssessmentId : undefined}
                                    onChange={setSelectedAssessmentId}
                                    options={Object.entries(
                                        filteredAssessments.reduce((acc, a) => {
                                            const subject = allSubjects.find(s => normalizeSubject(s.name) === normalizeSubject(a.subjectName));
                                            const sem = subject?.semester || 'Semester I';
                                            const semText = t(`admin.${sem === 'Semester I' ? 'semester1' : 'semester2'}`, sem);
                                            const groupLabel = `${a.subjectName} • ${semText}`;
                                            
                                            if (!acc[groupLabel]) acc[groupLabel] = [];
                                            acc[groupLabel].push({
                                                value: a.id,
                                                label: `${a.name} (Max: ${a.maxScore})`
                                            });
                                            return acc;
                                        }, {})
                                    ).map(([label, opts]) => ({ label, options: opts }))}
                                    allowClear
                                    showSearch
                                    disabled={!selectedSubject}
                                />
                            </Form.Item>
                        </Col>
                        {!!(teacher?.canCreateAssessments || teacher?.cancreateassessments) && (
                            <Col xs={24} md={6}>
                                <Form.Item label=" " style={{ marginBottom: 0 }}>
                                    <Button 
                                        icon={<BookOutlined />} 
                                        onClick={() => navigate('/teacher/assessments')}
                                        className="w-full h-10 rounded-xl"
                                    >
                                        {t('admin.assessments')}
                                    </Button>
                                </Form.Item>
                            </Col>
                        )}
                        {selectedAssessment && (
                            <Col xs={24} md={6}>
                                <Form.Item label="&nbsp;" style={{ marginBottom: 0 }}>
                                    <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded flex flex-col justify-center h-10">
                                        <Text strong className="text-blue-700 dark:text-blue-300 text-[15px]">
                                            {t('admin.maxScore')}: {selectedAssessment.maxScore}
                                        </Text>
                                    </div>
                                </Form.Item>
                            </Col>
                        )}
                    </Row>
                </Form>
            </Card>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 mb-4 w-full">
                <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    {t('teacher.studentsList')}
                    <Tag color="blue" style={{ marginLeft: '12px' }}>
                        {selectedAssessmentId
                            ? (searchQuery
                                ? `${studentsInGrade.length} / ${teacherStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade)).length}`
                                : studentsInGrade.length)
                            : '—'}
                    </Tag>
                </Title>
                <div className="hidden sm:block flex-grow border-t border-slate-200 dark:border-slate-700 mx-2"></div>
                <Input
                    placeholder={t('common.searchPlaceholder')}
                    prefix={<SearchOutlined className="text-slate-400" />}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '300px' }}
                    allowClear
                    disabled={!selectedGrade}
                />
                {selectedAssessment && (
                    <Space>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => handleSaveMarks()}
                            loading={isSaving}
                            disabled={!selectedAssessmentId || studentsInGrade.length === 0}
                        >
                            {t('teacher.saveMarks')}
                        </Button>
                        <Button
                            icon={<BarChartOutlined />}
                            onClick={handlePredictMarks}
                            disabled={!selectedAssessmentId || studentsInGrade.length === 0 || isSaving}
                        >
                            {t('teacher.predictMarks')}
                        </Button>
                        <Button
                            icon={<EditOutlined />}
                            onClick={handleFillConstantMark}
                            disabled={!selectedAssessmentId || studentsInGrade.length === 0}
                        >
                            {t('teacher.fillConstant')}
                        </Button>
                        <Button
                            icon={<ClearOutlined />}
                            danger
                            onClick={handleClearAssessmentMarks}
                            disabled={!selectedAssessmentId || studentsInGrade.length === 0 || isSaving}
                        >
                            {t('teacher.clearMarks')}
                        </Button>
                    </Space>
                )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden w-full">
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton active paragraph={{ rows: 1 }} title={false} />
                        <Skeleton active paragraph={{ rows: 5 }} />
                    </div>
                ) : !selectedAssessmentId ? (
                    <div className="p-10">
                        <Empty description={t('teacher.selectAssessmentPrompt')} />
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        dataSource={studentsInGrade}
                        rowKey="id"
                        onRow={(record) => ({
                            id: `row-${record.id}`
                        })}
                        pagination={{
                            current: currentPage,
                            pageSize: pageSize,
                            onChange: (p, ps) => {
                                setCurrentPage(p);
                                setPageSize(ps);
                            },
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            showQuickJumper: true,
                            position: ['bottomRight'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} ${t('admin.target')} ${total}`,
                        }}
                        scroll={{ x: 'max-content', y: 500 }}
                        className="students-table w-full"
                        locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
                    />
                )}
            </div>
        </div>
    );
}

function AttendanceModule({ setProfileStudentId, teacher }) {
    const { t } = useTranslation();

    // Persist selection state in sessionStorage so navigation between sidebar items doesn't reset it
    const [selectedGrade, setSelectedGrade] = useState(() => sessionStorage.getItem('sem_att_grade') || '');
    const [selectedSubject, setSelectedSubject] = useState(() => sessionStorage.getItem('sem_att_subject') || '');
    const [selectedAssessmentId, setSelectedAssessmentId] = useState(() => sessionStorage.getItem('sem_att_assessment') || '');
    const [attendanceDate, setAttendanceDate] = useState(() => sessionStorage.getItem('sem_att_date') || dayjs().format('YYYY-MM-DD'));
    const [attendance, setAttendance] = useState({});
    const [modifiedAttendance, setModifiedAttendance] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');


    // Keep sessionStorage in sync
    useEffect(() => { sessionStorage.setItem('sem_att_grade', selectedGrade); }, [selectedGrade]);
    useEffect(() => { sessionStorage.setItem('sem_att_subject', selectedSubject); }, [selectedSubject]);
    useEffect(() => { sessionStorage.setItem('sem_att_assessment', selectedAssessmentId); }, [selectedAssessmentId]);
    useEffect(() => { sessionStorage.setItem('sem_att_date', attendanceDate); }, [attendanceDate]);

    const [syncKey, setSyncKey] = useState(0);
    useEffect(() => {
        const handleSync = () => setSyncKey(k => k + 1);
        window.addEventListener('syncComplete', handleSync);
        return () => window.removeEventListener('syncComplete', handleSync);
    }, []);

    const allStudentsData = useLiveQuery(() => db.students.toArray(), [syncKey]);
    const assessmentsData = useLiveQuery(() => db.assessments.toArray(), [syncKey]);
    const subjectsData = useLiveQuery(() => db.subjects.toArray(), [syncKey]);
    const settingsRows = useLiveQuery(() => db.settings?.toArray(), [syncKey]) || [];

    const allStudents = allStudentsData || [];
    const allAssessments = assessmentsData || [];
    const allSubjects = subjectsData || [];
    const isLoading = allStudentsData === undefined || assessmentsData === undefined || subjectsData === undefined;
    const currentSemesterSetting = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';
    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades2 = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions2 = dbGrades2
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const normalizeSubject = (raw) => {
        if (!raw) return '';
        return String(raw).toLowerCase().trim();
    };

    const allowedGrades = Array.isArray(teacher?.assignedGrades) ? teacher.assignedGrades : [];
    const allowedSubjects = Array.isArray(teacher?.assignedSubjects) ? teacher.assignedSubjects : [];
    const normalizedAllowedSubjects = allowedSubjects.map(s => normalizeSubject(s)).filter(Boolean);

    const assessmentsForGrade = allAssessments.filter(a => {
        const subject = allSubjects.find(s => normalizeSubject(s.name) === normalizeSubject(a.subjectName));
        const assessmentSemester = subject?.semester || 'Semester I';
        return normalizeGrade(a.grade) === normalizeGrade(selectedGrade) &&
            assessmentSemester === currentSemesterSetting &&
            (allowedGrades.length === 0 || allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade))) &&
            (normalizedAllowedSubjects.length === 0 || normalizedAllowedSubjects.includes(normalizeSubject(a.subjectName)));
    });

    const subjectOptionsMap = new Map();
    assessmentsForGrade.forEach(a => {
        const key = normalizeSubject(a.subjectName);
        if (!subjectOptionsMap.has(key)) {
            subjectOptionsMap.set(key, a.subjectName);
        }
    });
    const subjectOptions2 = Array.from(subjectOptionsMap.entries()).map(([value, label]) => ({ value, label }));

    const filteredAssessments = selectedSubject
        ? assessmentsForGrade.filter(a => normalizeSubject(a.subjectName) === selectedSubject)
        : [];

    const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);

    const normalizedAllowedGrades2 = allowedGrades.map(g => normalizeGrade(g));
    const hasTeacherAssignedGrades2 = Array.isArray(teacher?.assignedGrades);
    const teacherStudents = hasTeacherAssignedGrades2
        ? (normalizedAllowedGrades2.length > 0
            ? allStudents.filter(s => normalizedAllowedGrades2.includes(normalizeGrade(s.grade)))
            : [])
        : allStudents;

    const gradeOptions2Unrestricted = [...GRADE_OPTIONS, ...extraGradeOptions2];
    const gradeOptions2 = Array.isArray(teacher?.assignedGrades) && allowedGrades.length > 0
        ? gradeOptions2Unrestricted.filter(o => allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(o.value)))
        : [];

    // Guard: if sessionStorage has a grade that this teacher isn't assigned to, clear it.
    useEffect(() => {
        if (!selectedGrade) return;
        if (!hasTeacherAssignedGrades2) return;
        const isAllowed = normalizedAllowedGrades2.includes(normalizeGrade(selectedGrade));
        if (!isAllowed) {
            setSelectedGrade('');
            setSelectedSubject('');
            setSelectedAssessmentId('');
            setSearchQuery('');
        }
    }, [hasTeacherAssignedGrades2, allowedGrades, selectedGrade]);

    const studentsInGrade = teacherStudents
        .filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade))
        .filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return s.name?.toLowerCase().includes(q);
        });

    useEffect(() => {
        if (!selectedGrade || !attendanceDate) return;

        async function loadAttendance() {
            const records = await db.attendance
                .filter(a => a.date === attendanceDate)
                .toArray();

            // Sort by updated_at ascending
            records.sort((a, b) => {
                const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                return timeA - timeB;
            });

            const attMap = {};
            records.forEach(r => {
                attMap[r.studentId] = r.status;
            });
            setAttendance(attMap);
            setModifiedAttendance(new Set()); // Clear modified attendance on date/grade change
        }
        loadAttendance();
    }, [selectedGrade, attendanceDate, syncKey]);

    const [isSaving, setIsSaving] = useState(false);

    const handleAttendanceChange = (studentId, status) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
        setModifiedAttendance(prev => {
            const next = new Set(prev);
            next.add(studentId);
            return next;
        });
    };

    const handleSaveAttendance = async () => {
        if (!attendanceDate) return;
        if (modifiedAttendance.size === 0) {
            message.info(t('teacher.noChanges'));
            return;
        }

        setIsSaving(true);
        try {
            const idsToDelete = [];
            for (const studentId of modifiedAttendance) {
                const status = attendance[studentId];
                const student = allStudents.find(s => s.id === studentId);
                const studentYear = student?.academicYear;

                const allExisting = await db.attendance
                    .where('[studentId+date]')
                    .equals([studentId, attendanceDate])
                    .toArray();

                allExisting.sort((a, b) => {
                    const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                    const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                    return timeA - timeB;
                });

                const existingRecord = allExisting.pop();
                
                // Self-healing: queue any orphaned duplicates for deletion
                for (const old of allExisting) {
                    idsToDelete.push(old.id);
                    await db.attendance.delete(old.id);
                }

                // If status is undefined (e.g., cleared), delete the record
                if (!status) {
                    if (existingRecord) {
                        idsToDelete.push(existingRecord.id);
                        await db.attendance.delete(existingRecord.id);
                    }
                    continue;
                }

                if (existingRecord) {
                    await db.attendance.update(existingRecord.id, { 
                        status, 
                        semester: currentSemesterSetting, 
                        markedBy: teacher?.id,
                        synced: 0,
                        updated_at: new Date().toISOString()
                    });
                } else {
                    await db.attendance.add({
                        id: crypto.randomUUID(),
                        studentId: studentId,
                        date: attendanceDate,
                        status,
                        semester: currentSemesterSetting,
                        markedBy: teacher?.id,
                        synced: 0,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Perform explicit Supabase deletion for cleared attendance (Plan B)
            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from('attendance').delete().in('id', idsToDelete);
                if (delError) console.warn("Supabase attendance deletion warning:", delError);
            }

            setModifiedAttendance(new Set());
            message.success(t('teacher.saveSuccess'));
            syncData().catch(console.error);
        } catch (err) {
            console.error("Attendance save failed:", err);
            message.error(t('teacher.saveError'));
        } finally {
            setIsSaving(false);
        }
    }; const handleMarkAllPresent = () => {
        if (!selectedGrade || studentsInGrade.length === 0) return;

        for (const student of studentsInGrade) {
            handleAttendanceChange(student.id, 'present');
        }
        message.success(t('teacher.markAllPresentSuccess'));
    };

    const handleClearAttendance = () => {
        if (!selectedGrade || studentsInGrade.length === 0) return;

        for (const student of studentsInGrade) {
            setAttendance(prev => {
                const next = { ...prev };
                delete next[student.id];
                return next;
            });
            setModifiedAttendance(prev => {
                const next = new Set(prev);
                next.add(student.id);
                return next;
            });
        }
        message.success(t('teacher.attendanceCleared'));
    };

    const handleScanSuccess = async (decodedText) => {
        // decodedText is the studentId
        const student = teacherStudents.find(s => s.id === decodedText);
        if (!student) {
            message.warning(t('teacher.studentNotFound'));
            return;
        }

        // Only record if student is in the selected grade (or if no grade selected, just record it)
        if (selectedGrade && normalizeGrade(student.grade) !== normalizeGrade(selectedGrade)) {
            message.warning(t('teacher.studentWrongGrade', { from: formatGrade(student.grade), to: formatGrade(selectedGrade) }));
            // Still record it though, as they are present
        }

        await handleAttendanceChange(student.id, 'present');
        notification.success({
            title: t('teacher.scanSuccess', { name: student.name }),
            placement: 'topRight',
            duration: 2
        });
    };

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name' },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => formatGrade(text) },
        {
            title: t('teacher.attendance'),
            key: 'status',
            align: 'right',
            render: (_, record) => {
                const currentStatus = attendance[record.id] || 'present';
                return (
                    <Radio.Group
                        value={currentStatus}
                        onChange={e => handleAttendanceChange(record.id, e.target.value)}
                        size="small"
                        className="attendance-radio-group"
                    >
                        <Radio.Button
                            value="present"
                            className="cursor-pointer"
                            style={currentStatus === 'present' ? { backgroundColor: '#22c55e', borderColor: '#22c55e', color: 'white' } : {}}
                        >
                            <CheckOutlined /> {t('teacher.present')}
                        </Radio.Button>
                        <Radio.Button
                            value="late"
                            className="cursor-pointer"
                            style={currentStatus === 'late' ? { backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: 'white' } : {}}
                        >
                            <ClockCircleOutlined /> {t('teacher.late')}
                        </Radio.Button>
                        <Radio.Button
                            value="absent"
                            className="cursor-pointer"
                            style={currentStatus === 'absent' ? { backgroundColor: '#ef4444', borderColor: '#ef4444', color: 'white' } : {}}
                        >
                            <CloseOutlined /> {t('teacher.absent')}
                        </Radio.Button>
                        <Radio.Button
                            value="no_class"
                            className="cursor-pointer"
                            style={currentStatus === 'no_class' ? { backgroundColor: '#64748b', borderColor: '#64748b', color: 'white' } : {}}
                        >
                            <MinusCircleOutlined /> {t('teacher.noClass')}
                        </Radio.Button>
                    </Radio.Group>
                );
            }
        },
        {
            title: '',
            key: 'profile',
            width: 50,
            render: (_, record) => (
                <Button
                    type="text"
                    icon={<UserOutlined className="text-blue-500" />}
                    onClick={() => setProfileStudentId(record.id)}
                    title={t('teacher.viewProfile')}
                />
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6 w-full coming-soon-blur-container">
            {/* Content to be blurred */}
            <div className="coming-soon-content-blur">
                <div>
                    <Title level={2}>{t('teacher.attendanceModule')}</Title>
                    <Text type="secondary">{t('teacher.recordAttendanceInfo')}</Text>
                </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form layout="vertical">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={8}>
                            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm h-full">
                                <Space orientation="vertical" className="w-full">
                                    <Text strong type="secondary">{t('teacher.selectGrade')}</Text>
                                    <Select
                                        value={selectedGrade || undefined}
                                        onChange={(value) => {
                                            setSelectedGrade(value);
                                            setSelectedSubject('');
                                            setSelectedAssessmentId('');
                                        }}
                                        style={{ width: '100%' }}
                                        size="large"
                                        options={gradeOptions2}
                                        placeholder={t('teacher.chooseGrade')}
                                        allowClear
                                    />
                                </Space>
                            </Card>
                        </Col>

                        <Col xs={24} sm={8}>
                            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm h-full">
                                <Space orientation="vertical" className="w-full">
                                    <Text strong type="secondary">{t('teacher.selectSubject')}</Text>
                                    <Select
                                        value={selectedSubject || undefined}
                                        onChange={(value) => {
                                            setSelectedSubject(value);
                                            setSelectedAssessmentId('');
                                        }}
                                        style={{ width: '100%' }}
                                        size="large"
                                        options={subjectOptions2}
                                        placeholder={t('teacher.chooseSubject')}
                                        disabled={!selectedGrade}
                                        allowClear
                                    />
                                </Space>
                            </Card>
                        </Col>

                        <Col xs={24} sm={8}>
                            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col justify-center">
                                {selectedGrade && currentSemesterSetting && allowedGrades.length > 0 ? (
                                    <Space orientation="vertical" className="w-full">
                                        <Text strong type="secondary">{t('teacher.selectAssessment')}</Text>
                                        <Select
                                            value={selectedAssessmentId && selectedAssessment ? selectedAssessmentId : undefined}
                                            onChange={setSelectedAssessmentId}
                                            style={{ width: '100%' }}
                                            size="large"
                                            placeholder={t('teacher.chooseAssessment')}
                                            disabled={!selectedSubject}
                                            allowClear
                                        >
                                            {filteredAssessments.map(a => (
                                                <Select.Option key={a.id} value={a.id}>
                                                    <div className="flex justify-between items-center w-full">
                                                        <span>{a.name}</span>
                                                        <Badge count={`${a.maxScore} pts`} style={{ backgroundColor: '#52c41a' }} />
                                                    </div>
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </Space>
                                ) : (
                                    <div className="text-center w-full py-2">
                                        <Text type="secondary">
                                            {!currentSemesterSetting ? t('teacher.askAdminSemester') : !selectedGrade ? t('teacher.selectGradeFirst') : t('teacher.noAssignedClasses')}
                                        </Text>
                                    </div>
                                )}
                            </Card>
                        </Col>
                    </Row>
                    <Row gutter={[16, 16]} align="bottom">
                        <Col xs={24} sm={12} lg={6}>
                            <Form.Item label={t('teacher.date')} style={{ marginBottom: 0 }}>
                                <DatePicker
                                    style={{ width: '100%' }}
                                    value={dayjs(attendanceDate)}
                                    onChange={(date) => setAttendanceDate(date ? date.format('YYYY-MM-DD') : '')}
                                    placeholder={t('admin.selectDate')}
                                />
                                {attendanceDate && (
                                    <div className="mt-1 text-xs text-slate-500 italic">
                                        {formatEthiopianDate(attendanceDate)}
                                    </div>
                                )}
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={24} lg={12}>
                            <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
                                <Space className="w-full justify-end" size="small" wrap>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleSaveAttendance}
                                        loading={isSaving}
                                        disabled={!selectedGrade || studentsInGrade.length === 0}
                                    >
                                        {t('teacher.saveAttendance')}
                                    </Button>
                                    <Button
                                        icon={<DeleteOutlined />}
                                        onClick={handleClearAttendance}
                                        disabled={!selectedGrade || studentsInGrade.length === 0 || isSaving}
                                        danger
                                    >
                                        {t('teacher.clearAttendance')}
                                    </Button>
                                    <Button
                                        icon={<TeamOutlined />}
                                        onClick={handleMarkAllPresent}
                                        disabled={!selectedGrade || studentsInGrade.length === 0 || isSaving}
                                    >
                                        {t('teacher.markAllPresent')}
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <QRScanner onScanSuccess={handleScanSuccess} />

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 mb-4 w-full">
                <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    {t('teacher.studentsList')}
                    <Tag color="blue" style={{ marginLeft: '12px' }}>
                        {searchQuery
                            ? `${studentsInGrade.length} / ${teacherStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade)).length}`
                            : studentsInGrade.length}
                    </Tag>
                </Title>
                <div className="hidden sm:block flex-grow border-t border-slate-200 dark:border-slate-700 mx-2"></div>
                <Input
                    placeholder={t('common.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    prefix={<SearchOutlined className="text-slate-400" />}
                    allowClear
                    className="w-full sm:w-[300px]"
                />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden w-full">
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton active paragraph={{ rows: 1 }} title={false} />
                        <Skeleton active paragraph={{ rows: 5 }} />
                    </div>
                ) : (
                    <Table
                        columns={columns}
                        dataSource={studentsInGrade}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            showQuickJumper: true,
                            position: ['bottomRight'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} ${t('admin.target')} ${total}`,
                        }}
                        scroll={{ x: 'max-content', y: 500 }}
                        className="students-table w-full"
                        locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
                    />
                )}
            </div>

            {/* Close content-blur div */}
            </div>

            {/* Standardized "Coming Soon" Overlay */}
            <div className="coming-soon-overlay">
                <div className="coming-soon-badge">
                    {t('common.comingSoon')}
                </div>
                <div className="coming-soon-text">
                    {t('teacher.attendanceModuleStatus')}
                </div>
                <div className="mt-2 text-slate-500 dark:text-slate-400 text-xs font-medium italic">
                    {t('teacher.featureInDevelopment')}
                </div>
            </div>
        </div>
    );
}

function QRScanner({ onScanSuccess }) {
    const [isScanning, setIsScanning] = useState(false);
    const { t } = useTranslation();

    return (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden relative flex flex-col items-center justify-center mb-6">
            {!isScanning ? (
                <div className="py-8 w-full flex justify-center">
                    <Button
                        type="primary"
                        size="large"
                        icon={<ScanOutlined />}
                        onClick={() => setIsScanning(true)}
                        className="h-16 px-12 text-lg rounded-full shadow-lg hover:scale-105 transition-transform"
                    >
                        {t('teacher.scanID')}
                    </Button>
                </div>
            ) : (
                <div className="w-full flex flex-col items-center p-4">
                    <div className="w-full max-w-[400px] aspect-square rounded-2xl overflow-hidden mb-6 shadow-2xl relative border-4 border-slate-700">
                        <Scanner
                            onScan={(detectedCodes) => {
                                if (detectedCodes && detectedCodes.length > 0) {
                                    onScanSuccess(detectedCodes[0].rawValue);
                                    // Make it feel responsive; could optional auto-close here
                                }
                            }}
                            components={{
                                audio: false,
                                tracker: true,
                            }}
                        />
                        {/* Overlay frame for aesthetics */}
                        <div className="absolute inset-0 border-2 border-emerald-500 rounded-2xl pointer-events-none opacity-50 z-10" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/20 rounded-lg pointer-events-none z-10" />
                    </div>
                    <Button
                        danger
                        size="large"
                        onClick={() => setIsScanning(false)}
                        className="rounded-full px-12 uppercase tracking-widest text-xs font-bold"
                    >
                        {t('teacher.stopScanning')}
                    </Button>
                </div>
            )}
        </Card>
    );
}
