import React, { useMemo } from 'react';
import { Typography, Card, List, Avatar, Tag, Empty, Badge, Alert, Row, Col, Statistic, Button, Space, Tooltip } from 'antd';
import { WarningOutlined, ClockCircleOutlined, FormOutlined, AlertOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatGrade, normalizeGrade } from '../../utils/gradeUtils';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

export default function TeacherUrgentMatters({ teacher }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const allowedGrades = useMemo(() => teacher?.assignedGrades || [], [teacher]);
    const allowedSubjects = useMemo(() => teacher?.assignedSubjects || [], [teacher]);

    const [syncKey, setSyncKey] = React.useState(0);
    React.useEffect(() => {
        const handleSync = () => setSyncKey(k => k + 1);
        window.addEventListener('syncComplete', handleSync);
        return () => window.removeEventListener('syncComplete', handleSync);
    }, []);

    const allStudents = useLiveQuery(() => db.students.toArray(), [syncKey]) || [];
    const marks = useLiveQuery(() => db.marks.toArray(), [syncKey]) || [];
    const allAssessments = useLiveQuery(() => db.assessments.toArray(), [syncKey]) || [];
    const allSubjects = useLiveQuery(() => db.subjects.toArray(), [syncKey]) || [];
    const settingsRows = useLiveQuery(() => db.settings?.toArray(), [syncKey]) || [];

    const currentSemester = settingsRows.find(r => r.key === 'currentSemester')?.value || 'Semester I';

    // Filter students to only those in the teacher's assigned grades
    const myStudents = useMemo(() => {
        if (allowedGrades.length === 0) return allStudents;
        return allStudents.filter(s =>
            allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(s.grade))
        );
    }, [allStudents, allowedGrades]);

    const isConduct = (a) => {
        const sName = (a.subjectName || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        return sName.includes('conduct') || sName.includes('attitude') || aName.includes('conduct') || aName.includes('attitude');
    };

    // Assessments this teacher is responsible for
    const myAssessments = useMemo(() => allAssessments.filter(a => {
        if (isConduct(a)) return false;
        const subject = allSubjects.find(s => s.name === a.subjectName);
        const assessmentSemester = subject?.semester || 'Semester I';
        return assessmentSemester === currentSemester &&
            (allowedGrades.length === 0 || allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(a.grade))) &&
            (allowedSubjects.length === 0 || allowedSubjects.includes(a.subjectName));
    }), [allAssessments, allSubjects, allowedGrades, allowedSubjects, currentSemester]);

    // Per-assessment missing marks (students who haven't been graded in a specific assessment)
    const missingMarksByAssessment = useMemo(() => {
        const result = [];
        myAssessments.forEach(assessment => {
            const studentsForGrade = myStudents.filter(s =>
                normalizeGrade(s.grade) === normalizeGrade(assessment.grade)
            );
            const ungraded = studentsForGrade.filter(s =>
                !marks.some(m => m.studentId === s.id && m.assessmentId === assessment.id)
            );
            if (ungraded.length > 0) {
                result.push({ assessment, count: ungraded.length, students: ungraded });
            }
        });
        return result;
    }, [myAssessments, myStudents, marks]);

    const totalIssues = missingMarksByAssessment.length;

    const avatarStyle = (bg, fg, border) => ({
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
        boxShadow: '0 6px 18px rgba(2,6,23,0.08)',
    });

    return (
        <div className="flex flex-col gap-10 pb-12 font-['Inter']">
            {/* Header Section - Minimalist & Soft */}
            <div className="relative p-10 rounded-[2.5rem] bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-400/5 blur-[120px] -mr-40 -mt-40 rounded-full" />
                <div className="relative flex flex-col md:flex-row md:items-center gap-8">
                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-[2rem] flex items-center justify-center border border-indigo-100/50 dark:border-indigo-800/30">
                        <WarningOutlined className="text-3xl text-indigo-500/80" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white m-0">
                            {t('admin.urgentMatters')}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                            <p className="text-slate-500 dark:text-slate-400 font-medium m-0">
                                {t('teacher.urgentMattersDesc')}
                            </p>
                            {allowedGrades.length > 0 && (
                                <div className="flex gap-1">
                                    {allowedGrades.map(g => (
                                        <span key={g} className="px-3 py-1 bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full uppercase tracking-widest border border-indigo-200/30 dark:border-indigo-800/30">
                                            {formatGrade(g)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
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
                        <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t('teacher.allCaughtUp')}</div>
                        <div className="text-emerald-600/60 dark:text-emerald-500/40 text-xs mt-0.5 font-medium">
                            {myAssessments.length === 0 ? t('teacher.noAssessmentsThisSemester') : t('teacher.allMarksRecorded')}
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
                            {t(totalIssues === 1 ? 'teacher.issuesRequireAttention' : 'teacher.issuesRequireAttention_plural', { count: totalIssues })}
                        </div>
                        <div className="text-rose-600/60 dark:text-rose-500/40 text-sm mt-0.5 font-medium">Detailed review required for the items below.</div>
                    </div>
                </div>
            )}

            {/* Main Issues List */}
            {missingMarksByAssessment.length > 0 && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between px-4">
                        <h3 className="text-lg font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-4 m-0">
                            {t('teacher.missingStudentMarksTitle')}
                            <Badge count={missingMarksByAssessment.length} color="rgba(99, 102, 241, 0.2)" style={{ color: '#6366f1', fontWeight: 'bold' }} />
                        </h3>
                    </div>

                    <div className="grid gap-6">
                        {missingMarksByAssessment.map(({ assessment, count, students: ungradedStudents }) => (
                            <div key={assessment.id} className="group p-10 rounded-[3rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/20 dark:hover:border-indigo-400/20 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/5">
                                <div className="flex flex-col xl:flex-row gap-10">
                                    {/* Assessment Info Block */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                                            <h4 className="text-2xl font-bold text-slate-800 dark:text-white m-0">
                                                {assessment.name}
                                            </h4>
                                            <div className="flex gap-2">
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                                    {assessment.subjectName || assessment.subjectname}
                                                </span>
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                                                    {formatGrade(assessment.grade)}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-rose-500/5 dark:bg-rose-400/5 border border-rose-500/10 dark:border-rose-400/10 mb-8">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
                                            <span className="text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-widest">{t('teacher.studentsMissingMarks', { count: count })}</span>
                                        </div>
                                        
                                        {/* Student Pills - Minimalist */}
                                        <div className="flex flex-wrap gap-2.5">
                                            {ungradedStudents.map(st => (
                                                <span key={st.id} className="px-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl text-slate-500 dark:text-slate-400 text-[11px] font-medium hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors whitespace-nowrap">
                                                    {st.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Button Area - Compelling & Inviting */}
                                    <div className="flex items-center xl:justify-end shrink-0">
                                        <Tooltip title={`Update marks for ${assessment.name}`}>
                                            <Button
                                                type="primary"
                                                size="large"
                                                className="h-16 px-12 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 border-none shadow-xl shadow-indigo-500/25 text-white font-bold flex items-center gap-3 transition-all hover:scale-[1.03] active:scale-95 group/btn"
                                                onClick={() => navigate('/teacher/mark-entry', {
                                                    state: {
                                                        assessmentId: assessment.id,
                                                        grade: assessment.grade,
                                                        highlightEmpty: true,
                                                        nonce: Date.now()
                                                    }
                                                })}
                                            >
                                                <EditOutlined className="text-xl group-hover/btn:rotate-12 transition-transform" />
                                                <span className="text-sm uppercase tracking-[0.15em]">{t('teacher.fixNow')}</span>
                                            </Button>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State - Subtle */}
            {totalIssues === 0 && myAssessments.length > 0 && (
                <div className="py-24 flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
                    <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-6">
                        <AlertOutlined className="text-3xl text-slate-300 dark:text-slate-700" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{t('teacher.noUrgentMatters')}</h3>
                    <p className="text-slate-400/60 text-sm mt-2 font-medium">All student marks are up to date for this semester.</p>
                </div>
            )}
        </div>
    );
};
