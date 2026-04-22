import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spin, Button, Result, Alert } from 'antd';
import { DownloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { supabase } from '../../utils/supabaseClient';
import LiveCertificate from '../../components/LiveCertificate';
import { calculateSingleStudentRank, calculateSubjectRows } from '../../utils/analyticsEngine';
import { useTranslation } from 'react-i18next';

export default function VerifyCertificate() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [student, setStudent] = useState(null);
  const [rankingInfo, setRankingInfo] = useState(null);
  const [subjectRows, setSubjectRows] = useState([]);
  const [missingAssessments, setMissingAssessments] = useState([]);
  const [gradeAssessments, setGradeAssessments] = useState([]);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    const fetchCertificateData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Student
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (studentError) throw studentError;
        if (!studentData) throw new Error("Student not found");
        
        setStudent(studentData);

        // 2. Fetch everything else needed
        const [mRes, aRes, subRes, setRes, allStudentsRes] = await Promise.all([
          supabase.from('marks').select('*').eq('studentid', studentData.id),
          supabase.from('assessments').select('*').eq('grade', studentData.grade),
          supabase.from('subjects').select('*'),
          supabase.from('settings').select('*'),
          supabase.from('students').select('*').eq('grade', studentData.grade)
        ]);

        const allStudents = allStudentsRes.data || [];
        const studentIdsInGrade = allStudents.map(s => s.id);
        
        const allMarksRes = await supabase.from('marks').select('*').in('studentid', studentIdsInGrade);

        const marks = mRes.data || [];
        const allMarks = allMarksRes.data || [];
        const assessments = aRes.data || [];
        const subjects = subRes.data || [];
        
        let settingsMap = {};
        if (setRes.data) {
          setRes.data.forEach(s => settingsMap[s.key] = s.value);
        }
        setSettings(settingsMap);
        const activeSemester = settingsMap['currentSemester'] || 'Semester I';

        // 3. Calculate metrics using the engine
        const rankInfo = calculateSingleStudentRank(studentData, allStudents, assessments, allMarks, activeSemester, subjects);
        const rows = calculateSubjectRows(studentData, assessments, marks, subjects, activeSemester);
        
        // Find missing assessments
        const missing = assessments.filter(a => {
            if (a.semester && a.semester !== activeSemester) return false;
            const hasMark = marks.some(m => m.assessmentid === a.id);
            return !hasMark;
        });

        setRankingInfo(rankInfo);
        setSubjectRows(rows);
        setMissingAssessments(missing);
        setGradeAssessments(assessments);

      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchCertificateData();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Spin size="large" /></div>;
  }

  if (error || !student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <Result
          status="warning"
          title="Verification Failed"
          subTitle="This certificate could not be found or the link is invalid."
          extra={<Link to="/"><Button type="primary">Go to Homepage</Button></Link>}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center pb-12">
      {/* Public Header */}
      <div className="w-full bg-white shadow-sm px-6 py-4 flex justify-between items-center mb-8 border-b border-slate-200 hide-on-print">
        <div className="flex items-center gap-3">
            <SafetyCertificateOutlined className="text-2xl text-forest-600" />
            <div>
                <h1 className="text-lg font-bold text-slate-800 m-0">Official Verification Portal</h1>
                <p className="text-xs text-slate-500 m-0">Senbet Student Management System</p>
            </div>
        </div>
        <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            size="large"
            onClick={() => window.print()}
            className="shadow-md bg-forest-600 hover:bg-forest-700"
        >
            Download PDF
        </Button>
      </div>

      {/* Certificate Container */}
      <div className="w-full max-w-4xl px-4 print-container">
        <div className="mb-6 hide-on-print">
            <Alert 
                message="Certificate Verified" 
                description={`This is the official, live academic record for ${student.name} as of ${new Date().toLocaleDateString()}.`}
                type="success" 
                showIcon 
                className="shadow-sm border-emerald-200 bg-emerald-50"
            />
        </div>
        <div className="bg-white p-2 md:p-8 rounded-3xl shadow-xl border border-slate-200 overflow-hidden print-no-shadow print-no-border print-p-0">
            <LiveCertificate 
                student={student}
                subjectRows={subjectRows}
                rankingInfo={rankingInfo}
                missingAssessments={missingAssessments}
                gradeAssessments={gradeAssessments}
                activeYearToUse={student.academicyear || new Date().toISOString()}
                averagePercentage={rankingInfo?.stats?.percentage?.toFixed(1) || 0}
            />
        </div>
      </div>
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
            body { background: white !important; }
            .hide-on-print { display: none !important; }
            .print-no-shadow { box-shadow: none !important; }
            .print-no-border { border: none !important; }
            .print-p-0 { padding: 0 !important; }
            .print-container { max-width: 100% !important; padding: 0 !important; }
            @page { margin: 0; size: A4 portrait; }
        }
      `}} />
    </div>
  );
}
