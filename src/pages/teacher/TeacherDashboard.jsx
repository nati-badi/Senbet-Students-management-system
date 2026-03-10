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
    SearchOutlined
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
    Modal
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import dayjs from 'dayjs';
import { Scanner } from '@yudiel/react-qr-scanner';
import StudentProfile from '../../components/StudentProfile';
import { GRADE_OPTIONS, formatGrade, normalizeGrade } from '../../utils/gradeUtils';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;


export default function TeacherDashboard() {
    const location = useLocation();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [profileStudentId, setProfileStudentId] = useState(null);

    const menuItems = [
        {
            key: '/',
            icon: <HomeOutlined />,
            label: <Link to="/">{t('app.title')}</Link>
        },
        {
            key: '/teacher',
            icon: <EditOutlined />,
            label: <Link to="/teacher">{t('teacher.markEntry')}</Link>
        },
        {
            key: '/teacher/attendance',
            icon: <CheckCircleOutlined />,
            label: <Link to="/teacher/attendance">{t('teacher.attendance')}</Link>
        },
    ];

    return (
        <div className="flex flex-col w-full h-full">
            {/* Mobile Navigation */}
            <div className="md:hidden mb-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Menu
                    mode="horizontal"
                    selectedKeys={[location.pathname === '/teacher/' ? '/teacher' : location.pathname]}
                    items={menuItems}
                    className="border-none w-full overflow-x-auto flex-nowrap hide-scrollbar"
                />
            </div>

            <Layout className="bg-transparent">
                <Sider
                    width={240}
                    style={{ flexShrink: 0 }}
                    className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 mr-6 hidden md:block"
                >
                    <div style={{ padding: '16px' }}>
                        <Text strong type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                            {t('teacher.menu')}
                        </Text>
                    </div>
                    <Menu
                        mode="inline"
                        selectedKeys={[location.pathname === '/teacher/' ? '/teacher' : location.pathname]}
                        items={menuItems}
                        className="border-none"
                    />
                </Sider>

                <Content className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 md:p-6 min-h-[600px] w-full overflow-hidden">
                    <Routes>
                        <Route path="/" element={<SpeedEntryMarks setProfileStudentId={setProfileStudentId} />} />
                        <Route path="/attendance" element={<AttendanceModule setProfileStudentId={setProfileStudentId} />} />
                    </Routes>
                </Content>
            </Layout>

            <StudentProfile
                studentId={profileStudentId}
                visible={!!profileStudentId}
                onClose={() => setProfileStudentId(null)}
            />
        </div>

    );
}

function SpeedEntryMarks({ setProfileStudentId }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
    const [localMarks, setLocalMarks] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const assessmentsData = useLiveQuery(() => db.assessments.toArray());
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    
    const allStudents = allStudentsData || [];
    const allAssessments = assessmentsData || [];
    const isLoading = allStudentsData === undefined || assessmentsData === undefined;

    const currentSemesterSetting = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    // Only allow teachers to grade assessments that match the current active semester
    const filteredAssessments = allAssessments.filter(a => 
        normalizeGrade(a.grade) === normalizeGrade(selectedGrade) && 
        (a.semester || 'Semester I') === currentSemesterSetting
    );
    const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);

    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions = dbGrades
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const gradeOptions = [...GRADE_OPTIONS, ...extraGradeOptions];
    const studentsInGrade = allStudents
        .filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade))
        .filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q);
        });

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
            setLocalMarks(markMap);
        }
        loadMarks();
    }, [selectedAssessmentId]);

    const handleMarkChange = async (studentId, value) => {
        const score = parseFloat(value);
        setLocalMarks(prev => ({ ...prev, [studentId]: value }));

        if (isNaN(score)) return;

        if (selectedAssessment && score > selectedAssessment.maxScore) {
            message.warning(t('teacher.invalidScoreRange', { max: selectedAssessment.maxScore }));
            return;
        }

        try {
            const existingMark = await db.marks
                .where('[studentId+assessmentId]').equals([studentId, selectedAssessmentId])
                .first();

            if (existingMark) {
                await db.marks.update(existingMark.id, { score, synced: 0 });
            } else {
                await db.marks.add({
                    id: crypto.randomUUID(),
                    studentId,
                    assessmentId: selectedAssessmentId,
                    subject: selectedAssessment.subjectName,
                    assessmentDate: selectedAssessment.date,
                    score,
                    synced: 0
                });
            }
        } catch (err) {
            console.error("Auto-save failed:", err);
            message.error("Failed to save mark offline!");
        }
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
                    value={localMarks[record.id] || ''}
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
                                    options={filteredAssessments.map(a => ({
                                        value: a.id,
                                        label: `${a.name} (${a.subjectName}) - ${t(`admin.${a.semester === 'Semester I' ? 'semester1' : 'semester2'}`, a.semester || 'Semester I')}`
                                    }))}
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
                        pagination={false}
                        scroll={{ x: 'max-content', y: 500 }}
                        className="students-table w-full"
                        locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
                    />
                )}
            </div>
        </div>
    );
}

