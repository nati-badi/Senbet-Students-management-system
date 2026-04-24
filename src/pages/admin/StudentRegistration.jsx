import React, { useState, useEffect } from 'react';
import { Typography, Row, Col, Card, Form, Input, Select, DatePicker, Button, Table, Tag, Space, Tooltip, Popconfirm, App, Upload, Skeleton, Empty, Modal, Tabs, Badge, Alert } from 'antd';
import { SearchOutlined, FilterOutlined, DownloadOutlined, UploadOutlined, EditOutlined, DeleteOutlined, UserOutlined, CopyOutlined, KeyOutlined, UserAddOutlined, ExportOutlined, ImportOutlined, TeamOutlined, RiseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { db } from '../../db/database';
import { syncData } from '../../utils/sync';
import { GRADE_OPTIONS, formatGrade, normalizeGrade, disabledDate } from '../../utils/gradeUtils';
import { validateAmharic, validateEthiopianPhone } from '../../utils/validators';
import { formatEthiopianDate, getEthiopianYear } from '../../utils/dateUtils';
import StudentProfile from '../../components/StudentProfile';

const { Title, Text } = Typography;

export default function StudentRegistration() {
    const [form] = Form.useForm();
    const [editForm] = Form.useForm();
    const [promoteForm] = Form.useForm();
    const { t } = useTranslation();
    const { message, notification, modal } = App.useApp();

    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState(() => {
        try {
            return sessionStorage.getItem('admin_students_search') || '';
        } catch {
            return '';
        }
    });
    const [filterGrade, setFilterGrade] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const [profileStudentId, setProfileStudentId] = useState(null);
    const [activeTab, setActiveTab] = useState('active');
    const [isPromoteModalVisible, setIsPromoteModalVisible] = useState(false);
    const [promotingStudent, setPromotingStudent] = useState(null);
    const [importPreview, setImportPreview] = useState([]);
    const [isImportPreviewVisible, setIsImportPreviewVisible] = useState(false);
    const [importErrors, setImportErrors] = useState(0);

    const studentsData = useLiveQuery(() => db.students.orderBy('name').toArray());
    const students = studentsData || [];
    const isLoadingStudents = studentsData === undefined;

    const handleValuesChange = (_, allValues) => {
        setIsFormValid(!!(allValues.name && allValues.grade));
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
                modal.confirm({
                    title: t('admin.duplicateNameTitle'),
                    content: t('admin.duplicateNameContent', { name: values.name }),
                    okText: t('admin.registerDuplicate'),
                    cancelText: t('admin.cancelAction'),
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
                portalCode: values.portalCode || Math.floor(100000 + Math.random() * 900000).toString(),
                academicYear,
                synced: 0,
                updated_at: new Date().toISOString()
            });
            form.resetFields();
            form.setFieldsValue({ dateOfEntry: dayjs() });
            setIsFormValid(false);
            message.success(t('admin.studentRegistered'));
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('admin.studentRegisterFailed'));
        }
    };

    const handleDelete = async (id) => {
        try {
            await db.students.delete(id);
            await db.deleted_records.add({ id: crypto.randomUUID(), tableName: 'students', recordId: id });
            message.success(t('admin.studentDeleted'));
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('admin.deleteFailed'));
        }
    };

    const handleArchive = async (id) => {
        try {
            await db.students.update(id, { 
                archived: 1, 
                synced: 0, 
                updated_at: new Date().toISOString() 
            });
            message.success(t('admin.studentArchived'));
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('admin.archiveFailed'));
        }
    };

    const handleRestore = async (id, name) => {
        modal.confirm({
            title: t('admin.restoreTitle'),
            content: t('admin.restoreContent', { name }),
            okText: t('admin.restore'),
            onOk: async () => {
                try {
                    await db.students.update(id, { 
                        archived: 0, 
                        synced: 0, 
                        updated_at: new Date().toISOString() 
                    });
                    message.success(t('admin.studentRestored'));
                    await syncData().catch(console.error);
                } catch (err) {
                    message.error(t('admin.restoreFailed'));
                }
            }
        });
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
                synced: 0,
                updated_at: new Date().toISOString()
            });
            setIsEditModalVisible(false);
            message.success(t('admin.studentUpdated'));
            await syncData().catch(console.error);
        } catch (err) {
            console.error("Failed to edit student:", err);
        }
    };

    const showPromoteModal = (student) => {
        setPromotingStudent(student);
        const currentGradeNum = normalizeGrade(student.grade);
        const nextGradeNum = currentGradeNum + 1;
        const nextGradeOption = GRADE_OPTIONS.find(o => normalizeGrade(o.value) === nextGradeNum);
        
        // Default to next year if year is in ISO format
        let nextYear = student.academicYear;
        try {
            const date = dayjs(student.academicYear);
            if (date.isValid()) {
                nextYear = date.add(1, 'year').toISOString();
            }
        } catch (e) {}

        promoteForm.setFieldsValue({
            grade: nextGradeOption ? nextGradeOption.value : student.grade,
            academicYear: dayjs(nextYear)
        });
        setIsPromoteModalVisible(true);
    };

    const handlePromoteSave = async () => {
        try {
            const values = await promoteForm.validateFields();
            const academicYear = values.academicYear.toISOString();

            await db.students.update(promotingStudent.id, {
                grade: values.grade,
                academicYear,
                archived: 0, // Ensure they are active if promoted from archive
                synced: 0,
                updated_at: new Date().toISOString()
            });
            
            setIsPromoteModalVisible(false);
            message.success(t('admin.promotedSuccess', { name: promotingStudent.name }));
            await syncData().catch(console.error);
        } catch (err) {
            console.error("Promotion failed:", err);
        }
    };

    const copyToClipboard = async (text) => {
        const val = String(text || '').trim();
        if (!val || val === 'null' || val === 'undefined') {
            message.warning(t('common.noDataToCopy', 'No valid data to copy'));
            return;
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(val);
                message.success(t('common.copied', 'Copied to clipboard!'));
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = val;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    message.success(t('common.copied', 'Copied to clipboard!'));
                } else {
                    throw new Error('Copy command failed');
                }
            }
        } catch (err) {
            console.error('Clipboard error:', err);
            message.error(t('common.copyFailed', 'Failed to copy. Please copy manually.'));
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
                notification.error({ title: t('admin.missingColumnsError') });
                return;
            }

            const name = String(row[nameKey] ?? '').trim();
            const grade = normalizeGrade(row[gradeKey]);

            // Track validation issues per row
            const issues = [];
            if (!name) issues.push(t('admin.missingName', 'Missing name'));
            if (!grade) issues.push(t('admin.missingGrade', 'Missing grade'));

            let gender = String(row[genderKey] ?? '').trim().toLowerCase().startsWith('f') ? 'Female' : 'Male';
            let contact = String(row[contactKey] ?? '').trim();
            if (contact.length === 9 && !contact.startsWith('0')) contact = '0' + contact;
            if (contact && (contact.length !== 10 || !contact.startsWith('0'))) {
                issues.push(t('admin.invalidPhone', 'Invalid phone'));
            }

            const academicYear = dateKey ? String(row[dateKey] ?? '').trim() : new Date().toISOString();
            if (!academicYear) missingDateCount++;

            // Check for duplicates in existing students
            const isDuplicate = name && students.some(s => s.name.trim().toLowerCase() === name.toLowerCase() && normalizeGrade(s.grade) === grade);
            if (isDuplicate) issues.push(t('admin.duplicateStudent', 'Duplicate'));

            if (!name || !grade) { errorCount++; }

            bulkStudents.push({
                id: crypto.randomUUID(),
                name,
                baptismalName: String(row[baptKey] ?? '').trim(),
                gender,
                academicYear,
                grade,
                parentContact: contact,
                synced: 0,
                _issues: issues,
            });
        }

        // Show preview instead of committing directly
        setImportPreview(bulkStudents);
        setImportErrors(errorCount);
        setIsImportPreviewVisible(true);
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

    const handleGenerateAllCodes = async () => {
        try {
            const missing = students.filter(s => {
                const code = s.portalCode || s.portalcode;
                return !code || String(code).trim() === '';
            });
            
            if (missing.length === 0) {
                message.info(t('admin.allCodesExist'));
                return;
            }

            const usedCodes = new Set(students.map(s => s.portalCode || s.portalcode).filter(Boolean));
            const generateUniqueCode = () => {
                let code;
                do {
                    code = Math.floor(100000 + Math.random() * 900000).toString();
                } while (usedCodes.has(code));
                usedCodes.add(code);
                return code;
            };

            for (const s of missing) {
                await db.students.update(s.id, { 
                    portalCode: generateUniqueCode(),
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
            }
            
            message.success(t('admin.codesGenerated', { count: missing.length }));
            await syncData().catch(console.error);
        } catch (error) {
            console.error('Error generating codes:', error);
            message.error(t('admin.codesGenerateFailed'));
        }
    };

    const handleSingleGenerate = async (id) => {
        try {
            const usedCodes = new Set(students.map(s => s.portalCode || s.portalcode).filter(Boolean));
            let code;
            do {
                code = Math.floor(100000 + Math.random() * 900000).toString();
            } while (usedCodes.has(code));

            await db.students.update(id, { 
                portalCode: code,
                synced: 0,
                updated_at: new Date().toISOString()
            });
            message.success(t('admin.codeGenerated'));
            await syncData().catch(console.error);
        } catch (error) {
            message.error(t('admin.codeGenerateFailed'));
        }
    };

    const filteredStudents = students.filter(s => {
        // Filter by Tab (Active vs Archive)
        const isArchived = s.archived === 1;
        if (activeTab === 'active' && isArchived) return false;
        if (activeTab === 'archive' && !isArchived) return false;

        const query = (searchQuery || "").toLowerCase();
        const matchesSearch = (s.name || "").toLowerCase().includes(query) ||
            (s.baptismalName || s.baptismalname || "").toLowerCase().includes(query) ||
            (s.parentContact || s.parentcontact || "").includes(searchQuery);
        const matchesGrade = !filterGrade || String(s.grade) === String(filterGrade);
        return matchesSearch && matchesGrade;
    });

    useEffect(() => {
        try {
            if (searchQuery) sessionStorage.removeItem('admin_students_search');
        } catch {
            // ignore
        }
    }, []);

    const columns = [
        { 
            title: t('admin.name'), 
            dataIndex: 'name', 
            key: 'name', 
            sorter: (a, b) => (a.name || '').localeCompare(b.name || '') 
        },
        { 
            title: t('admin.baptismalName'), 
            dataIndex: 'baptismalName', 
            key: 'baptismalName', 
            render: (v, r) => v || r.baptismalname || '—',
            sorter: (a, b) => (a.baptismalName || a.baptismalname || '').localeCompare(b.baptismalName || b.baptismalname || '') 
        },
        { 
            title: t('admin.gender'), 
            dataIndex: 'gender', 
            render: (t) => <Tag color={t === 'Male' ? 'blue' : 'magenta'}>{t || '—'}</Tag>, 
            sorter: (a, b) => (a.gender || '').localeCompare(b.gender || '') 
        },
        { 
            title: t('admin.grade'), 
            dataIndex: 'grade', 
            render: (t) => <Tag color="green">{formatGrade(t)}</Tag>, 
            sorter: (a, b) => normalizeGrade(a.grade) - normalizeGrade(b.grade) 
        },
        { 
            title: t('admin.portalCode'), 
            dataIndex: 'portalCode', 
            key: 'portalCode',
            width: 140,
            render: (code, record) => {
                const actualCode = code || record.portalCode || record.portalcode;
                if (!actualCode || String(actualCode).trim() === '') {
                    return (
                        <Button 
                            type="link" 
                            size="small" 
                            onClick={() => handleSingleGenerate(record.id)}
                            className="p-0 h-auto text-xs"
                        >
                            {t('common.generate')}
                        </Button>
                    );
                }
                
                return (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Text copyable={{ 
                            text: actualCode,
                            icon: [<CopyOutlined key="copy-icon" className="text-slate-400 hover:text-blue-500 transition-colors" />, <CheckCircleOutlined key="check-icon" className="text-green-500" />],
                            tooltips: [t('common.copy', 'Copy Code'), t('common.copied', 'Copied!')]
                        }} style={{ fontFamily: 'monospace', fontWeight: '800', letterSpacing: '0.5px' }} className="bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                            {actualCode}
                        </Text>
                    </div>
                );
            }
        },
        { 
            title: t('admin.contact'), 
            dataIndex: 'parentContact',
            render: (v, r) => v || r.parentcontact || '—'
        },
        { 
            title: t('admin.dateOfEntry'), 
            dataIndex: 'academicYear', 
            render: (t) => <span className="text-xs text-slate-500">{formatEthiopianDate(t)}</span>, 
            sorter: (a, b) => new Date(a.academicYear || 0) - new Date(b.academicYear || 0) 
        },
        {
            title: t('common.actions'), key: 'actions', align: 'right', render: (_, r) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => showEditModal(r)} />
                    {r.archived === 1 ? (
                        <Tooltip title={t('admin.restoreToActive')}>
                            <Button type="text" icon={<ImportOutlined className="text-green-500" />} onClick={() => handleRestore(r.id, r.name)} />
                        </Tooltip>
                    ) : (
                        <Tooltip title={t('admin.archiveGraduate')}>
                            <Button type="text" icon={<ExportOutlined className="text-orange-500" />} onClick={() => handleArchive(r.id)} />
                        </Tooltip>
                    )}
                    <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => handleDelete(r.id)}><Button type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
                    <Tooltip title={t('admin.promote', 'Promote to Next Grade')}>
                        <Button type="text" icon={<RiseOutlined className="text-amber-500" />} onClick={() => showPromoteModal(r)} />
                    </Tooltip>
                    <Button type="text" icon={<UserOutlined className="text-blue-500" />} onClick={() => setProfileStudentId(r.id)} />
                </Space>
            )
        },
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <h2 className="text-2xl font-bold mb-6">{t('admin.registerNewStudent')}</h2>
            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                <Form form={form} onFinish={handleRegister} layout="vertical" initialValues={{ gender: 'Male' }} onValuesChange={handleValuesChange}>
                    <Row gutter={16}>
                        <Col xs={24} md={12}><Form.Item label={t('admin.fullName')} name="name" rules={[{ required: true }, { validator: validateAmharic }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.baptismalNameField')} name="baptismalName" rules={[{ required: true }, { validator: validateAmharic }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.gender')} name="gender"><Select options={[{ value: 'Male', label: t('admin.male') }, { value: 'Female', label: t('admin.female') }]} /></Form.Item></Col>
                        <Col xs={24} md={12}>
                            <Form.Item label={t('admin.dateOfEntry')} name="dateOfEntry" initialValue={dayjs()} extra={regDateOfEntry ? <EthiopianDatePreview value={regDateOfEntry} /> : null}>
                                <DatePicker className="w-full" disabledDate={disabledDate} placeholder={t('admin.selectDate')} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true }]}><Select options={GRADE_OPTIONS} showSearch /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.portalAccessCode')} name="portalCode" tooltip={t('admin.portalCodeTooltip')}><Input placeholder={t('admin.autoGeneratePlaceholder')} maxLength={6} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.parentContact')} name="parentContact" rules={[{ required: true }, { validator: validateEthiopianPhone }]}><Input maxLength={10} /></Form.Item></Col>
                    </Row>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                            {t('admin.downloadTemplate')}
                        </Button>
                        <Upload showUploadList={false} beforeUpload={handleImportFile}><Button icon={<UploadOutlined />}>{t('admin.importData')}</Button></Upload>
                        <Button type="primary" htmlType="submit" disabled={!isFormValid}>{t('common.save')}</Button>
                    </div>
                </Form>
            </Card>

            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <FilterOutlined className="text-slate-500" />
                    <span className="text-slate-500 font-bold text-sm uppercase tracking-wide">{t('admin.filterStudents')}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Input prefix={<SearchOutlined />} placeholder={t('admin.searchPlaceholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} allowClear className="max-w-md" />
                    <Select
                        placeholder={`← ${t('admin.allGrades')} ${t('admin.filterByGrade')}`}
                        value={filterGrade}
                        onChange={setFilterGrade}
                        allowClear
                        className="w-64"
                        options={allGradeOptions}
                        popupMatchSelectWidth={false}
                    />
                    <div className="flex-1" />
                    <Button 
                        icon={<KeyOutlined className="text-amber-500" />} 
                        onClick={handleGenerateAllCodes}
                        className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl"
                    >
                        {t('admin.fixMissingCodes')}
                    </Button>
                </div>
            </div>

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab}
                className="mt-4"
                items={[
                    {
                        key: 'active',
                        label: (
                            <span className="flex items-center gap-2 px-2">
                                <TeamOutlined /> {t('admin.activeStudents', 'Active Students')}
                                <Badge count={students.filter(s => !s.archived).length} className="ml-1" overflowCount={999} style={{ backgroundColor: '#10b981' }} />
                            </span>
                        )
                    },
                    {
                        key: 'archive',
                        label: (
                            <span className="flex items-center gap-2 px-2">
                                <ExportOutlined /> {t('admin.archiveGraduated', 'Archive (Graduated)')}
                                <Badge count={students.filter(s => s.archived === 1).length} className="ml-1" overflowCount={999} style={{ backgroundColor: '#f59e0b' }} />
                            </span>
                        )
                    }
                ]}
            />

            <Table
                columns={columns}
                dataSource={filteredStudents}
                rowKey="id"
                loading={isLoadingStudents}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showQuickJumper: true,
                    position: ['bottomRight'],
                    showTotal: (total, range) => `${range[0]}-${range[1]} ${t('common.paginationOf')} ${total}`,
                }}
            />

            <Modal title={t('admin.edit')} open={isEditModalVisible} onOk={handleEditSave} onCancel={() => setIsEditModalVisible(false)} forceRender={true}>
                <Form form={editForm} layout="vertical">
                    <Row gutter={16}>
                        <Col xs={24} md={12}><Form.Item label={t('admin.fullName')} name="name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.baptismalNameField')} name="baptismalName" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.gradeClass')} name="grade" rules={[{ required: true }]}><Select options={GRADE_OPTIONS} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.portalCode', 'Portal Access Code')} name="portalCode" rules={[{ required: true }]}><Input maxLength={6} /></Form.Item></Col>
                        <Col xs={24} md={12}><Form.Item label={t('admin.parentContact')} name="parentContact" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    </Row>
                </Form>
            </Modal>

            <Modal title={<span><RiseOutlined className="text-amber-500 mr-2" /> {t('admin.promoteStudent', 'Promote Student')}</span>} open={isPromoteModalVisible} onOk={handlePromoteSave} onCancel={() => setIsPromoteModalVisible(false)} forceRender={true} okText={t('admin.promote', 'Promote')}>
                <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">{t('admin.promotingStudent')}</div>
                    <div className="text-lg font-bold text-slate-800">{promotingStudent?.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{t('admin.currentGradeLabel')} {promotingStudent?.grade} ({getEthiopianYear(promotingStudent?.academicYear)})</div>
                </div>
                <Form form={promoteForm} layout="vertical">
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item label={t('admin.promoteToGrade', 'Promote to Grade')} name="grade" rules={[{ required: true }]}>
                                <Select options={GRADE_OPTIONS} />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label={t('admin.newAcademicYear', 'Effective Academic Year')} name="academicYear" rules={[{ required: true }]} extra={<EthiopianDatePreview value={Form.useWatch('academicYear', promoteForm)} />}>
                                <DatePicker className="w-full" disabledDate={disabledDate} placeholder={t('admin.selectDate')} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Alert 
                        type="info" 
                        showIcon 
                        message={t('admin.promoteAlertInfo')} 
                    />
                </Form>
            </Modal>

            {/* ── Import Preview Modal ── */}
            <Modal
                title={<span className="flex items-center gap-2"><ImportOutlined /> {t('admin.importPreviewTitle', 'Preview Import Data')}</span>}
                open={isImportPreviewVisible}
                onCancel={() => { setIsImportPreviewVisible(false); setImportPreview([]); }}
                width={900}
                footer={[
                    <Button key="cancel" onClick={() => { setIsImportPreviewVisible(false); setImportPreview([]); }}>
                        {t('admin.cancelAction', 'Cancel')}
                    </Button>,
                    <Button
                        key="confirm"
                        type="primary"
                        disabled={importPreview.filter(r => !r._issues?.length || r._issues.every(i => i.includes('Duplicate') || i.includes('ተመሳሳይ'))).length === 0}
                        onClick={async () => {
                            const validRows = importPreview.filter(r => r.name && r.grade);
                            const cleaned = validRows.map(({ _issues, ...rest }) => rest);
                            if (cleaned.length > 0) {
                                await db.students.bulkAdd(cleaned);
                                notification.success({ message: t('admin.importSuccess', { count: cleaned.length }) });
                            }
                            setIsImportPreviewVisible(false);
                            setImportPreview([]);
                        }}
                    >
                        <CheckCircleOutlined /> {t('admin.confirmImport', 'Confirm Import')} ({importPreview.filter(r => r.name && r.grade).length})
                    </Button>,
                ]}
            >
                {importErrors > 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        className="mb-4"
                        message={t('admin.importWarningRows', { count: importErrors }) || `${importErrors} rows have issues and will be skipped.`}
                    />
                )}
                <Table
                    dataSource={importPreview}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 700 }}
                    rowClassName={(record) => record._issues?.length ? 'bg-red-50 dark:bg-red-950/20' : 'bg-green-50 dark:bg-green-950/20'}
                    columns={[
                        {
                            title: '#',
                            width: 50,
                            render: (_, __, i) => i + 1,
                        },
                        {
                            title: t('admin.fullName'),
                            dataIndex: 'name',
                            render: (v) => v || <Text type="danger">—</Text>,
                        },
                        {
                            title: t('admin.baptismalNameField', 'Baptismal'),
                            dataIndex: 'baptismalName',
                            render: (v) => v || <Text type="secondary">—</Text>,
                        },
                        {
                            title: t('admin.gradeClass'),
                            dataIndex: 'grade',
                            width: 90,
                            render: (v) => v ? formatGrade(v) : <Text type="danger">—</Text>,
                        },
                        {
                            title: t('admin.gender', 'Gender'),
                            dataIndex: 'gender',
                            width: 80,
                        },
                        {
                            title: t('admin.parentContact'),
                            dataIndex: 'parentContact',
                            width: 120,
                        },
                        {
                            title: t('admin.status', 'Status'),
                            dataIndex: '_issues',
                            width: 180,
                            render: (issues) => {
                                if (!issues || issues.length === 0) return <Tag color="green">{t('admin.valid', 'Valid')}</Tag>;
                                return issues.map((issue, i) => <Tag key={i} color={issue.includes('Duplicate') || issue.includes('ተመሳሳይ') ? 'orange' : 'red'}>{issue}</Tag>);
                            },
                        },
                    ]}
                />
            </Modal>

            <StudentProfile studentId={profileStudentId} visible={!!profileStudentId} onClose={() => setProfileStudentId(null)} />
        </div>
    );
}
