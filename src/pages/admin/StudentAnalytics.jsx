import { useState, useMemo, useEffect } from 'react';
import { Typography, Card, Space, Row, Col, Select, Table, Divider, Tag, Empty } from 'antd';
import { TrophyOutlined, StarOutlined, BarChartOutlined, LineChartOutlined, TeamOutlined } from '@ant-design/icons';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useTranslation } from 'react-i18next';
import { GRADE_OPTIONS, formatGrade, normalizeGrade, normalizeSubject } from '../../utils/gradeUtils';
import { calculateRankings, calculateGroupAverage, isConductAssessment } from '../../utils/analyticsEngine';

const { Title, Text } = Typography;
const { Option } = Select;

export default function StudentAnalytics({ isTeacherView = false, teacher = null }) {
    const { t } = useTranslation();
    const [syncKey, setSyncKey] = useState(0);

    useEffect(() => {
        const handleSync = () => setSyncKey(k => k + 1);
        window.addEventListener('syncComplete', handleSync);
        return () => window.removeEventListener('syncComplete', handleSync);
    }, []);

    const students = useLiveQuery(() => db.students.toArray(), [syncKey]) || [];
    const marks = useLiveQuery(() => db.marks.toArray(), [syncKey]) || [];
    const assessments = useLiveQuery(() => db.assessments.toArray(), [syncKey]) || [];
    const attendance = useLiveQuery(() => db.attendance.toArray(), [syncKey]) || [];
    const subjects = useLiveQuery(() => db.subjects.toArray(), [syncKey]) || [];
    const dbGrades = [...new Set(students.map(s => s.grade))].filter(Boolean);
    const allGradeOptions = [
        ...GRADE_OPTIONS,
        ...dbGrades
            .filter(g => !GRADE_OPTIONS.some(o => o.value === String(g)))
            .map(g => ({ value: String(g), label: formatGrade(g) }))
    ];

    const allowedGrades = Array.isArray(teacher?.assignedGrades) ? teacher.assignedGrades : [];
    const gradeOptions = isTeacherView && allowedGrades.length > 0
        ? allGradeOptions.filter(o => allowedGrades.some(g => normalizeGrade(g) === normalizeGrade(o.value)))
        : allGradeOptions;

    const [selectedGrade, setSelectedGrade] = useState(() => {
        if (isTeacherView && gradeOptions.length > 0) {
            return gradeOptions[0].value;
        }
        return 'All';
    });
    const [selectedSemester, setSelectedSemester] = useState('Semester I');
    const [selectedSubject, setSelectedSubject] = useState('All');

    // Calculate Top Students
    const studentRankings = useMemo(() => {
        if (!students.length || !marks.length || !assessments.length) return [];

        const semesterAssessments = assessments.filter(a => {
            const subject = subjects.find(s => s.name === a.subjectName || s.name === a.subjectname);
            const subjSem = subject?.semester || 'Semester I';
            
            // Basic Semester Match
            let isMatchSem = false;
            if (selectedSemester === 'Semester I') {
                isMatchSem = subjSem === 'Semester I';
            } else {
                // Semester II is cumulative
                isMatchSem = true;
            }
            
            if (isConductAssessment(a)) return false;
            
            const isMatchSub = selectedSubject === 'All' || (a.subjectName || a.subjectname) === selectedSubject;
            return isMatchSem && isMatchSub;
        });

        if (semesterAssessments.length === 0) return [];

        // Use centralized ranking engine
        const rankings = calculateRankings(students, semesterAssessments, marks);

        // Add attendance stats and filter by grade
        const rankingsWithAttendance = rankings.map(s => {
            const studentAttendance = attendance.filter(a => 
                (a.studentId === s.id || a.studentid === s.id) && 
                (a.semester || 'Semester I') === selectedSemester
            );
            const presentCount = studentAttendance.filter(a => a.status === 'present').length;
            const totalDays = studentAttendance.length;
            const attendanceRate = totalDays > 0 ? (presentCount / totalDays) * 100 : 0;

            return {
                ...s,
                attendanceRate,
                totalDays
            };
        });

        let filteredRankings = rankingsWithAttendance;
        if (selectedGrade !== 'All') {
            filteredRankings = rankingsWithAttendance.filter(s => normalizeGrade(s.grade) === normalizeGrade(selectedGrade));
        }

        return filteredRankings.sort((a, b) => b.percentage - a.percentage);
    }, [students, marks, assessments, attendance, selectedGrade, selectedSemester, selectedSubject, subjects]);

    const top10Students = studentRankings.slice(0, 10);
    const schoolAverage = useMemo(
        () => calculateGroupAverage(studentRankings),
        [studentRankings]
    );

    const columns = [
        {
            title: 'Rank',
            key: 'rank',
            width: 80,
            align: 'center',
            render: (_, __, index) => {
                let badge = <span>{index + 1}</span>;
                if (index === 0) badge = <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 border-2 border-yellow-400 font-bold mx-auto"><TrophyOutlined /></div>;
                else if (index === 1) badge = <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border-2 border-slate-300 font-bold mx-auto">2</div>;
                else if (index === 2) badge = <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-orange-700 border-2 border-orange-300 font-bold mx-auto">3</div>;
                return badge;
            }
        },
        { title: t('admin.name'), dataIndex: 'name', key: 'name', render: (text) => <span className="font-bold">{text}</span> },
        { title: t('admin.grade'), dataIndex: 'grade', key: 'grade', render: (text) => <Tag color="blue">{formatGrade(text)}</Tag> },
        { 
            title: 'Score', 
            key: 'score', 
            render: (_, r) => <span className="text-slate-500">{r.totalScore.toFixed(1)} / {r.totalMax}</span> 
        },
        { 
            title: 'Average', 
            dataIndex: 'percentage', 
            key: 'percentage',
            render: (val) => {
                let color = "text-green-600";
                if (val < 50) color = "text-red-500";
                else if (val < 75) color = "text-orange-500";
                return <span className={`font-bold text-lg ${color}`}>{val.toFixed(1)}%</span>;
            }
        },
        {
            title: 'Attendance',
            dataIndex: 'attendanceRate',
            key: 'attendanceRate',
            render: () => <span className="coming-soon-content-blur text-slate-300">88%</span>
        }
    ];

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <Title level={2} style={{ margin: 0 }}>
                        <BarChartOutlined className="mr-3 text-blue-500" />
                        {t('admin.analyticsDashboard', 'Student Analytics')}
                    </Title>
                    <Text type="secondary">View top-performing students and class statistics.</Text>
                </div>
                
                <Space className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <Select 
                        value={selectedSemester} 
                        onChange={setSelectedSemester} 
                        className="w-32" 
                        bordered={false}
                    >
                        <Option value="Semester I">Semester I</Option>
                        <Option value="Semester II">Semester II</Option>
                    </Select>
                    <Divider type="vertical" className="h-6" />
                    <Select 
                        value={selectedSubject} 
                        onChange={setSelectedSubject} 
                        className="w-40" 
                        bordered={false}
                        showSearch
                    >
                        <Option value="All">All Subjects</Option>
                        {[...new Set(subjects.filter(s => s.semester === selectedSemester).map(s => s.name))].map(sub => (
                            <Option key={sub} value={sub}>{sub}</Option>
                        ))}
                    </Select>
                    <Divider type="vertical" className="h-6" />
                    <Select 
                        value={selectedGrade} 
                        onChange={setSelectedGrade} 
                        className="w-40" 
                        bordered={false}
                        showSearch
                    >
                        <Option value="All">Overall School (All Grades)</Option>
                        {gradeOptions.map(g => (
                            <Option key={g.value} value={g.value}>{g.label}</Option>
                        ))}
                    </Select>
                </Space>
            </div>

            <Row gutter={[24, 24]}>
                <Col xs={24} md={8}>
                    <Card className="rounded-3xl border-none bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/20 overflow-hidden relative">
                        <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                            <TrophyOutlined style={{ fontSize: '120px' }} />
                        </div>
                        <div className="relative z-10">
                            <Text className="text-blue-100 font-bold uppercase tracking-wider text-xs">Category Average</Text>
                            <div className="text-5xl font-black mt-2 mb-1">{schoolAverage.toFixed(1)}%</div>
                            <Text className="text-blue-100 text-sm">Target {selectedSemester}</Text>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card className="rounded-3xl border-none bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-xl shadow-green-500/20 overflow-hidden relative">
                        <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                            <TeamOutlined style={{ fontSize: '120px' }} />
                        </div>
                        <div className="relative z-10">
                            <Text className="text-green-100 font-bold uppercase tracking-wider text-xs">Total Ranked Students</Text>
                            <div className="text-5xl font-black mt-2 mb-1">{studentRankings.length}</div>
                            <Text className="text-green-100 text-sm">With recorded marks</Text>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card className="rounded-3xl border-none bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-xl shadow-purple-500/20 overflow-hidden relative">
                         <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                            <StarOutlined style={{ fontSize: '120px' }} />
                        </div>
                        <div className="relative z-10">
                            <Text className="text-purple-100 font-bold uppercase tracking-wider text-xs">Top Performer</Text>
                            <div className="text-3xl font-black mt-2 mb-1 truncate">
                                {top10Students.length > 0 ? top10Students[0].name : 'N/A'}
                            </div>
                            <Text className="text-purple-100 text-sm">
                                {top10Students.length > 0 ? `${top10Students[0].percentage.toFixed(1)}% Average` : 'No data'}
                            </Text>
                        </div>
                    </Card>
                </Col>
            </Row>

            <Card 
                title={
                    <Space>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <LineChartOutlined className="text-blue-600" />
                        </div>
                        <span className="font-bold text-lg">Top 10 Students Leaderboard</span>
                        {selectedGrade !== 'All' && <Tag color="blue" className="ml-2">{formatGrade(selectedGrade)}</Tag>}
                    </Space>
                }
                className="rounded-3xl border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden"
                bodyStyle={{ padding: 0 }}
            >
                {studentRankings.length > 0 ? (
                    <Table 
                        columns={columns} 
                        dataSource={top10Students}
                        rowKey="id"
                        pagination={false}
                        className="leaderboard-table"
                    />
                ) : (
                    <div className="p-12 text-center text-slate-400">
                        <Empty description={`No mark data found for ${selectedGrade === 'All' ? 'the school' : formatGrade(selectedGrade)} in ${selectedSemester}`} />
                    </div>
                )}
            </Card>

            <style>{`
                .leaderboard-table .ant-table-thead > tr > th {
                    background-color: transparent;
                    border-bottom: 2px solid #f1f5f9;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: 1px;
                    padding: 16px;
                }
                .dark .leaderboard-table .ant-table-thead > tr > th {
                    border-bottom-color: #1e293b;
                    color: #94a3b8;
                }
                .leaderboard-table .ant-table-tbody > tr > td {
                    padding: 16px;
                    border-bottom: 1px solid #f8fafc;
                }
                .dark .leaderboard-table .ant-table-tbody > tr > td {
                    border-bottom-color: #0f172a;
                }
                .leaderboard-table .ant-table-tbody > tr:hover > td {
                    background-color: #f8fafc;
                }
                .dark .leaderboard-table .ant-table-tbody > tr:hover > td {
                    background-color: #0f172a;
                }
            `}</style>
        </div>
    );
}
