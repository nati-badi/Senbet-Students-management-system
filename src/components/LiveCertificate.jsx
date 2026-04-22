import React, { useMemo } from 'react';
import { Typography, Table, Tag, Space, Empty } from 'antd';
import {
    WarningOutlined,
    FileProtectOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getEthiopianYear } from '../utils/dateUtils';
import dayjs from 'dayjs';

const { Text } = Typography;

const EthiopianCross = ({ className }) => (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor">
        <rect x="42" y="42" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"/>
        <circle cx="50" cy="50" r="4" fill="currentColor"/>
        <path d="M42 42 L42 20 L30 15 L50 0 L70 15 L58 20 L58 42" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="50" cy="8" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="18" r="2" fill="currentColor"/>
        <circle cx="65" cy="18" r="2" fill="currentColor"/>
        <path d="M42 58 L42 80 L30 85 L50 100 L70 85 L58 80 L58 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="50" cy="92" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="82" r="2" fill="currentColor"/>
        <circle cx="65" cy="82" r="2" fill="currentColor"/>
        <path d="M42 42 L20 42 L15 30 L0 50 L15 70 L20 58 L42 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="8" cy="50" r="2.5" fill="currentColor"/>
        <circle cx="18" cy="35" r="2" fill="currentColor"/>
        <circle cx="18" cy="65" r="2" fill="currentColor"/>
        <path d="M58 42 L80 42 L85 30 L100 50 L85 70 L80 58 L58 58" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
        <circle cx="92" cy="50" r="2.5" fill="currentColor"/>
        <circle cx="82" cy="35" r="2" fill="currentColor"/>
        <circle cx="82" cy="65" r="2" fill="currentColor"/>
    </svg>
);

