import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Spin, Button, Typography, message } from 'antd';
import { DownloadOutlined, SafetyCertificateFilled, CheckOutlined } from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../utils/supabaseClient';
import { calculateSubjectRows, calculateSingleStudentRank } from '../../utils/analyticsEngine';
import { getEthiopianYear } from '../../utils/dateUtils';

const { Text } = Typography;

export default function VerifyCertificate() {
  const { id } = useParams();
  const certRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  
  const [student, setStudent] = useState(null);
  const [rankInfo, setRankInfo] = useState({});
  const [subjectRows, setSubjectRows] = useState([]);
  const [semester, setSemester] = useState('Semester I');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('id', id)
          .maybeSingle();
          
        if (studentError) throw studentError;
        if (!studentData) throw new Error("Student not found");
        setStudent(studentData);

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

        const studentMarks = mRes.data || [];
        const allMarks = allMarksRes.data || [];
        const gradeAssessments = aRes.data || [];
        const allSubjects = subRes.data || [];
        
        let settingsMap = {};
        if (setRes.data) setRes.data.forEach(s => settingsMap[s.key] = s.value);
        const activeSemester = settingsMap['currentSemester'] || 'Semester I';
        setSemester(activeSemester);

        const ri = calculateSingleStudentRank(studentData, allStudents, gradeAssessments, allMarks, activeSemester, allSubjects);
        const rows = calculateSubjectRows(studentData, gradeAssessments, studentMarks, allSubjects, activeSemester);

        setRankInfo(ri || { classRank: '-', overallRank: '-', totalInClass: 0, totalInGrade: 0 });
        setSubjectRows(rows);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const { overallEarned, overallMax, overallAvg } = useMemo(() => {
    let earned = 0, max = 0;
    subjectRows.forEach(row => { earned += row.rowEarned; max += row.rowMax; });
    return { overallEarned: earned, overallMax: max, overallAvg: max > 0 ? ((earned / max) * 100).toFixed(1) : 0 };
  }, [subjectRows]);

  const handleDownloadPDF = async () => {
    if (!certRef.current) return;
    try {
      setDownloading(true);
      const hide = message.loading('Generating Official PDF...', 0);

      const canvas = await html2canvas(certRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Verified_Certificate_${student.name.replace(/\s+/g, '_')}.pdf`);
      
      hide();
      message.success('Download Complete');
    } catch (err) {
      console.error(err);
      message.error('Generation Failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Spin size="large" /></div>;
  }

  if (error || !student) {
    return <div className="min-h-screen flex items-center justify-center bg-white p-6"><Text type="danger">Invalid Verification Link</Text></div>;
  }

  const scoreNum = parseFloat(overallAvg);
  const avgColor = scoreNum >= 70 ? '#166534' : (scoreNum >= 50 ? '#A67C00' : '#991B1B');
  const avgBg = scoreNum >= 70 ? '#ECFDF5' : (scoreNum >= 50 ? '#FFFBEB' : '#FEF2F2');
  const avgBorder = scoreNum >= 70 ? '#10B981' : (scoreNum >= 50 ? '#C9A227' : '#DC2626');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center">
      
      {/* 🟢 VERIFICATION STATUS BAR (SUBTLE & OFFICIAL) */}
      <div className="w-full bg-[#10B981] py-2 px-4 flex items-center justify-center gap-2 shadow-md hide-on-print sticky top-0 z-50">
        <SafetyCertificateFilled className="text-white text-lg" />
        <span className="text-white font-bold text-xs uppercase tracking-widest">Officially Verified Record</span>
        <CheckOutlined className="text-white font-black" />
      </div>

      {/* 📥 FLOATING DOWNLOAD BUTTON (FOR MOBILE) */}
      <button 
        onClick={handleDownloadPDF}
        disabled={downloading}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-forest-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-forest-700 active:scale-95 transition-all hide-on-print border-none cursor-pointer"
      >
        {downloading ? <Spin size="small" /> : <DownloadOutlined style={{ fontSize: '24px' }} />}
      </button>

      <div className="flex-1 w-full max-w-4xl p-2 md:p-8 flex flex-col items-center overflow-hidden">
        
        {/* RESPONSIVE CERTIFICATE SCALING */}
        <div className="cert-scaler-container">
          <div ref={certRef} className="cert-container" style={{
            width: '210mm',
            minHeight: '297mm',
            background: 'linear-gradient(180deg, #FAFAFA 0%, #F5F5F0 100%)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            color: '#1A1A1A',
            boxSizing: 'border-box',
            fontFamily: "'Inter', sans-serif"
          }}>
            {/* Gold Borders */}
            <div style={{ position: 'absolute', inset: '12px', border: '2px solid #C9A227', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(201,162,39,0.4)', pointerEvents: 'none' }} />

            {/* Corner Details */}
            <svg style={{ position: 'absolute', top: '12px', left: '12px', width: '32px', height: '32px', color: '#C9A227' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', top: '12px', right: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(90deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', bottom: '12px', left: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(-90deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>
            <svg style={{ position: 'absolute', bottom: '12px', right: '12px', width: '32px', height: '32px', color: '#C9A227', transform: 'rotate(180deg)' }} viewBox="0 0 100 100" fill="none"><path d="M0 0v100h20V20h80V0H0z" fill="currentColor"/></svg>

            {/* Watermark Logo */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.03, zIndex: 1, pointerEvents: 'none' }}>
              <img src="/logo.png" alt="" style={{ width: '450px', height: '450px', objectFit: 'contain', filter: 'grayscale(100%)' }} crossOrigin="anonymous" />
            </div>

            {/* Header Content */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px', zIndex: 10, textAlign: 'center' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '100px', height: '100px', marginBottom: '16px', objectFit: 'contain' }} crossOrigin="anonymous" />
              <span className="cert-amharic" style={{ fontSize: '28px', fontWeight: '800', color: '#0F3A2B', marginBottom: '4px' }}>በግ/ደ/አ/ቅ/አርሴማ ፍኖተ ብርሃን ሰ/ቤት</span>
              <span className="cert-amharic" style={{ fontSize: '14px', color: '#A67C00', fontStyle: 'italic' }}>"በሃይማኖትና በምግባር የታነጹ ትውልድን ማፍራት"</span>
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <span className="cert-amharic" style={{ fontSize: '32px', color: '#0A0A0A', fontWeight: '900' }}>የትምህርት ማስረጃ</span>
                <div style={{ width: '180px', height: '2px', backgroundColor: '#C9A227', margin: '8px auto' }}></div>
              </div>
            </div>

            {/* Student Summary */}
            <div className="inner-cert-card" style={{ padding: '28px 36px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
              <div>
                <span className="cert-amharic" style={{ fontSize: '12px', color: '#555', fontWeight: '800' }}>ሙሉ ስም / FULL NAME</span>
                <span className="cert-amharic" style={{ fontSize: '38px', fontWeight: '900', display: 'block', lineHeight: 1.1 }}>{student.name}</span>
                {!!(student?.baptismalName || student?.baptismalname) && (
                  <span className="cert-amharic" style={{ fontSize: '18px', fontWeight: '800', color: '#0F3A2B', marginTop: '8px', display: 'block' }}>{student.baptismalName || student.baptismalname}</span>
                )}
              </div>
              <div style={{ borderLeft: '2px solid #EEE', paddingLeft: '32px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span className="cert-amharic" style={{ fontSize: '11px', color: '#555' }}>ጥናት ዘመን / YEAR</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', display: 'block' }}>{getEthiopianYear(student.academicyear || student.academicYear || dayjs().toISOString())} ዓ.ም</span>
                </div>
                <div>
                  <span className="cert-amharic" style={{ fontSize: '11px', color: '#555' }}>ክፍል / GRADE</span>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: '#0F3A2B', display: 'block' }}>{student.grade}</span>
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="inner-cert-card" style={{ flex: 1, padding: '24px 32px', zIndex: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#555' }}>የትምህርት ዓይነት / SUBJECT</th>
                    <th style={{ textAlign: 'center', padding: '12px', color: '#555' }}>፩ኛ</th>
                    <th style={{ textAlign: 'center', padding: '12px', color: '#555' }}>፪ኛ</th>
                    <th style={{ textAlign: 'center', padding: '12px', color: '#555' }}>አጠቃላይ</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: idx % 2 === 0 ? 'transparent' : '#FAFAFA' }}>
                      <td style={{ padding: '14px 12px', fontWeight: '800' }}>{row.subject}</td>
                      <td style={{ textAlign: 'center' }}>{row.semI}</td>
                      <td style={{ textAlign: 'center' }}>{row.semII}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontWeight: '900',
                          backgroundColor: parseFloat(row.avg) >= 70 ? '#DCFCE7' : '#F3F4F6',
                          color: parseFloat(row.avg) >= 70 ? '#166534' : '#374151'
                        }}>{row.avg}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Rank Summary */}
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '2px solid #EEE', paddingTop: '24px' }}>
                <div style={{ display: 'flex', gap: '40px' }}>
                  <div>
                    <span className="cert-amharic" style={{ fontSize: '11px', color: '#666', fontWeight: '800' }}>ጠቅላላ ውጤት</span>
                    <span style={{ fontSize: '28px', fontWeight: '900', display: 'block' }}>{overallEarned} <span style={{fontSize:'14px', color:'#888'}}>/ {overallMax}</span></span>
                  </div>
                  <div>
                    <span className="cert-amharic" style={{ fontSize: '11px', color: '#666', fontWeight: '800' }}>የክፍል ደረጃ</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', display: 'block' }}>{rankInfo.classRank || '-'} <span style={{fontSize:'12px', color:'#888'}}>/ {rankInfo.totalInClass || '-'}</span></span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span className="cert-amharic" style={{ fontSize: '12px', color: avgColor, fontWeight: '900' }}>አማካይ ውጤት</span>
                  <div style={{ padding: '10px 20px', background: avgBg, border: `2px solid ${avgBorder}`, borderRadius: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '32px', fontWeight: '900', color: avgColor }}>{overallAvg}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer QR & Signatures */}
            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 20px', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '6px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #C9A227' }}>
                  <QRCodeCanvas value={`https://senbet-students-management-system.vercel.app/verify/${student.id}`} size={60} level="M" />
                </div>
                <div>
                  <span className="cert-amharic" style={{ fontSize: '11px', fontWeight: '800', color: '#0F3A2B', display: 'block' }}>ትክክለኛ ማስረጃ</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>ID: {student.id.slice(0,8)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '40px' }}>
                <div style={{ width: '100px', borderTop: '1px solid #333', textAlign: 'center', paddingTop: '4px' }}>
                  <span className="cert-amharic" style={{fontSize:'10px', fontWeight:'800'}}>ሥራ አስኪያጅ</span>
                </div>
                <div style={{ width: '100px', borderTop: '1px solid #333', textAlign: 'center', paddingTop: '4px' }}>
                  <span className="cert-amharic" style={{fontSize:'10px', fontWeight:'800'}}>አስተባባሪ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          .hide-on-print { display: none !important; }
          .cert-scaler-container { transform: none !important; margin: 0 !important; width: 100% !important; }
          body { background: white !important; }
          @page { margin: 0; size: A4 portrait; }
        }
        
        .cert-scaler-container {
          transform-origin: top center;
          box-shadow: 0 15px 40px rgba(0,0,0,0.1);
          border-radius: 2px;
          overflow: hidden;
          transition: transform 0.2s ease;
        }

        /* Mobile Responsive Scaling */
        @media (max-width: 210mm) {
          .cert-scaler-container {
            transform: scale(calc(100vw / 225mm));
            margin-bottom: calc(297mm * (1 - (100vw / 225mm)) * -1);
          }
        }
        @media (max-width: 500px) {
          .cert-scaler-container {
            transform: scale(calc((100vw - 20px) / 210mm));
            margin-bottom: calc(297mm * (1 - ((100vw - 20px) / 210mm)) * -1.05);
          }
        }

        .inner-cert-card {
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
        }

        .cert-amharic { font-family: 'Noto Sans Ethiopic', sans-serif; }
      `}} />
    </div>
  );
}
