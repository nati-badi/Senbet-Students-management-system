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
    HomeOutlined
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
    DatePicker
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import dayjs from 'dayjs';
import { Html5QrcodeScanner } from 'html5-qrcode';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

// Fixed grade options (must match AdminDashboard)
// Fixed grade options: store as number, label in Amharic
const GRADE_OPTIONS = [
    { value: '1', label: '1ኛ ክፍል' },
    { value: '2', label: '2ኛ ክፍል' },
    { value: '3', label: '3ኛ ክፍል' },
    { value: '4', label: '4ኛ ክፍል' },
    { value: '5', label: '5ኛ ክፍል' },
    { value: '6', label: '6ኛ ክፍል' },
    { value: '7', label: '7ኛ ክፍል' },
    { value: '8', label: '8ኛ ክፍል' },
    { value: '9', label: '9ኛ ክፍል' },
    { value: '10', label: '10ኛ ክፍል' },
    { value: '11', label: '11ኛ ክፍል' },
    { value: '12', label: '12ኛ ክፍል' },
    { value: '13', label: '12+ (ሌላ)' },
];

const formatGrade = (grade) => {
    if (!grade) return '';
    const s = String(grade);
    const option = GRADE_OPTIONS.find(o => o.value === s);
    if (option) return option.label;
    if (s.includes('ኛ ክፍል')) return s;
    return `${s}ኛ ክፍል`;
};

const normalizeGrade = (rawGrade) => {
    if (!rawGrade) return '';
    const s = String(rawGrade).toLowerCase().trim();
    // Match "1", "Grade 1", "1ኛ ክፍል", etc.
    const match = s.match(/(\d+)/);
    if (match) {
        const num = match[1];
        if (parseInt(num) >= 1 && parseInt(num) <= 12) return num;
        if (parseInt(num) > 12) return '13';
    }
    if (s.includes('ሌላ') || s.includes('other') || s.includes('12+')) return '13';
    return rawGrade; // fallback
};

export default function TeacherDashboard() {
    const location = useLocation();
    const { t } = useTranslation();
    const navigate = useNavigate();

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

            <Content className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 min-h-[600px]">
                <Routes>
                    <Route path="/" element={<SpeedEntryMarks />} />
                    <Route path="/attendance" element={<AttendanceModule />} />
                </Routes>
            </Content>
        </Layout>
    );
}

function SpeedEntryMarks() {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
    const [localMarks, setLocalMarks] = useState({});

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const assessmentsData = useLiveQuery(() => db.assessments.toArray());
    const allStudents = allStudentsData || [];
    const allAssessments = assessmentsData || [];
    const isLoading = allStudentsData === undefined || assessmentsData === undefined;

    const filteredAssessments = allAssessments.filter(a => normalizeGrade(a.grade) === normalizeGrade(selectedGrade));
    const selectedAssessment = allAssessments.find(a => a.id === selectedAssessmentId);

    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions = dbGrades
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const gradeOptions = [...GRADE_OPTIONS, ...extraGradeOptions];
    const studentsInGrade = allStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade));

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
            title: t('teacher.score'),
            key: 'score',
            align: 'right',
            width: 150,
            render: (_, record) => (
                <Input
                    type="number"
                    placeholder={`0-${selectedAssessment?.maxScore || 100}`}
                    value={localMarks[record.id] || ''}
                    onChange={e => handleMarkChange(record.id, e.target.value)}
                    style={{ textAlign: 'right' }}
                    max={selectedAssessment?.maxScore}
                    min={0}
                />
            )
        },
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div>
                <Title level={2}>{t('teacher.speedEntryMarks')}</Title>
                <Text type="secondary">{t('teacher.enterMarksInfo')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
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
                                    label: `${a.name} (${a.subjectName})`
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
            </Card>

            {isLoading ? (
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg border border-slate-100 dark:border-slate-700 space-y-4 shadow-sm text-center">
                    <Skeleton active paragraph={{ rows: 5 }} />
                </div>
            ) : (
                <Table
                    columns={columns}
                    dataSource={studentsInGrade}
                    rowKey="id"
                    pagination={false}
                    className="shadow-sm rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700"
                    locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
                />
            )}
        </div>
    );
}

