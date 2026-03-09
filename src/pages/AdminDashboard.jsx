import { useState, useRef, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
    UserAddOutlined,
    UserOutlined,
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
    HomeOutlined,
    BookOutlined,
    SettingOutlined
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
import StudentProfile from '../components/StudentProfile';

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
        {
            key: '/admin/settings',
            icon: <SettingOutlined />,
            label: <Link to="/admin/settings">{t('app.settings', 'Settings')}</Link>
        },
    ];

    return (
        <div className="flex flex-col w-full h-full">
            {/* Mobile Navigation */}
            <div className="md:hidden mb-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Menu
                    mode="horizontal"
                    selectedKeys={[location.pathname === '/admin/' ? '/admin' : location.pathname]}
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

                <Content className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 md:p-6 min-h-[600px] w-full overflow-hidden">
                    <Routes>
                        <Route path="/" element={<StudentRegistration />} />
                        <Route path="/certificates" element={<DocumentGenerator type="certificate" />} />
                        <Route path="/id-cards" element={<DocumentGenerator type="id-card" />} />
                        <Route path="/data" element={<SystemDataManagement />} />
                        <Route path="/subjects" element={<SubjectManagement />} />
                        <Route path="/assessments" element={<AssessmentManagement />} />
                        <Route path="/settings" element={<SettingsManager />} />
                        <Route path="/sync" element={<SyncCenter />} />
                    </Routes>
                </Content>
            </Layout>
        </div>
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

function SettingsManager() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    
    // Load current settings from DB
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    
    useEffect(() => {
        if (settingsRows && settingsRows.length > 0) {
            const settingsObj = {};
            settingsRows.forEach(row => {
                settingsObj[row.key] = row.value;
            });
            form.setFieldsValue({
                currentAcademicYear: settingsObj.currentAcademicYear || dayjs().format('YYYY'),
                currentSemester: settingsObj.currentSemester || 'Semester I'
            });
        } else {
            form.setFieldsValue({
                currentAcademicYear: dayjs().format('YYYY'),
                currentSemester: 'Semester I'
            });
        }
    }, [settingsRows, form]);

    const handleSaveSettings = async (values) => {
        try {
            await db.settings.put({ key: 'currentAcademicYear', value: values.currentAcademicYear });
            await db.settings.put({ key: 'currentSemester', value: values.currentSemester });
            message.success(t('common.save', 'Settings saved successfully'));
        } catch (error) {
            message.error("Failed to save settings");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Title level={2}>{t('app.settings', 'System Settings')}</Title>
                <Text type="secondary">Global configurations for Academic Year and Semester</Text>
            </div>

            <Card className="max-w-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <Form form={form} layout="vertical" onFinish={handleSaveSettings}>
                    <Form.Item 
                        label="Active Academic Year" 
                        name="currentAcademicYear"
                        rules={[{ required: true, message: 'Please enter current academic year' }]}
                    >
                        <Input placeholder="e.g. 2016" />
                    </Form.Item>

                    <Form.Item 
                        label="Active Semester" 
                        name="currentSemester"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="Semester I">Semester I</Select.Option>
                            <Select.Option value="Semester II">Semester II</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item>
                        <Button type="primary" htmlType="submit" size="large" icon={<SettingOutlined />}>
                            {t('common.save', 'Save Global Settings')}
                        </Button>
                    </Form.Item>
                </Form>
                
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    <strong>Note:</strong> Editing the academic year controls the default year assigned to newly registered students. Editing the active semester will automatically guide teachers when they enter marks. Historic data is preserved based on the year it was entered.
                </div>
            </Card>
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
    const [profileStudentId, setProfileStudentId] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(null); // studentId being generated
    const [printStudent, setPrintStudent] = useState(null); // student for hidden template

    const studentsData = useLiveQuery(() => db.students.toArray());
    const students = studentsData || [];
    const isLoadingStudents = studentsData === undefined;
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];

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
            const { dateOfEntry, ...otherValues } = values;
            const studentData = {
                ...otherValues,
                academicYear: dateOfEntry ? dateOfEntry.toISOString() : new Date().toISOString(),
                createdAt: new Date().toISOString(),
                synced: 0,
            };

            await db.students.add(studentData);
            message.success(t('common.success', 'Student added successfully!'));
            form.resetFields();
            setIsFormValid(false);
        } catch (err) {
            console.error("Failed to add student:", err);
            message.error(t('common.error', 'Failed to add student.'));
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

    const handleGenerateSinglePdf = async (student, type) => {
        setGeneratingPdf(student.id + '-' + type);
        setPrintStudent({ student, type });

        // Wait for DOM to render the hidden template
        await new Promise(r => setTimeout(r, 400));

        try {
            const elementId = `single-${type}-${student.id}`;
            const element = document.getElementById(elementId);
            if (!element) { message.error('Print template not found.'); return; }

            const canvas = await html2canvas(element, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        * { color-scheme: light !important; }
                        [class*="bg-slate-"], [class*="text-slate-"], [class*="border-slate-"] {
                            background-color: transparent !important;
                            color: #0f172a !important;
                            border-color: #e2e8f0 !important;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            });            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF('p', 'mm', type === 'id-card' ? [86, 54] : 'a4');
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, type === 'id-card' ? pdfHeight : Math.min(pdfHeight, doc.internal.pageSize.getHeight()));
            doc.save(`${student.name}_${type === 'id-card' ? 'IDCard' : 'Certificate'}.pdf`);
            message.success(`${type === 'id-card' ? 'ID Card' : 'Certificate'} downloaded!`);
        } catch (err) {
            console.error('Single PDF error:', err);
            message.error('Failed to generate PDF.');
        } finally {
            setGeneratingPdf(null);
            setPrintStudent(null);
        }
    };

    const handleEditSave = async () => {
        try {
            const values = await editForm.validateFields();
            const { dateOfEntry, ...otherValues } = values;
            const academicYear = dateOfEntry ? dateOfEntry.toISOString() : editingStudent.academicYear;

            await db.students.update(editingStudent.id, {
                ...otherValues,
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
                <Space size="small" wrap>
                    <Tooltip title={t('teacher.viewProfile')}>
                        <Button
                            type="text"
                            icon={<UserOutlined className="text-blue-500" />}
                            onClick={() => setProfileStudentId(record.id)}
                            className="cursor-pointer"
                            size="small"
                        />
                    </Tooltip>
                    <Tooltip title="Print ID Card">
                        <Button
                            type="text"
                            size="small"
                            icon={<IdcardOutlined className="text-emerald-600" />}
                            loading={generatingPdf === record.id + '-id-card'}
                            onClick={() => handleGenerateSinglePdf(record, 'id-card')}
                            className="cursor-pointer"
                        />
                    </Tooltip>
                    <Tooltip title="Print Certificate">
                        <Button
                            type="text"
                            size="small"
                            icon={<FilePdfOutlined className="text-amber-600" />}
                            loading={generatingPdf === record.id + '-certificate'}
                            onClick={() => handleGenerateSinglePdf(record, 'certificate')}
                            className="cursor-pointer"
                        />
                    </Tooltip>
                    <Tooltip title={t('admin.edit')}>
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => showEditModal(record)}
                            className="cursor-pointer"
                        />
                    </Tooltip>
                    <Popconfirm title="ተማሪውን ይዘርዘዘት?" onConfirm={() => handleDelete(record.id)}>
                        <Button
                            type="text"
                            danger
                            size="small"
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
                            scroll={{ x: 'max-content', y: 500 }}
                            className="students-table w-full"
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

            <StudentProfile
                studentId={profileStudentId}
                visible={!!profileStudentId}
                onClose={() => setProfileStudentId(null)}
            />

            {/* Hidden single-student print template */}
            {printStudent && (
                <div className="opacity-0 pointer-events-none fixed top-[9999px] left-0" aria-hidden="true">
                    <div id={`single-${printStudent.type}-${printStudent.student.id}`}
                        style={{ width: printStudent.type === 'id-card' ? '86mm' : '210mm', background: 'white', padding: '10px' }}
                    >
                        {printStudent.type === 'id-card'
                            ? <IDCardTemplate student={printStudent.student} />
                            : <CertificateTemplate
                                student={printStudent.student}
                                marks={allMarks.filter(m => m.studentId === printStudent.student.id)}
                                assessments={allAssessments}
                              />
                        }
                    </div>
                </div>
            )}
        </div>
    );
}

function DocumentGenerator({ type }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentProcessingId, setCurrentProcessingId] = useState(null);
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
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
                setCurrentProcessingId(student.id);
                
                // Show progress message
                const progressMsg = message.loading(`${t('common.processing', 'Processing')} ${i + 1}/${gradeStudents.length}: ${student.name}`, 0);

                // Wait for React to render the specific student's template
                await new Promise(r => setTimeout(r, 200));

                const element = document.getElementById(`batch-temp-target`);
                if (!element) {
                    console.warn("Template target not found for", student.name);
                    progressMsg(); // Close loading message
                    continue;
                }

                // Simple batching: if not first page, add new page
                if (i > 0) doc.addPage();

                const canvas = await html2canvas(element, {
                    scale: 3, // High quality
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    onclone: (clonedDoc) => {
                        const style = clonedDoc.createElement('style');
                        style.innerHTML = `
                            * { color-scheme: light !important; }
                            [class*="bg-slate-"], [class*="text-slate-"], [class*="border-slate-"] {
                                background-color: transparent !important;
                                color: #0f172a !important;
                                border-color: #e2e8f0 !important;
                            }
                        `;
                        clonedDoc.head.appendChild(style);
                    }
                });

                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                progressMsg(); // Close loading message
            }
            doc.save(`Senbet_${type === 'id-card' ? 'ID_Cards' : 'Certificates'}_${selectedGrade}.pdf`);
            message.success(t('common.success', 'Generation complete!'));
        } catch (err) {
            console.error("PDF Gen Error:", err);
            message.destroy(); // Clear any hanging loading messages
            message.error("Failed to generate documents.");
        } finally {
            setIsGenerating(false);
            setCurrentProcessingId(null);
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

            {/* Hidden Templates for html2canvas - Optimized to render only one at a time during batch */}
            <div style={{ opacity: 0, pointerEvents: 'none', position: 'fixed', top: '5000px', left: 0, background: 'white' }}>
                {isGenerating && currentProcessingId && (
                    <div id="batch-temp-target" style={{ width: type === 'id-card' ? '325px' : '794px', padding: '10px' }}>
                        {(() => {
                            const student = gradeStudents.find(s => s.id === currentProcessingId);
                            if (!student) return null;
                            return type === 'id-card' ? (
                                <IDCardTemplate student={student} />
                            ) : (
                                <CertificateTemplate student={student} marks={allMarks.filter(m => m.studentId === student.id)} assessments={allAssessments} />
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}

function IDCardTemplate({ student }) {
    return (
        <div style={{
            width: '325px', height: '204px', background: '#ffffff', border: '2px solid #0f172a',
            borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', position: 'relative'
        }}>
            {/* Header */}
            <div style={{ background: '#0f172a', color: '#ffffff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold' }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
                    <span style={{ fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Finote Birhan Senbet School</span>
                </div>
                <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🪪</div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', padding: '8px 10px', gap: '8px', alignItems: 'center', boxSizing: 'border-box', width: '100%' }}>
                {/* Photo Placeholder */}
                <div style={{ width: '68px', minWidth: '68px', height: '80px', border: '2px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                    <span style={{ fontSize: '28px' }}>👤</span>
                    <span style={{ fontSize: '6px', color: '#94a3b8', textTransform: 'uppercase', marginTop: '2px' }}>Photo</span>
                </div>

                {/* Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                    <div>
                        <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Full Name / ሙሉ ስም</div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Baptismal / ከርስትና ስም</div>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.baptismalName || '-'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '14px' }}>
                        <div>
                            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Grade / ክፍል</div>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a' }}>{student.grade}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '7px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase' }}>Year / ዘሜን</div>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#0f172a' }}>{dayjs(student.academicYear).isValid() ? dayjs(student.academicYear).format('YYYY') : dayjs().format('YYYY')}</div>
                        </div>
                    </div>
                </div>

                {/* QR Code */}
                <div style={{ padding: '4px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <QRCodeCanvas value={student.id} size={50} level="H" bgColor="#ffffff" fgColor="#000000" />
                    <div style={{ fontSize: '5px', color: '#94a3b8', fontFamily: 'monospace', fontStyle: 'italic', marginTop: '2px', textAlign: 'center' }}>SCAN</div>
                </div>
            </div>

            {/* Ethiopian-flag footer bar */}
            <div style={{ height: '5px', background: 'linear-gradient(90deg, #22c55e 33%, #eab308 33% 66%, #ef4444 66%)', width: '100%' }} />
        </div>
    );
}

function CertificateTemplate({ student, marks, assessments = [] }) {
    // Group marks by subject, calculate Sem I and Sem II totals
    const studentGrade = student.grade;
    const gradeAssessments = assessments.filter(a => a.grade === studentGrade);

    const subjects = [...new Set(gradeAssessments.map(a => a.subjectName))].sort();

    const subjectRows = subjects.map(subject => {
        const semIAssessments = gradeAssessments.filter(a => a.subjectName === subject && (a.semester || 'Semester I') === 'Semester I');
        const semIIAssessments = gradeAssessments.filter(a => a.subjectName === subject && a.semester === 'Semester II');

        const semIEarned = semIAssessments.reduce((acc, a) => {
            const mark = marks.find(m => m.assessmentId === a.id);
            return acc + (mark ? (mark.score || 0) : 0);
        }, 0);
        const semIMax = semIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
        const semIHasData = semIAssessments.some(a => marks.find(m => m.assessmentId === a.id));

        const semIIEarned = semIIAssessments.reduce((acc, a) => {
            const mark = marks.find(m => m.assessmentId === a.id);
            return acc + (mark ? (mark.score || 0) : 0);
        }, 0);
        const semIIMax = semIIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
        const semIIHasData = semIIAssessments.some(a => marks.find(m => m.assessmentId === a.id));

        const totalMax = semIMax + semIIMax;
        const totalEarned = semIEarned + semIIEarned;
        const avgPct = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(0) : '-';

        return {
            subject,
            semI: semIHasData ? `${semIEarned} / ${semIMax}` : '—',
            semII: semIIHasData ? `${semIIEarned} / ${semIIMax}` : (semIIAssessments.length === 0 ? 'N/A' : '—'),
            avg: avgPct !== '-' ? `${avgPct}%` : '—',
        };
    });

    const overallEarned = marks.reduce((acc, m) => acc + (m.score || 0), 0);
    const overallMax = gradeAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
    const overallAvg = overallMax > 0 ? ((overallEarned / overallMax) * 100).toFixed(1) : 0;

    return (
        <div style={{
            width: '210mm', minHeight: '297mm', background: '#ffffff', border: '10px double #0f172a',
            padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center',
            color: '#0f172a', position: 'relative', fontFamily: 'serif', boxSizing: 'border-box'
        }}>
            {/* Corner Decorations */}
            <div style={{ position: 'absolute', top: '12px', left: '12px', borderTop: '4px solid #0f172a', borderLeft: '4px solid #0f172a', width: '32px', height: '32px' }} />
            <div style={{ position: 'absolute', top: '12px', right: '12px', borderTop: '4px solid #0f172a', borderRight: '4px solid #0f172a', width: '32px', height: '32px' }} />
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', borderBottom: '4px solid #0f172a', borderLeft: '4px solid #0f172a', width: '32px', height: '32px' }} />
            <div style={{ position: 'absolute', bottom: '12px', right: '12px', borderBottom: '4px solid #0f172a', borderRight: '4px solid #0f172a', width: '32px', height: '32px' }} />

            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.1em' }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', marginTop: '4px' }}>Finote Birhan Senbet School</div>
                <div style={{ width: '96px', height: '2px', background: '#0f172a', margin: '12px 0' }} />
                <div style={{ fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Report Card</div>
            </div>

            {/* Student Info */}
            <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Student Name / ሙሉ ስም</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginTop: '2px' }}>{student.name}</div>
                </div>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Baptismal / ክርስትና ስም</div>
                    <div style={{ fontWeight: '600', marginTop: '2px' }}>{student.baptismalName || '—'}</div>
                </div>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Grade / ክፍል</div>
                    <div style={{ fontWeight: 'bold', marginTop: '2px' }}>{student.grade}</div>
                </div>
                <div>
                    <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Academic Year</div>
                    <div style={{ fontWeight: '600', marginTop: '2px' }}>{dayjs(student.academicYear).format('YYYY')}</div>
                </div>
            </div>

            {/* Grades Table */}
            <div style={{ width: '100%', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ background: '#0f172a', color: 'white' }}>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', border: '1px solid #0f172a' }}>Subject</th>
                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #0f172a' }}>Semester I</th>
                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #0f172a' }}>Semester II</th>
                            <th style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #0f172a' }}>Average</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjectRows.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', border: '1px solid #e2e8f0' }}>No grade records</td></tr>
                        ) : subjectRows.map((row, i) => (
                            <tr key={row.subject} style={{ background: i % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '7px 8px', fontWeight: '600', borderX: '1px solid #e2e8f0', border: '1px solid #e2e8f0' }}>{row.subject}</td>
                                <td style={{ padding: '7px', textAlign: 'center', border: '1px solid #e2e8f0' }}>{row.semI}</td>
                                <td style={{ padding: '7px', textAlign: 'center', color: row.semII === '—' ? '#94a3b8' : 'inherit', border: '1px solid #e2e8f0' }}>{row.semII}</td>
                                <td style={{ padding: '7px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #e2e8f0' }}>{row.avg}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ background: '#0f172a', color: 'white', fontWeight: 'bold' }}>
                            <td style={{ padding: '8px', border: '1px solid #0f172a' }}>Overall Average</td>
                            <td colSpan={2} style={{ border: '1px solid #0f172a' }} />
                            <td style={{ padding: '8px', textAlign: 'center', fontSize: '14px', border: '1px solid #0f172a' }}>{overallAvg}%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Signature lines */}
            <div style={{ width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '160px', borderBottom: '1px solid #0f172a', marginBottom: '8px', height: '40px' }} />
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>School Administrator</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '160px', borderBottom: '1px solid #0f172a', marginBottom: '8px', height: '40px' }} />
                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Grade Coordinator</span>
                </div>
            </div>

            {/* Seal */}
            <div style={{ position: 'absolute', bottom: '64px', left: '50%', transform: 'translateX(-50%) rotate(12deg)', width: '96px', height: '96px', border: '4px double #e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center', color: '#cbd5e1', textTransform: 'uppercase' }}>Official Seal</div>
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

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden w-full mt-4">
                <Table
                    columns={columns}
                    dataSource={subjects}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 'max-content', y: 500 }}
                    className="students-table w-full"
                />
            </div>
        </div>
    );
}

function AssessmentManagement() {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);

    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    
    const currentSemesterSetting = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    useEffect(() => {
        if (!editingId && currentSemesterSetting) {
            form.setFieldsValue({ semester: currentSemesterSetting });
        }
    }, [currentSemesterSetting, editingId, form]);

    const handleSave = async (values) => {
        try {
            const data = {
                name: values.name,
                subjectName: values.subjectName,
                grade: values.grade,
                maxScore: parseFloat(values.maxScore),
                semester: values.semester || 'Semester I',
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
        { title: t('admin.semester', 'Semester'), dataIndex: 'semester', key: 'semester', render: (text) => t(`admin.${text === 'Semester I' ? 'semester1' : 'semester2'}`, text) },
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
                                name="semester"
                                label={t('admin.semester', 'Semester')}
                                rules={[{ required: true }]}
                            >
                                <Select options={[
                                    { value: 'Semester I', label: t('admin.semester1', 'Semester I') },
                                    { value: 'Semester II', label: t('admin.semester2', 'Semester II') }
                                ]} />
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

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden w-full mt-4">
                <Table
                    columns={columns}
                    dataSource={assessments}
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 'max-content', y: 500 }}
                    className="students-table w-full"
                />
            </div>
        </div>
    );
}
