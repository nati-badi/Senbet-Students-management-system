import { useState, useEffect } from 'react';
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
    CloseOutlined
} from '@ant-design/icons';
import {
    Layout,
    Menu,
    Typography,
    Space,
    Card,
    Select,
    Input,
    Table,
    Button,
    Row,
    Col,
    Tag,
    Divider,
    message,
    Empty,
    Radio,
    DatePicker
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

export default function TeacherDashboard() {
    const location = useLocation();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const menuItems = [
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
            <Sider width={240} className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mr-6 hidden md:block transition-colors">
                <div style={{ padding: '16px' }}>
                    <Text strong type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                        {t('teacher.menu')}
                    </Text>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    className="border-none"
                    onClick={({ key }) => navigate(key)}
                />
            </Sider>

            <Content className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 min-h-[600px] transition-colors">
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

    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const uniqueGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
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

            <Card className="bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 transition-colors">
                <Row gutter={16}>
                    <Col xs={24} md={8}>
                        <Form.Item label={t('teacher.selectGrade')} style={{ marginBottom: 0 }}>
                            <Select
                                placeholder={t('teacher.selectGrade')}
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                options={uniqueGrades.map(g => ({ value: g, label: g }))}
                                allowClear
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

            <Table
                columns={columns}
                dataSource={studentsInGrade}
                rowKey="id"
                pagination={false}
                className="shadow-sm rounded-lg overflow-hidden border border-slate-100"
                locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
            />
        </div>
    );
}

function AttendanceModule() {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [localAttendance, setLocalAttendance] = useState({});

    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const uniqueGrades = [...new Set(allStudents.map(s => s.grade))].filter(Boolean);
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

            <Card className="bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 transition-colors">
                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item label={t('teacher.selectGrade')} style={{ marginBottom: 0 }}>
                            <Select
                                placeholder={t('teacher.selectGrade')}
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                options={uniqueGrades.map(g => ({ value: g, label: g }))}
                                allowClear
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item label={t('teacher.date')} style={{ marginBottom: 0 }}>
                            <DatePicker
                                style={{ width: '100%' }}
                                value={dayjs(attendanceDate)}
                                onChange={(date) => setAttendanceDate(date ? date.format('YYYY-MM-DD') : '')}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>

            <Table
                columns={columns}
                dataSource={studentsInGrade}
                rowKey="id"
                pagination={false}
                className="shadow-sm rounded-lg overflow-hidden border border-slate-100"
                locale={{ emptyText: <Empty description={selectedGrade ? t('teacher.noStudentsInGrade') : t('teacher.selectGrade')} /> }}
            />
        </div>
    );
}
