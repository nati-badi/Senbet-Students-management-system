import React, { useState, useMemo } from 'react';
import { Typography, Card, List, Avatar, Tag, Empty, Badge, Alert, Row, Col, Statistic, Button, Space, Tooltip, Modal, Input, App, Pagination } from 'antd';
import { useTranslation } from 'react-i18next';
import { WarningOutlined, UserOutlined, ClockCircleOutlined, FormOutlined, AlertOutlined, KeyOutlined, CopyOutlined, PhoneOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import StudentProfile from '../../components/StudentProfile';
import { supabase } from '../../utils/supabaseClient';

const { Title, Text, Paragraph } = Typography;

export default function UrgentMatters() {
    const { message } = App.useApp();
    const [profileStudentId, setProfileStudentId] = useState(null);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const students = useLiveQuery(() => db.students.toArray(), []) || [];
    const marks = useLiveQuery(() => db.marks.toArray(), []) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray(), []) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray(), []) || [];

    const settingsRows = useLiveQuery(() => db.settings?.toArray()) || [];
    const currentSemester = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    // Grades that have at least one assessment configured (any semester)
    const activeGrades = useMemo(() => {
        const set = new Set();
        assessments.forEach(a => {
            if (a.grade) {
                set.add(String(a.grade).trim());
                set.add(normalizeGrade(a.grade));
            }
        });
        return set;
    }, [assessments]);

    // Students missing critical info - Scoped to active grades
    const missingInfoStudents = useMemo(() => students.filter(s => {
        if (!s.grade || s.archived === 1) return false; 
        const gn = normalizeGrade(s.grade);
        const isGradeActive = activeGrades.has(String(s.grade).trim()) || activeGrades.has(gn);
        if (!isGradeActive) return false;
        return !s.name || (!s.parentContact && !s.parentcontact) || (!s.portalCode && !s.portalcode);
    }), [students, activeGrades]);

    const isConduct = (a) => {
        const sName = (a.subjectName || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        return sName.includes('conduct') || sName.includes('attitude') || aName.includes('conduct') || aName.includes('attitude');
    };

    // Students with INCOMPLETE marks in ACTIVE SEMESTER assessments
    const incompleteMarksStudents = useMemo(() => {
        const activeAssessments = assessments.filter(a => {
            if (isConduct(a)) return false;
            const subject = subjects.find(sp => sp.name === a.subjectName);
            return (subject?.semester || 'Semester I') === currentSemester;
        });
        if (activeAssessments.length === 0) return [];

        const activeAssessmentIds = new Set(activeAssessments.map(a => a.id));

        // Count assessments per grade (normalized)
        const gradeAssessmentCount = {};
        activeAssessments.forEach(a => {
            const g = normalizeGrade(a.grade);
            gradeAssessmentCount[g] = (gradeAssessmentCount[g] || 0) + 1;
        });

        // Count marks per student in those active assessments
        const studentMarkCount = {};
        marks.forEach(m => {
            if (activeAssessmentIds.has(m.assessmentId)) {
                studentMarkCount[m.studentId] = (studentMarkCount[m.studentId] || 0) + 1;
            }
        });
        
        return students.filter(s => {
            if (!s.grade || s.archived === 1) return false;
            const gn = normalizeGrade(s.grade);
            const isGradeActive = activeGrades.has(String(s.grade).trim()) || activeGrades.has(gn);
            if (!isGradeActive) return false;

            const expectedCount = gradeAssessmentCount[gn] || 0;
            if (expectedCount === 0) return false;

            const actualCount = studentMarkCount[s.id] || 0;
            return actualCount < expectedCount;
        });
    }, [students, marks, assessments, subjects, currentSemester, activeGrades]);

    // Students missing portal codes - Show ALL students missing codes regardless of grade activity
    const missingPortalCode = useMemo(() => students.filter(s => {
        if (s.archived === 1) return false;
        const code = s.portalCode || s.portalcode;
        return !code || String(code).trim() === '';
    }), [students]);

    const totalIssues = missingInfoStudents.length + missingPortalCode.length + incompleteMarksStudents.length;

    const usedPortalCodes = useMemo(() => {
        const set = new Set();
        for (const s of students) {
            const code = s.portalCode || s.portalcode;
            if (code) set.add(String(code).trim());
        }
        return set;
    }, [students]);

    const generateUniquePortalCode = (used) => {
        for (let i = 0; i < 50; i++) {
            const code = String(Math.floor(100000 + Math.random() * 900000));
            if (!used.has(code)) return code;
        }
        return String(Date.now()).slice(-6);
    };

    const avatarStyle = (bg, fg, border) => ({
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
        boxShadow: '0 6px 18px rgba(2, 6, 23, 0.08)',
    });

    const copyToClipboard = async (text, successMsg) => {
        const val = String(text || '').trim();
        if (!val || val === 'null' || val === 'undefined') {
            message.warning(t('common.noDataToCopy'));
            return;
        }
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(val);
                message.success(successMsg);
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
                message.success(successMsg);
            }
        } catch (e) {
            message.error(t('common.copyFailed'));
        }
    };

    const generatePortalCode = async (studentId) => {
        const code = generateUniquePortalCode(usedPortalCodes);
        await db.students.update(studentId, { 
            portalCode: code, 
            synced: 0,
            updated_at: new Date().toISOString()
        });
        return code;
    };

    const generateAllPortalCodes = async () => {
        if (missingPortalCode.length === 0) return;
        try {
            const used = new Set(usedPortalCodes);
            let updated = 0;
            for (const s of missingPortalCode) {
                const code = generateUniquePortalCode(used);
                used.add(code);
                await db.students.update(s.id, { 
                    portalCode: code, 
                    synced: 0,
                    updated_at: new Date().toISOString()
                });
                updated++;
            }
            message.success(t('admin.codesGenerated', { count: updated }));
        } catch (e) {
            message.error(t('admin.codesGenerateFailed'));
        }
    };


    const goToRegisterAndSearch = (name) => {
        navigate('/admin/register');
        try {
            sessionStorage.setItem('admin_students_search', String(name || ''));
        } catch {
            // ignore
        }
    };

    const [missingInfoPage, setMissingInfoPage] = useState(1);
    const [portalCodePage, setPortalCodePage] = useState(1);
    const [incompleteMarksPage, setIncompleteMarksPage] = useState(1);
    const pageSize = 5;

    const paginatedMissingInfo = useMemo(() => {
        const start = (missingInfoPage - 1) * pageSize;
        return missingInfoStudents.slice(start, start + pageSize);
    }, [missingInfoStudents, missingInfoPage]);

    const paginatedPortalCodes = useMemo(() => {
        const start = (portalCodePage - 1) * pageSize;
        return missingPortalCode.slice(start, start + pageSize);
    }, [missingPortalCode, portalCodePage]);

    const paginatedIncompleteMarks = useMemo(() => {
        const start = (incompleteMarksPage - 1) * pageSize;
        return incompleteMarksStudents.slice(start, start + pageSize);
    }, [incompleteMarksStudents, incompleteMarksPage]);

    return (
        <div className="flex flex-col gap-10 pb-12 font-['Inter']">
            {/* Header Section - Minimalist & Soft */}
            <div className="glass-header">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-400/5 blur-[120px] -mr-40 -mt-40 rounded-full" />
                <div className="relative flex flex-col md:flex-row md:items-center gap-6 lg:gap-8">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-[1.5rem] lg:rounded-[2rem] flex items-center justify-center border border-indigo-100/50 dark:border-indigo-800/30">
                        <WarningOutlined className="text-2xl lg:text-3xl text-indigo-500/80" />
                    </div>
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-800 dark:text-white m-0">
                            {t('admin.urgentMatters')}
                        </h2>
                        <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 font-medium mt-2 max-w-xl">
                            {t('admin.urgentMattersDesc')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Status Alert Area - Integrated Glass Style */}
            {totalIssues === 0 ? (
                <div className="flex items-center gap-5 p-6 rounded-[2rem] bg-emerald-500/5 dark:bg-emerald-400/5 border border-emerald-500/10 dark:border-emerald-400/10">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <AlertOutlined className="text-emerald-600 dark:text-emerald-400 text-sm" />
                    </div>
                    <div>
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t('admin.allCaughtUp')}</div>
                        <div className="text-emerald-600/60 dark:text-emerald-500/40 text-xs mt-0.5 font-medium">
                            {t('admin.noUrgentMattersAdminDesc')}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-5 p-6 rounded-[2rem] bg-rose-500/5 dark:bg-rose-400/5 border border-rose-500/10 dark:border-rose-400/10">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center animate-pulse">
                        <AlertOutlined className="text-rose-600 dark:text-rose-400 text-sm" />
                    </div>
                    <div>
                        <div className="font-bold text-rose-700 dark:text-rose-400 text-xs uppercase tracking-widest">
                            {t('admin.issuesRequireAttention', { count: totalIssues })}
                        </div>
                        <div className="text-rose-600/60 dark:text-rose-500/40 text-sm mt-0.5 font-medium">Please address the critical issues listed below to maintain data integrity.</div>
                    </div>
                </div>
            )}

            {/* Main Issues - Grouped by Category */}
            <div className="space-y-12">
                {/* 1. Missing Student Info */}
                {missingInfoStudents.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-4 m-0">
                                {t('admin.studentsMissingInfoTitle')}
                                <Badge count={missingInfoStudents.length} color="rgba(244, 63, 94, 0.2)" style={{ color: '#f43f5e', fontWeight: 'bold' }} />
                            </h3>
                        </div>

                        <div className="grid gap-4">
                            {paginatedMissingInfo.map(student => {
                                const missing = [];
                                if (!student.name) missing.push(t('admin.fullName', 'Name'));
                                if (!student.baptismalName && !student.baptismalname) missing.push(t('admin.baptismalNameField', 'Baptismal Name'));
                                if (!student.grade) missing.push(t('admin.gradeClass', 'Grade'));
                                if (!student.parentContact && !student.parentcontact) missing.push(t('admin.parentContact', 'Contact'));
                                if (!student.portalCode && !student.portalcode) missing.push(t('admin.portalCode', 'Portal Code'));

                                return (
                                    <div key={student.id} className="glass-card hover:border-rose-500/20 dark:hover:border-rose-400/20 transition-all duration-500 hover:shadow-2xl hover:shadow-rose-500/5">
                                        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:items-center">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                    <h4 className="text-xl font-bold text-slate-800 dark:text-white m-0">
                                                        {student.name || <span className="text-rose-500 italic">{t('admin.noName')}</span>}
                                                    </h4>
                                                    {student.grade && (
                                                        <Tag className="rounded-full border-none bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-3">
                                                            {formatGrade(student.grade)}
                                                        </Tag>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {missing.map(field => (
                                                        <span key={field} className="px-3 py-1 bg-rose-500/5 dark:bg-rose-400/5 border border-rose-500/10 dark:border-rose-400/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                                            {t('admin.missingField', { field })}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-3 shrink-0 lg:justify-end">
                                                {!student.portalCode && (
                                                    <Button
                                                        size="middle"
                                                        icon={<KeyOutlined />}
                                                        className="rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const code = await generatePortalCode(student.id);
                                                            message.success(`${t('admin.portalCodeGenerated')}: ${code}`);
                                                        }}
                                                    >
                                                        {t('admin.generateCode')}
                                                    </Button>
                                                )}
                                                <Button
                                                    type="primary"
                                                    size="middle"
                                                    className="h-12 px-8 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 border-none shadow-lg shadow-indigo-500/20 text-white font-bold text-xs tracking-wide hover:scale-105 transition-transform"
                                                    onClick={() => goToRegisterAndSearch(student.name)}
                                                >
                                                    {t('admin.fixNow')}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {missingInfoStudents.length > pageSize && (
                            <div className="flex justify-center pt-4">
                                <div className="p-2 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60">
                                    <Pagination
                                        current={missingInfoPage}
                                        total={missingInfoStudents.length}
                                        pageSize={pageSize}
                                        onChange={setMissingInfoPage}
                                        size="small"
                                        showSizeChanger={false}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Missing Portal Codes */}
                {missingPortalCode.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-4 m-0">
                                {t('admin.studentsWithoutPortalCodeTitle')}
                                <Badge count={missingPortalCode.length} color="rgba(99, 102, 241, 0.2)" style={{ color: '#6366f1', fontWeight: 'bold' }} />
                            </h3>
                            <Button 
                                size="small" 
                                icon={<KeyOutlined />} 
                                className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-none font-bold text-[10px] uppercase tracking-widest px-4"
                                onClick={generateAllPortalCodes}
                            >
                                {t('admin.generateAll')}
                            </Button>
                        </div>

                        <div className="grid gap-4">
                            {paginatedPortalCodes.map(student => (
                                <div key={student.id} className="group p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/20 dark:hover:border-indigo-400/20 transition-all duration-300">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-lg font-bold text-slate-800 dark:text-white m-0">
                                                {student.name}
                                            </h4>
                                            <div className="flex items-center gap-3 mt-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatGrade(student.grade)}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span className="text-xs font-medium text-slate-500">{student.parentContact || student.parentcontact || 'No Contact'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <Button
                                                size="middle"
                                                icon={<KeyOutlined />}
                                                className="rounded-xl bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-none font-bold text-xs"
                                                onClick={async () => {
                                                    const code = await generatePortalCode(student.id);
                                                    message.success(`${t('admin.portalCodeGenerated')}: ${code}`);
                                                }}
                                            >
                                                {t('admin.generateCode')}
                                            </Button>
                                            <Button
                                                type="text"
                                                size="middle"
                                                className="rounded-xl text-slate-400 hover:text-indigo-500 font-bold text-xs"
                                                onClick={() => setProfileStudentId(student.id)}
                                            >
                                                {t('admin.view')}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {missingPortalCode.length > pageSize && (
                            <div className="flex justify-center pt-4">
                                <div className="p-2 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60">
                                    <Pagination
                                        current={portalCodePage}
                                        total={missingPortalCode.length}
                                        pageSize={pageSize}
                                        onChange={setPortalCodePage}
                                        size="small"
                                        showSizeChanger={false}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Incomplete Marks */}
                {incompleteMarksStudents.length > 0 && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-4 m-0">
                                {t('admin.incompleteMarks')}
                                <Badge count={incompleteMarksStudents.length} color="rgba(234, 88, 12, 0.2)" style={{ color: '#ea580c', fontWeight: 'bold' }} />
                            </h3>
                        </div>

                        <div className="grid gap-4">
                            {paginatedIncompleteMarks.map(student => (
                                <div key={student.id} className="group p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-orange-500/20 dark:hover:border-orange-400/20 transition-all duration-300">
                                    <div className="flex items-center gap-6">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-lg font-bold text-slate-800 dark:text-white m-0">
                                                {student.name}
                                            </h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{formatGrade(student.grade)}</span>
                                        </div>
                                        <Button
                                            type="primary"
                                            size="middle"
                                            className="h-10 px-6 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border-none font-bold text-xs hover:bg-orange-500 hover:text-white transition-all"
                                            onClick={() => navigate('/teacher')}
                                        >
                                            {t('admin.openMarkEntry')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {incompleteMarksStudents.length > pageSize && (
                            <div className="flex justify-center pt-4">
                                <div className="p-2 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60">
                                    <Pagination
                                        current={incompleteMarksPage}
                                        total={incompleteMarksStudents.length}
                                        pageSize={pageSize}
                                        onChange={setIncompleteMarksPage}
                                        size="small"
                                        showSizeChanger={false}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Empty State - Subtle */}
            {totalIssues === 0 && (
                <div className="py-24 flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-6">
                        <AlertOutlined className="text-3xl text-slate-300 dark:text-slate-700" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('admin.allCaughtUp')}</h3>
                    <p className="text-slate-400/60 text-sm mt-2 font-medium">All student records are complete and up to date.</p>
                </div>
            )}

            <StudentProfile 
                studentId={profileStudentId} 
                visible={!!profileStudentId} 
                onClose={() => setProfileStudentId(null)} 
            />
        </div>
    );
}
