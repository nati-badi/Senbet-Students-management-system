ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE public.marks ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE public.marks ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS semester TEXT;

-- 1. Add updated_at column to all tables if missing
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.marks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Create the update_timestamp function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Create triggers for each table
DROP TRIGGER IF EXISTS update_students_modtime ON public.students;
CREATE TRIGGER update_students_modtime BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_subjects_modtime ON public.subjects;
CREATE TRIGGER update_subjects_modtime BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_assessments_modtime ON public.assessments;
CREATE TRIGGER update_assessments_modtime BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_attendance_modtime ON public.attendance;
CREATE TRIGGER update_attendance_modtime BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_marks_modtime ON public.marks;
CREATE TRIGGER update_marks_modtime BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_teachers_modtime ON public.teachers;
CREATE TRIGGER update_teachers_modtime BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS update_settings_modtime ON public.settings;
CREATE TRIGGER update_settings_modtime BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_timestamp();
