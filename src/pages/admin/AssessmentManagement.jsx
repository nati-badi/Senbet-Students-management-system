import React, { useState } from 'react';
import { Typography, Card, Form, Input, Button, Space, Table, Popconfirm, message, Row, Col, Select, DatePicker, Tag, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, WarningOutlined, AlertOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db } from '../../db/database';
import { GRADE_OPTIONS, formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import { formatEthiopianDate } from '../../utils/dateUtils';
import { supabase } from '../../utils/supabaseClient';
import { syncData } from '../../utils/sync';

const { Title, Text, Paragraph } = Typography;

export default function AssessmentManagement() {
    const { t, i18n } = useTranslation();
    const [modal, contextHolder] = Modal.useModal();
    const [form] = Form.useForm();
    const [editingId, setEditingId] = useState(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const selectedGrade = Form.useWatch('grade', form);
    const selectedSubject = Form.useWatch('subjectName', form);

    const allSubjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const subjects = (allSubjects || [])
        .filter(s => {
            if (!selectedGrade) return false;
            const sGrade = normalizeGrade(s.grade);
            const selGrade = normalizeGrade(selectedGrade);
            // Robust matching: Normalized match OR direct string match OR inclusive match
            return (sGrade && selGrade && sGrade === selGrade) || 
                   String(s.grade).trim() === String(selectedGrade).trim();
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', i18n.language === 'am' ? 'am' : 'en'));
    const settings = useLiveQuery(() => db.settings.toArray()) || [];
    const currentYear = settings.find(s => s.key === 'currentAcademicYear')?.value;

    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
    // Filter to only show assessments for the active academic year
    const assessments = (allAssessments || []).filter(a => !currentYear || a.academicYear === currentYear);

    const handleSave = async (values) => {
        try {
            const subject = allSubjects.find(s => s.name === values.subjectName);
            const semester = subject?.semester || 'Semester I';

            const data = {
                name: values.name,
                subjectName: values.subjectName,
                grade: values.grade,
                maxScore: parseFloat(values.maxScore),
                date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                semester: semester,
                academicYear: currentYear || computeEthiopianYear().toString(),
                synced: 0
            };

            if (editingId) {
                await db.assessments.update(editingId, {
                    ...data,
                    updated_at: new Date().toISOString()
                });
                message.success(t('common.save'));
            } else {
                await db.assessments.add({
                    id: crypto.randomUUID(),
                    ...data,
                    updated_at: new Date().toISOString()
                });
                message.success(t('admin.assessmentAdded'));
            }
            form.resetFields();
            setEditingId(null);
            setIsFormModalOpen(false);
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('admin.assessmentSaveError'));
        }
    };

    const handleEdit = (assessment) => {
        setEditingId(assessment.id);
        form.setFieldsValue({
            ...assessment,
            date: assessment.date ? dayjs(assessment.date) : null
        });
        setIsFormModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await db.assessments.delete(id);
            await db.deleted_records.add({ id: crypto.randomUUID(), tableName: 'assessments', recordId: id });
            message.success(t('admin.assessmentDeleted'));
            await syncData().catch(console.error);
        } catch (err) {
            message.error(t('admin.assessmentDeleteError'));
        }
    };

    const handleWipeAllMarks = () => {
        modal.confirm({
            title: <span className="text-red-600 dark:text-red-400 font-bold">{t('admin.dangerous.confirmTitle')}</span>,
            icon: <WarningOutlined className="text-red-500" />,
            content: (
                <div className="py-4">
                    <Paragraph type="danger" strong>
                        {t('admin.dangerous.confirmDesc')}
                    </Paragraph>
                    <Paragraph type="secondary" className="text-sm">
                        {t('admin.dangerous.confirmType')} <Text code strong className="text-red-600 dark:text-red-400">RESET</Text>
                    </Paragraph>
                    <Input 
                        placeholder={t('admin.dangerous.resetPlaceholder', 'Type RESET here')} 
                        className="dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        onChange={(e) => window._wipeConfirm = e.target.value}
                    />
                </div>
            ),
            okText: t('admin.dangerous.wipeEverything'),
            okType: 'danger',
            onOk: async () => {
                if (window._wipeConfirm !== 'RESET') {
                    message.error(t('admin.dangerous.wrongConfirm'));
                    return;
                }
                const hide = message.loading(t('admin.dangerous.wipingMarks'), 0);
                try {
                    const allMarks = await db.marks.toArray();
                    const allIds = allMarks.map(m => m.id);
                    
                    // Clear locally
                    await db.marks.clear();
                    
                    // Queue for remote deletion
                    if (allIds.length > 0) {
                        for (const id of allIds) {
                            await db.deleted_records.add({ id: crypto.randomUUID(), tableName: 'marks', recordId: id });
                        }
                        
                        // Chunked Supabase Wipe (500 records at a time)
                        for (let i = 0; i < allIds.length; i += 500) {
                            const chunk = allIds.slice(i, i + 500);
                            const { error: delError } = await supabase.from('marks').delete().in('id', chunk);
                            if (delError) console.error("Wipe chunk error:", delError);
                        }
                    }
                    
                    message.success(t('admin.dangerous.wipeSuccess', { count: allIds.length }));
                } catch (e) {
                    message.error(t('admin.dangerous.wipeFailed', { error: e.message }));
                } finally {
                    hide();
                    delete window._wipeConfirm;
                }
            }
        });
    };

    const columns = [
        { title: t('admin.name'), dataIndex: 'name', key: 'name' },
        { title: t('admin.subjects'), dataIndex: 'subjectName', key: 'subjectName' },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => formatGrade(text) },
        { title: t('admin.maxScore'), dataIndex: 'maxScore', key: 'maxScore' },
        { 
            title: t('admin.semester', 'Semester'), 
            key: 'semester', 
            render: (_, record) => {
                const subject = allSubjects.find(s => s.name === record.subjectName && normalizeGrade(s.grade) === normalizeGrade(record.grade));
                const sem = subject?.semester || 'Semester I';
                return <Tag color="gold">{t(`admin.${sem === 'Semester II' ? 'semester2' : 'semester1'}`, sem)}</Tag>;
            }
        },
        { 
            title: t('teacher.date'), 
            dataIndex: 'date', 
            key: 'date',
            render: (text) => formatEthiopianDate(text)
        },
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

    const closeModal = () => {
        setIsFormModalOpen(false);
        setEditingId(null);
        form.resetFields();
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            {contextHolder}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                <div>
                    <h2 className="text-2xl font-bold m-0">{t('admin.assessments')}</h2>
                    <span className="text-slate-500">{t('admin.manageAssessments')}</span>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    size="large" 
                    onClick={() => setIsFormModalOpen(true)}
                    className="rounded-xl shadow-md h-12 px-6 flex items-center gap-2 font-bold"
                >
                    {t('admin.addAssessment')}
                </Button>
            </div>

            <Modal
                title={<h3 className="text-lg font-bold m-0">{editingId ? t('admin.editAssessment') : t('admin.addAssessment')}</h3>}
                open={isFormModalOpen}
                onCancel={closeModal}
                footer={null}
                width={800}
                className="top-10"
                destroyOnClose
                forceRender
            >
                <div className="pt-4">
                    <Form form={form} onFinish={handleSave} layout="vertical">
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="grade"
                                    label={t('admin.grade')}
                                    rules={[{ required: true }]}
                                >
                                    <Select 
                                        options={GRADE_OPTIONS} 
                                        showSearch 
                                        placeholder={t('admin.selectGrade')}
                                        onChange={() => {
                                            form.setFieldsValue({ subjectName: undefined });
                                        }}
                                        className="w-full h-10"
                                    />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="subjectName"
                                    label={t('admin.subjects')}
                                    rules={[{ required: true }]}
                                >
                                    <Select 
                                        showSearch
                                        disabled={!selectedGrade}
                                        placeholder={!selectedGrade ? t('admin.selectGradeFirst') : t('admin.selectSubjectFirst')}
                                        className="w-full h-10"
                                    >
                                        {subjects.map(s => (
                                            <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="name"
                                    label={t('admin.assessmentName')}
                                    rules={[{ required: true }]}
                                >
                                    <Input 
                                        placeholder={!selectedSubject ? t('admin.selectSubjectFirst') : t('admin.assessmentNamePlaceholder')} 
                                        disabled={!selectedSubject} 
                                        className="h-10"
                                    />
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="maxScore"
                                    label={t('admin.maxScore')}
                                    rules={[{ required: true }]}
                                >
                                    <Input type="number" disabled={!selectedSubject} min={0} className="h-10" />
                                </Form.Item>
                            </Col>
                            <Col xs={24}>
                                <Form.Item
                                    name="date"
                                    label={t('teacher.date')}
                                >
                                    <DatePicker style={{ width: '100%' }} disabled={!selectedSubject} placeholder={t('admin.selectDate')} className="h-10" />
                                    {form.getFieldValue('date') && (
                                        <div className="mt-1 text-xs text-slate-500 italic">
                                            {formatEthiopianDate(form.getFieldValue('date').toDate())}
                                        </div>
                                    )}
                                </Form.Item>
                            </Col>
                        </Row>
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
                            <Button onClick={closeModal} size="large" className="rounded-xl px-6">
                                {t('admin.cancel')}
                            </Button>
                            <Button type="primary" htmlType="submit" size="large" className="rounded-xl px-10 font-bold">
                                {editingId ? t('common.save') : t('admin.addAssessment')}
                            </Button>
                        </div>
                    </Form>
                </div>
            </Modal>

            <Table
                columns={columns}
                dataSource={assessments}
                rowKey="id"
                scroll={{ x: 'max-content' }}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showQuickJumper: true,
                    position: ['bottomRight'],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                }}
                className="shadow-sm rounded-xl overflow-hidden"
            />
            <Card className="rounded-2xl border-none shadow-sm bg-red-50/50 dark:bg-red-900/10 border-t-4 border-t-red-500 mt-12 transition-all duration-300">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                        <Title level={4} style={{ margin: 0 }} className="text-red-600 dark:text-red-400 flex items-center gap-2">
                             <AlertOutlined /> {t('admin.dangerous.title')}
                        </Title>
                        <Text type="secondary" className="dark:text-slate-400">{t('admin.dangerous.desc')}</Text>
                    </div>
                    <Button 
                        danger 
                        type="primary" 
                        icon={<DeleteOutlined />} 
                        onClick={handleWipeAllMarks}
                        className="rounded-lg shadow-sm font-bold border-none"
                    >
                        {t('admin.dangerous.wipeMarks')}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