function AttendanceModule() {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [localAttendance, setLocalAttendance] = useState({});

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const allStudents = allStudentsData || [];
    const isLoading = allStudentsData === undefined;
    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades2 = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const extraGradeOptions2 = dbGrades2
        .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
        .map(g => ({ value: String(g), label: formatGrade(g) }));

    const gradeOptions2 = [...GRADE_OPTIONS, ...extraGradeOptions2];
    const studentsInGrade = allStudents.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade));

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
                        buttonStyle="solid"
                        size="small"
                    >
                        <Radio.Button value="present" className="cursor-pointer">
                            <CheckOutlined /> {t('teacher.present')}
                        </Radio.Button>
                        <Radio.Button value="late" className="cursor-pointer">
                            <ClockCircleOutlined /> {t('teacher.late')}
                        </Radio.Button>
                        <Radio.Button value="absent" className="cursor-pointer">
                            <CloseOutlined /> {t('teacher.absent')}
                        </Radio.Button>
                    </Radio.Group>
                );
            }
        },
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div>
                <Title level={2}>{t('teacher.attendanceModule')}</Title>
                <Text type="secondary">{t('teacher.recordAttendanceInfo')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Row gutter={16} align="bottom">
                    <Col xs={24} md={8}>
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
                    <Col xs={24} md={8}>
                        <Form.Item label={t('teacher.date')} style={{ marginBottom: 0 }}>
                            <DatePicker
                                style={{ width: '100%' }}
                                value={dayjs(attendanceDate)}
                                onChange={(date) => setAttendanceDate(date ? date.format('YYYY-MM-DD') : '')}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Space className="w-full">
                            <Button
                                icon={<TeamOutlined />}
                                onClick={handleMarkAllPresent}
                                disabled={!selectedGrade || studentsInGrade.length === 0}
                                className="w-full"
                            >
                                {t('teacher.markAllPresent')}
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <QRScanner onScanSuccess={handleScanSuccess} />

            {isLoading ? (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm text-center">
                    <Skeleton active paragraph={{ rows: 5 }} />
                </div>
            ) : (
                <Table
                    columns={columns}
                    dataSource={studentsInGrade}
                    rowKey="id"
                    pagination={false}
                    className="shadow-sm rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700"
                    locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
                />
            )}
        </div>
    );
}

function QRScanner({ onScanSuccess }) {
    const [isScanning, setIsScanning] = useState(false);
    const { t } = useTranslation();
    const scannerRef = useRef(null);

    useEffect(() => {
        if (isScanning) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            scanner.render(onScanSuccess, (err) => {
                // Ignore silent errors
            });
            scannerRef.current = scanner;
        } else {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
                scannerRef.current = null;
            }
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(err => console.error("Failed to clear scanner on unmount", err));
            }
        };
    }, [isScanning]);

    return (
        <Card className="bg-slate-900 border-slate-800 overflow-hidden relative min-h-[100px] flex flex-col items-center justify-center mb-6">
            {!isScanning ? (
                <Button
                    type="primary"
                    size="large"
                    icon={<ScanOutlined />}
                    onClick={() => setIsScanning(true)}
                    className="h-16 px-12 text-lg rounded-full shadow-lg hover:scale-105 transition-transform"
                >
                    {t('teacher.scanID')}
                </Button>
            ) : (
                <div className="w-full max-w-[500px] flex flex-col items-center">
                    <div id="reader" className="w-full bg-black rounded-xl overflow-hidden mb-4"></div>
                    <Button
                        danger
                        onClick={() => setIsScanning(false)}
                        className="rounded-full"
                    >
                        {t('teacher.stopScanning')}
                    </Button>
                </div>
            )}
        </Card>
    );
}
