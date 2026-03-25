import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Switch, Select, Input, Button, Table, Tag, message, Alert, Modal, Empty, Row, Col, Space, Tooltip } from 'antd';
import { CalendarOutlined, BookOutlined, RiseOutlined, CheckCircleOutlined, SaveOutlined, CalculatorOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
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
        if (currentSemSetting) setSemesterInput(currentSemSetting);
        setYearInput(computeEthiopianYear());
    }, [currentSemSetting, currentYearSetting]);

    // Handle initial load of students for promotion
    useEffect(() => {
        if (!selectedGrade || !allStudents || !allAssessments || !allMarks) {
            setStudentsToReview([]);
            return;
        }
        
        // Normalize grade checking exactly as done in StudentProfile
        const normalizeGrade = (g) => {
            if (!g) return '';
            const match = String(g).match(/(\d+)/);
            return match ? match[1] : g;
        };

        const studentGradeNorm = normalizeGrade(selectedGrade);
        const gradeAssessments = allAssessments.filter(a => normalizeGrade(a.grade) === studentGradeNorm);

        const filtered = allStudents.filter(s => s.grade === selectedGrade).map(s => {
            // Pre-calculate their grade status for validation
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
                action: 'promote', // default manual action initially
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
            message.error("Failed to update settings");
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
                        // Skip if missing marks
                        if (s.hasMissingMarks) {
                            return s; // Leaves their action as whatever it currently is (or a warning/flag later)
                        }

                        // Apply 50% logic
                        let newAction = 'promote';
                        if (s.percentage < 50) {
                            newAction = 'hold_back';
                        }
                        
                        return { ...s, action: newAction };
                    }));
                    setLoading(false);
                    message.success("Calculated promotions based on yearly averages.");
                }, 500); // Small UI buffer
            }
        });
    };

    const handleCommitPromotions = () => {
        Modal.confirm({
            title: t('admin.commitPromotions'),
            content: t('admin.commitPromotionsConfirm'),
            okText: t('common.save'),
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    setLoading(true);
                    
                    await db.transaction('rw', db.students, async () => {
                        for (const student of studentsToReview) {
                            if (student.action === 'promote') {
                                await db.students.update(student.id, { 
                                    grade: student.nextGradeResult, 
                                    synced: 0,
                                    updated_at: new Date().toISOString()
                                });
                            }
                            // If action is 'hold_back', we do nothing to the grade.
                            // If action is 'graduate', we could potentially set a status flag, but for now we might map them to '13' (Other/Graduate)
                            if (student.action === 'graduate') {
                                await db.students.update(student.id, { 
                                    grade: '13', 
                                    synced: 0,
                                    updated_at: new Date().toISOString()
                                });
                            }
                        }
                    });
                    
                    message.success(t('admin.promotionsSuccess'));
                    setSelectedGrade(null); // Reset wizard
                } catch (error) {
                    console.error("Promotion Error: ", error);
                    message.error("Failed to process student promotions.");
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const promotionColumns = [
        {
            title: t('admin.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <div className="flex items-center gap-2">
                    <div>
                        <Text strong>{text}</Text>
                        <br />
                        <Text type="secondary" className="text-xs">{record.baptismalName}</Text>
                    </div>
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
        <div className="space-y-6">
            <div>
                <Title level={2} style={{ margin: 0 }}>{t('admin.academicSetup')}</Title>
                <Text type="secondary">{t('admin.manageAcademicYear')}</Text>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={8}>
                    {/* Current Settings Panel */}
                    <Card 
                        title={<Space><CalendarOutlined /> {t('admin.currentSettings')}</Space>}
                        className="rounded-2xl border-none shadow-sm h-full"
                    >
                        <div className="space-y-4">
                            <div>
                                <Text strong className="block mb-2">{t('admin.activeAcademicYear')}</Text>
                                <Input 
                                    value={yearInput} 
                                    disabled
                                    className="bg-slate-50 text-slate-500 font-medium cursor-not-allowed"
                                />
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
                    {currentSemSetting === 'Semester II' ? (
                        <Card 
                            title={<Space><RiseOutlined className="text-green-600"/> {t('admin.studentPromotion')}</Space>}
                            className="rounded-2xl border-none shadow-sm h-full"
                        >
                            <Paragraph type="secondary">
                                {t('admin.promotionDesc')}
                            </Paragraph>

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

                            {selectedGrade && (
                                <>
                                    <Table 
                                        dataSource={displayedStudents}
                                        columns={promotionColumns}
                                        rowKey="id"
                                        pagination={{ pageSize: 10 }}
                                        size="small"
                                        className="mb-4"
                                    />

                                    {studentsToReview.length > 0 && (
                                        <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800">
                                            <Button 
                                                icon={<CalculatorOutlined />}
                                                onClick={handleAutoCalculate}
                                                disabled={loading}
                                            >
                                                {t('admin.autoCalculate')}
                                            </Button>

                                            <Button 
                                                type="primary" 
                                                icon={<CheckCircleOutlined />}
                                                onClick={handleCommitPromotions}
                                                loading={loading}
                                                className="bg-green-600 border-none shadow-md hover:bg-green-500"
                                            >
                                                {t('admin.commitPromotions')}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}

                            {!selectedGrade && (
                                <Empty description={t('admin.selectGradeToReview')} className="my-8" />
                            )}

                        </Card>
                    ) : (
                        <Card className="rounded-2xl border-none shadow-sm h-full flex items-center justify-center">
                            <Alert
                                type="info"
                                showIcon
                                message={t('admin.studentPromotion')}
                                description={t('admin.promotionSem2Only', 'The Student Promotion Wizard is only available at the end of the academic year (Semester II). Switch the active semester to Semester II to begin the promotion process.')}
                                className="rounded-xl"
                            />
                        </Card>
                    )}
                </Col>

            </Row>

        </div>
    );
};
