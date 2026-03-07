import { useState, useRef, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    UserAddOutlined,
    FilePdfOutlined,
    DatabaseOutlined,
    DeleteOutlined,
    UploadOutlined,
    SearchOutlined,
    FilterOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    PlusOutlined,
    LockOutlined,
    DownloadOutlined,
    WarningOutlined,
    IdcardOutlined,
    HomeOutlined,
    BookOutlined
} from '@ant-design/icons';
import {
    Table,
    Button,
    Input,
    Select,
    Space,
    Card,
    Typography,
    Form,
    Row,
    Col,
    Upload,
    message,
    Popconfirm,
    Modal,
    Tag,
    Divider,
    Empty,
    Tooltip,
    Layout,
    Menu,
    notification,
    DatePicker,
    Skeleton
} from 'antd';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { API_BASE } from '../utils/sync';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';

const { Title, Text } = Typography;
const { Content, Sider } = Layout;

// Fixed grade options for 1-12 + extra
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

// Validators
const validateAmharic = (_, value) => {
    if (!value) return Promise.resolve();
    // Allow both Ethiopic and standard Latin characters/spaces
    // This makes the system more flexible while still supporting Amharic
    return Promise.resolve();
};

const validateEthiopianPhone = (_, value) => {
    if (!value) return Promise.resolve(); // optional field
    const cleaned = value.replace(/\s/g, '');
    if (!/^\d{10}$/.test(cleaned)) return Promise.reject('ስልክ ቁጥር 10 አሃዝ መሆን አለበት (ለምሳሌ 0911234567)');
    if (!/^(09|07)/.test(cleaned)) return Promise.reject('ስልክ ቁጥር 09 ወይም 07 ሲጀምር ብቻ ትክክለኛ ነው');
    return Promise.resolve();
};

export default function AdminDashboard() {
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
            key: '/admin',
            icon: <UserAddOutlined />,
            label: <Link to="/admin">{t('admin.registerStudents')}</Link>
        },
        {
            key: '/admin/certificates',
            icon: <FilePdfOutlined />,
            label: <Link to="/admin/certificates">{t('admin.certificates')}</Link>
        },
        {
            key: '/admin/id-cards',
            icon: <IdcardOutlined />,
            label: <Link to="/admin/id-cards">{t('admin.idCards')}</Link>
        },
        {
            key: '/admin/data',
            icon: <DatabaseOutlined />,
            label: <Link to="/admin/data">{t('admin.systemData')}</Link>
        },
        {
            key: '/admin/subjects',
            icon: <BookOutlined />,
            label: <Link to="/admin/subjects">{t('admin.subjects')}</Link>
        },
        {
            key: '/admin/assessments',
            icon: <FilePdfOutlined />,
            label: <Link to="/admin/assessments">{t('admin.assessments')}</Link>
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
                        {t('admin.menu')}
                    </Text>
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={[location.pathname === '/admin/' ? '/admin' : location.pathname]}
                    items={menuItems}
                    className="border-none"
                />
            </Sider>

            <Content className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 min-h-[600px]">
                <Routes>
                    <Route path="/" element={<StudentRegistration />} />
                    <Route path="/certificates" element={<DocumentGenerator type="certificate" />} />
                    <Route path="/id-cards" element={<DocumentGenerator type="id-card" />} />
                    <Route path="/data" element={<SystemDataManagement />} />
                    <Route path="/subjects" element={<SubjectManagement />} />
                    <Route path="/assessments" element={<AssessmentManagement />} />
                    <Route path="/sync" element={<SyncCenter />} />
                </Routes>
            </Content>
        </Layout>
    );
}

function SyncCenter() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Empty description={t('common.comingSoon')} />
        </div>
    );
}

