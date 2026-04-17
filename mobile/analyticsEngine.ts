import { 
  calculateStudentStats as sharedCalculateStudentStats,
  calculateRankings as sharedCalculateRankings,
  calculateSingleStudentRank as sharedCalculateSingleStudentRank,
  calculateSubjectRows as sharedCalculateSubjectRows,
  calculateGroupAverage as sharedCalculateGroupAverage
} from "../shared/analyticsEngine";
import { Student, Assessment } from "./utils";

/**
 * Mobile implementation of the analytics engine.
 * Delegated to the root /shared folder to ensure total consistency with Desktop.
 */

export interface Mark {
  id: string;
  studentId: string;
  assessmentId: string;
  score: number;
}

export interface Subject {
  id: string;
  name: string;
  semester: "Semester I" | "Semester II";
}

export const calculateStudentStats = (
  student: Student,
  assessments: Assessment[],
  allMarks: Mark[],
) => {
  return sharedCalculateStudentStats(student, assessments as any, allMarks as any);
};

export const calculateRankings = (
  students: Student[],
  assessments: Assessment[],
  marks: Mark[],
) => {
  return sharedCalculateRankings(students, assessments as any, marks as any);
};

export const calculateSingleStudentRank = (
  student: Student,
  allStudents: Student[],
  assessments: Assessment[],
  marks: Mark[],
  activeSemester: string,
  subjects: Subject[],
) => {
  return sharedCalculateSingleStudentRank(
    student,
    allStudents,
    assessments as any,
    marks as any,
    activeSemester,
    subjects
  );
};

export const calculateSubjectRows = (
  student: Student,
  assessments: Assessment[],
  marks: Mark[],
  subjects: Subject[],
  activeSemester: string,
) => {
  return sharedCalculateSubjectRows(
    student,
    assessments as any,
    marks as any,
    subjects,
    activeSemester
  );
};

export const calculateGroupAverage = (studentStats: any[]) => {
  return sharedCalculateGroupAverage(studentStats);
};
