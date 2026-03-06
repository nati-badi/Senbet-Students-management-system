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
    WarningOutlined
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
    DatePicker
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

const { Title, Text } = Typography;
const { Content, Sider } = Layout;

// Fixed grade options for 1-12 + extra
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

// Validators
const validateAmharic = (_, value) => {
    if (!value) return Promise.resolve();
    // Ethiopic Unicode block: U+1200–U+137F, spaces, and common punctuation allowed
    const amharicOnly = /^[\u1200-\u137F\s\-/]+$/;
    if (!amharicOnly.test(value)) return Promise.reject('ስም በአማርኛ ብቻ ይሁን');
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
            key: '/admin/data',
            icon: <DatabaseOutlined />,
            label: <Link to="/admin/data">{t('admin.systemData')}</Link>
        },
    ];

    return (
        <Layout className="bg-transparent" style={{ overflow: 'hidden' }}>
            <Sider
                width={240}
                style={{ flexShrink: 0 }}
                className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mr-6 hidden md:block transition-colors"
            >
                <div style={{ padding: '16px' }}>
                    <Text strong type="secondary" style={{ fontSize: '12px', textTransform: 'uppercase' }}>
                        {t('admin.menu')}
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
                    <Route path="/" element={<StudentRegistration />} />
                    <Route path="/certificates" element={<CertificateGenerator />} />
                    <Route path="/data" element={<SystemDataManagement />} />
                </Routes>
            </Content>
        </Layout>
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

            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 transition-colors">
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

    const students = useLiveQuery(() => db.students.toArray()) || [];

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
                const lk = k.toLowerCase();
                return (lk.includes('name') && !lk.includes('baptismal')) ||
                    lk.includes('ሙሉ ስም') || lk.includes('ስም');
            }) || keys[0];
            const baptKey = keys.find(k => {
                const lk = k.toLowerCase();
                return lk.includes('baptismal') || lk.includes('የክርስትና') || lk.includes('ክርስትና');
            }) || keys[1];
            const genderKey = keys.find(k => {
                const lk = k.toLowerCase();
                return lk.includes('gender') || lk.includes('sex') || lk.includes('ፆታ');
            }) || keys[2];
            const gradeKey = keys.find(k => {
                const lk = k.toLowerCase();
                return lk.includes('grade') || lk.includes('class') || lk.includes('ክፍል');
            }) || keys[3];
            const contactKey = keys.find(k => {
                const lk = k.toLowerCase();
                return lk.includes('contact') || lk.includes('phone') || lk.includes('ስልክ');
            }) || keys[4];
            // Check if file has a date/year column (English + Amharic)
            const dateKey = keys.find(k => {
                const lk = k.toLowerCase();
                return lk.includes('year') || lk.includes('date') || lk.includes('ዓ.ም') ||
                    lk.includes('academic') || lk.includes('ዓመት') || lk.includes('ቀን');
            });

            const name = String(row[nameKey] ?? '').trim();
            const grade = String(row[gradeKey] ?? '').trim();

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
                description: "Check your file format. It must have at least 'Full Name' and 'Grade' columns.",
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

        const sGrade = String(student.grade).trim().toLowerCase();
        const fGrade = String(filterGrade).trim().toLowerCase();

        let matchesGrade = !filterGrade || sGrade === fGrade;
        if (!filterGrade) matchesGrade = true;
        else if (!matchesGrade) {
            // Fallback match: if both contain same number and same '+' status
            const num1 = sGrade.match(/\d+/);
            const num2 = fGrade.match(/\d+/);
            if (num1 && num2 && num1[0] === num2[0]) {
                const hasPlus1 = sGrade.includes('+');
                const hasPlus2 = fGrade.includes('+');
                if (hasPlus1 === hasPlus2) matchesGrade = true;
            }
        }

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
            render: (text) => <Tag color="green">{text}</Tag>
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

            <Card className="bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 transition-colors">
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
                <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap' }}>
                    {t('admin.enrolledStudents')} <Tag color="blue">{students.length}</Tag>
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

            <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="overflow-hidden">
                    <Table
                        columns={columns}
                        dataSource={filteredStudents}
                        rowKey="id"
                        pagination={false}
                        scroll={{ y: 500 }}
                        className="students-table"
                        locale={{ emptyText: <Empty description={t('admin.noStudentsYet')} /> }}
                    />
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
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
}

function CertificateGenerator() {
    const { t } = useTranslation();
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const [selectedGrade, setSelectedGrade] = useState('');

    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);

    const generateCertificates = () => {
        if (!selectedGrade) return;
        const gradeStudents = students.filter(s => s.grade === selectedGrade);
        if (gradeStudents.length === 0) {
            message.warning('No students in this grade.');
            return;
        }

        const doc = new jsPDF();
        gradeStudents.forEach((student, index) => {
            if (index > 0) doc.addPage();
            doc.setFillColor(248, 250, 252);
            doc.rect(0, 0, 210, 297, 'F');
            doc.setDrawColor(22, 101, 52);
            doc.setLineWidth(1.5);
            doc.rect(10, 10, 190, 277);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.setTextColor(15, 23, 42);
            doc.text("Certificate of Achievement", 105, 40, { align: "center" });

            doc.setFontSize(16);
            doc.text("በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት", 105, 50, { align: "center" });

            doc.setFontSize(14);
            doc.text(`This certifies that`, 105, 80, { align: "center" });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(22, 101, 52);
            doc.text(student.name, 105, 95, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text(`has successfully completed Grade ${student.grade}.`, 105, 110, { align: "center" });

            const studentMarks = allMarks.filter(m => m.studentId === student.id);
            if (studentMarks.length > 0) {
                doc.autoTable({
                    startY: 130,
                    head: [['Subject', 'Date', 'Score']],
                    body: studentMarks.map(m => [m.subject, m.assessmentDate, m.score]),
                    theme: 'striped',
                    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
                    margin: { left: 20, right: 20 }
                });
            } else {
                doc.setFontSize(12);
                doc.setTextColor(100, 116, 139);
                doc.text(t('admin.noMarksYet'), 105, 140, { align: "center" });
            }
        });

        doc.save(`Senbet_Certificates_${selectedGrade}.pdf`);
        message.success('Certificates generated!');
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[600px]">
            <div>
                <Title level={2}>{t('admin.generateCertificates')}</Title>
                <Text type="secondary">{t('admin.generatorDesc')}</Text>
            </div>

            <Card className="bg-slate-50 dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex flex-col gap-4 w-full">
                    <div>
                        <Text strong style={{ display: 'block', marginBottom: '8px' }}>
                            {t('admin.selectGradeCerts')}
                        </Text>
                        <Select
                            placeholder={t('teacher.selectGrade')}
                            value={selectedGrade}
                            onChange={setSelectedGrade}
                            style={{ width: '100%' }}
                            size="large"
                        >
                            {uniqueGrades.map(g => (
                                <Select.Option key={g} value={g}>{g}</Select.Option>
                            ))}
                        </Select>
                    </div>

                    <Button
                        type="primary"
                        icon={<FilePdfOutlined />}
                        disabled={!selectedGrade}
                        onClick={generateCertificates}
                        size="large"
                        block
                        className="cursor-pointer"
                    >
                        {t('admin.downloadAllCertificates')}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