function SystemDataManagement() {
    const { t } = useTranslation();

    const handleWipeDatabase = async () => {
        try {
            // 1. Wipe local Dexie Database in the Browser
            await db.students.clear();
            await db.attendance.clear();
            await db.marks.clear();

            // 2. Wipe central SQLite Database via API gracefully
            if (navigator.onLine) {
                try {
                    const response = await fetch(`${API_BASE}/sync/clear`, {
                        method: 'DELETE',
                    });
                    if (!response.ok) {
                        console.warn("Server warning: wipe returned non-OK status.");
                    }
                } catch (netErr) {
                    console.warn("Could not reach server to wipe master DB:", netErr);
                    // Silently continue since local was wiped
                }
            }

            notification.success({
                message: 'Database Erased',
                description: 'All local data has been completely erased.',
                placement: 'topRight',
                duration: 5,
            });
        } catch (error) {
            notification.error({
                message: 'Wipe Failed',
                description: 'Failed to completely wipe the database. Are you online?',
                placement: 'topRight',
            });
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
            <div>
                <Title level={2}>{t('admin.systemData', 'System Data')}</Title>
                <Text type="secondary">Manage the underlying database system.</Text>
            </div>

            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
                <div className="flex flex-col gap-4 w-full">
                    <div>
                        <Text strong className="text-red-700 dark:text-red-500 text-lg flex items-center gap-2 mb-2">
                            <WarningOutlined /> Danger Zone
                        </Text>
                        <Text className="text-red-600 dark:text-red-400 block mb-4">
                            Wiping the database is an irreversible action. This will permanently delete <strong>ALL</strong> students, attendance records, and marks from both this device and the central server.
                        </Text>

                        <Popconfirm
                            title="Are you absolutely sure?"
                            description="This cannot be undone. All data will be destroyed."
                            onConfirm={handleWipeDatabase}
                            okText="Yes, Wipe Everything"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                danger
                                type="primary"
                                icon={<DeleteOutlined />}
                                size="large"
                                className="cursor-pointer"
                            >
                                Wipe Entire Database
                            </Button>
                        </Popconfirm>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function StudentRegistration() {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);

    const studentsData = useLiveQuery(() => db.students.toArray());
    const students = studentsData || [];
    const isLoadingStudents = studentsData === undefined;

    const handleValuesChange = (_, allValues) => {
        setIsFormValid(!!(allValues.name && allValues.grade));
    };

    // Precise Date Localization using native browser Intl
    const formatEthiopianDate = (dateInput) => {
        const dateObj = (dateInput && typeof dateInput === 'string' && dateInput.includes('T'))
            ? new Date(dateInput)
            : (dateInput ? null : new Date());

        if (!dateObj || isNaN(dateObj.getTime())) return dateInput || '—';

        const isAmharic = (i18n.language || 'am').startsWith('am');
        const locale = isAmharic ? 'am-ET-u-ca-ethiopic' : 'en-ET-u-ca-ethiopic';

        try {
            const formatter = new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            let formatted = formatter.format(dateObj);

            // Clean up English suffix if it outputs generic eras
            if (!isAmharic) {
                formatted = formatted.replace(/(AM|PM|ERA1|ERA0)/gi, '').trim() + ' E.C.';
            }
            return formatted;
        } catch (e) {
            return dateInput || '—';
        }
    };

    const currentEthiopianDateDisplay = formatEthiopianDate();

    // Watch values for real-time preview
    const regDateOfEntry = Form.useWatch('dateOfEntry', form);
    const editDateOfEntry = Form.useWatch('dateOfEntry', editForm);

    // Helper for real-time Ethiopian date preview in forms
    const EthiopianDatePreview = ({ value }) => {
        if (!value) return null;
        try {
            const dateString = value.toISOString();
            return (
                <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                    <span className="notranslate" translate="no">📅 {formatEthiopianDate(dateString)}</span>
                </div>
            );
        } catch (e) {
            return null;
        }
    };

    const disabledDate = (current) => {
        // Can not select days after today
        return current && current > dayjs().endOf('day');
    };

    const handleRegister = async (values) => {
        // Duplicate name check — warn admin but allow override
        const existingWithSameName = students.filter(
            s => s.name.trim().toLowerCase() === values.name.trim().toLowerCase()
        );
        if (existingWithSameName.length > 0) {
            // Use Modal.confirm for a blocking confirmation
            const confirmed = await new Promise(resolve => {
                Modal.confirm({
                    title: 'ይህ ስም በዳታባዚ ውስጥ ተመዘግቡዘል',
                    content: `"‹${values.name}›" ዋነም በዳታባዜው Ꭻሎች ይገኙ። ዘመዘግብዘት ይፈልጋቸሎል?`,
                    okText: 'ዘመዘግብ (ዱቤል)',
                    cancelText: 'ተወሃ',
                    onOk: () => resolve(true),
                    onCancel: () => resolve(false),
                });
            });
            if (!confirmed) return;
        }

        try {
            const academicYear = values.dateOfEntry ? values.dateOfEntry.toISOString() : new Date().toISOString();
            await db.students.add({
                id: crypto.randomUUID(),
                ...values,
                academicYear,
                synced: 0,
            });
            form.resetFields();
            form.setFieldsValue({ dateOfEntry: dayjs() });
            setIsFormValid(false);
            message.success('ተማሪ በተሳካ ሁኙ ተመዘግቷል!');
        } catch (err) {
            console.error("Failed to add student:", err);
            message.error('ተማሪ መዘግበት አልታቸለም።');
        }
    };

    const handleDelete = async (id) => {
        try {
            await db.students.delete(id);
            message.success('Student removed from database.');
        } catch (err) {
            console.error("Failed to delete student:", err);
            message.error('Delete failed.');
        }
    };

    const showEditModal = (student) => {
        setEditingStudent(student);
        editForm.setFieldsValue({
            ...student,
            dateOfEntry: student.academicYear ? dayjs(student.academicYear) : dayjs()
        });
        setIsEditModalVisible(true);
    };

    const handleEditSave = async () => {
        try {
            const values = await editForm.validateFields();
            const academicYear = values.dateOfEntry ? values.dateOfEntry.toISOString() : editingStudent.academicYear;

            await db.students.update(editingStudent.id, {
                ...values,
                academicYear,
                synced: 0
            });
            setIsEditModalVisible(false);
            message.success('Student record updated.');
        } catch (err) {
            console.error("Failed to edit student:", err);
        }
    };

    const downloadTemplate = () => {
        // Amharic column headers so the file matches the expected Ethiopian format
        const headers = [['ሙሉ ስም', 'የክርስትና ስም', 'ፆታ', 'ክፍል', 'የወላጅ ስልክ ቁጥር']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        ws['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 22 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ተማሪዎች');
        XLSX.writeFile(wb, 'Senbet_Students_Template.xlsx');
    };

    const processRows = async (rows) => {
        const bulkStudents = [];
        let errorCount = 0;
        let missingDateCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const keys = Object.keys(row);

            // Detect columns — supports both English and Amharic headers
            const nameKey = keys.find(k => {
                const lk = k.toLowerCase().trim();
                return (lk.includes('name') && !lk.includes('baptismal')) ||
                    lk.includes('ሙሉ ስም') || lk.includes('ስም') || lk.includes('name');
            });
            const baptKey = keys.find(k => {
                const lk = k.toLowerCase().trim();
                return lk.includes('baptismal') || lk.includes('የክርስትና') || lk.includes('ክርስትና');
            });
            const genderKey = keys.find(k => {
                const lk = k.toLowerCase().trim();
                return lk.includes('gender') || lk.includes('sex') || lk.includes('ፆታ');
            });
            const gradeKey = keys.find(k => {
                const lk = k.toLowerCase().trim();
                return lk.includes('grade') || lk.includes('class') || lk.includes('ክፍል');
            });
            const contactKey = keys.find(k => {
                const lk = k.toLowerCase().trim();
                return lk.includes('contact') || lk.includes('phone') || lk.includes('ስልክ');
            });
            // Check if file has a date/year column (English + Amharic)
            const dateKey = keys.find(k => {
                const lk = k.toLowerCase();
                return lk.includes('year') || lk.includes('date') || lk.includes('ዓ.ም') ||
                    lk.includes('academic') || lk.includes('ዓመት') || lk.includes('ቀን');
            });

            if (!nameKey || !gradeKey) {
                notification.error({
                    message: 'Missing Required Columns',
                    description: "የተማሪ 'ስም' (Full Name) ወይም 'ክፍል' (Grade) ኮለሞች አልተገኙም። እባክዎ ፋይሉ ስም እና ክፍል እንዳለው ያረጋግጡ።",
                    placement: 'topRight',
                    duration: 10,
                });
                return; // Stop processing entirely if headers are missing
            }

            const name = String(row[nameKey] ?? '').trim();
            const grade = normalizeGrade(row[gradeKey]);

            if (!name || !grade) { errorCount++; continue; }

            let gender = String(row[genderKey] ?? '').trim();
            gender = (gender && gender.toLowerCase().startsWith('f')) ? 'Female' : 'Male';

            let contact = String(row[contactKey] ?? '').trim();
            // Excel removes leading zeros; if it's 9 digits, it's missing the 0.
            if (contact.length === 9 && !contact.startsWith('0')) {
                contact = '0' + contact;
            }

            // Use date from file if column exists and has a value; otherwise use current date
            let parsedDate = dateKey ? String(row[dateKey] ?? '').trim() : '';
            // If parsedDate is Excel serial date (e.g. 43203) or just digits, fallback to current
            if (parsedDate && /^\d{5}$/.test(parsedDate)) {
                parsedDate = '';
            }
            const academicYear = parsedDate ? parsedDate : new Date().toISOString();
            if (!parsedDate) missingDateCount++;

            bulkStudents.push({
                id: crypto.randomUUID(),
                name,
                baptismalName: String(row[baptKey] ?? '').trim(),
                gender,
                academicYear,
                grade,
                parentContact: contact,
                synced: 0
            });
        }

        if (bulkStudents.length > 0) {
            try {
                await db.students.bulkAdd(bulkStudents);
                if (missingDateCount > 0) {
                    notification.warning({
                        message: 'Import Complete — Date Missing',
                        description: `Imported ${bulkStudents.length} students, but ${missingDateCount} of them have no date. Please edit each student to fill in the date.${errorCount > 0 ? ` Also skipped ${errorCount} rows with missing Name or Grade.` : ''}`,
                        placement: 'topRight',
                        duration: 8,
                    });
                } else {
                    notification.success({
                        message: 'Import Successful',
                        description: `Successfully imported ${bulkStudents.length} students.${errorCount > 0 ? ` Skipped ${errorCount} invalid rows.` : ''}`,
                        placement: 'topRight',
                        duration: 5,
                    });
                }
            } catch (error) {
                console.error('Failed to bulk import:', error);
                notification.error({
                    message: 'Database Error',
                    description: 'Could not save the imported students to the local database.',
                    placement: 'topRight',
                });
            }
        } else {
            notification.warning({
                message: 'No Valid Data Found',
                description: "Check your file format. It must have 'Full Name' (ስም) and 'Grade' (ክፍል) columns.",
                placement: 'topRight',
                duration: 6,
            });
        }
    };

    const handleImportFile = (file) => {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        const isCsv = fileName.endsWith('.csv');

        if (!isExcel && !isCsv) {
            notification.error({
                message: 'Invalid File Type',
                description: 'Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.',
                placement: 'topRight',
            });
            return false;
        }

        if (isExcel) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
                    await processRows(rows);
                } catch (err) {
                    notification.error({
                        message: 'Excel Parse Error',
                        description: `Failed to read the file: ${err.message}`,
                        placement: 'topRight',
                    });
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => { await processRows(results.data); },
                error: (error) => {
                    notification.error({
                        message: 'CSV Parse Error',
                        description: `Failed to read the file: ${error.message}`,
                        placement: 'topRight',
                    });
                }
            });
        }

        return false;
    };

    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);

    // Merge DB grades with fixed GRADE_OPTIONS (keep consistent ordering)
    const allGradeOptions = [
        ...GRADE_OPTIONS,
        ...uniqueGrades
            .filter(g => !GRADE_OPTIONS.some(o => o.value === g))
            .map(g => ({ value: g, label: g })),
    ];

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.baptismalName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.parentContact || "").includes(searchQuery);

        const sGrade = String(student.grade).trim();
        const fGrade = String(filterGrade).trim();

        const matchesGrade = !filterGrade || sGrade === fGrade;

        return matchesSearch && matchesGrade;
    });

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
        { title: t('admin.baptismalName'), dataIndex: 'baptismalName', key: 'baptismalName' },
        {
            title: t('admin.gender'),
            dataIndex: 'gender',
            key: 'gender',
            render: (text) => <Tag color={text === 'Male' ? 'blue' : 'magenta'}>{t(`admin.${text.toLowerCase()}`)}</Tag>
        },
        {
            title: t('admin.grade'),
            dataIndex: 'grade',
            key: 'grade',
            render: (text) => <Tag color="green">{formatGrade(text)}</Tag>
        },
        { title: t('admin.contact'), dataIndex: 'parentContact', key: 'parentContact' },
        {
            title: t('admin.dateOfEntry', 'Date of Entry'),
            dataIndex: 'academicYear',
            key: 'academicYear',
            render: (text) => <span style={{ color: '#64748b', fontSize: '12px' }}>{formatEthiopianDate(text)}</span>
        },
        {
            title: t('common.actions'),
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space>
                    <Tooltip title={t('admin.edit')}>
                        <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => showEditModal(record)}
                            className="cursor-pointer"
                        />
                    </Tooltip>
                    <Popconfirm title="ተማሪውን ይዘርዘዘት?" onConfirm={() => handleDelete(record.id)}>
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            className="cursor-pointer"
                        />
                    </Popconfirm>
                </Space>
            )
        },
    ];

    return (
        <div className="flex flex-col gap-6 w-full min-h-[800px]">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <Title level={2}>{t('admin.registerNewStudent')}</Title>
                    <Text type="secondary">{t('admin.addStudentsDesc')}</Text>
                </div>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form
                    form={form}
                    onFinish={handleRegister}
                    layout="vertical"
                    initialValues={{ gender: 'Male' }}
                    onValuesChange={handleValuesChange}
                >
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.fullName')}
                                name="name"
                                rules={[
                                    { required: true, message: 'ሙሉ ስም ያስፈልጋል' },
                                    { validator: validateAmharic }
                                ]}
                            >
                                <Input placeholder="ለምሳሌ፡ አበበ ከበደ" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.baptismalNameField')}
                                name="baptismalName"
                                rules={[
                                    { required: true, message: 'የክርስትና ስም ያስፈልጋል' },
                                    { validator: validateAmharic }
                                ]}
                            >
                                <Input placeholder="ለምሳሌ፡ ገብረ ማርያም" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gender')} name="gender" rules={[{ required: true }]}>
                                <Select options={[
                                    { value: 'Male', label: t('admin.male') },
                                    { value: 'Female', label: t('admin.female') },
                                ]} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.dateOfEntry', 'Date of Entry')}
                                name="dateOfEntry"
                                initialValue={dayjs()}
                                extra={<EthiopianDatePreview value={regDateOfEntry} />}
                            >
                                <DatePicker
                                    className="w-full cursor-pointer"
                                    format="DD/MM/YYYY"
                                    disabledDate={disabledDate}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true, message: 'ክፍል ያስፈልጋል' }]}>
                                <Select
                                    placeholder="ክፍል ይምረጡ"
                                    options={GRADE_OPTIONS}
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.parentContact')}
                                name="parentContact"
                                rules={[
                                    { required: true, message: 'ስልክ ቁጥር ያስፈልጋል' },
                                    { validator: validateEthiopianPhone }
                                ]}
                            >
                                <Input placeholder="ለምሳሌ፡ 0911234567" maxLength={10} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <div className="flex justify-end mt-4 gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <Button
                            icon={<DownloadOutlined />}
                            size="large"
                            className="cursor-pointer"
                            onClick={downloadTemplate}
                        >
                            {t('admin.downloadTemplate', 'Download Template')}
                        </Button>
                        <Upload
                            accept=".csv,.xlsx,.xls"
                            showUploadList={false}
                            beforeUpload={handleImportFile}
                        >
                            <Button icon={<UploadOutlined />} size="large" className="cursor-pointer">
                                {t('admin.importData')}
                            </Button>
                        </Upload>
                        <Button type="primary" htmlType="submit" size="large" icon={<PlusOutlined />} className="px-8 cursor-pointer" disabled={!isFormValid}>
                            {t('admin.saveStudent')}
                        </Button>
                    </div>
                </Form>
            </Card>

            <div className="flex items-center gap-4 mt-2">
                <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                    {t('admin.enrolledStudents')}
                    <Tag color="blue" style={{ marginLeft: '12px' }}>
                        {(searchQuery || filterGrade) ? `${filteredStudents.length} / ${students.length}` : students.length}
                    </Tag>
                </Title>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between w-full mb-4 gap-4 items-center">
                <Input
                    prefix={<SearchOutlined />}
                    placeholder={t('admin.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    allowClear
                    style={{ width: '100%', maxWidth: 400 }}
                />
                <Select
                    placeholder={t('admin.allGrades')}
                    value={filterGrade}
                    onChange={setFilterGrade}
                    style={{ width: '100%', maxWidth: 200 }}
                    allowClear
                    suffixIcon={<FilterOutlined />}
                    options={allGradeOptions}
                />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-hidden">
                    {isLoadingStudents ? (
                        <div className="p-6 space-y-4">
                            <Skeleton active paragraph={{ rows: 1 }} title={false} />
                            <Skeleton active paragraph={{ rows: 5 }} />
                        </div>
                    ) : (
                        <Table
                            columns={columns}
                            dataSource={filteredStudents}
                            rowKey="id"
                            pagination={false}
                            scroll={{ y: 500 }}
                            className="students-table"
                            locale={{ emptyText: <Empty description={t('admin.noStudentsYet')} /> }}
                        />
                    )}
                </div>
            </div>

            <Modal
                title={t('admin.edit')}
                open={isEditModalVisible}
                onOk={handleEditSave}
                onCancel={() => setIsEditModalVisible(false)}
                okText={t('admin.saveChanges')}
                cancelText={t('admin.cancel')}
            >
                <Form form={editForm} layout="vertical">
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.fullName')}
                                name="name"
                                rules={[
                                    { required: true, message: 'ሙሉ ስም ያስፈልጋል' },
                                    { validator: validateAmharic }
                                ]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.baptismalNameField')}
                                name="baptismalName"
                                rules={[
                                    { required: true, message: 'የክርስትና ስም ያስፈልጋል' },
                                    { validator: validateAmharic }
                                ]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gender')} name="gender" rules={[{ required: true }]}>
                                <Select options={[
                                    { value: 'Male', label: t('admin.male') },
                                    { value: 'Female', label: t('admin.female') },
                                ]} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true, message: 'ክፍል ያስፈልጋል' }]}>
                                <Select
                                    placeholder="ክፍል ይምረጡ"
                                    options={GRADE_OPTIONS}
                                    showSearch
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.parentContact')}
                                name="parentContact"
                                rules={[
                                    { required: true, message: 'ስልክ ቁጥር ያስፈልጋል' },
                                    { validator: validateEthiopianPhone }
                                ]}
                            >
                                <Input maxLength={10} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.dateOfEntry', 'Date of Entry')}
                                name="dateOfEntry"
                                extra={<EthiopianDatePreview value={editDateOfEntry} />}
                            >
                                <DatePicker
                                    className="w-full cursor-pointer"
                                    format="DD/MM/YYYY"
                                    disabledDate={disabledDate}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}

