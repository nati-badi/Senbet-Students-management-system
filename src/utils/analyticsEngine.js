import { 
    calculateStudentStats as sharedCalculateStudentStats,
    calculateRankings as sharedCalculateRankings,
    calculateSingleStudentRank as sharedCalculateSingleStudentRank,
    calculateSubjectRows as sharedCalculateSubjectRows,
    calculateGroupAverage as sharedCalculateGroupAverage,
    isConductAssessment as sharedIsConductAssessment
} from '../../shared/analyticsEngine';
import { normalizeGrade as sharedNormalizeGrade, normalizeSubject as sharedNormalizeSubject } from '../../shared/gradeUtils';

/**
 * Shared central logic for all student performance and ranking calculations.
 * Ensures percentages and rankings match exactly across Student Profiles, 
 * Analytics Dashboards, and Live/Final Certificates.
 * 
 * Delegated to the root /shared folder for absolute cross-platform consistency.
 */

export const isConductAssessment = (assessment) => sharedIsConductAssessment(assessment);
export const normalizeGrade = (g) => sharedNormalizeGrade(g);
export const normalizeSubject = (s) => sharedNormalizeSubject(s);

export const calculateStudentStats = (student, relevantAssessments, allMarks) => {
    return sharedCalculateStudentStats(student, relevantAssessments, allMarks);
};

export const calculateRankings = (students, assessments, marks) => {
    return sharedCalculateRankings(students, assessments, marks);
};

export const calculateSingleStudentRank = (student, allStudents, assessments, marks, activeSemester, subjects) => {
    return sharedCalculateSingleStudentRank(student, allStudents, assessments, marks, activeSemester, subjects);
};

export const calculateSubjectRows = (student, assessments, marks, subjects, activeSemester) => {
    return sharedCalculateSubjectRows(student, assessments, marks, subjects, activeSemester);
};

export const calculateGroupAverage = (studentStats) => {
    return sharedCalculateGroupAverage(studentStats);
};
