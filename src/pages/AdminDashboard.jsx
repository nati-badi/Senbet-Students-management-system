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
    notification
} from 'antd';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { API_BASE } from '../utils/sync';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Content, Sider } = Layout;

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
        <Layout className="bg-transparent">
            <Sider width={240} className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mr-6 hidden md:block transition-colors">
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

            // 2. Wipe central SQLite Database via API
            const response = await fetch(`${API_BASE}/sync/clear`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error("Failed to reach server to wipe master database.");
            }

            notification.success({
                message: 'Database Erased',
                description: 'All local and server-side student data has been completely erased.',
                placement: 'topRight',
                duration: 5,
            });
        } catch (error) {
            console.error(error);
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
    const { t } = useTranslation();
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

    // Converts a Gregorian date to Ethiopian calendar date string
    const getEthiopianDate = () => {
        const now = new Date();
        const gYear = now.getFullYear();
        const gMonth = now.getMonth() + 1; // 1-indexed
        const gDay = now.getDate();

        // Ethiopian New Year falls on Sep 11 (or Sep 12 in leap years)
        const ethYear = (gMonth > 9 || (gMonth === 9 && gDay >= 11)) ? gYear - 7 : gYear - 8;

        const ethMonthNames = [
            'መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት',
            'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጷጉሜ'
        ];

        // Days from Ethiopian New Year (Sep 11) to now
        const ethNewYear = new Date(gYear, 8, 11); // Sep 11 of current Gregorian year
        let dayOfYear;
        if (now >= ethNewYear) {
            dayOfYear = Math.floor((now - ethNewYear) / 86400000);
        } else {
            const prevEthNewYear = new Date(gYear - 1, 8, 11);
            dayOfYear = Math.floor((now - prevEthNewYear) / 86400000);
        }

        const ethMonth = Math.floor(dayOfYear / 30);
        const ethDay = (dayOfYear % 30) + 1;
        const monthName = ethMonthNames[Math.min(ethMonth, 12)];

        return `${ethDay} ${monthName} ${ethYear} ዓ.ም`;
    };

    const ethiopianDate = getEthiopianDate();

    const handleRegister = async (values) => {
        try {
            await db.students.add({
                id: crypto.randomUUID(),
                ...values,
                academicYear: ethiopianDate,
                synced: 0,
            });
            form.resetFields();
            setIsFormValid(false);
            message.success('Student registered successfully!');
        } catch (err) {
            console.error("Failed to add student:", err);
            message.error('Failed to register student.');
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
        editForm.setFieldsValue(student);
        setIsEditModalVisible(true);
    };

    const handleEditSave = async () => {
        try {
            const values = await editForm.validateFields();
            await db.students.update(editingStudent.id, { ...values, synced: 0 });
            setIsEditModalVisible(false);
            message.success('Student record updated.');
        } catch (err) {
            console.error("Failed to edit student:", err);
        }
    };

    const downloadTemplate = () => {
        // Generate a proper .xlsx file so each header is in its own column
        const headers = [["Full Name", "Baptismal Name", "Gender", "Grade", "Parent Contact"]];
        const ws = XLSX.utils.aoa_to_sheet(headers);

        // Set column widths for readability
        ws['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 20 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Students');
        XLSX.writeFile(wb, 'Senbet_Students_Template.xlsx');
    };

    const processRows = async (rows) => {
        const bulkStudents = [];
        let errorCount = 0;
        let missingDateCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const keys = Object.keys(row);
            const nameKey = keys.find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('baptismal')) || keys[0];
            const baptKey = keys.find(k => k.toLowerCase().includes('baptismal')) || keys[1];
            const genderKey = keys.find(k => k.toLowerCase().includes('gender') || k.toLowerCase().includes('sex')) || keys[2];
            const gradeKey = keys.find(k => k.toLowerCase().includes('grade') || k.toLowerCase().includes('class')) || keys[3];
            const contactKey = keys.find(k => k.toLowerCase().includes('contact') || k.toLowerCase().includes('phone')) || keys[4];
            // Check if file has a date/year column
            const dateKey = keys.find(k =>
                k.toLowerCase().includes('year') ||
                k.toLowerCase().includes('date') ||
                k.toLowerCase().includes('ዓ.ም') ||
                k.toLowerCase().includes('academic')
            );

            const name = String(row[nameKey] ?? '').trim();
            const grade = String(row[gradeKey] ?? '').trim();

            if (!name || !grade) { errorCount++; continue; }

            let gender = String(row[genderKey] ?? '').trim();
            gender = (gender && gender.toLowerCase().startsWith('f')) ? 'Female' : 'Male';

            // Use date from file if column exists and has a value; otherwise leave empty
            const academicYear = dateKey ? String(row[dateKey] ?? '').trim() : '';
            if (!academicYear) missingDateCount++;

            bulkStudents.push({
                id: crypto.randomUUID(),
                name,
                baptismalName: String(row[baptKey] ?? '').trim(),
                gender,
                academicYear,
                grade,
                parentContact: String(row[contactKey] ?? '').trim(),
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

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.parentContact || "").includes(searchQuery);
        const matchesGrade = !filterGrade || student.grade === filterGrade;
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
            render: (text) => <Tag color="forest">{text}</Tag>
        },
        { title: t('admin.contact'), dataIndex: 'parentContact', key: 'parentContact' },
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
                    <Popconfirm title="Delete this student?" onConfirm={() => handleDelete(record.id)}>
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
        <div className="flex flex-col gap-6 w-full">
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
                            <Form.Item label={t('admin.fullName')} name="name" rules={[{ required: true }]}>
                                <Input placeholder={t('admin.namePlaceholder')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.baptismalNameField')} name="baptismalName">
                                <Input placeholder={t('admin.baptismalPlaceholder')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gender')} name="gender">
                                <Select options={[
                                    { value: 'Male', label: t('admin.male') },
                                    { value: 'Female', label: t('admin.female') },
                                ]} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label="ዛሬ">
                                <div className="flex items-center gap-2 h-8 px-3 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                                    <LockOutlined className="text-slate-400" />
                                    <span className="text-slate-600 dark:text-slate-400 text-sm">{ethiopianDate}</span>
                                </div>
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true }]}>
                                <Input placeholder={t('admin.gradePlaceholder')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.parentContact')} name="parentContact">
                                <Input placeholder={t('admin.contactPlaceholder')} />
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

            <div className="flex flex-col sm:flex-row justify-between w-full mb-4 gap-4">
                <Input
                    prefix={<SearchOutlined />}
                    placeholder={t('admin.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', maxWidth: 400 }}
                />
                <Select
                    placeholder={t('admin.allGrades')}
                    value={filterGrade}
                    onChange={setFilterGrade}
                    style={{ width: '100%', maxWidth: 200 }}
                    allowClear
                    suffixIcon={<FilterOutlined />}
                >
                    {uniqueGrades.map(g => (
                        <Select.Option key={g} value={g}>{g}</Select.Option>
                    ))}
                </Select>
            </div>

            <Table
                columns={columns}
                dataSource={filteredStudents}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                className="shadow-sm rounded-lg overflow-hidden border border-slate-100"
                locale={{ emptyText: <Empty description={t('admin.noStudentsYet')} /> }}
            />

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
                            <Form.Item label={t('admin.fullName')} name="name" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.baptismalNameField')} name="baptismalName">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gender')} name="gender">
                                <Select options={[
                                    { value: 'Male', label: t('admin.male') },
                                    { value: 'Female', label: t('admin.female') },
                                ]} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.parentContact')} name="parentContact">
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                label={t('admin.academicYear')}
                                name="academicYear"
                                tooltip="ለምሳሌ: 25 የካቲት 2018 ዓ.ም"
                            >
                                <Input placeholder="e.g. 25 የካቲት 2018 ዓ.ም" />
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
