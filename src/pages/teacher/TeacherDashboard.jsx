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
    WarningOutlined
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
    message,
    Skeleton,
    Empty,
    Radio,
    notification,
    DatePicker,
    Modal,
    Badge
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { syncData } from '../../utils/sync';
import { supabase } from '../../utils/supabaseClient';
import dayjs from 'dayjs';
import { Scanner } from '@yudiel/react-qr-scanner';
import StudentProfile from '../../components/StudentProfile';
import StudentAnalytics from '../admin/StudentAnalytics';
import TeacherUrgentMatters from './TeacherUrgentMatters';
import { GRADE_OPTIONS, formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import { Navigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;


export default function TeacherDashboard() {
    const location = useLocation();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [profileStudentId, setProfileStudentId] = useState(null);
    const [teacherSession, setTeacherSession] = useState(() => {
        try {
            const raw = sessionStorage.getItem('senbet_teacher_auth');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const liveTeacher = useLiveQuery(
        () => teacherSession?.id ? db.teachers.get(teacherSession.id) : null,
        [teacherSession?.id]
    );

    const activeTeacher = liveTeacher || teacherSession;

    if (!activeTeacher) {
        return <TeacherLogin onLogin={setTeacherSession} />;
    }

    const handleTeacherLogout = () => {
        sessionStorage.removeItem('senbet_teacher_auth');
        setTeacherSession(null);
        message.info(t('common.logout', 'Logged out'));
    };

    const menuItems = [
        {
            key: '/teacher',
            icon: <HomeOutlined />,
            label: t('app.title')
        },
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
    ];

    return (
        <div className="flex flex-col w-full gap-4">
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
                    <Button danger onClick={handleTeacherLogout}>
                        {t('common.logout', 'Logout')}
                    </Button>
                </div>
            </Card>
            {/* Mobile Navigation */}
            <div className="lg:hidden bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Menu
                    mode="horizontal"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={({ key }) => navigate(key)}
                    className="border-none w-full overflow-x-auto flex-nowrap hide-scrollbar"
                />
            </div>

            {/* Desktop: Sidebar + Content */}
            <div className="flex flex-row gap-6 items-start">
                <div className="hidden lg:flex flex-col flex-shrink-0 w-[240px] bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden teacher-sidebar">
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

                <div className="flex-1 min-w-0 min-h-[600px]">
                    <Routes>
                        <Route path="/" element={<Navigate to="mark-entry" replace />} />
                        <Route path="/mark-entry" element={<SpeedEntryMarks teacher={activeTeacher} setProfileStudentId={setProfileStudentId} />} />
                        <Route path="/attendance" element={<AttendanceModule teacher={activeTeacher} setProfileStudentId={setProfileStudentId} />} />
                        <Route path="/analytics" element={<StudentAnalytics isTeacherView={true} teacher={activeTeacher} />} />
                        <Route path="/urgent" element={<TeacherUrgentMatters teacher={activeTeacher} />} />
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
    const [form] = Form.useForm();
    const teachers = useLiveQuery(() => db.teachers?.toArray()) || [];

    const handleSubmit = async (values) => {
        const name = String(values.teacherName || '').trim().toLowerCase();
        const accessCode = String(values.accessCode || '').trim();
        const match = teachers.find(tt => String(tt.name || '').trim().toLowerCase() === name && String(tt.accessCode || '').trim() === accessCode);

        if (!match) {
            message.error(t('teacher.loginError', 'Invalid teacher name or access code'));
            return;
        }
        sessionStorage.setItem('senbet_teacher_auth', JSON.stringify(match));
        onLogin(match);
        message.success(t('teacher.loginSuccess', 'Welcome'));
    };

    return (
        <div className="max-w-md mx-auto py-10">
            <Card className="shadow-xl rounded-2xl border-slate-200 dark:border-slate-800">
                <Title level={3} style={{ marginTop: 0 }}>{t('teacher.portalLogin', 'Teacher Portal Login')}</Title>
                <Text type="secondary">{t('teacher.portalLoginDesc', 'Enter your access code provided by the admin.')}</Text>
                <Divider />
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="teacherName"
                        label={t('admin.name', 'Name')}
                        rules={[{ required: true, message: 'Please enter your name' }]}
                    >
                        <Input placeholder="Full name" />
                    </Form.Item>
                    <Form.Item
                        name="accessCode"
                        label={t('parent.accessCode', 'Access Code')}
                        rules={[{ required: true, message: 'Please enter your access code' }]}
                    >
                        <Input.Password placeholder="6-digit code" maxLength={6} />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block size="large">
                        {t('common.login', 'Login')}
                    </Button>
                </Form>
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
    const [marks, setMarks] = useState({});
    const [modifiedMarks, setModifiedMarks] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [modal, contextHolder] = Modal.useModal();

    // Keep sessionStorage in sync
    useEffect(() => { sessionStorage.setItem('sem_mark_grade', selectedGrade); }, [selectedGrade]);
    useEffect(() => { sessionStorage.setItem('sem_mark_assessment', selectedAssessmentId); }, [selectedAssessmentId]);

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const assessmentsData = useLiveQuery(() => db.assessments.toArray());
    const subjectsData = useLiveQuery(() => db.subjects.toArray());
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];

    const allStudents = allStudentsData || [];
    const allAssessments = assessmentsData || [];
    const allSubjects = subjectsData || [];
    const isLoading = allStudentsData === undefined || assessmentsData === undefined || subjectsData === undefined;

    const currentSemesterSetting = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    const allowedGrades = Array.isArray(teacher?.assignedGrades) ? teacher.assignedGrades : [];
    const allowedSubjects = Array.isArray(teacher?.assignedSubjects) ? teacher.assignedSubjects : [];

    // Only allow teachers to grade assessments that match their assigned subjects/grades + current semester
    const filteredAssessments = allAssessments.filter(a => {
        const subject = allSubjects.find(s => s.name === a.subjectName);
        const assessmentSemester = subject?.semester || 'Semester I';
        return normalizeGrade(a.grade) === normalizeGrade(selectedGrade) &&
            assessmentSemester === currentSemesterSetting &&
            (allowedGrades.length === 0 || allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade))) &&
            (allowedSubjects.length === 0 || allowedSubjects.includes(a.subjectName));
    });
    const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);

    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions = dbGrades
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const gradeOptionsUnrestricted = [...GRADE_OPTIONS, ...extraGradeOptions];
    const gradeOptions = allowedGrades.length > 0
        ? gradeOptionsUnrestricted.filter(o => allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(o.value)))
        : gradeOptionsUnrestricted;
    const studentsInGrade = allStudents
        .filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade))
        .filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return s.name?.toLowerCase().includes(q);
        });

    useEffect(() => {
        if (location.state?.assessmentId) {
            setSelectedAssessmentId(location.state.assessmentId);
        }
        if (location.state?.grade) {
            setSelectedGrade(location.state.grade);
        }
    }, [location.state]);

    useEffect(() => {
        if (!selectedAssessmentId) return;

        async function loadMarks() {
            const marks = await db.marks
                .where('assessmentId').equals(selectedAssessmentId)
                .toArray();

            const markMap = {};
            marks.forEach(m => {
                markMap[m.studentId] = m.score;
            });
            setMarks(markMap);
            setModifiedMarks(new Set()); // Clear modified marks on assessment change
        }
        loadMarks();
    }, [selectedAssessmentId]);

    const [isSaving, setIsSaving] = useState(false);

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

    const handleSaveMarks = async () => {
        if (!selectedAssessmentId) return;
        if (modifiedMarks.size === 0) {
            message.info(t('teacher.noChanges', 'No changes to save.'));
            return;
        }

        setIsSaving(true);
        try {
            const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);
            const idsToDelete = [];

            for (const studentId of modifiedMarks) {
                const value = marks[studentId];
                const score = parseFloat(value);

                if (value === '' || value === null || value === undefined || isNaN(score)) {
                    // If value is cleared, delete existing mark if any
                    const existingMark = await db.marks
                        .where('[studentId+assessmentId]').equals([studentId, selectedAssessmentId])
                        .first();
                    if (existingMark) {
                        idsToDelete.push(existingMark.id);
                        await db.marks.delete(existingMark.id);
                    }
                    continue;
                }

                if (score > selectedAssessment.maxScore) continue;

                const existingMark = await db.marks
                    .where('[studentId+assessmentId]').equals([studentId, selectedAssessmentId])
                    .first();

                if (existingMark) {
                    await db.marks.update(existingMark.id, { score, synced: 0 });
                } else {
                    await db.marks.add({
                        id: crypto.randomUUID(),
                        studentId: studentId,
                        assessmentId: selectedAssessmentId,
                        subject: selectedAssessment.subjectName,
                        assessmentDate: selectedAssessment.date,
                        score,
                        synced: 0
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
            syncData().catch(console.error);
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
            onOk: async () => {
                const val = window._tempBulkValue;
                if (val === undefined || val === '') return;
                if (val > selectedAssessment.maxScore) {
                    message.error(t('teacher.invalidScoreRange', { max: selectedAssessment.maxScore }));
                    return;
                }

                let count = 0;
                for (const student of studentsWithoutMarks) {
                    handleMarkChange(student.id, val.toString());
                    count++;
                }
                message.success(t('teacher.fillSuccess', { count }));
                delete window._tempBulkValue;
            }
        });
    };

    const handlePredictMarks = async () => {
        if (!selectedAssessment) return;

        const studentsWithoutMarks = studentsInGrade.filter(s => marks[s.id] === undefined || marks[s.id] === '');
        if (studentsWithoutMarks.length === 0) {
            message.info(t('teacher.fullyGraded'));
            return;
        }

        // Pre-filter: only include students who have AT LEAST ONE mark in this subject already
        const studentsWithHistory = [];
        for (const student of studentsWithoutMarks) {
            const historyCount = await db.marks
                .where('studentId').equals(student.id)
                .filter(m => m.subject === selectedAssessment.subjectName)
                .count();
            if (historyCount > 0) {
                studentsWithHistory.push(student);
            }
        }

        if (studentsWithHistory.length === 0) {
            message.warning(t('teacher.noHistoryFound', 'No mark history found for these students in this subject. Predictions cannot be made.'));
            return;
        }

        modal.confirm({
            title: t('teacher.predictMarks'),
            content: t('teacher.confirmPredict', { count: studentsWithHistory.length, subject: selectedAssessment.subjectName }),
            onOk: async () => {
                const predictions = [];
                for (const student of studentsWithHistory) {
                    // Find all marks for this student in the same subject
                    const subjectMarks = await db.marks
                        .where('studentId').equals(student.id)
                        .filter(m => m.subject === selectedAssessment.subjectName)
                        .toArray();

                    if (subjectMarks.length > 0) {
                        // Calculate average percentage
                        let totalPercentage = 0;
                        for (const m of subjectMarks) {
                            const assessment = allAssessments.find(a => a.id === m.assessmentId);
                            if (assessment && assessment.maxScore > 0) {
                                totalPercentage += (m.score / assessment.maxScore);
                            }
                        }
                        const avgPercentage = totalPercentage / subjectMarks.length;
                        const predictedScore = Math.round(avgPercentage * selectedAssessment.maxScore * 10) / 10;
                        predictions.push({ id: student.id, score: predictedScore });
                    }
                }

                let count = 0;
                for (const p of predictions) {
                    handleMarkChange(p.id, p.score.toString());
                    count++;
                }
                message.success(t('teacher.predictionSuccess', { count }));
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
            render: (_, record) => (
                <Input
                    type="number"
                    placeholder={selectedAssessment ? `0-${selectedAssessment.maxScore}` : ''}
                    value={marks[record.id] || ''}
                    onChange={e => handleMarkChange(record.id, e.target.value)}
                    style={{ textAlign: 'right' }}
                    max={selectedAssessment?.maxScore}
                    min={0}
                />
            )
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
            <div>
                <Title level={2}>{t('teacher.speedEntryMarks')}</Title>
                <Text type="secondary">{t('teacher.enterMarksInfo')}</Text>
            </div>

            {contextHolder}
            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form layout="vertical">
                    <Row gutter={16} align="bottom">
                        <Col xs={24} md={8}>
                            <Form.Item label={t('teacher.selectGrade')} style={{ marginBottom: 0 }}>
                                <Select
                                    placeholder={t('teacher.selectGrade')}
                                    value={selectedGrade}
                                    onChange={(val) => {
                                        setSelectedGrade(val);
                                        setSelectedAssessmentId('');
                                    }}
                                    options={gradeOptions}
                                    allowClear
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item label={t('teacher.selectAssessment')} style={{ marginBottom: 0 }}>
                                <Select
                                    placeholder={t('teacher.selectAssessment')}
                                    value={selectedAssessmentId}
                                    onChange={setSelectedAssessmentId}
                                    options={Object.entries(
                                        filteredAssessments.reduce((acc, a) => {
                                            const subject = allSubjects.find(s => s.name === a.subjectName);
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
                                    disabled={!selectedGrade}
                                />
                            </Form.Item>
                        </Col>
                        {selectedAssessment && (
                            <Col xs={24} md={8}>
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded flex justify-between items-center h-[32px]">
                                    <Text strong className="text-blue-700 dark:text-blue-300">
                                        {t('admin.maxScore')}: {selectedAssessment.maxScore}
                                    </Text>
                                    <Text type="secondary" size="small">
                                        {selectedAssessment.date}
                                    </Text>
                                </div>
                            </Col>
                        )}
                    </Row>
                </Form>
            </Card>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-6 mb-4 w-full">
                <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    {t('teacher.studentsList', 'Students List')}
                    <Tag color="blue" style={{ marginLeft: '12px' }}>
                        {selectedAssessmentId
                            ? (searchQuery
                                ? `${studentsInGrade.length} / ${allStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade)).length}`
                                : studentsInGrade.length)
                            : '—'}
                    </Tag>
                </Title>
                <div className="hidden sm:block flex-grow border-t border-slate-200 dark:border-slate-700 mx-2"></div>
                <Input
                    placeholder={t('common.search', 'Search students...')}
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
                            onClick={handleSaveMarks}
                            loading={isSaving}
                            disabled={!selectedAssessmentId || studentsInGrade.length === 0}
                        >
                            {t('common.save', 'Save Marks')}
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
                        <Empty description={t('teacher.selectAssessment', 'Select an assessment to start entering marks.')} />
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
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
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
    const [attendanceDate, setAttendanceDate] = useState(() => sessionStorage.getItem('sem_att_date') || dayjs().format('YYYY-MM-DD'));
    const [attendance, setAttendance] = useState({});
    const [modifiedAttendance, setModifiedAttendance] = useState(new Set());
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');


    // Keep sessionStorage in sync
    useEffect(() => { sessionStorage.setItem('sem_att_grade', selectedGrade); }, [selectedGrade]);
    useEffect(() => { sessionStorage.setItem('sem_att_date', attendanceDate); }, [attendanceDate]);

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    const allStudents = allStudentsData || [];
    const isLoading = allStudentsData === undefined;
    const currentSemesterSetting = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';
    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades2 = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions2 = dbGrades2
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const allowedGrades = Array.isArray(teacher?.assignedGrades) ? teacher.assignedGrades : [];
    const gradeOptions2Unrestricted = [...GRADE_OPTIONS, ...extraGradeOptions2];
    const gradeOptions2 = allowedGrades.length > 0
        ? gradeOptions2Unrestricted.filter(o => allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(o.value)))
        : gradeOptions2Unrestricted;
    const studentsInGrade = allStudents
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

            const attMap = {};
            records.forEach(r => {
                attMap[r.studentId] = r.status;
            });
            setAttendance(attMap);
            setModifiedAttendance(new Set()); // Clear modified attendance on date/grade change
        }
        loadAttendance();
    }, [selectedGrade, attendanceDate]);

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
            message.info(t('teacher.noChanges', 'No changes to save.'));
            return;
        }

        setIsSaving(true);
        try {
            const idsToDelete = [];
            for (const studentId of modifiedAttendance) {
                const status = attendance[studentId];
                // If status is undefined (e.g., cleared), delete the record
                if (!status) {
                    const existingRecord = await db.attendance
                        .where('[studentId+date]')
                        .equals([studentId, attendanceDate])
                        .first();
                    if (existingRecord) {
                        idsToDelete.push(existingRecord.id);
                        await db.attendance.delete(existingRecord.id);
                    }
                    continue;
                }

                const existingRecord = await db.attendance
                    .where('[studentId+date]')
                    .equals([studentId, attendanceDate])
                    .first();

                if (existingRecord) {
                    await db.attendance.update(existingRecord.id, { status, semester: currentSemesterSetting, synced: 0 });
                } else {
                    await db.attendance.add({
                        id: crypto.randomUUID(),
                        studentId: studentId,
                        date: attendanceDate,
                        status,
                        semester: currentSemesterSetting,
                        synced: 0
                    });
                }
            }

            // Perform explicit Supabase deletion for cleared attendance (Plan B)
            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from('attendance').delete().in('id', idsToDelete);
                if (delError) console.warn("Supabase attendance deletion warning:", delError);
            }

            setModifiedAttendance(new Set());
            message.success(t('teacher.saveSuccess', 'Attendance saved successfully!'));
            syncData().catch(console.error);
        } catch (err) {
            console.error("Attendance save failed:", err);
            message.error(t('teacher.saveError', 'Failed to save attendance!'));
        } finally {
            setIsSaving(false);
        }
    }; const handleMarkAllPresent = () => {
        if (!selectedGrade || studentsInGrade.length === 0) return;

        for (const student of studentsInGrade) {
            handleAttendanceChange(student.id, 'present');
        }
        message.success(t('teacher.markAllPresentSuccess', 'Successfully marked all as present locally. Click Save to persist.'));
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
        message.success(t('teacher.attendanceCleared', 'Attendance cleared locally. Click Save to persist.'));
    };

    const handleScanSuccess = async (decodedText) => {
        // decodedText is the studentId
        const student = allStudents.find(s => s.id === decodedText);
        if (!student) {
            message.error(t('teacher.studentNotFound'));
            return;
        }

        // Only record if student is in the selected grade (or if no grade selected, just record it)
        if (selectedGrade && normalizeGrade(student.grade) !== normalizeGrade(selectedGrade)) {
            message.warning(`Student is from ${formatGrade(student.grade)}, not ${formatGrade(selectedGrade)}`);
            // Still record it though, as they are present
        }

        await handleAttendanceChange(student.id, 'present');
        notification.success({
            message: t('teacher.scanSuccess', { name: student.name }),
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
        <div className="flex flex-col gap-6 w-full">
            <div>
                <Title level={2}>{t('teacher.attendanceModule')}</Title>
                <Text type="secondary">{t('teacher.recordAttendanceInfo')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form layout="vertical">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12}>
                            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm h-full">
                                <Space orientation="vertical" className="w-full">
                                    <Text strong type="secondary">{t('teacher.selectGrade')}</Text>
                                    <Select
                                        value={selectedGrade}
                                        onChange={(value) => {
                                            setSelectedGrade(value);
                                            setSelectedAssessmentId('');
                                        }}
                                        style={{ width: '100%' }}
                                        size="large"
                                        options={gradeOptions2}
                                        placeholder="Choose a grade"
                                    />
                                </Space>
                            </Card>
                        </Col>

                        <Col xs={24} sm={12}>
                            <Card className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm h-full flex flex-col justify-center">
                                {selectedGrade && currentSemesterSetting && allowedSubjects.length > 0 && allowedGrades.length > 0 ? (
                                    <Space orientation="vertical" className="w-full">
                                        <Text strong type="secondary">{t('teacher.selectAssessment')}</Text>
                                        <Select
                                            value={selectedAssessmentId}
                                            onChange={setSelectedAssessmentId}
                                            style={{ width: '100%' }}
                                            size="large"
                                            placeholder="Choose an assessment to grade"
                                        >
                                            {filteredAssessments.map(a => (
                                                <Option key={a.id} value={a.id}>
                                                    <div className="flex justify-between items-center w-full">
                                                        <span>{a.subjectName} - {a.name}</span>
                                                        <Badge count={`${a.maxScore} pts`} style={{ backgroundColor: '#52c41a' }} />
                                                    </div>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Space>
                                ) : (
                                    <div className="text-center w-full py-2">
                                        <Text type="secondary">
                                            {!currentSemesterSetting ? 'Please ask admin to set Semester' : !selectedGrade ? 'First, select a grade' : 'No subjects/grades assigned to you'}
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
                                />
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
                                        {t('common.save', 'Save Attendance')}
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
                    {t('teacher.studentsList', 'Students List')}
                    <Tag color="blue" style={{ marginLeft: '12px' }}>
                        {searchQuery ? `${studentsInGrade.length} / ${allStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade)).length}` : studentsInGrade.length}
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
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
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
                        {t('teacher.stopScanning', 'Stop Camera')}
                    </Button>
                </div>
            )}
        </Card>
    );
}
