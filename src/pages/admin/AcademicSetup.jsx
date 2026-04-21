import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Switch, Select, Input, Button, Table, Tag, message, Alert, Modal, Empty, Row, Col, Space, Tooltip } from 'antd';
import { CalendarOutlined, BookOutlined, RiseOutlined, CheckCircleOutlined, SaveOutlined, CalculatorOutlined, SearchOutlined, WarningOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { GRADE_OPTIONS, formatGrade, getNextGrade } from '../../utils/gradeUtils';
import { computeEthiopianYear } from '../../utils/dateUtils';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

export default function AcademicSetup() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [yearInput, setYearInput] = useState(computeEthiopianYear());
    const [semesterInput, setSemesterInput] = useState('Semester I');
    const [wipeInput, setWipeInput] = useState('');
    const [rolloverYear, setRolloverYear] = useState(computeEthiopianYear() + 1);

    // Promotion State
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [studentsToReview, setStudentsToReview] = useState([]);
    const [searchText, setSearchText] = useState('');
    
    // Fetch live settings and students
    const settings = useLiveQuery(() => db.settings.toArray()) || [];
    const allStudents = useLiveQuery(() => db.students.toArray()) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const currentSemSetting = settings.find(s => s.key === 'currentSemester')?.value;
    const currentYearSetting = settings.find(s => s.key === 'currentAcademicYear')?.value;

    useEffect(() => {
        if (currentSemSetting && currentSemSetting !== semesterInput) {
            setSemesterInput(currentSemSetting);
        }
        const currentYear = currentYearSetting || computeEthiopianYear();
        if (currentYear !== yearInput) {
            setYearInput(currentYear);
        }
    }, [currentSemSetting, currentYearSetting, semesterInput, yearInput]);

    // Handle initial load of students for promotion
    useEffect(() => {
        if (!selectedGrade || !allStudents || !allAssessments || !allMarks) {
            setStudentsToReview([]);
            return;
        }
        
        const normalizeGrade = (g) => {
            if (!g) return '';
            const match = String(g).match(/(\d+)/);
            return match ? match[1] : g;
        };

        const studentGradeNorm = normalizeGrade(selectedGrade);
        const gradeAssessments = allAssessments.filter(a => normalizeGrade(a.grade) === studentGradeNorm);

        const filtered = allStudents.filter(s => s.grade === selectedGrade).map(s => {
            let hasMissingMarks = false;
            let totalMax = 0;
            let totalEarned = 0;

            gradeAssessments.forEach(a => {
                const mark = allMarks.find(m => m.studentId === s.id && m.assessmentId === a.id);
                if (!mark) {
                    hasMissingMarks = true;
                } else {
                    totalEarned += mark.score;
                }
                totalMax += (parseFloat(a.maxScore) || 0);
            });

            const percentage = totalMax > 0 ? ((totalEarned / totalMax) * 100) : 0;

            return {
                ...s,
                action: 'promote',
                nextGradeResult: getNextGrade(s.grade),
                hasMissingMarks,
                percentage
            };
        });
        
        setStudentsToReview(filtered);
    }, [selectedGrade, allStudents, allAssessments, allMarks]);

    // Handle Search filter
    const displayedStudents = useMemo(() => {
        if (!searchText) return studentsToReview;
        return studentsToReview.filter(s => 
            s.name.toLowerCase().includes(searchText.toLowerCase()) || 
            (s.baptismalName && s.baptismalName.toLowerCase().includes(searchText.toLowerCase()))
        );
    }, [studentsToReview, searchText]);

    const handleSaveSettings = async () => {
        try {
            setLoading(true);
            await db.transaction('rw', db.settings, async () => {
                await db.settings.put({ key: 'currentSemester', value: semesterInput });
                await db.settings.put({ key: 'currentAcademicYear', value: yearInput });
            });
            message.success(t('admin.settingsUpdated'));
        } catch (error) {
            console.error(error);
            message.error(t('admin.settingsUpdateFailed', 'Failed to update settings'));
        } finally {
            setLoading(false);
        }
    };

    const handleActionChange = (studentId, action) => {
        setStudentsToReview(prev => prev.map(s => {
            if (s.id === studentId) {
                return { ...s, action };
            }
            return s;
        }));
    };

    const handleAutoCalculate = () => {
        Modal.confirm({
            title: t('admin.autoCalculate'),
            content: t('admin.autoCalculateConfirm'),
            icon: <CalculatorOutlined className="text-blue-500" />,
            okText: t('common.yes', 'Yes'),
            cancelText: t('common.cancel'),
            onOk: () => {
                setLoading(true);
                setTimeout(() => {
                    setStudentsToReview(prev => prev.map(s => {
                        if (s.hasMissingMarks) return s;
                        let newAction = 'promote';
                        if (s.percentage < 50) newAction = 'hold_back';
                        return { ...s, action: newAction };
                    }));
                    setLoading(false);
                    message.success(t('admin.promotionsCalculated', 'Calculated promotions based on yearly averages.'));
                }, 500);
            }
        });
    };

    const handleCommitPromotions = () => {
        Modal.confirm({
            title: <span className="text-blue-600 font-bold">{t('admin.academicRollover', 'Finalize Academic Rollover')}</span>,
            content: (
                <div className="py-2">
                    <Paragraph>
                        You are about to promote these students and transition the entire school to a new academic year. 
                        <strong> This will reset the semester back to Semester I.</strong>
                    </Paragraph>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                        <Text strong>Target Academic Year:</Text>
                        <Input 
                            type="number" 
                            className="mt-2" 
                            value={rolloverYear} 
                            onChange={(e) => setRolloverYear(parseInt(e.target.value))}
                        />
                    </div>
                    <Alert 
                        type="warning" 
                        showIcon 
                        message={t('admin.verifyStudentActions', 'Verify student actions carefully before continuing.')} 
                    />
                </div>
            ),
            okText: t('admin.finalizeYear', 'Finalize & Start New Year'),
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    setLoading(true);
                    
                    await db.transaction('rw', [db.students, db.settings], async () => {
                        // 1. Promote/Update Students
                        for (const student of studentsToReview) {
                            const updates = { 
                                academicYear: rolloverYear, 
                                synced: 0,
                                updated_at: new Date().toISOString()
                            };

                            if (student.action === 'promote') {
                                updates.grade = student.nextGradeResult;
                            } else if (student.action === 'graduate') {
                                updates.archived = 1;
                            }
                            
                            await db.students.update(student.id, updates);
                        }

                        // 2. Global Transition
                        await db.settings.put({ key: 'currentSemester', value: 'Semester I' });
                        await db.settings.put({ key: 'currentAcademicYear', value: rolloverYear });
                    });
                    
                    message.success(t('admin.rolloverComplete', 'Academic year rollover complete!'));
                    setSelectedGrade(null);
                    const { syncData } = await import('../../utils/sync');
                    syncData().catch(console.error);
                } catch (error) {
                    console.error("Promotion Error: ", error);
                    message.error(t('admin.promotionFailed', 'Failed to process student promotions.'));
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleWipeDatabase = async () => {
        if (wipeInput !== 'WIPE EVERYTHING') {
            message.error(t('admin.wrongConfirmPhrase', 'Please type the confirmation phrase exactly.'));
            return;
        }

        const hide = message.loading(t('admin.wipingSystem', 'Wiping system data...'), 0);
        try {
            const { supabase } = await import('../../utils/supabaseClient');
            const tables = ['marks', 'attendance', 'assessments', 'students', 'teachers', 'subjects', 'deleted_records'];
            for (const table of tables) {
                await supabase.from(table).delete().not('id', 'is', null);
            }

            await db.students.clear();
            await db.attendance.clear();
            await db.marks.clear();
            await db.subjects.clear();
            await db.assessments.clear();
            await db.teachers.clear();
            if (db.deleted_records) await db.deleted_records.clear();

            message.success(t('admin.systemWiped', 'System wiped completely.'));
            setWipeInput('');
            window.location.reload();
        } catch (error) {
            message.error(`${t('admin.wipeFailedTitle', 'Wipe failed:')} ${error.message}`);
        } finally {
            hide();
        }
    };

    const promotionColumns = [
        {
            title: t('admin.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <div>
                    <Text strong>{text}</Text>
                    <br />
                    <Text type="secondary" className="text-xs">{record.baptismalName}</Text>
                </div>
            )
        },
        {
            title: t('admin.gradeClass'),
            dataIndex: 'grade',
            key: 'grade',
            render: text => formatGrade(text)
        },
        {
            title: '%',
            dataIndex: 'percentage',
            key: 'percentage',
            render: (p, record) => record.hasMissingMarks ? (
                 <Tooltip title={t('admin.missingMarks')}>
                     <Tag icon={<WarningOutlined />} color="warning">N/A</Tag>
                 </Tooltip>
            ) : <Tag color={p >= 50 ? 'green' : 'red'}>{p.toFixed(1)}%</Tag>
        },
        {
            title: t('admin.promotionAction'),
            key: 'action',
            width: 250,
            render: (_, record) => (
                <Select
                    value={record.action}
                    onChange={(val) => handleActionChange(record.id, val)}
                    style={{ width: '100%' }}
                >
                    <Select.Option value="promote"><span className="text-green-600">{t('admin.promoteToNext')} ({formatGrade(record.nextGradeResult)})</span></Select.Option>
                    <Select.Option value="hold_back"><span className="text-orange-500">{t('admin.holdBack')}</span></Select.Option>
                    <Select.Option value="graduate"><span className="text-blue-500">{t('admin.graduate')}</span></Select.Option>
                </Select>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-8 w-full">
            <div>
                <h2 className="text-2xl font-bold m-0">{t('admin.academicSetup')}</h2>
                <Text type="secondary">{t('admin.manageAcademicYear')}</Text>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} lg={8}>
                    <Card 
                        title={<Space><CalendarOutlined /> {t('admin.currentSettings')}</Space>}
                        className="rounded-2xl border-none shadow-sm h-full"
                    >
                        <div className="space-y-4">
                            <div>
                                <Text strong className="block mb-2">{t('admin.activeAcademicYear')}</Text>
                                <Input value={currentYearSetting || yearInput} disabled className="bg-slate-50 font-medium" />
                            </div>
                            
                            <div>
                                <Text strong className="block mb-2">{t('admin.activeSemester')}</Text>
                                <Select 
                                    value={semesterInput} 
                                    onChange={setSemesterInput}
                                    style={{ width: '100%' }}
                                >
                                    <Select.Option value="Semester I">{t('admin.semester1')}</Select.Option>
                                    <Select.Option value="Semester II">{t('admin.semester2')}</Select.Option>
                                </Select>
                            </div>

                            <Button 
                                type="primary" 
                                icon={<SaveOutlined />} 
                                onClick={handleSaveSettings}
                                loading={loading}
                                className="w-full bg-blue-600 mt-4"
                            >
                                {t('admin.updateSettings')}
                            </Button>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={16}>
                    <Card 
                        title={<Space><RiseOutlined className="text-green-600"/> {t('admin.academicRollover', 'New Year Rollover')}</Space>}
                        className="rounded-2xl border-none shadow-sm h-full"
                    >
                        <Paragraph type="secondary">
                            {t('admin.academicRolloverDesc', 'Move students to their next grades and prepare the system for the next academic year.')}
                        </Paragraph>

                        {currentSemSetting === 'Semester II' ? (
                            <>
                                <div className="flex gap-4 mb-6">
                                    <Select
                                        placeholder={t('admin.selectGradeToReview')}
                                        style={{ width: 250 }}
                                        onChange={setSelectedGrade}
                                        value={selectedGrade}
                                        options={GRADE_OPTIONS}
                                    />
                                    {selectedGrade && (
                                        <Input.Search
                                            placeholder={t('admin.searchStudent')}
                                            allowClear
                                            style={{ width: 300 }}
                                            onChange={(e) => setSearchText(e.target.value)}
                                            className="ml-auto"
                                        />
                                    )}
                                </div>

                                {selectedGrade ? (
                                    <>
                                        <Table 
                                            dataSource={displayedStudents}
                                            columns={promotionColumns}
                                            rowKey="id"
                                            pagination={{ pageSize: 10 }}
                                            size="small"
                                            className="mb-4"
                                        />
                                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                            <Button icon={<CalculatorOutlined />} onClick={handleAutoCalculate}>{t('admin.autoCalculate')}</Button>
                                            <Button 
                                                type="primary" 
                                                icon={<CheckCircleOutlined />} 
                                                onClick={handleCommitPromotions}
                                                className="bg-green-600 border-none shadow-md"
                                            >
                                                {t('admin.commitPromotions')}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <Empty description={t('admin.selectGradeBeginPromotions', 'Select a grade to begin promotions')} className="my-10" />
                                )}
                            </>
                        ) : (
                            <Alert
                                type="info"
                                showIcon
                                message={t('admin.startSemesterTwo', 'Start Semester II First')}
                                description={t('admin.rolloverWizardDesc', 'The Rollover Wizard is available at the end of Semester II. Switch the active semester to begin.')}
                                className="rounded-xl"
                            />
                        )}
                    </Card>
                </Col>
            </Row>

            <Card className="rounded-2xl border-none shadow-sm bg-red-50/50 dark:bg-red-900/10 border-t-4 border-t-red-500 mt-8">
                <div className="flex justify-between items-center flex-wrap gap-6">
                    <div className="max-w-xl">
                        <h4 className="text-lg font-bold text-red-600 flex items-center gap-2 m-0">
                            <WarningOutlined /> {t('admin.factoryReset', 'Factory Reset (Nuclear Option)')}
                        </h4>
                        <p className="text-slate-500 mt-2 text-sm leading-relaxed">
                            {t('admin.factoryResetDesc', 'This will permanently delete ALL students, teachers, grades, subjects, and assessments from both this device and the server. Only use this for a completely fresh installation.')}
                        </p>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[250px]">
                        <Input 
                            placeholder={t('admin.wipeEverythingPlaceholder', 'Type WIPE EVERYTHING to confirm')} 
                            value={wipeInput}
                            onChange={(e) => setWipeInput(e.target.value)}
                            className="border-red-200"
                        />
                        <Button 
                            danger 
                            type="primary" 
                            disabled={wipeInput !== 'WIPE EVERYTHING'}
                            icon={<DeleteOutlined />}
                            onClick={handleWipeDatabase}
                            className="font-bold h-10"
                        >
                            {t('admin.resetEntireSystem', 'Reset Entire System')}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
