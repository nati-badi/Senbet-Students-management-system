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
const GRADE_OPTIONS = [
    { value: '1ኛ ክፍል', label: '1ኛ ክፍል' },
    { value: '2ኛ ክፍል', label: '2ኛ ክፍል' },
    { value: '3ኛ ክፍል', label: '3ኛ ክፍል' },
    { value: '4ኛ ክፍል', label: '4ኛ ክፍል' },
    { value: '5ኛ ክፍል', label: '5ኛ ክፍል' },
    { value: '6ኛ ክፍል', label: '6ኛ ክፍል' },
    { value: '7ኛ ክፍል', label: '7ኛ ክፍል' },
    { value: '8ኛ ክፍል', label: '8ኛ ክፍል' },
    { value: '9ኛ ክፍል', label: '9ኛ ክፍል' },
    { value: '10ኛ ክፍል', label: '10ኛ ክፍል' },
    { value: '11ኛ ክፍል', label: '11ኛ ክፍል' },
    { value: '12ኛ ክፍል', label: '12ኛ ክፍል' },
    { value: '12+ (ሌላ)', label: '12+ (ሌላ)' },
];

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
    const [subject, setSubject] = useState('');
    const [assessmentDate, setAssessmentDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [localMarks, setLocalMarks] = useState({});

    const allStudentsData = useLiveQuery(() => db.students.toArray());
    const allStudents = allStudentsData || [];
    const isLoading = allStudentsData === undefined;
    // Build grade list: fixed GRADE_OPTIONS + any extra grades already in DB
    const dbGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
    const gradeOptions = [
        ...GRADE_OPTIONS,
        ...dbGrades.filter(g => !GRADE_OPTIONS.some(o => o.value === g)).map(g => ({ value: g, label: g }))
    ];
    const studentsInGrade = allStudents.filter(s => s.grade === selectedGrade);

    useEffect(() => {
        if (!selectedGrade || !subject || !assessmentDate) return;

        async function loadMarks() {
            const marks = await db.marks
                .where('assessmentDate').equals(assessmentDate)
                .toArray();

            const matchingMarks = marks.filter(m => m.subject === subject);
            const markMap = {};
            matchingMarks.forEach(m => {
                markMap[m.studentId] = m.score;
            });
            setLocalMarks(markMap);
        }
        loadMarks();
    }, [selectedGrade, subject, assessmentDate]);

    const handleMarkChange = async (studentId, value) => {
        const score = parseFloat(value);
        setLocalMarks(prev => ({ ...prev, [studentId]: value }));

        if (isNaN(score)) return;

        try {
            const existingMark = await db.marks
                .filter(m => m.studentId === studentId && m.subject === subject && m.assessmentDate === assessmentDate)
                .first();

            if (existingMark) {
                await db.marks.update(existingMark.id, { score, synced: 0 });
            } else {
                await db.marks.add({
                    id: crypto.randomUUID(),
                    studentId,
                    subject,
                    assessmentDate,
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
        {
            title: t('teacher.score'),
            key: 'score',
            align: 'right',
            width: 150,
            render: (_, record) => (
                <Input
                    type="number"
                    placeholder="0-100"
                    value={localMarks[record.id] || ''}
                    onChange={e => handleMarkChange(record.id, e.target.value)}
                    style={{ textAlign: 'right' }}
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
                <Row gutter={16}>
                    <Col xs={24} md={8}>
                        <Form.Item label={t('teacher.selectGrade')} style={{ marginBottom: 0 }}>
                            <Select
                                placeholder={t('teacher.selectGrade')}
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                options={gradeOptions}
                                allowClear
                                showSearch
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item label={t('teacher.subject')} style={{ marginBottom: 0 }}>
                            <Input
                                placeholder="e.g. Math"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                        <Form.Item label={t('teacher.date')} style={{ marginBottom: 0 }}>
                            <DatePicker
                                style={{ width: '100%' }}
                                value={dayjs(assessmentDate)}
                                onChange={(date) => setAssessmentDate(date ? date.format('YYYY-MM-DD') : '')}
                            />
                        </Form.Item>
                    </Col>
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
    const gradeOptions2 = [
        ...GRADE_OPTIONS,
        ...dbGrades2.filter(g => !GRADE_OPTIONS.some(o => o.value === g)).map(g => ({ value: g, label: g }))
    ];
    const studentsInGrade = allStudents.filter(s => s.grade === selectedGrade);

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
        if (selectedGrade && student.grade !== selectedGrade) {
            message.warning(`Student is from ${student.grade}, not ${selectedGrade}`);
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
