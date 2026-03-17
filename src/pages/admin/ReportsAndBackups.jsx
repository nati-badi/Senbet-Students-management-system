import { useState } from 'react';
import { Typography, Card, Button, Space, message, Select, DatePicker, Row, Col } from 'antd';
import { DownloadOutlined, FileExcelOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { formatEthiopianDate } from '../../utils/dateUtils';

const { Title, Text, Paragraph } = Typography;

export default function ReportsAndBackups() {
    const { t } = useTranslation();
    const students = useLiveQuery(() => db.students.toArray()) || [];
    const marks = useLiveQuery(() => db.marks.toArray()) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray()) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
    const attendance = useLiveQuery(() => db.attendance.toArray()) || [];

    const handleDownloadStudents = () => {
        if (!students || students.length === 0) {
            message.warning('No students to export.');
            return;
        }

        const data = students.map(s => ({
            'Full Name': s.name,
            'Baptismal Name': s.baptismalName || '',
            'Gender': s.gender,
            'Grade': s.grade,
            'Portal Code': s.portalCode || '',
            'Parent Contact': s.parentContact,
            'Date of Entry': formatEthiopianDate(s.academicYear, true)
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Enrolled_Students");
        XLSX.writeFile(wb, "Senbet_Enrolled_Students.xlsx");
        message.success('Students exported successfully!');
    };

    const handleDownloadSemesterReport = (semester) => {
        if (!students.length || !marks.length || !assessments.length) {
            message.warning('No data available to generate report.');
            return;
        }

        // Filter assessments by semester (derived from subject)
        const semesterAssessments = assessments.filter(a => {
            const subject = subjects.find(s => s.name === a.subjectName);
            return (subject?.semester || 'Semester I') === semester;
        });
        if (semesterAssessments.length === 0) {
            message.warning(`No assessments found for ${semester}.`);
            return;
        }

        const reportData = [];
        const assessmentIds = semesterAssessments.map(a => a.id);
        const semesterMarks = marks.filter(m => assessmentIds.includes(m.assessmentId));

        // Group assessments by Subject to get max scores
        const subjects = [...new Set(semesterAssessments.map(a => a.subjectName))];

        students.forEach(student => {
            const studentRow = {
                'Student Name': student.name,
                'Grade': student.grade
            };

            let totalScore = 0;
            let totalMax = 0;

            subjects.forEach(subject => {
                const subjAssessments = semesterAssessments.filter(a => a.subjectName === subject && a.grade === student.grade);
                let subjScore = 0;
                let subjMax = 0;

                subjAssessments.forEach(sa => {
                    const mark = semesterMarks.find(m => m.studentId === student.id && m.assessmentId === sa.id);
                    if (mark) subjScore += mark.score;
                    subjMax += sa.maxScore;
                });

                if (subjMax > 0) {
                    studentRow[`${subject} Score`] = subjScore;
                    studentRow[`${subject} Max`] = subjMax;
                    totalScore += subjScore;
                    totalMax += subjMax;
                }
            });

            if (totalMax > 0) {
                studentRow['Total Score'] = totalScore;
                studentRow['Total Max'] = totalMax;
                studentRow['Percentage'] = ((totalScore / totalMax) * 100).toFixed(2) + '%';
                reportData.push(studentRow);
            }
        });

        if (reportData.length === 0) {
            message.warning(`No valid student marks found for ${semester}.`);
            return;
        }

        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `${semester}_Report`);
        XLSX.writeFile(wb, `Senbet_${semester.replace(' ', '_')}_Report.xlsx`);
        message.success(`${semester} report exported successfully!`);
    };

    return (
        <div className="flex flex-col gap-6 w-full">
            <div>
                <Title level={2} style={{ margin: 0 }}>{t('admin.reportsBackups', 'Reports & Backups')}</Title>
                <Text type="secondary">Generate comprehensive reports and download system data backups.</Text>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                    <Card 
                        title={<Space><DatabaseOutlined className="text-blue-500"/> Enrolled Students Data</Space>}
                        className="h-full rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"
                    >
                        <Paragraph type="secondary" className="mb-6">
                            Download a complete Excel spreadsheet containing all currently registered students, including their contact details and portal access codes. Useful for generating parent contact lists or external backups.
                        </Paragraph>
                        <Button 
                            type="primary" 
                            icon={<FileExcelOutlined />} 
                            onClick={handleDownloadStudents}
                            size="large"
                            className="bg-green-600 hover:bg-green-500 border-none w-full sm:w-auto"
                        >
                            Download Students List (Excel)
                        </Button>
                    </Card>
                </Col>

                <Col xs={24} md={12}>
                    <Card 
                        title={<Space><FileExcelOutlined className="text-green-500"/> Semester Grade Reports</Space>}
                        className="h-full rounded-2xl shadow-sm border-slate-200 dark:border-slate-800"
                    >
                        <Paragraph type="secondary" className="mb-6">
                            Generate a comprehensive matrix of all student marks across all subjects for a specific semester. This calculates totals and percentages automatically.
                        </Paragraph>
                        <Space className="w-full flex-wrap gap-4">
                            <Button 
                                type="primary" 
                                icon={<DownloadOutlined />} 
                                onClick={() => handleDownloadSemesterReport('Semester I')}
                                size="large"
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500"
                            >
                                Generate Semester I Report
                            </Button>
                            <Button 
                                type="primary" 
                                icon={<DownloadOutlined />} 
                                onClick={() => handleDownloadSemesterReport('Semester II')}
                                size="large"
                                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500"
                            >
                                Generate Semester II Report
                            </Button>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}