function AttendanceModule({ setProfileStudentId }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [localAttendance, setLocalAttendance] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const allStudents = allStudentsData || [];
    const isLoading = allStudentsData === undefined;
    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades2 = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions2 = dbGrades2
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const gradeOptions2 = [...GRADE_OPTIONS, ...extraGradeOptions2];
    const studentsInGrade = allStudents
        .filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade))
        .filter(s => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return s.name?.toLowerCase().includes(q) || s.id?.toLowerCase().includes(q);
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
            setLocalAttendance(attMap);
        }
        loadAttendance();
    }, [selectedGrade, attendanceDate]);

    const handleAttendanceChange = async (studentId, status) => {
        setLocalAttendance(prev => ({ ...prev, [studentId]: status }));

        try {
            const existingRecord = await db.attendance
                .filter(a => a.studentId === studentId && a.date === attendanceDate)
                .first();

            if (existingRecord) {
                await db.attendance.update(existingRecord.id, { status, synced: 0 });
            } else {
                await db.attendance.add({
                    id: crypto.randomUUID(),
                    studentId,
                    date: attendanceDate,
                    status,
                    synced: 0
                });
            }
        } catch (err) {
            console.error("Attendance save failed:", err);
            message.error("Failed to save attendance!");
        }
    };

    const handleMarkAllPresent = async () => {
        if (!selectedGrade || studentsInGrade.length === 0) return;

        const newAttendance = { ...localAttendance };
        try {
            for (const student of studentsInGrade) {
                newAttendance[student.id] = 'present';
                const existingRecord = await db.attendance
                    .filter(a => a.studentId === student.id && a.date === attendanceDate)
                    .first();

                if (existingRecord) {
                    await db.attendance.update(existingRecord.id, { status: 'present', synced: 0 });
                } else {
                    await db.attendance.add({
                        id: crypto.randomUUID(),
                        studentId: student.id,
                        date: attendanceDate,
                        status: 'present',
                        synced: 0
                    });
                }
            }
            setLocalAttendance(newAttendance);
            message.success(t('teacher.markAllPresentSuccess', 'Successfully marked all as present'));
        } catch (err) {
            console.error("Bulk attendance failed:", err);
            message.error("Failed to update all students.");
        }
    };

    const handleClearAttendance = async () => {
        if (!selectedGrade || studentsInGrade.length === 0) return;

        const newAttendance = { ...localAttendance };
        try {
            for (const student of studentsInGrade) {
                delete newAttendance[student.id];
                const existingRecord = await db.attendance
                    .filter(a => a.studentId === student.id && a.date === attendanceDate)
                    .first();

                if (existingRecord) {
                    await db.attendance.delete(existingRecord.id);
                }
            }
            setLocalAttendance(newAttendance);
            message.success(t('teacher.clearAttendanceSuccess', 'Attendance cleared successfully'));
        } catch (err) {
            console.error("Clear attendance failed:", err);
            message.error("Failed to clear attendance.");
        }
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
                const currentStatus = localAttendance[record.id] || 'present';
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
                    <Row gutter={[16, 16]} align="bottom">
                        <Col xs={24} sm={12} lg={6}>
                            <Form.Item label={t('teacher.selectGrade')} style={{ marginBottom: 0 }}>
                                <Select
                                    placeholder={t('teacher.selectGrade')}
                                    value={selectedGrade}
                                    onChange={setSelectedGrade}
                                    options={gradeOptions2}
                                    allowClear
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
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
                                        icon={<DeleteOutlined />}
                                        onClick={handleClearAttendance}
                                        disabled={!selectedGrade || studentsInGrade.length === 0}
                                        danger
                                    >
                                        {t('teacher.clearAttendance')}
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<TeamOutlined />}
                                        onClick={handleMarkAllPresent}
                                        disabled={!selectedGrade || studentsInGrade.length === 0}
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
                        pagination={false}
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