const LiveCertificate = ({ student, subjectRows, rankingInfo, missingAssessments, activeYearToUse, averagePercentage, gradeAssessments }) => {
    const { t } = useTranslation();
    const { classRank, overallRank, totalInClass, totalInGrade } = rankingInfo || {};

    return (
        <div className="w-full flex flex-col items-center bg-transparent py-4">
            {/* Certificate Card */}
            <div className="w-full max-w-4xl bg-[#fdfbf7] rounded-3xl shadow-2xl border border-[#e8dfce] overflow-hidden font-serif text-[#2c1810]">
                
                {/* Header with improved ornaments */}
                <div className="flex flex-col items-center pt-10 pb-4 px-10 text-center relative overflow-hidden">
                    <EthiopianCross className="absolute -top-12 -left-12 w-48 h-48 opacity-[0.03] text-[#5c4033] rotate-12" />
                    <EthiopianCross className="absolute -bottom-12 -right-12 w-48 h-48 opacity-[0.03] text-[#5c4033] -rotate-12" />
                    
                    <h2 className="text-xl md:text-2xl font-bold text-[#2c1810] mb-1 leading-tight" style={{ fontFamily: 'serif' }}>
                        {t('app.title')}
                    </h2>
                    <p className="text-[10px] md:text-xs text-[#5c4033] font-bold tracking-widest uppercase mb-4 opacity-70">
                        {t('teacher.transcriptSubtitle')}
                    </p>
                    <div className="w-20 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mb-4" />
                    <p className="text-sm md:text-base font-black text-[#1a3a6b] tracking-[0.2em] uppercase">
                        {t('teacher.academicTranscript')}
                    </p>
                </div>

                {/* Student Info */}
                <div className="px-6 md:px-12 pb-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-[#e8dfce] pb-4 mb-8 gap-6">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[#8c7361] font-bold uppercase tracking-widest">{t('teacher.fullNameLabel')} / NAME</span>
                            <span className="text-xl md:text-2xl font-bold text-[#2c1810] leading-tight">{student?.name}</span>
                            {!!(student?.baptismalName || student?.baptismalname) && (
                                <span className="text-xs italic text-[#5c4033] mt-0.5">
                                    {t('teacher.baptismalNameLabel')}: {student.baptismalName || student.baptismalname}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-8 md:gap-16 text-left md:text-right w-full md:w-auto">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-[#8c7361] font-bold uppercase tracking-widest">{t('teacher.gradeLabel')} / GRADE</span>
                                <span className="text-lg md:text-xl font-bold text-[#2c1810]">{student?.grade}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-[#8c7361] font-bold uppercase tracking-widest">{t('teacher.yearLabel')} / YEAR</span>
                                <span className="text-lg md:text-xl font-bold text-[#2c1810]">
                                    {getEthiopianYear(activeYearToUse || dayjs().toISOString())}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Subjects Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[14px] md:text-[15px] mb-8 min-w-[500px]">
                            <thead>
                                <tr className="border-b-2 border-[#d4af37]/30">
                                    <th className="py-3 px-4 text-left font-bold text-[#8c7361] uppercase tracking-wider text-[10px]">
                                        {t('teacher.subjectLabel')} / SUBJECT
                                    </th>
                                    <th className="py-3 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[10px]">
                                        {t('teacher.semesterI')} /<br/>SEM I
                                    </th>
                                    <th className="py-3 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[10px]">
                                        {t('teacher.semesterII')} /<br/>SEM II
                                    </th>
                                    <th className="py-3 px-4 text-center font-bold text-[#8c7361] uppercase tracking-wider text-[10px]">
                                        {t('teacher.avg')} / AVG
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {subjectRows?.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 italic text-[#8c7361] text-base">
                                            {t('teacher.noAssessmentsDefined')}
                                        </td>
                                    </tr>
                                ) : (
                                    subjectRows?.map((row) => (
                                        <tr key={row.subject} className="border-b border-[#e8dfce]/60 hover:bg-[#faf8f3] transition-colors">
                                            <td className="py-3.5 px-4 text-[#2c1810] font-medium">{row.subject}</td>
                                            <td className="py-3.5 px-4 text-center text-[#5c4033] font-medium">{row.semI || '—'}</td>
                                            <td className="py-3.5 px-4 text-center text-[#5c4033] font-medium">{row.semII || '—'}</td>
                                            <td className="py-3.5 px-4 text-center font-bold text-[#2c1810]">{row.avg || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Grand Total & Ranks */}
                    <div className="border-t-2 border-[#d4af37]/30 pt-6 mt-4 space-y-4 bg-gradient-to-b from-[#fdfbf7] to-[#f9f5ed] p-6 rounded-2xl border border-[#e8dfce]/40">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-[#2c1810] uppercase tracking-widest">
                                {t('teacher.grandTotal')} / GRAND TOTAL
                            </span>
                            <span className="text-3xl md:text-4xl font-black text-[#8b0000] drop-shadow-sm">{averagePercentage}%</span>
                        </div>

                        {totalInClass > 0 && (
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-[11px] font-bold text-[#5c4033] uppercase tracking-widest">
                                    {t('teacher.classRank')} / CLASS RANK
                                </span>
                                <span className="text-lg md:text-xl font-bold text-[#2c1810]">{classRank} / {totalInClass}</span>
                            </div>
                        )}

                        {totalInGrade > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold text-[#8c7361] uppercase tracking-widest">
                                    {t('teacher.gradeRank')} / GRADE RANK
                                </span>
                                <span className="text-base md:text-lg font-bold text-[#5c4033]">{overallRank} / {totalInGrade}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Banner */}
                {missingAssessments?.length > 0 && (
                    <div className="border-t border-[#8b0000]/20 bg-[#8b0000]/5 text-[#8b0000] py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-[0.2em] px-4">
                        <Space><WarningOutlined /> {t('teacher.incompleteTranscript', { count: missingAssessments.length })}</Space>
                    </div>
                )}
                {missingAssessments?.length === 0 && gradeAssessments?.length > 0 && (
                    <div className="border-t border-[#d4af37]/30 bg-[#d4af37]/5 text-[#5c4033] py-3 text-center text-[10px] md:text-xs font-black uppercase tracking-[0.2em] px-4">
                        <Space><FileProtectOutlined className="text-[#d4af37]" /> {t('teacher.readyForFinal')}</Space>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveCertificate;
