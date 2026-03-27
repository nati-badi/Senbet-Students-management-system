import { useState } from 'react';
import { Typography, Card, Table, Button, Space, Modal, Form, Input, Select, Popconfirm, message, Tag, Tooltip, Switch } from 'antd';
import { UserAddOutlined, EditOutlined, DeleteOutlined, KeyOutlined, CopyOutlined } from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { syncData } from '../../utils/sync';
import { useTranslation } from 'react-i18next';
import { GRADE_OPTIONS, formatGrade, normalizeGrade, normalizeSubject } from '../../utils/gradeUtils';

const { Title } = Typography;

export default function TeacherManagement() {
    const { t } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState(null);
    const [form] = Form.useForm();
    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    const currentSemester = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    const teachers = useLiveQuery(() => db.teachers?.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const students = useLiveQuery(() => db.students.toArray()) || [];

    const dbGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const gradeOptions = [
        ...GRADE_OPTIONS,
        ...dbGrades
            .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
            .map(g => ({ value: String(g), label: formatGrade(g) }))
    ];

    // Helper to filter and group subjects by grade
    const watchedGrades = Form.useWatch('assignedGrades', form) || [];
    const availableSubjects = subjects.filter(s => 
        (s.semester || 'Semester I') === currentSemester &&
        watchedGrades.some(g => normalizeGrade(g) === normalizeGrade(s.grade))
    );

    const subjectOptions = availableSubjects.map(s => ({
        label: `[${formatGrade(s.grade)}] ${s.name}`,
        value: s.name // Storing just the name for simplicity, as per current schema
    }));

    const showModal = (teacher = null) => {
        setEditingTeacher(teacher);
        if (teacher) {
            form.setFieldsValue({
                ...teacher,
                canCreateAssessments: !!(teacher.canCreateAssessments ?? teacher.cancreateassessments),
                assignedGrades: teacher.assignedGrades || [],
                assignedSubjects: teacher.assignedSubjects || []
            });
        } else {
            form.resetFields();
        }
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
        setEditingTeacher(null);
    };

    const handleSave = async (values) => {
        try {
            const myGrades = values.assignedGrades || [];
            const mySubjects = values.assignedSubjects || [];

            // Check for conflicts with other teachers
            for (const t of teachers) {
                if (editingTeacher && t.id === editingTeacher.id) continue;
                
                // 1. Identity checks for duplication
                if (values.accessCode && (t.accessCode === values.accessCode || t.accesscode === values.accessCode)) {
                    message.error(`Access code "${values.accessCode}" is already in use by ${t.name}`);
                    return;
                }
                
                if (values.phone && t.phone === values.phone) {
                    message.error(`Phone number "${values.phone}" is already registered to ${t.name}`);
                    return;
                }

                if (t.name.toLowerCase().trim() === values.name.toLowerCase().trim()) {
                    message.error(`Teacher with name "${values.name}" already exists.`);
                    return;
                }

                // 2. Assignment conflicts (same subject/grade pair)
                const otherGrades = t.assignedGrades || [];
                const otherSubjects = t.assignedSubjects || [];

                const overlapGrades = otherGrades.filter(og => 
                    myGrades.some(mg => normalizeGrade(mg) === normalizeGrade(og))
                );
                const overlapSubjects = otherSubjects.filter(os => 
                    mySubjects.some(ms => normalizeSubject(ms) === normalizeSubject(os))
                );

                if (overlapGrades.length > 0 && overlapSubjects.length > 0) {
                    const gradeList = overlapGrades.map(g => formatGrade(g)).join(', ');
                    const subjectList = overlapSubjects.join(', ');
                    message.error(`Conflict: ${t.name} is already assigned to ${subjectList} in ${gradeList}`);
                    return; // Block save
                }
            }

            if (editingTeacher) {
                await db.teachers.update(editingTeacher.id, { 
                    ...values, 
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                message.success('Teacher updated successfully');
            } else {
                await db.teachers.add({
                    id: crypto.randomUUID(),
                    ...values,
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                message.success('Teacher added successfully');
            }
            syncData().catch(console.error);
            handleCancel();
        } catch (error) {
            console.error('Error saving teacher:', error);
            message.error('Failed to save teacher');
        }
    };

    const copyToClipboard = async (text) => {
        const val = String(text || '').trim();
        if (!val || val === 'null' || val === 'undefined') {
            message.warning('No valid data to copy');
            return;
        }
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(val);
                message.success('Copied');
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = val;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                message.success('Copied');
            }
        } catch {
            message.error('Copy failed');
        }
    };

    const generateAccessCode = () => Math.floor(100000 + Math.random() * 900000).toString();

    const handleDelete = async (id) => {
        try {
            await db.teachers.delete(id);
            await db.deleted_records.add({ tableName: 'teachers', recordId: id });
            message.success('Teacher deleted successfully');
            syncData().catch(console.error);
        } catch (error) {
            console.error('Error deleting teacher:', error);
            message.error('Failed to delete teacher');
        }
    };

    const columns = [
        {
            title: t('admin.name'),
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => (a.name || '').localeCompare(b.name || '')
        },
        {
            title: t('admin.contact'),
            dataIndex: 'phone',
            key: 'phone'
        },
        {
            title: 'Access Code',
            dataIndex: 'accessCode',
            key: 'accessCode',
            width: 140,
            render: (code, record) => {
                const actualCode = code || record.accessCode || record.accesscode;
                if (!actualCode) return <Tag color="default">—</Tag>;
                
                return (
                    <Space size="small">
                        <Tag color="gold" className="font-mono">{actualCode}</Tag>
                        <Tooltip title="Copy code">
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<CopyOutlined />} 
                                onClick={() => copyToClipboard(actualCode)} 
                            />
                        </Tooltip>
                    </Space>
                );
            }
        },
        {
            title: 'Assigned Grades',
            dataIndex: 'assignedGrades',
            key: 'assignedGrades',
            render: (grades) => grades?.map(g => <Tag color="blue" key={g}>{formatGrade(g)}</Tag>)
        },
        {
            title: 'Assigned Subjects',
            dataIndex: 'assignedSubjects',
            key: 'assignedSubjects',
            render: (subs) => subs?.map(s => <Tag color="purple" key={s}>{s}</Tag>)
        },
        {
            title: 'Permissions',
            key: 'permissions',
            render: (_, record) => (record.canCreateAssessments || record.cancreateassessments) ? <Tag color="green">Manage Assessments</Tag> : <Tag color="default">View Only</Tag>
        },
        {
            title: t('common.actions'),
            key: 'actions',
            align: 'right',
            render: (_, record) => (
                <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => showModal(record)} />
                    <Popconfirm
                        title="Are you sure you want to delete this teacher?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex justify-between items-center">
                <Title level={2} style={{ margin: 0 }}>{t('admin.teacherManagement', 'Teacher Management')}</Title>
                <Button 
                    type="primary" 
                    icon={<UserAddOutlined />} 
                    onClick={() => showModal()}
                    className="font-bold rounded-xl"
                >
                    Add Teacher
                </Button>
            </div>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                <Table 
                    columns={columns} 
                    dataSource={teachers}
                    rowKey="id"
                    pagination={{ pageSize: 15 }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            <Modal
                title={editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
                open={isModalVisible}
                onCancel={handleCancel}
                onOk={() => form.submit()}
                destroyOnClose
                okText="Save"
                className="rounded-2xl overflow-hidden"
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSave}
                    className="mt-4"
                >
                    <Form.Item
                        name="name"
                        label={t('admin.name')}
                        rules={[{ required: true, message: 'Please input the teacher name!' }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="phone"
                        label={t('admin.contact')}
                        rules={[{ required: true, message: 'Please input the phone number!' }]}
                    >
                        <Input type="tel" />
                    </Form.Item>

                    <Form.Item
                        name="accessCode"
                        label="Teacher Access Code"
                        rules={[{ required: true, message: 'Please set an access code' }]}
                        extra="Teachers use this code to log in to the Teacher Portal."
                    >
                        <Input
                            addonBefore={<KeyOutlined />}
                            placeholder="6-digit code"
                            maxLength={6}
                            suffix={
                                <Button
                                    type="text"
                                    size="small"
                                    onClick={() => form.setFieldsValue({ accessCode: generateAccessCode() })}
                                >
                                    Generate
                                </Button>
                            }
                        />
                    </Form.Item>

                    <Form.Item
                        name="assignedGrades"
                        label="Assigned Grades"
                    >
                        <Select 
                            mode="multiple" 
                            options={gradeOptions} 
                            placeholder="Select grades they teach"
                        />
                    </Form.Item>

                    <Form.Item
                        name="assignedSubjects"
                        label="Assigned Subjects"
                    >
                        <Select 
                            mode="multiple" 
                            options={subjectOptions} 
                            placeholder={watchedGrades.length === 0 ? "Select grades first" : "Select subjects they teach"}
                            disabled={watchedGrades.length === 0}
                        />
                    </Form.Item>

                    <Form.Item
                        name="canCreateAssessments"
                        valuePropName="checked"
                        label="Assessment Permissions"
                        extra="Allow teacher to create & manage assessments"
                    >
                        <Switch checkedChildren="Yes" unCheckedChildren="No" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
