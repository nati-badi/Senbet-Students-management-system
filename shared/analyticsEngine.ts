import { normalizeGrade, normalizeSubject, isConductAssessment } from './gradeUtils';
export { isConductAssessment };

/**
 * Universal Analytics Engine for Senbet Students Management System.
 * Ensures consistent ranking and percentage calculation across Mobile and Desktop.
 */

export interface UnifiedMark {
  id?: string;
  studentId?: string;
  studentid?: string;
  assessmentId?: string;
  assessmentid?: string;
  score: number | string;
}

export interface UnifiedAssessment {
  id?: string;
  assessmentId?: string;
  name: string;
  subjectName?: string;
  subjectname?: string;
  grade: string;
  maxScore?: number | string;
  maxscore?: number | string;
  max_score?: number | string;
}

export interface UnifiedStudent {
  id: string;
  name: string;
  grade: string;
}

/**
 * Calculates academic stats for a student against a set of assessments.
 * WEIGHTED MEAN = (Sum of Earned) / (Sum of Max)
 */
export const calculateStudentStats = (
  student: UnifiedStudent,
  relevantAssessments: UnifiedAssessment[],
  allMarks: UnifiedMark[]
) => {
  let totalScore = 0;
  let totalMax = 0;

  relevantAssessments.forEach(a => {
    const aId = a.id || a.assessmentId;
    
    // Find mark with robust ID matching
    const mark = allMarks.find(m => {
      const mStudentId = m.studentId || m.studentid;
      const mAssessmentId = m.assessmentId || m.assessmentid;
      return mStudentId === student.id && mAssessmentId === aId;
    });

    if (mark) {
      totalScore += (Number(mark.score) || 0);
    }

    // Accumulate total max potential score
    const mScore = Number(a.maxScore || a.maxscore || a.max_score || 0);
    totalMax += mScore;
  });

  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  return {
    totalScore,
    totalMax,
    percentage,
    hasData: totalMax > 0
  };
};

/**
 * Calculates full rankings for a cohort.
 */
export const calculateRankings = (
  students: UnifiedStudent[],
  assessments: UnifiedAssessment[],
  marks: UnifiedMark[]
) => {
  if (!students || !assessments || !marks) return [];

  // Exclude non-academic assessments (conduct, etc.)
  const academicAssessments = assessments.filter(a => !isConductAssessment(a));

  const studentsWithStats = students.map(s => {
    const sGradeNorm = normalizeGrade(s.grade);
    
    // Filter assessments that belong to this student's grade level
    const sGradeAssessments = academicAssessments.filter(a => 
      normalizeGrade(a.grade) === sGradeNorm
    );

    const stats = calculateStudentStats(s, sGradeAssessments, marks);
    
    return {
      ...s,
      ...stats
    };
  }).filter(s => s.hasData); // Only rank students who actually have recordable marks

  // Sort by percentage descending
  return studentsWithStats.sort((a, b) => b.percentage - a.percentage);
};

/**
 * Calculates specific ranks (Overall and Class/Section) for a single student.
 */
export const calculateSingleStudentRank = (
  student: UnifiedStudent,
  allStudents: UnifiedStudent[],
  assessments: UnifiedAssessment[],
  marks: UnifiedMark[],
  activeSemester: string,
  subjects: any[]
) => {
  if (!student || !allStudents || !assessments || !marks || !subjects) {
    return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };
  }

  const studentGradeNorm = normalizeGrade(student.grade);

  // 1. Filter assessments by Grade, Conduct status, and Semester
  const filteredAssessments = assessments.filter(a => {
    // Must match grade
    if (normalizeGrade(a.grade) !== studentGradeNorm) return false;
    
    // Skip conduct
    if (isConductAssessment(a)) return false;

    // Check semester logic
    const sName = a.subjectName || a.subjectname;
    const subjectObj = subjects.find(s => normalizeSubject(s.name) === normalizeSubject(sName));
    const subjSem = subjectObj?.semester || 'Semester I';

    if (activeSemester === 'Semester I') {
      return subjSem === 'Semester I';
    }
    // Semester II is cumulative (includes both Sem I and Sem II subjects)
    return true; 
  });

  if (filteredAssessments.length === 0) {
    return { classRank: 'N/A', overallRank: 'N/A', totalInClass: 0, totalInGrade: 0 };
  }

  // 2. Identify all students in this grade level (for Overall Rank)
  const studentsInGradeLevel = allStudents.filter(s => 
    normalizeGrade(s.grade) === studentGradeNorm
  );

  // 3. Calculate rankings for the grade level
  const rankings = calculateRankings(studentsInGradeLevel, filteredAssessments, marks);

  // 4. Find student stats
  const studentStats = rankings.find(r => r.id === student.id);
  
  // 5. Calculate class-specific subset
  const classRanks = rankings.filter(r => r.grade === student.grade);

  let overallRank: number | 'N/A' = 'N/A';
  let classRank: number | 'N/A' = 'N/A';

  if (studentStats) {
    // Standard Competition Ranking (12225): Rank = 1 + (number of peers strictly ahead of you)
    overallRank = 1 + rankings.filter(r => r.percentage > studentStats.percentage).length;
    classRank = 1 + classRanks.filter(r => r.percentage > studentStats.percentage).length;
  }

  return {
    overallRank,
    totalInGrade: rankings.length,
    classRank,
    totalInClass: classRanks.length,
    stats: studentStats || null 
  };
};

