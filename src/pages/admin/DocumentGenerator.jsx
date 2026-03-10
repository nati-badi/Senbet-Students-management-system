import React, { useState, useRef } from 'react';
import { Typography, Card, Select, Button, Space, message } from 'antd';
import { FilePdfOutlined, IdcardOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import { QRCodeCanvas } from 'qrcode.react';
import { db } from '../../db/database';

const { Title, Text } = Typography;

export default function DocumentGenerator({ type }) {
    const { t } = useTranslation();
    const [selectedGrade, setSelectedGrade] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const allMarks = useLiveQuery(() => db.marks.toArray()) || [];

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
                    <Space direction="vertical" className="w-full" size="middle">
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
                    <div key={student.id} id={`temp-${type}-${student.id}`} style={{ width: type === 'id-card' ? '86mm' : '210mm', padding: '10px' }}>
                        {type === 'id-card' ? (
                            <IDCardTemplate student={student} />
                        ) : (
                            <CertificateTemplate student={student} marks={allMarks.filter(m => m.studentId === student.id)} />
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

function CertificateTemplate({ student, marks }) {
    const totalScore = marks.length > 0 ? marks.reduce((acc, m) => acc + (m.score || 0), 0) : 0;
    const avgScore = marks.length > 0 ? (totalScore / marks.length).toFixed(1) : 0;

    return (
        <div className="w-[190mm] h-[277mm] bg-white border-[12px] border-double border-slate-900 p-12 flex flex-col items-center text-slate-900 relative font-serif">
            <div className="absolute top-4 left-4 border-t-4 border-l-4 border-slate-900 w-12 h-12" />
            <div className="absolute top-4 right-4 border-t-4 border-r-4 border-slate-900 w-12 h-12" />
            <div className="absolute bottom-4 left-4 border-b-4 border-l-4 border-slate-900 w-12 h-12" />
            <div className="absolute bottom-4 right-4 border-b-4 border-r-4 border-slate-900 w-12 h-12" />

            <div className="flex flex-col items-center mb-12 text-center">
                <Title level={2} className="!mb-0 !text-slate-900 italic font-serif">በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</Title>
                <Text className="text-xl uppercase tracking-widest font-bold">Finote Birhan Senbet School</Text>
                <div className="w-32 h-1 bg-slate-900 my-4" />
                <Title level={1} className="!mb-8 !text-5xl uppercase tracking-tighter text-slate-800">Certificate of Completion</Title>
            </div>

            <Text className="text-2xl italic mb-6">This is to certify that</Text>
            <div className="border-b-2 border-slate-900 w-full text-center pb-2 mb-8">
                <Title level={1} className="!mb-0 !text-6xl text-slate-900">{student.name}</Title>
            </div>

            <Text className="text-xl text-center max-w-2xl leading-relaxed mb-12">
                has successfully completed the studies and clinical requirements of <br />
                <span className="font-bold text-2xl uppercase">{student.grade}</span> <br />
                with distinction and academic excellence during the year of {student.academicYear || dayjs().format('YYYY')}.
            </Text>

            <div className="w-full mt-8 border-2 border-slate-200 p-8 rounded-2xl bg-slate-50/50">
                <div className="grid grid-cols-2 gap-8">
                    <div className="flex flex-col">
                        <span className="text-slate-400 uppercase text-sm font-bold tracking-widest mb-2">Academic Performance</span>
                        <div className="flex items-end gap-2">
                            <Title level={2} className="!mb-0 !text-4xl text-slate-900">{avgScore}%</Title>
                            <span className="text-slate-500 mb-1">Average Score</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-slate-400 uppercase text-sm font-bold tracking-widest mb-2">Baptismal Name</span>
                        <Title level={3} className="!mb-0 !text-2xl text-slate-800">{student.baptismalName || 'N/A'}</Title>
                    </div>
                </div>
                <div className="mt-8 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 text-center">
                    <div className="flex flex-col items-center">
                        <div className="w-48 border-b border-slate-900 mb-2 h-12" />
                        <span className="text-sm font-bold uppercase tracking-tighter">School Administrator</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="w-48 border-b border-slate-900 mb-2 h-12" />
                        <span className="text-sm font-bold uppercase tracking-tighter">Grade Coordinator</span>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-40 h-40 border-4 border-double border-slate-200 rounded-full flex items-center justify-center opacity-50 rotate-12">
                <div className="text-[10px] font-bold text-center text-slate-300 uppercase">Official School Seal</div>
            </div>
        </div>
    );
}
