-- ==============================================================================
-- CORE / TABLAS GENÉRICAS (Módulo Base)
-- ==============================================================================

-- Tabla genérica de usuarios del sistema interno (Admins, RRHH, etc.)
CREATE TABLE core_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- Ej: 'WEB_ADMIN', 'HR_MANAGER'
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- MÓDULO DE EMPLEABILIDAD (EMP)
-- ==============================================================================

-- 2.1 Vacantes de Trabajo
-- Almacena las oportunidades laborales que se muestran en la web pública.
CREATE TABLE emp_job_vacancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT NOT NULL, -- Sugerencia: Usar TEXT o JSONB si necesitas listas estructuradas
    
    is_active BOOLEAN DEFAULT true,     -- Para activar/desactivar la vacante
    is_published BOOLEAN DEFAULT false, -- Para mostrarla u ocultarla al público
    
    publication_date TIMESTAMP,
    closing_date TIMESTAMP,
    
    created_by UUID REFERENCES core_users(id), -- Admin que creó la vacante
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 Candidatos
-- Datos del aspirante. Se crea una tabla separada para evitar redundancia 
-- de datos si un mismo candidato aplica a múltiples vacantes en el futuro.
CREATE TABLE emp_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    national_id VARCHAR(20) UNIQUE NOT NULL, -- Cédula/DNI
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 Postulaciones
-- Relaciona a un candidato con una vacante y maneja el estado de la aplicación.
CREATE TABLE emp_job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vacancy_id UUID NOT NULL REFERENCES emp_job_vacancies(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES emp_candidates(id) ON DELETE CASCADE,
    
    -- El estado de la postulación. Simplificado a un ENUM o VARCHAR 
    -- en lugar de una tabla/clase compleja. Ej: 'PENDING', 'ACCEPTED', 'REJECTED'
    status VARCHAR(50) DEFAULT 'PENDING', 
    
    -- Archivo del Currículum. Guardamos solo la URL del archivo subido a Supabase/S3.
    resume_url VARCHAR(500) NOT NULL, 
    cover_letter TEXT, -- Opcional, por si hay un campo de "mensaje adicional"
    
    -- Campos de evaluación interna
    review_notes TEXT, 
    reviewed_by UUID REFERENCES core_users(id), -- El admin que evaluó al candidato
    review_date TIMESTAMP,
    
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricción clave: Evita que el mismo candidato aplique dos veces a la misma vacante
    UNIQUE(vacancy_id, candidate_id)
);
