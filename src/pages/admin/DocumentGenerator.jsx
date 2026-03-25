import React, { useState, useMemo } from 'react';
import { Typography, Card, Select, Button, Space, message } from 'antd';
import { FilePdfOutlined, IdcardOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import { QRCodeCanvas } from 'qrcode.react';
import { db } from '../../db/database';


const { Title, Text } = Typography;

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

export default function DocumentGenerator({ type }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const marks = useLiveQuery(() => db.marks.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const settings = useLiveQuery(() => db.settings.toArray()) || [];

    const activeAcademicYear = useMemo(() => settings.find(s => s.key === 'currentAcademicYear')?.value || '-', [settings]);
    const activeSemester = useMemo(() => settings.find(s => s.key === 'currentSemester')?.value || 'Semester I', [settings]);

    const normalizeGrade = (g) => {
        if (!g) return '';
        const match = String(g).match(/(\d+)/);
        return match ? match[1] : g;
    };
    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const gradeStudents = students.filter(s => s.grade === selectedGrade);

    const handleGenerate = async () => {
        if (!selectedGrade || gradeStudents.length === 0) return;
        setIsGenerating(true);
        
        const isIdCard = type === 'id-card';
        const doc = new jsPDF({
            orientation: isIdCard ? 'l' : 'p',
            unit: 'mm',
            format: isIdCard ? [86, 54] : 'a4'
        });

        const studentsToProcess = gradeStudents; // Assuming gradeStudents is already filtered by selectedGrade

        if (studentsToProcess.length === 0) {
            message.warning("No students found to generate documents for.");
            setIsGenerating(false);
            return;
        }

        // --- PRE-CALCULATE ALL RANKS IF WE ARE DOING CERTIFICATES ---
        let rankMap = {};
        if (!isIdCard) {
            const studentGradeNorm = normalizeGrade(selectedGrade);
            const gradeAssesses = assessments.filter(a => normalizeGrade(a.grade) === studentGradeNorm);
            const assessIds = gradeAssesses.map(a => a.id);
            const pertinentMarks = marks.filter(m => assessIds.includes(m.assessmentId));
            const studentsInGrade = students.filter(s => normalizeGrade(s.grade) === studentGradeNorm);
            
            const rankings = studentsInGrade.map(s => {
                let sTotalScore = 0;
                let sTotalMax = 0;
                
                gradeAssesses.forEach(a => {
                    // Check if assessment matches the correct semester constraints
                    const subjObj = subjects.find(subj => subj.name === a.subjectName);
                    const isSem1 = (subjObj?.semester || 'Semester I') === 'Semester I';
                    
                    if (activeSemester === 'Semester I') {
                        if (!isSem1) return; // Skip sem2 for sem1 ranking
                    } // For Semester II, we tally EVERYTHING (Sem 1 + Sem 2)

                    const mark = pertinentMarks.find(m => m.studentId === s.id && m.assessmentId === a.id);
                    if (mark) sTotalScore += mark.score;
                    sTotalMax += (parseFloat(a.maxScore) || 0);
                });
                
                const sPercentage = sTotalMax > 0 ? (sTotalScore / sTotalMax) * 100 : 0;
                return { id: s.id, grade: s.grade, percentage: sPercentage, hasData: sTotalMax > 0 };
            }).filter(s => s.hasData);

            rankings.sort((a, b) => b.percentage - a.percentage);

            const totalInGrade = rankings.length;

            studentsToProcess.forEach(s => {
                const overallRankIndex = rankings.findIndex(r => r.id === s.id);
                const overallRank = overallRankIndex !== -1 ? overallRankIndex + 1 : 'N/A';

                const classRankings = rankings.filter(r => r.grade === s.grade);
                const classRankIndex = classRankings.findIndex(r => r.id === s.id);
                const classRank = classRankIndex !== -1 ? classRankIndex + 1 : 'N/A';
                const totalInClass = classRankings.length;

                rankMap[s.id] = { classRank, overallRank, totalInClass, totalInGrade };
            });
        }

        try {
            for (let i = 0; i < studentsToProcess.length; i++) {
                const student = studentsToProcess[i];
                
                if (i > 0) doc.addPage();

                if (isIdCard) {
                    const element = document.getElementById(`temp-${type}-${student.id}`);
                    if (!element) continue;

                    const canvas = await html2canvas(element, {
                        scale: 3,
                        useCORS: true,
                        logging: false,
                        backgroundColor: null
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const imgProps = doc.getImageProperties(imgData);
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                } else {
                    // Certificate generation directly with jsPDF
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const pageHeight = doc.internal.pageSize.getHeight();
                    const margin = 15;
                    const startY = 20;

                    // Header
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(18);
                    doc.text("Senbet School Academic Report", pageWidth / 2, startY, { align: 'center' });
                    doc.setFontSize(12);
                    doc.text("Finote Birhan Senbet School", pageWidth / 2, startY + 8, { align: 'center' });
                    doc.line(margin, startY + 15, pageWidth - margin, startY + 15);

                    // Top Left Info (Name / Grade)
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(14);
                    doc.text(`Name: ${student.name}`, margin + 5, startY + 50);
                    doc.setFontSize(10);
                    doc.setTextColor(115, 115, 115); // text-slate-500
                    doc.text(`Baptismal Name: ${student.baptismalName || '-'}`, margin + 5, startY + 56);
                    
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.text(`Grade: ${student.grade || 'N/A'}`, margin + 5, startY + 64);
                    
                    // Top Right Info (Year / Semester)
                    const displayYear = activeAcademicYear.includes('E.C.') ? activeAcademicYear : `${activeAcademicYear} E.C.`;
                    doc.text(`Year: ${displayYear}`, pageWidth - margin - 5, startY + 50, { align: 'right' });
                    doc.text(`Semester: ${activeSemester}`, pageWidth - margin - 5, startY + 56, { align: 'right' });

                    // --- Calculate Marks & Render Table ---
                    const gradeAssesses = assessments.filter(a => normalizeGrade(a.grade) === normalizeGrade(selectedGrade));
                    const studentMarks = marks.filter(m => m.studentId === student.id);
                    
                    // Get unique subjects
                    const subjectsList = [...new Set(gradeAssesses.map(a => a.subjectName))].sort();
                    
                    let tableBody = [];
                    let totalMaxScore = 0;
                    let totalEarnedScore = 0;

                    subjectsList.forEach(subjectName => {
                        const subjObj = subjects.find(s => s.name === subjectName);
                        
                        const semIAssessments = gradeAssesses.filter(a => a.subjectName === subjectName && (subjObj?.semester || 'Semester I') === 'Semester I');
                        const semIIAssessments = gradeAssesses.filter(a => a.subjectName === subjectName && subjObj?.semester === 'Semester II');

                        const semIEarned = semIAssessments.reduce((acc, a) => {
                            const m = studentMarks.find(mark => mark.assessmentId === a.id);
                            return acc + (m ? m.score : 0);
                        }, 0);
                        const semIMax = semIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
                        const semIHasData = semIAssessments.some(a => studentMarks.find(m => m.assessmentId === a.id));

                        const semIIEarned = semIIAssessments.reduce((acc, a) => {
                            const m = studentMarks.find(mark => mark.assessmentId === a.id);
                            return acc + (m ? m.score : 0);
                        }, 0);
                        const semIIMax = semIIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
                        const semIIHasData = semIIAssessments.some(a => studentMarks.find(m => m.assessmentId === a.id));

                        let rowTotalMax = 0;
                        let rowTotalEarned = 0;

                        if (activeSemester === 'Semester I') {
                            rowTotalMax = semIMax;
                            rowTotalEarned = semIEarned;
                        } else {
                            // Semester II aggregates both
                            rowTotalMax = semIMax + semIIMax;
                            rowTotalEarned = semIEarned + semIIEarned;
                        }

                        totalMaxScore += rowTotalMax;
                        totalEarnedScore += rowTotalEarned;

                        const rowAvg = rowTotalMax > 0 ? `${((rowTotalEarned / rowTotalMax) * 100).toFixed(0)}%` : '—';
                        const semIRender = semIHasData ? `${semIEarned}/${semIMax}` : (semIAssessments.length ? '—' : 'N/A');
                        const semIIRender = semIIHasData ? `${semIIEarned}/${semIIMax}` : (semIIAssessments.length ? '—' : 'N/A');

                        if (activeSemester === 'Semester I') {
                            tableBody.push([
                                subjectName,
                                semIRender,
                                rowAvg
                            ]);
                        } else {
                            tableBody.push([
                                subjectName,
                                semIRender,
                                semIIRender,
                                rowAvg
                            ]);
                        }
                    });

                    const averagePercentage = totalMaxScore > 0 ? ((totalEarnedScore / totalMaxScore) * 100).toFixed(1) : 0;
                    
                    // Add final Total row inside the table
                    if (activeSemester === 'Semester I') {
                        tableBody.push([
                            { content: 'Grand Total', styles: { fontStyle: 'bold', textColor: [44, 24, 16] } },
                            '',
                            { content: `${averagePercentage}%`, styles: { fontStyle: 'bold', textColor: [139, 0, 0] } }
                        ]);
                    } else {
                        tableBody.push([
                            { content: 'Grand Total', styles: { fontStyle: 'bold', textColor: [44, 24, 16] } },
                            '',
                            '',
                            { content: `${averagePercentage}%`, styles: { fontStyle: 'bold', textColor: [139, 0, 0] } }
                        ]);
                    }

                    autoTable(doc, {
                        startY: startY + 74,
                        head: [
                            activeSemester === 'Semester I' 
                                ? ['Subject', 'Semester I', 'Average'] 
                                : ['Subject', 'Semester I', 'Semester II', 'Average']
                        ],
                        body: tableBody,
                        theme: 'grid',
                        styles: {
                            font: 'helvetica',
                            fontSize: 10,
                            cellPadding: 3,
                            textColor: [44, 24, 16], // text-[#2c1810]
                        },
                        headStyles: {
                            fillColor: [245, 245, 245], // light gray
                            textColor: [140, 115, 97], // text-[#8c7361]
                            fontStyle: 'bold',
                            fontSize: 9,
                            halign: 'center',
                        },
                        columnStyles: {
                            0: { halign: 'left', cellWidth: 50 },
                            1: { halign: 'center' },
                            2: { halign: 'center' },
                            3: { halign: 'center', fontStyle: 'bold' },
                        },
                        didParseCell: function (data) {
                            if (data.section === 'body' && data.row.index === tableBody.length - 1) {
                                data.cell.styles.fontStyle = 'bold';
                                data.cell.styles.textColor = [44, 24, 16];
                                if (data.column.index === (activeSemester === 'Semester I' ? 2 : 3)) {
                                    data.cell.styles.textColor = [139, 0, 0]; // text-[#8b0000]
                                    data.cell.styles.fontSize = 12;
                                }
                            }
                        },
                    });

                    const finalY = doc.autoTable.previous.finalY;

                    // Ranks
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.text(`Class Rank: ${rankMap[student.id]?.classRank || 'N/A'} / ${rankMap[student.id]?.totalInClass || '0'}`, margin + 5, finalY + 15);
                    doc.text(`Overall Grade Rank: ${rankMap[student.id]?.overallRank || 'N/A'} / ${rankMap[student.id]?.totalInGrade || '0'}`, margin + 5, finalY + 22);

                    // Footer (Signatures)
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.setTextColor(140, 115, 97); // text-[#8c7361]
                    doc.text("School Administrator", margin + 5, pageHeight - 30);
                    doc.text("Class Coordinator", pageWidth - margin - 5, pageHeight - 30, { align: 'right' });
                    doc.line(margin + 5, pageHeight - 35, margin + 60, pageHeight - 35);
                    doc.line(pageWidth - margin - 60, pageHeight - 35, pageWidth - margin - 5, pageHeight - 35);
                }
            }
            doc.save(`Senbet_${type === 'id-card' ? 'ID_Cards' : 'Certificates'}_${selectedGrade}.pdf`);
            message.success(t('common.success', 'Generation complete!'));
        } catch (err) {
            console.error("PDF Gen Error:", err);
            message.error("Failed to generate documents.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="max-w-[600px]">
                <Title level={2}>{type === 'id-card' ? t('admin.idCardGenerator') : t('admin.finalCertificates')}</Title>
                <Text type="secondary">{type === 'id-card' ? t('admin.idCardDesc') : t('admin.generatorDesc')}</Text>


                <Card className="mt-6 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    <Space orientation="vertical" className="w-full" size="middle">
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: '8px' }}>{t('admin.selectGradeCerts')}</Text>
                            <Select
                                placeholder={t('teacher.selectGrade')}
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                style={{ width: '100%' }}
                                size="large"
                                options={uniqueGrades.map(g => ({ value: g, label: g }))}
                            />
                        </div>
                        <Button
                            type="primary"
                            icon={<FilePdfOutlined />}
                            size="large"
                            block
                            disabled={!selectedGrade || gradeStudents.length === 0}
                            loading={isGenerating}
                            onClick={handleGenerate}
                        >
                            {type === 'id-card' ? t('admin.downloadIDCards') : t('admin.downloadAllCertificates')}
                        </Button>
                    </Space>
                </Card>
            </div>

            <div className="opacity-0 pointer-events-none fixed top-[5000px] left-0">
                {gradeStudents.map(student => (
                    <div key={student.id} id={`temp-${type}-${student.id}`} style={{ 
                        width: type === 'id-card' ? '86mm' : '210mm',
                        height: 'auto',
                        padding: '10px' 
                    }}>
                        {type === 'id-card' ? (
                            <IDCardTemplate student={student} />
                        ) : (
                            // CertificateTemplate is now largely replaced by direct jsPDF drawing in handleGenerate
                            // This component might still be used for visual preview or if some parts are still HTML-rendered
                            <CertificateTemplate 
                                student={student} 
                                marks={marks.filter(m => m.studentId === student.id)} 
                                subjects={subjects}
                                assessments={assessments}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function IDCardTemplate({ student }) {
    return (
        <div className="w-[86mm] h-[54mm] bg-white border-[2px] border-slate-900 rounded-xl overflow-hidden flex flex-col relative text-slate-900 font-sans shadow-lg">
            <div className="bg-slate-900 text-white p-2 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
                    <span className="text-[7px] uppercase tracking-tighter">Finote Birhan Senbet School</span>
                </div>
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <IdcardOutlined className="text-white text-lg" />
                </div>
            </div>
            <div className="flex-1 flex p-2 gap-3 items-center">
                <div className="w-[20mm] h-[24mm] border-2 border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50 overflow-hidden">
                    <UserOutlined className="text-slate-300 text-3xl mb-1" />
                    <span className="text-[6px] text-slate-400 uppercase">Student Photo</span>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">FullName / ሙሉ ስም</span>
                    <span className="text-[11px] font-bold text-slate-900 leading-tight mb-1 truncate">{student.name}</span>
                    <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Baptismal / የክርስትና ስም</span>
                    <span className="text-[9px] font-semibold text-slate-700 leading-tight mb-1 truncate">{student.baptismalName || '-'}</span>
                    <div className="flex gap-4">
                        <div>
                            <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Grade / ክፍል</span>
                            <div className="text-[9px] font-bold">{student.grade}</div>
                        </div>
                        <div>
                            <span className="text-[7px] text-slate-400 font-bold uppercase leading-none">Year / ዘመን</span>
                            <div className="text-[9px] font-bold">
                                {String(student.academicYear || dayjs().format('YYYY')).includes('E.C.') 
                                    ? student.academicYear 
                                    : `${dayjs(student.academicYear).format('YYYY')} E.C.`}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-1 bg-white border border-slate-100 rounded-lg">
                    <QRCodeCanvas value={student.id} size={50} level="H" />
                    <div className="text-[5px] text-center mt-0.5 text-slate-400 font-mono italic">SCAN FOR ATTENDANCE</div>
                </div>
            </div>
            <div className="h-1 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 w-full" />
        </div>
    );
}

function CertificateTemplate({ student, marks, subjects = [], assessments = [] }) {
    const studentGrade = student.grade;
    const gradeAssessments = assessments.filter(a => a.grade === studentGrade);
    const uniqueSubjects = [...new Set(gradeAssessments.map(a => a.subjectName))].sort();

    const subjectRows = uniqueSubjects.map(subjectName => {
        const semIAssessments = gradeAssessments.filter(a => {
            const subj = subjects.find(s => s.name === a.subjectName);
            return a.subjectName === subjectName && (subj?.semester || 'Semester I') === 'Semester I';
        });
        const semIIAssessments = gradeAssessments.filter(a => {
            const subj = subjects.find(s => s.name === a.subjectName);
            return a.subjectName === subjectName && subj?.semester === 'Semester II';
        });

        const semIEarned = semIAssessments.reduce((acc, a) => {
            const mark = marks.find(m => m.assessmentId === a.id);
            return acc + (mark ? (mark.score || 0) : 0);
        }, 0);
        const semIMax = semIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
        const semIHasData = semIAssessments.some(a => marks.find(m => m.assessmentId === a.id));

        const semIIEarned = semIIAssessments.reduce((acc, a) => {
            const mark = marks.find(m => m.assessmentId === a.id);
            return acc + (mark ? (mark.score || 0) : 0);
        }, 0);
        const semIIMax = semIIAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
        const semIIHasData = semIIAssessments.some(a => marks.find(m => m.assessmentId === a.id));

        const totalMax = semIMax + semIIMax;
        const totalEarned = semIEarned + semIIEarned;
        const avgPct = totalMax > 0 ? ((totalEarned / totalMax) * 100).toFixed(0) : '-';

        return {
            subject: subjectName,
            semI: semIHasData ? `${semIEarned} / ${semIMax}` : '—',
            semII: semIIHasData ? `${semIIEarned} / ${semIIMax}` : (semIIAssessments.length === 0 ? 'N/A' : '—'),
            avg: avgPct !== '-' ? `${avgPct}%` : '—',
        };
    });

    const overallEarned = marks.reduce((acc, m) => acc + (m.score || 0), 0);
    const overallMax = gradeAssessments.reduce((acc, a) => acc + (parseFloat(a.maxScore) || 0), 0);
    const overallAvg = overallMax > 0 ? ((overallEarned / overallMax) * 100).toFixed(1) : 0;

    const { t } = useTranslation();

    return (
        <div className="w-[190mm] h-[277mm] bg-[#fdfbf7] p-12 flex flex-col relative font-serif text-[#2c1810] border border-[#e8dfce]">
            {/* Minimalist Corner Accents */}
            <div className="absolute top-8 left-8 w-10 h-10 border-t border-l border-[#d4af37]" />
            <div className="absolute top-8 right-8 w-10 h-10 border-t border-r border-[#d4af37]" />
            <div className="absolute bottom-8 left-8 w-10 h-10 border-b border-l border-[#d4af37]" />
            <div className="absolute bottom-8 right-8 w-10 h-10 border-b border-r border-[#d4af37]" />

            {/* Faint Background Emblem */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                <EthiopianCross className="w-[500px] h-[500px] text-[#2c1810]" />
            </div>

            {/* Header */}
            <div className="flex flex-col items-center mb-12 text-center relative z-10">
                <EthiopianCross className="w-16 h-16 text-[#d4af37] mb-6" />
                <Title level={2} className="!mb-2 !text-[#2c1810] !font-serif tracking-wide">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Title>
                <Text className="text-base uppercase tracking-[0.2em] text-[#5c4033] font-medium">የተማሪዎች ውጤት መግለጫ</Text>
                <div className="w-16 h-px bg-[#d4af37] my-6" />
                <Text className="text-xl uppercase tracking-widest text-[#8b0000] font-semibold">{t('admin.finalCertificates', 'Academic Report Card')}</Text>
            </div>

            {/* Student Info (Minimalist Grid) */}
            <div className="w-full flex justify-between items-end border-b border-[#e8dfce] pb-6 mb-12 z-10">
                <div className="flex flex-col gap-1.5">
                    <Text className="uppercase text-xs tracking-widest text-[#8c7361] font-semibold">ሙሉ ስም / {t('admin.name')}</Text>
                    <Text className="text-2xl font-medium text-[#2c1810]">{student.name}</Text>
                    <Text className="text-base italic text-[#5c4033]">{student.baptismalName || '-'}</Text>
                </div>
                <div className="flex gap-16 text-right">
                    <div className="flex flex-col gap-1.5">
                        <Text className="uppercase text-xs tracking-widest text-[#8c7361] font-semibold">ክፍል / {t('admin.grade')}</Text>
                        <Text className="text-xl text-[#2c1810]">{student.grade}</Text>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Text className="uppercase text-xs tracking-widest text-[#8c7361] font-semibold">ዓ.ም / Year</Text>
                        <Text className="text-xl text-[#2c1810]">
                            {String(student.academicYear || dayjs().format('YYYY')).includes('E.C.') 
                                ? student.academicYear 
                                : `${dayjs(student.academicYear).format('YYYY')} E.C.`}
                        </Text>
                    </div>
                </div>
            </div>

            {/* Minimalist Data Table */}
            <div className="w-full mb-12 z-10">
                <table className="w-full border-collapse text-base">
                    <thead>
                        <tr>
                            <th className="p-4 text-left font-medium text-[#8c7361] uppercase tracking-wider text-sm border-b border-[#d4af37]/30">የትምህርት አይነት</th>
                            <th className="p-4 text-center font-medium text-[#8c7361] uppercase tracking-wider text-sm border-b border-[#d4af37]/30">፩ኛ መንፈቀ ዓመት (1st Sem)</th>
                            <th className="p-4 text-center font-medium text-[#8c7361] uppercase tracking-wider text-sm border-b border-[#d4af37]/30">፪ኛ መንፈቀ ዓመት (2nd Sem)</th>
                            <th className="p-4 text-center font-medium text-[#8c7361] uppercase tracking-wider text-sm border-b border-[#d4af37]/30">አማካይ ውጤት (Avg)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subjectRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-[#e8dfce]/50">
                                <td className="p-4 text-[#2c1810]">{row.subject}</td>
                                <td className="p-4 text-center text-[#5c4033]">{row.semI}</td>
                                <td className="p-4 text-center text-[#5c4033]">{row.semII}</td>
                                <td className="p-4 text-center font-medium text-[#2c1810]">{row.avg}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="p-5 pt-8 text-[#2c1810] uppercase tracking-widest font-semibold text-sm">አጠቃላይ ድምር (Grand Total)</td>
                            <td colSpan={2} className="p-5 pt-8 text-center text-[#5c4033]">{overallEarned} / {overallMax}</td>
                            <td className="p-5 pt-8 text-center text-[#8b0000] font-semibold text-2xl">{overallAvg}%</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Signatures */}
            <div className="w-full grid grid-cols-2 gap-16 text-center mt-auto pb-8 z-10">
                <div className="flex flex-col items-center">
                    <div className="w-56 border-b border-[#2c1810]/40 mb-3 h-16" />
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8c7361]">የትምህርት ቤቱ አስተዳዳሪ</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-56 border-b border-[#2c1810]/40 mb-3 h-16" />
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8c7361]">የክፍል አስተባባሪ</span>
                </div>
            </div>

            {/* Faint Seal Position */}
            <div className="absolute bottom-24 left-16 opacity-10 transform -rotate-12 pointer-events-none">
                <div className="w-40 h-40 border-2 border-dashed border-[#8b0000] rounded-full flex items-center justify-center">
                    <Text className="text-xs font-bold text-center uppercase tracking-widest text-[#8b0000]">ኦፊሴላዊ<br/>ማህተም</Text>
                </div>
            </div>
        </div>
    );
}
