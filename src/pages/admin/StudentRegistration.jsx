import React, { useState } from 'react';
import { Typography, Row, Col, Card, Form, Input, Select, DatePicker, Button, Table, Tag, Space, Tooltip, Popconfirm, Modal, notification, Upload, message, Skeleton, Empty } from 'antd';
import { SearchOutlined, FilterOutlined, DownloadOutlined, UploadOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { db } from '../../db/database';
import { GRADE_OPTIONS, formatGrade, normalizeGrade, disabledDate } from '../../utils/gradeUtils';
import { validateAmharic, validateEthiopianPhone } from '../../utils/validators';
import StudentProfile from '../../components/StudentProfile';

const { Title, Text } = Typography;

export default function StudentRegistration() {
    const { t, i18n } = useTranslation();
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const [profileStudentId, setProfileStudentId] = useState(null);

    const studentsData = useLiveQuery(() => db.students.toArray());
    const students = studentsData || [];
    const isLoadingStudents = studentsData === undefined;

    const handleValuesChange = (_, allValues) => {
        setIsFormValid(!!(allValues.name && allValues.grade));
    };

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
            if (!isAmharic) {
                formatted = formatted.replace(/(AM|PM|ERA1|ERA0)/gi, '').trim() + ' E.C.';
            }
            return formatted;
        } catch (e) {
            return dateInput || '—';
        }
    };

    const regDateOfEntry = Form.useWatch('dateOfEntry', form);
    const editDateOfEntry = Form.useWatch('dateOfEntry', editForm);

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
        const existingWithSameName = students.filter(
            s => s.name.trim().toLowerCase() === values.name.trim().toLowerCase()
        );
        if (existingWithSameName.length > 0) {
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
            message.error('ተማሪ መዘግበት አልታቸለም።');
        }
    };

    const handleDelete = async (id) => {
        try {
            await db.students.delete(id);
            message.success('Student removed from database.');
        } catch (err) {
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
        const headers = [['ሙሉ ስም', 'የክርስትና ስም', 'ፆታ', 'ክፍል', 'የወላጅ ስልክ ቁጥር']];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 22 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ተማሪዎች');
        XLSX.writeFile(wb, 'Senbet_Students_Template.xlsx');
    };

    const processRows = async (rows) => {
        const bulkStudents = [];
        let errorCount = 0;
        let missingDateCount = 0;

        for (let row of rows) {
            const keys = Object.keys(row);
            const nameKey = keys.find(k => k.toLowerCase().includes('name') || k.includes('ስም'));
            const baptKey = keys.find(k => k.toLowerCase().includes('baptismal') || k.includes('ክርስትና'));
            const genderKey = keys.find(k => k.toLowerCase().includes('gender') || k.includes('ፆታ'));
            const gradeKey = keys.find(k => k.toLowerCase().includes('grade') || k.includes('ክፍል'));
            const contactKey = keys.find(k => k.toLowerCase().includes('contact') || k.includes('ስልክ'));
            const dateKey = keys.find(k => k.toLowerCase().includes('year') || k.includes('ቀን'));

            if (!nameKey || !gradeKey) {
                notification.error({ message: 'Missing Required Columns' });
                return;
            }

            const name = String(row[nameKey] ?? '').trim();
            const grade = normalizeGrade(row[gradeKey]);

            if (!name || !grade) { errorCount++; continue; }

            let gender = String(row[genderKey] ?? '').trim().toLowerCase().startsWith('f') ? 'Female' : 'Male';
            let contact = String(row[contactKey] ?? '').trim();
            if (contact.length === 9 && !contact.startsWith('0')) contact = '0' + contact;

            const academicYear = dateKey ? String(row[dateKey] ?? '').trim() : new Date().toISOString();
            if (!academicYear) missingDateCount++;

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
            await db.students.bulkAdd(bulkStudents);
            notification.success({ message: `Imported ${bulkStudents.length} students.` });
        }
    };

    const handleImportFile = (file) => {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (isExcel) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                processRows(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' }));
            };
            reader.readAsArrayBuffer(file);
        } else {
            Papa.parse(file, { header: true, complete: (res) => processRows(res.data) });
        }
        return false;
    };

    const allGradeOptions = [
        ...GRADE_OPTIONS,
        ...[...new Set(students.map(s => s.grade))]
            .filter(g => !GRADE_OPTIONS.some(o => o.value === g))
            .map(g => ({ value: g, label: g })),
    ];

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.baptismalName || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGrade = !filterGrade || String(s.grade) === String(filterGrade);
        return matchesSearch && matchesGrade;
    });

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
        { title: t('admin.baptismalName'), dataIndex: 'baptismalName', key: 'baptismalName' },
        { title: t('admin.gender'), dataIndex: 'gender', render: (t) => <Tag color={t === 'Male' ? 'blue' : 'magenta'}>{t}</Tag> },
        { title: t('admin.grade'), dataIndex: 'grade', render: (t) => <Tag color="green">{formatGrade(t)}</Tag> },
        { title: t('admin.contact'), dataIndex: 'parentContact' },
        { title: t('admin.dateOfEntry'), dataIndex: 'academicYear', render: (t) => <span className="text-xs text-slate-500">{formatEthiopianDate(t)}</span> },
        {
            title: t('common.actions'), key: 'actions', align: 'right', render: (_, r) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => showEditModal(r)} />
                    <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                    <Button type="text" icon={<UserOutlined className="text-blue-500" />} onClick={() => setProfileStudentId(r.id)} />
                </Space>
            )
        },
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <Title level={2}>{t('admin.registerNewStudent')}</Title>
            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form form={form} onFinish={handleRegister} layout="vertical" initialValues={{ gender: 'Male' }} onValuesChange={handleValuesChange}>
                    <Row gutter={16}>
                        <Col xs={24} md={12}><Form.Item label={t('admin.fullName')} name="name" rules={[{ required: true }, { validator: validateAmharic }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.baptismalNameField')} name="baptismalName" rules={[{ required: true }, { validator: validateAmharic }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.gender')} name="gender"><Select options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.dateOfEntry')} name="dateOfEntry" initialValue={dayjs()} extra={<EthiopianDatePreview value={regDateOfEntry} />}><DatePicker className="w-full" disabledDate={disabledDate} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true }]}><Select options={GRADE_OPTIONS} showSearch /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.parentContact')} name="parentContact" rules={[{ required: true }, { validator: validateEthiopianPhone }]}><Input maxLength={10} /></Form.Item></Col>
                    </Row>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>{t('admin.downloadTemplate')}</Button>
                        <Upload showUploadList={false} beforeUpload={handleImportFile}><Button icon={<UploadOutlined />}>{t('admin.importData')}</Button></Upload>
                        <Button type="primary" htmlType="submit" disabled={!isFormValid}>{t('common.save')}</Button>
                    </div>
                </Form>
            </Card>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <Input prefix={<SearchOutlined />} placeholder={t('admin.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} allowClear className="max-w-md" />
                <Select placeholder={t('admin.allGrades')} value={filterGrade} onChange={setFilterGrade} allowClear className="w-48" options={allGradeOptions} />
            </div>

            <Table columns={columns} dataSource={filteredStudents} rowKey="id" pagination={false} loading={isLoadingStudents} />

            <Modal title={t('admin.edit')} open={isEditModalVisible} onOk={handleEditSave} onCancel={() => setIsEditModalVisible(false)}>
                <Form form={editForm} layout="vertical">
                    <Row gutter={16}>
                        <Col xs={24} md={12}><Form.Item label={t('admin.fullName')} name="name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.baptismalNameField')} name="baptismalName" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true }]}><Select options={GRADE_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.parentContact')} name="parentContact" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    </Row>
                </Form>
            </Modal>
            <StudentProfile studentId={profileStudentId} visible={!!profileStudentId} onClose={() => setProfileStudentId(null)} />
        </div>
    );
}