function DocumentGenerator({ type }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const templateRef = useRef(null);

    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const gradeStudents = students.filter(s => s.grade === selectedGrade);

    const handleGenerate = async () => {
        if (!selectedGrade || gradeStudents.length === 0) return;
        setIsGenerating(true);
        const doc = new jsPDF(type === 'id-card' ? 'p' : 'p', 'mm', 'a4');

        try {
            for (let i = 0; i < gradeStudents.length; i++) {
                const student = gradeStudents[i];
                const element = document.getElementById(`temp-${type}-${student.id}`);
                if (!element) continue;

                // Simple batching: if not first page, add new page
                if (i > 0) doc.addPage();

                const canvas = await html2canvas(element, {
                    scale: 3, // High quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: null
                });

                const imgData = canvas.toDataURL('image/png');
                if (type === 'id-card') {
                    // Place multiple cards per page or just one large one? 
                    // User said "id card", usually 8 or 10 per page. 
                    // For simplicity, let's do 1 focused card per page for now, or scaled to fit.
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                } else {
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                }
            }
            doc.save(`Senbet_${type === 'id-card' ? 'ID_Cards' : 'Certificates'}_${selectedGrade}.pdf`);
            message.success(t('common.success', 'Generation complete!'));
        } catch (err) {
            console.error("PDF Gen Error:", err);
            message.error("Failed to generate documents.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="max-w-[600px]">
                <Title level={2}>{type === 'id-card' ? t('admin.idCardGenerator') : t('admin.finalCertificates')}</Title>
                <Text type="secondary">{type === 'id-card' ? t('admin.idCardDesc') : t('admin.certificateTemplateDesc')}</Text>

                <Card className="mt-6 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    <Space direction="vertical" className="w-full" size="middle">
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: '8px' }}>{t('admin.selectGradeCerts')}</Text>
                            <Select
                                placeholder={t('teacher.selectGrade')}
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                style={{ width: '100%' }}
                                size="large"
                                options={uniqueGrades.map(g => ({ value: g, label: g }))}
                            />
                        </div>
                        <Button
                            type="primary"
                            icon={<FilePdfOutlined />}
                            size="large"
                            block
                            disabled={!selectedGrade || gradeStudents.length === 0}
                            loading={isGenerating}
                            onClick={handleGenerate}
                        >
                            {type === 'id-card' ? t('admin.downloadIDCards') : t('admin.downloadAllCertificates')}
                        </Button>
                    </Space>
                </Card>
            </div>

            {/* Hidden Templates for html2canvas */}
            <div className="opacity-0 pointer-events-none fixed top-[5000px] left-0">
                {gradeStudents.map(student => (
                    <div key={student.id} id={`temp-${type}-${student.id}`} style={{ width: type === 'id-card' ? '86mm' : '210mm', padding: '10px' }}>
                        {type === 'id-card' ? (
                            <IDCardTemplate student={student} />
                        ) : (
                            <CertificateTemplate student={student} marks={allMarks.filter(m => m.studentId === student.id)} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function IDCardTemplate({ student }) {
    return (
        <div className="w-[86mm] h-[54mm] bg-white border-[2px] border-slate-900 rounded-xl overflow-hidden flex flex-col relative text-slate-900 font-sans shadow-lg">
            {/* Header */}
            <div className="bg-slate-900 text-white p-2 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
                    <span className="text-[7px] uppercase tracking-tighter">Finote Birhan Senbet School</span>
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <IdcardOutlined className="text-white text-lg" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex p-2 gap-3 items-center">
                {/* Photo Placeholder */}
                <div className="w-[20mm] h-[24mm] border-2 border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
                    <UserOutlined className="text-slate-300 text-3xl mb-1" />
                    <span className="text-[6px] text-slate-400 uppercase">Student Photo</span>
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">FullName / ሙሉ ስም</span>
                    <span className="text-[11px] font-bold text-slate-900 leading-tight mb-1 truncate">{student.name}</span>

                    <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Baptismal / የክርስትና ስም</span>
                    <span className="text-[9px] font-semibold text-slate-700 leading-tight mb-1 truncate">{student.baptismalName || '-'}</span>

                    <div className="flex gap-4">
                        <div>
                            <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Grade / ክፍል</span>
                            <div className="text-[9px] font-bold">{student.grade}</div>
                        </div>
                        <div>
                            <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Year / ዘመን</span>
                            <div className="text-[9px] font-bold">{student.academicYear || dayjs().format('YYYY')}</div>
                        </div>
                    </div>
                </div>

                {/* QR Code */}
                <div className="p-1 bg-white border border-slate-100 rounded-lg">
                    <QRCodeCanvas value={student.id} size={50} level="H" />
                    <div className="text-[5px] text-center mt-0.5 text-slate-400 font-mono italic">SCAN FOR ATTENDANCE</div>
                </div>
            </div>

            {/* Footer decoration */}
            <div className="h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 w-full" />
        </div>
    );
}

function CertificateTemplate({ student, marks }) {
    const totalScore = marks.length > 0 ? marks.reduce((acc, m) => acc + (m.score || 0), 0) : 0;
    const avgScore = marks.length > 0 ? (totalScore / marks.length).toFixed(1) : 0;

    return (
        <div className="w-[190mm] h-[277mm] bg-white border-[12px] border-double border-slate-900 p-12 flex flex-col items-center text-slate-900 relative font-serif">
            {/* Corner Decorations */}
            <div className="absolute top-4 left-4 border-t-4 border-l-4 border-slate-900 w-12 h-12" />
            <div className="absolute top-4 right-4 border-t-4 border-r-4 border-slate-900 w-12 h-12" />
            <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-slate-900 w-12 h-12" />
            <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-slate-900 w-12 h-12" />

            <div className="flex flex-col items-center mb-12 text-center">
                <Title level={2} className="!mb-0 !text-slate-900 italic font-serif">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Title>
                <Text className="text-xl uppercase tracking-widest font-bold">Finote Birhan Senbet School</Text>
                <div className="w-32 h-1 bg-slate-900 my-4" />
                <Title level={1} className="!mb-8 !text-5xl uppercase tracking-tighter text-slate-800">Certificate of Completion</Title>
            </div>

            <Text className="text-2xl italic mb-6">This is to certify that</Text>

            <div className="border-b-2 border-slate-900 w-full text-center pb-2 mb-8">
                <Title level={1} className="!mb-0 !text-6xl text-slate-900">{student.name}</Title>
            </div>

            <Text className="text-xl text-center max-w-2xl leading-relaxed mb-12">
                has successfully completed the studies and clinical requirements of <br />
                <span className="font-bold text-2xl uppercase">{student.grade}</span> <br />
                with distinction and academic excellence during the year of {student.academicYear || dayjs().format('YYYY')}.
            </Text>

            {/* Statistics Table */}
            <div className="w-full mt-8 border-2 border-slate-200 p-8 rounded-2xl bg-slate-50/50">
                <div className="grid grid-cols-2 gap-8">
                    <div className="flex flex-col">
                        <span className="text-slate-400 uppercase text-sm font-bold tracking-widest mb-2">Academic Performance</span>
                        <div className="flex items-end gap-2">
                            <Title level={2} className="!mb-0 !text-4xl text-slate-900">{avgScore}%</Title>
                            <span className="text-slate-500 mb-1">Average Score</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-slate-400 uppercase text-sm font-bold tracking-widest mb-2">Baptismal Name</span>
                        <Title level={3} className="!mb-0 !text-2xl text-slate-800">{student.baptismalName || 'N/A'}</Title>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 text-center">
                    <div className="flex flex-col items-center">
                        <div className="w-48 border-b border-slate-900 mb-2 h-12" />
                        <span className="text-sm font-bold uppercase tracking-tighter">School Administrator</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="w-48 border-b border-slate-900 mb-2 h-12" />
                        <span className="text-sm font-bold uppercase tracking-tighter">Grade Coordinator</span>
                    </div>
                </div>
            </div>

            {/* Seal Placeholder */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-40 h-40 border-4 border-double border-slate-200 rounded-full flex items-center justify-center opacity-50 rotate-12">
                <div className="text-[10px] font-bold text-center text-slate-300 uppercase">Official School Seal</div>
            </div>
        </div>
    );
}

// Keep older generator as fallback or delete if refactor is complete
function CertificateGenerator() {
    return <DocumentGenerator type="certificate" />;
}

function SubjectManagement() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

    const handleSave = async (values) => {
        try {
            if (editingId) {
                await db.subjects.update(editingId, {
                    name: values.name,
                    synced: 0
                });
                message.success(t('common.save'));
            } else {
                await db.subjects.add({
                    id: crypto.randomUUID(),
                    name: values.name,
                    synced: 0
                });
                message.success(t('admin.subjectAdded'));
            }
            form.resetFields();
            setEditingId(null);
        } catch (err) {
            message.error("Error saving subject");
        }
    };

    const handleEdit = (subject) => {
        setEditingId(subject.id);
        form.setFieldsValue({ name: subject.name });
    };

    const handleDelete = async (id) => {
        await db.subjects.delete(id);
        message.success(t('admin.subjectDeleted'));
    };

    const columns = [
        { title: t('admin.subjectName'), dataIndex: 'name', key: 'name' },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        type="text"
                    />
                    <Popconfirm
                        title={t('admin.deleteSubjectConfirm')}
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            danger
                            type="text"
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Title level={2}>{t('admin.subjects')}</Title>
                <Text type="secondary">{t('admin.manageSubjects')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form form={form} onFinish={handleSave} layout="inline">
                    <Form.Item
                        name="name"
                        rules={[{ required: true, message: t('admin.subjectName') }]}
                        style={{ minWidth: '300px' }}
                    >
                        <Input placeholder={t('admin.subjectNamePlaceholder')} />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit">
                            {editingId ? t('common.save') : t('admin.addSubject')}
                        </Button>
                        {editingId && (
                            <Button className="ml-2" onClick={() => {
                                setEditingId(null);
                                form.resetFields();
                            }}>
                                {t('admin.cancel')}
                            </Button>
                        )}
                    </Form.Item>
                </Form>
            </Card>

            <Table
                columns={columns}
                dataSource={subjects}
                rowKey="id"
                pagination={false}
                className="shadow-sm rounded-xl overflow-hidden"
            />
        </div>
    );
}

function AssessmentManagement() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];

    const handleSave = async (values) => {
        try {
            const data = {
                name: values.name,
                subjectName: values.subjectName,
                grade: values.grade,
                maxScore: parseFloat(values.maxScore),
                date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                synced: 0
            };

            if (editingId) {
                await db.assessments.update(editingId, data);
                message.success(t('common.save'));
            } else {
                await db.assessments.add({
                    id: crypto.randomUUID(),
                    ...data
                });
                message.success(t('admin.assessmentAdded'));
            }
            form.resetFields();
            setEditingId(null);
        } catch (err) {
            message.error("Error saving assessment");
        }
    };

    const handleEdit = (assessment) => {
        setEditingId(assessment.id);
        form.setFieldsValue({
            ...assessment,
            date: assessment.date ? dayjs(assessment.date) : null
        });
    };

    const handleDelete = async (id) => {
        await db.assessments.delete(id);
        message.success(t('admin.assessmentDeleted'));
    };

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name' },
        { title: t('admin.subjects'), dataIndex: 'subjectName', key: 'subjectName' },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => formatGrade(text) },
        { title: t('admin.maxScore'), dataIndex: 'maxScore', key: 'maxScore' },
        { title: t('teacher.date'), dataIndex: 'date', key: 'date' },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        type="text"
                    />
                    <Popconfirm
                        title={t('admin.deleteAssessmentConfirm')}
                        onConfirm={() => handleDelete(record.id)}
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            danger
                            type="text"
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Title level={2}>{t('admin.assessments')}</Title>
                <Text type="secondary">{t('admin.manageAssessments')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form form={form} onFinish={handleSave} layout="vertical">
                    <Row gutter={16}>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="name"
                                label={t('admin.assessmentName')}
                                rules={[{ required: true }]}
                            >
                                <Input placeholder={t('admin.assessmentNamePlaceholder')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="subjectName"
                                label={t('admin.subjects')}
                                rules={[{ required: true }]}
                            >
                                <Select showSearch>
                                    {subjects.map(s => (
                                        <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="grade"
                                label={t('admin.grade')}
                                rules={[{ required: true }]}
                            >
                                <Select options={GRADE_OPTIONS} showSearch />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="maxScore"
                                label={t('admin.maxScore')}
                                rules={[{ required: true }]}
                            >
                                <Input type="number" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item
                                name="date"
                                label={t('teacher.date')}
                            >
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={24} className="flex justify-end">
                            <Space>
                                {editingId && (
                                    <Button onClick={() => {
                                        setEditingId(null);
                                        form.resetFields();
                                    }}>
                                        {t('admin.cancel')}
                                    </Button>
                                )}
                                <Button type="primary" htmlType="submit">
                                    {editingId ? t('common.save') : t('admin.addAssessment')}
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                </Form>
            </Card>

            <Table
                columns={columns}
                dataSource={assessments}
                rowKey="id"
                pagination={false}
                className="shadow-sm rounded-xl overflow-hidden"
            />
        </div>
    );
}