/**
 * Calculates data for Subject Performance rows.
 */
export const calculateSubjectRows = (
  student: UnifiedStudent,
  assessments: UnifiedAssessment[],
  marks: UnifiedMark[],
  subjects: any[],
  activeSemester: string
) => {
  if (!student) return [];

  const gradeNorm = normalizeGrade(student.grade);
  
  const gradeAssessments = assessments.filter(a => 
    normalizeGrade(a.grade) === gradeNorm && !isConductAssessment(a)
  );

  const uniqueSubjectNames = [...new Set(gradeAssessments.map(a => a.subjectName || a.subjectname))].sort();

  return uniqueSubjectNames.map(subName => {
    // Utility to get score for a set of assessments
    const getScoreForSet = (assessmentSet: UnifiedAssessment[]) => {
      const earned = assessmentSet.reduce((acc, a) => {
        const aId = a.id || a.assessmentId;
        const m = marks.find(mark => 
          (mark.studentId === student.id || mark.studentid === student.id) && 
          (mark.assessmentId === aId || mark.assessmentid === aId)
        );
        return acc + (m ? (Number(m.score) || 0) : 0);
      }, 0);
      
      const max = assessmentSet.reduce((acc, a) => 
        acc + (Number(a.maxScore || a.maxscore || a.max_score) || 0), 0
      );
      
      const hasData = assessmentSet.some(a => {
        const aId = a.id || a.assessmentId;
        return marks.find(m => 
          (m.studentId === student.id || m.studentid === student.id) && 
          (m.assessmentId === aId || m.assessmentid === aId)
        );
      });

      return { earned, max, hasData };
    };

    const semIAssessments = gradeAssessments.filter(a => {
      const aSub = a.subjectName || a.subjectname;
      const subjObj = subjects.find(s => normalizeSubject(s.name) === normalizeSubject(aSub));
      return aSub === subName && (subjObj?.semester || 'Semester I') === 'Semester I';
    });

    const semIIAssessments = gradeAssessments.filter(a => {
      const aSub = a.subjectName || a.subjectname;
      const subjObj = subjects.find(s => normalizeSubject(s.name) === normalizeSubject(aSub));
      return aSub === subName && subjObj?.semester === 'Semester II';
    });

    const semI = getScoreForSet(semIAssessments);
    const semII = getScoreForSet(semIIAssessments);

    let rowMax = 0;
    let rowEarned = 0;
    if (activeSemester === 'Semester I') {
      rowMax = semI.max;
      rowEarned = semI.earned;
    } else {
      rowMax = semI.max + semII.max;
      rowEarned = semI.earned + semII.earned;
    }

    const avgPct = rowMax > 0 ? ((rowEarned / rowMax) * 100).toFixed(0) : '-';

    return {
      subject: subName,
      semI: semI.hasData ? `${semI.earned} / ${semI.max}` : (semIAssessments.length ? '—' : 'N/A'),
      semII: semII.hasData ? `${semII.earned} / ${semII.max}` : (semIIAssessments.length ? '—' : 'N/A'),
      avg: avgPct !== '-' ? `${avgPct}%` : '—',
      rowMax,
      rowEarned,
      semIEarned: semI.earned,
      semIMax: semI.max,
      semIIEarned: semII.earned,
      semIIMax: semII.max,
      semIHasData: semI.hasData,
      semIIHasData: semII.hasData
    };
  });
};

/**
 * Calculates group averages (category or school-wide).
 */
export const calculateGroupAverage = (studentStats: any[]) => {
  if (!studentStats || !studentStats.length) return 0;
  const totalEarned = studentStats.reduce((sum, s) => sum + (s.totalScore || 0), 0);
  const totalMax = studentStats.reduce((sum, s) => sum + (s.totalMax || 0), 0);
  return totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
};
