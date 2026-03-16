import React, { useState, useRef } from 'react';
import { Typography, Card, Select, Button, Space, message } from 'antd';
import { FilePdfOutlined, IdcardOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';


const { Title, Text } = Typography;

export default function DocumentGenerator({ type }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const uniqueGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const gradeStudents = students.filter(s => s.grade === selectedGrade);

    const handleGenerate = async () => {
        if (!selectedGrade || gradeStudents.length === 0) return;
        setIsGenerating(true);
        const doc = new jsPDF(type === 'id-card' ? 'p' : 'p', 'mm', 'a4');

        try {
            for (let i = 0; i < gradeStudents.length; i++) {
                const student = gradeStudents[i];
                const element = document.getElementById(`temp-${type}-${student.id}`);
                if (!element) continue;

                if (i > 0) doc.addPage();

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
                <Text type="secondary">{type === 'id-card' ? t('admin.idCardDesc') : t('admin.certificateTemplateDesc')}</Text>

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
                            <CertificateTemplate 
                                student={student} 
                                marks={allMarks.filter(m => m.studentId === student.id)} 
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
                            <div className="text-[9px] font-bold">{student.academicYear || dayjs().format('YYYY')}</div>
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
        <div className="w-[190mm] h-[277mm] bg-white border-[12px] border-double border-slate-900 p-8 flex flex-col items-center text-slate-900 relative font-serif">
            {/* Corner Decorations */}
            <div className="absolute top-4 left-4 border-t-4 border-l-4 border-slate-900 w-12 h-12" />
            <div className="absolute top-4 right-4 border-t-4 border-r-4 border-slate-900 w-12 h-12" />
            <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-slate-900 w-12 h-12" />
            <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-slate-900 w-12 h-12" />

            <div className="flex flex-col items-center mb-6 text-center">
                <Title level={3} className="!mb-0 !text-slate-900 font-serif">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Title>
                <Text className="text-sm uppercase tracking-widest font-bold">Finote Birhan Senbet School</Text>
                <div className="w-24 h-0.5 bg-slate-900 my-2" />
                <Title level={2} className="!mb-2 uppercase tracking-tighter text-slate-800">{t('admin.finalCertificates', 'Academic Report Card')}</Title>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 mb-6 border border-slate-200 p-4 rounded-xl text-sm">
                <div>
                    <Text type="secondary" className="uppercase text-[10px] font-bold block">{t('admin.name')}</Text>
                    <Text strong className="text-lg">{student.name}</Text>
                </div>
                <div>
                    <Text type="secondary" className="uppercase text-[10px] font-bold block">{t('admin.baptismalName', 'Baptismal Name')}</Text>
                    <Text strong>{student.baptismalName || '-'}</Text>
                </div>
                <div>
                    <Text type="secondary" className="uppercase text-[10px] font-bold block">{t('admin.grade')}</Text>
                    <Text strong>{student.grade}</Text>
                </div>
                <div>
                    <Text type="secondary" className="uppercase text-[10px] font-bold block">Year</Text>
                    <Text strong>{student.academicYear || dayjs().format('YYYY')}</Text>
                </div>
            </div>

            <table className="w-full border-collapse border border-slate-900 text-sm mb-8">
                <thead>
                    <tr className="bg-slate-50">
                        <th className="p-2 text-left border border-slate-900">{t('admin.subjects')}</th>
                        <th className="p-2 text-center border border-slate-900">{t('admin.semester1', 'Semester I')}</th>
                        <th className="p-2 text-center border border-slate-900">{t('admin.semester2', 'Semester II')}</th>
                        <th className="p-2 text-center border border-slate-900">Average</th>
                    </tr>
                </thead>
                <tbody>
                    {subjectRows.map((row, idx) => (
                        <tr key={idx}>
                            <td className="p-2 border border-slate-900 font-bold">{row.subject}</td>
                            <td className="p-2 text-center border border-slate-900">{row.semI}</td>
                            <td className="p-2 text-center border border-slate-900">{row.semII}</td>
                            <td className="p-2 text-center border border-slate-900 font-bold bg-slate-50/50">{row.avg}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-900 text-white font-bold">
                        <td className="p-3 border border-slate-900 uppercase tracking-wider">{t('admin.totalScore', 'Grand Total')}</td>
                        <td colSpan={2} className="p-3 text-center border border-slate-900">{overallEarned} / {overallMax}</td>
                        <td className="p-3 text-center border border-slate-900 text-xl">{overallAvg}%</td>
                    </tr>
                </tfoot>
            </table>

            <div className="w-full grid grid-cols-2 gap-12 text-center mt-auto pb-8">
                <div className="flex flex-col items-center">
                    <div className="w-48 border-b border-slate-900 mb-2 h-12" />
                    <span className="text-xs font-bold uppercase tracking-tighter">School Administrator</span>
                </div>
                <div className="flex flex-col items-center">
                    <div className="w-48 border-b border-slate-900 mb-2 h-12" />
                    <span className="text-xs font-bold uppercase tracking-tighter">Grade Coordinator</span>
                </div>
            </div>

            <div className="absolute bottom-20 left-10 opacity-30 transform -rotate-12 pointer-events-none">
                <div className="w-32 h-32 border-4 border-double border-slate-400 rounded-full flex items-center justify-center">
                    <Text className="text-[10px] font-bold text-center uppercase text-slate-400">Official Seal</Text>
                </div>
            </div>
        </div>
    );
}
