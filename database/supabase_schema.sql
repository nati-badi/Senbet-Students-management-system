-- Supabase SQL Schema for Senbet Student Management System
-- Paste this into the Supabase SQL Editor to instantly create all required tables.

-- 1. Students Table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    baptismalName TEXT,
    grade TEXT NOT NULL,
    gender TEXT,
    parentContact TEXT,
    academicYear TEXT,
    dateOfEntry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Subjects Table
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Assessments Table
CREATE TABLE public.assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subjectName TEXT NOT NULL,
    grade TEXT NOT NULL,
    maxScore NUMERIC NOT NULL,
    date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Marks Table
CREATE TABLE public.marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    studentId UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    assessmentId UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL,
    assessmentDate TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Attendance Table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    studentId UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL, -- 'present', 'absent', 'late', 'no_class'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: 'synced' column is deliberately NOT tracked in Supabase. 
-- The local Dexie databases use 'synced' to track what needs to be pushed.
-- Supabase represents the "master" state.
