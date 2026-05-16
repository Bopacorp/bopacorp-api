-- =====================================================
-- BOPA DIGITAL SYSTEM — ServiceCatalogCMS Module
-- Schema normalizado hasta 3FN · 22 tablas
-- PostgreSQL · Prisma-ready
-- =====================================================
-- Módulos cubiertos:
--   CAT  — Catálogo de Servicios
--   CMS  — Gestión de Contenidos Web
--   BUS  — Búsqueda Avanzada (bases relacionales)
-- =====================================================
-- Convenciones:
--   deleted_at TIMESTAMP NULL  → NULL = activo, NOT NULL = soft-deleted
--   updated_at trigger         → auto-actualización en cada UPDATE
--   Índices parciales UNIQUE   → WHERE deleted_at IS NULL
--   Zero ENUMs, zero CHECK IN  → todo con FK a lookup table
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CATÁLOGOS DE DOMINIO (lookup tables)
--    Una tabla por dominio con FK reales
-- =====================================================

-- 1.1 Tipos de servicio
CREATE TABLE item_types (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.2 Tipos de contrato
CREATE TABLE contract_types (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.3 Segmentos de mercado
CREATE TABLE segments (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.4 Tiers / niveles de servicio
CREATE TABLE tiers (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.5 Tipos de beneficio
CREATE TABLE benefit_types (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.6 Tipos de condición
CREATE TABLE condition_types (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.7 Tipos de contenido (CMS)
CREATE TABLE content_types (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.8 Canales de activación
CREATE TABLE activation_channels (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);

-- 1.9 Zonas geográficas de roaming
CREATE TABLE geo_zones (
    code       VARCHAR(30)  PRIMARY KEY,
    label      VARCHAR(100) NOT NULL,
    sort_order INTEGER      DEFAULT 0,
    deleted_at TIMESTAMP    DEFAULT NULL
);


-- =====================================================
-- 2. TABLAS DE ENTIDAD (entity tables)
-- =====================================================

-- 2.1 Categorías — jerarquía auto-referenciada
--     Replaces: Category.java (Composite pattern simplificado)
CREATE TABLE categories (
    id          SERIAL       PRIMARY KEY,
    parent_id   INTEGER      REFERENCES categories(id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order  INTEGER      DEFAULT 0,
    created_at  TIMESTAMP    DEFAULT NOW(),
    updated_at  TIMESTAMP    DEFAULT NOW(),
    deleted_at  TIMESTAMP    DEFAULT NULL
);

CREATE INDEX idx_categories_parent    ON categories(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_sort      ON categories(sort_order)   WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_categories_name_root
    ON categories(name) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_categories_name_child
    ON categories(name, parent_id) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;


-- 2.2 Ítems del catálogo — campos comunes
--     Replaces: CatalogItem.java, VoiceService, ConectivityService, DigitalService
--     Los campos específicos de cada tipo van en tablas 1:1 separadas
CREATE TABLE catalog_items (
    id                 SERIAL        PRIMARY KEY,
    category_id        INTEGER       NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    item_type_code     VARCHAR(30)   NOT NULL REFERENCES item_types(code),
    contract_type_code VARCHAR(30)   REFERENCES contract_types(code),
    segment_code       VARCHAR(30)   REFERENCES segments(code),
    tier_code          VARCHAR(30)   REFERENCES tiers(code),
    name                   VARCHAR(100)  NOT NULL,
    description            TEXT,
    price                  DECIMAL(15,2) NOT NULL CHECK (price >= 0),
    activation_code        VARCHAR(30),
    activation_channel_code VARCHAR(30)   REFERENCES activation_channels(code),
    created_at             TIMESTAMP     DEFAULT NOW(),
    updated_at             TIMESTAMP     DEFAULT NOW(),
    deleted_at             TIMESTAMP     DEFAULT NULL
);

CREATE INDEX idx_catalog_items_category   ON catalog_items(category_id)        WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_type       ON catalog_items(item_type_code)      WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_contract   ON catalog_items(contract_type_code)  WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_segment    ON catalog_items(segment_code)        WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_tier       ON catalog_items(tier_code)           WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_price      ON catalog_items(price)               WHERE deleted_at IS NULL;
CREATE INDEX idx_catalog_items_channel    ON catalog_items(activation_channel_code) WHERE deleted_at IS NULL;


-- 2.2a Detalles específicos VOICE (1:1)
--      Replaces: VoiceService.java
CREATE TABLE voice_item_details (
    item_id     INTEGER PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    gigas_total INTEGER,
    minutes     INTEGER,
    sms         INTEGER
);


-- 2.2b Detalles específicos CONNECTIVITY (1:1)
--      Replaces: ConectivityService.java
CREATE TABLE connectivity_item_details (
    item_id   INTEGER       PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    bandwidth DECIMAL(10,2)
);


-- 2.2c Detalles específicos DIGITAL (1:1)
--      Replaces: DigitalService.java
CREATE TABLE digital_item_details (
    item_id  INTEGER       PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    provider VARCHAR(100)
);

-- 2.2d Detalles específicos ROAMING (1:1)
CREATE TABLE roaming_item_details (
    item_id        INTEGER      PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    geo_zone_code  VARCHAR(30)  REFERENCES geo_zones(code),
    duration_days  INTEGER
);

-- 2.2e Detalles específicos DEVICE (1:1)
CREATE TABLE device_item_details (
    item_id            INTEGER       PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    brand              VARCHAR(50),
    model              VARCHAR(100),
    storage_gb         INTEGER,
    financing_months   INTEGER,
    financing_monthly  DECIMAL(10,2)
);


-- 2.3 Beneficios asociados a ítems (M:1)
--     Replaces: Benefit.java, ElectiveBenefit.java, TemporalBenefit.java
CREATE TABLE item_benefits (
    id               SERIAL       PRIMARY KEY,
    item_id          INTEGER      NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    benefit_type_code VARCHAR(30)  NOT NULL REFERENCES benefit_types(code),
    name             VARCHAR(100) NOT NULL,
    description      TEXT,
    created_at       TIMESTAMP    DEFAULT NOW(),
    deleted_at       TIMESTAMP    DEFAULT NULL
);

CREATE INDEX idx_item_benefits_item ON item_benefits(item_id)       WHERE deleted_at IS NULL;
CREATE INDEX idx_item_benefits_type ON item_benefits(benefit_type_code) WHERE deleted_at IS NULL;


-- 2.4a Condiciones de edad (1:1 con catalog_items)
--      Replaces: AgeCondition.java
CREATE TABLE age_conditions (
    item_id     INTEGER PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    min_age     INTEGER,
    max_age     INTEGER,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW(),
    deleted_at  TIMESTAMP DEFAULT NULL
);


-- 2.4b Condiciones legales (1:1 con catalog_items)
--      Replaces: LegalCondition.java
CREATE TABLE legal_conditions (
    item_id           INTEGER PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    legal_requirement TEXT,
    description       TEXT,
    created_at        TIMESTAMP DEFAULT NOW(),
    deleted_at        TIMESTAMP DEFAULT NULL
);


-- 2.4c Condiciones temporales (1:1 con catalog_items)
--      Replaces: Temporal condition concept (not a separate Java class, but present in SQL)
CREATE TABLE temporal_conditions (
    item_id         INTEGER PRIMARY KEY REFERENCES catalog_items(id) ON DELETE CASCADE,
    effective_date  DATE,
    expiration_date DATE,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    deleted_at      TIMESTAMP DEFAULT NULL
);


-- 2.5 Bloques de contenido CMS — web editable
--     Replaces: ContentBlock.java, ContentType.java, CompanyInfo.java
--     CompanyInfo (mission/vision/history/values) son content_blocks con content_key específico
CREATE TABLE content_blocks (
    id               SERIAL       PRIMARY KEY,
    content_key      VARCHAR(50)  NOT NULL,
    content_type_code VARCHAR(30) NOT NULL REFERENCES content_types(code),
    title            VARCHAR(100),
    content          TEXT         NOT NULL,
    sort_order       INTEGER      DEFAULT 0,
    updated_by       INTEGER,     -- ⚠️ FK pendiente → employees(id) cuando el módulo CoreUsers esté disponible
    created_at       TIMESTAMP    DEFAULT NOW(),
    updated_at       TIMESTAMP    DEFAULT NOW(),
    deleted_at       TIMESTAMP    DEFAULT NULL
);

CREATE INDEX idx_content_blocks_type  ON content_blocks(content_type_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_content_blocks_sort  ON content_blocks(sort_order)        WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_content_blocks_key
    ON content_blocks(content_key) WHERE deleted_at IS NULL;


-- 2.6 Solicitudes de contacto desde el catálogo público
--     RF-CAT-004: El cliente puede contactar a un asesor desde el catálogo
CREATE TABLE catalog_contact_requests (
    id            SERIAL       PRIMARY KEY,
    item_id       INTEGER      REFERENCES catalog_items(id) ON DELETE SET NULL,
    client_name   VARCHAR(100) NOT NULL,
    client_email  VARCHAR(100) NOT NULL,
    client_phone  VARCHAR(20),
    message       TEXT,
    is_attended   BOOLEAN      DEFAULT FALSE,
    attended_at   TIMESTAMP    DEFAULT NULL,
    attended_by   INTEGER,     -- ⚠️ FK pendiente → employees(id) cuando el módulo CoreUsers esté disponible
    created_at    TIMESTAMP    DEFAULT NOW(),
    deleted_at    TIMESTAMP    DEFAULT NULL
);

CREATE INDEX idx_contact_requests_item     ON catalog_contact_requests(item_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_contact_requests_attended ON catalog_contact_requests(is_attended)  WHERE deleted_at IS NULL;


-- =====================================================
-- 3. FUNCIÓN Y TRIGGERS
-- =====================================================

-- updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_catalog_items_updated_at
    BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_content_blocks_updated_at
    BEFORE UPDATE ON content_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- attended_at automático (cuando is_attended pasa a TRUE)
CREATE OR REPLACE FUNCTION set_attended_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_attended = TRUE AND (OLD.is_attended = FALSE OR OLD.is_attended IS NULL) THEN
        NEW.attended_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contact_attended
    BEFORE UPDATE ON catalog_contact_requests
    FOR EACH ROW EXECUTE FUNCTION set_attended_at();


-- =====================================================
-- 4. DATOS SEMILLA (seed data)
-- =====================================================

-- 4.1 Tipos de servicio
INSERT INTO item_types (code, label, sort_order) VALUES
    ('VOICE',         'Telefonía Móvil',       1),
    ('CONNECTIVITY',  'Internet y Datos',      2),
    ('DIGITAL',       'Servicios Digitales',   3),
    ('ROAMING',       'Roaming Internacional', 4),
    ('DEVICE',        'Dispositivos',          5);

-- 4.2 Tipos de contrato
INSERT INTO contract_types (code, label, sort_order) VALUES
    ('POSTPAGO',   'Postpago',   1),
    ('PREPAGO',    'Prepago',    2),
    ('RECURRENTE', 'Recurrente', 3);

-- 4.3 Segmentos de mercado
INSERT INTO segments (code, label, sort_order) VALUES
    ('SOHO',     'Small Office / Home Office',  1),
    ('EMPRESAS', 'Empresas',                    2),
    ('GENERAL',  'General',                     3);

-- 4.4 Tiers / niveles de servicio
INSERT INTO tiers (code, label, sort_order) VALUES
    ('DIAMOND',   'Diamond',   1),
    ('PLATINUM',  'Platinum',  2),
    ('GOLD',      'Gold',      3),
    ('STANDARD',  'Standard',  4);

-- 4.5 Tipos de beneficio
INSERT INTO benefit_types (code, label, sort_order) VALUES
    ('ELECTIVE', 'Electivo',   1),
    ('STANDARD', 'Estándar',   2),
    ('TEMPORAL', 'Temporal',   3);

-- 4.6 Tipos de condición
INSERT INTO condition_types (code, label, sort_order) VALUES
    ('AGE',      'Edad',     1),
    ('LEGAL',    'Legal',    2),
    ('TEMPORAL', 'Temporal', 3);

-- 4.7 Tipos de contenido
INSERT INTO content_types (code, label, sort_order) VALUES
    ('TEXT',   'Texto Plano',       1),
    ('HTML',   'HTML Enriquecido',  2),
    ('IMAGE',  'Imagen',            3),
    ('VIDEO',  'Video',             4),
    ('BANNER', 'Banner Publicitario', 5);

-- 4.8 Canales de activación
INSERT INTO activation_channels (code, label, sort_order) VALUES
    ('SMS_333', 'SMS al 333',    1),
    ('APP',     'App Móvil',     2),
    ('WEB',     'Portal Web',    3);

-- 4.9 Zonas geográficas de roaming
INSERT INTO geo_zones (code, label, sort_order) VALUES
    ('CAN',           'Canadá',              1),
    ('USA',           'Estados Unidos',      2),
    ('ZONA_MOVISTAR', 'Zona Movistar',       3),
    ('WORLD',         'Resto del Mundo',     4);

-- 4.10 Categorías raíz
INSERT INTO categories (name, description, sort_order) VALUES
    ('Telefonía Móvil',    'Planes y servicios de telefonía celular',            1),
    ('Internet y Datos',   'Servicios de conectividad e internet empresarial',   2),
    ('Servicios Digitales','Soluciones digitales y servicios cloud',             3);

-- 4.11 Contenido institucional (CompanyInfo via content_blocks)
INSERT INTO content_blocks (content_key, content_type_code, title, content, sort_order) VALUES
    ('mission', 'TEXT', 'Misión',   'Proporcionar servicios de telecomunicaciones de alta calidad que impulsen la transformación digital de las empresas ecuatorianas.', 1),
    ('vision',  'TEXT', 'Visión',   'Ser la empresa líder en soluciones de telecomunicaciones B2B del Ecuador, reconocida por nuestra excelencia operativa.',         2),
    ('history', 'TEXT', 'Historia', 'Fundada en 2010, BOPACORP S.A. ha evolucionado como socio estratégico de Telefónica Movistar, ofreciendo servicios de telecomunicaciones a más de 500 empresas.', 3),
    ('values',  'TEXT', 'Valores',  'Integridad, Innovación, Compromiso con el cliente, Excelencia operativa, Responsabilidad social.',                             4);

-- 4.12 Ítems de ejemplo — Voz
INSERT INTO catalog_items (category_id, item_type_code, contract_type_code, segment_code, tier_code, name, description, price)
VALUES
    (1, 'VOICE', 'POSTPAGO', 'GENERAL',  'STANDARD', 'Plan Básico Móvil', 'Plan de voz básico con datos limitados',             19.99),
    (1, 'VOICE', 'POSTPAGO', 'EMPRESAS', 'PLATINUM', 'Plan Pro Móvil',   'Plan de voz premium empresarial con datos ilimitados', 39.99);

INSERT INTO voice_item_details (item_id, gigas_total, minutes, sms) VALUES
    (1, 5,  100, 50),
    (2, 25, NULL, NULL);

-- 4.13 Ítems de ejemplo — Conectividad
INSERT INTO catalog_items (category_id, item_type_code, contract_type_code, segment_code, tier_code, name, description, price)
VALUES
    (2, 'CONNECTIVITY', 'POSTPAGO',   'EMPRESAS', 'GOLD',    'Internet Básico Empresarial',  'Conexión simétrica 50Mbps',  49.99),
    (2, 'CONNECTIVITY', 'RECURRENTE', 'EMPRESAS', 'DIAMOND', 'Internet Premium Empresarial', 'Conexión simétrica 200Mbps', 99.99);

INSERT INTO connectivity_item_details (item_id, bandwidth) VALUES
    (3, 50),
    (4, 200);

-- 4.14 Ítems de ejemplo — Digital
INSERT INTO catalog_items (category_id, item_type_code, contract_type_code, segment_code, tier_code, name, description, price)
VALUES
    (3, 'DIGITAL', 'RECURRENTE', 'SOHO',  'STANDARD', 'Almacenamiento Cloud 100GB', 'Espacio en la nube empresarial',      9.99),
    (3, 'DIGITAL', 'RECURRENTE', 'SOHO',  'STANDARD', 'Seguridad Endpoint',         'Protección antivirus empresarial',   14.99);

INSERT INTO digital_item_details (item_id, provider) VALUES
    (5, 'AWS'),
    (6, 'Kaspersky');

-- 4.15 Beneficios de ejemplo
INSERT INTO item_benefits (item_id, benefit_type_code, name, description) VALUES
    (1, 'STANDARD', 'Soporte 24/7',       'Atención al cliente telefónica las 24 horas'),
    (2, 'STANDARD', 'Roaming gratuito',   'Roaming internacional sin costo adicional'),
    (2, 'TEMPORAL', 'Descuento 50%',      '50% de descuento en la primera factura, válido por 90 días'),
    (4, 'ELECTIVE', 'IP fija incluida',   'Dirección IP fija sin costo');

-- 4.16 Condiciones de ejemplo
INSERT INTO age_conditions (item_id, min_age, max_age, description) VALUES
    (1, 18, NULL, 'El titular debe ser mayor de edad');

INSERT INTO legal_conditions (item_id, legal_requirement, description) VALUES
    (2, 'RUC activo', 'Cliente debe presentar RUC activo y vigente'),
    (4, 'RUC activo y certificado bancario', 'Se requiere documentación legal completa');

INSERT INTO temporal_conditions (item_id, effective_date, expiration_date, description) VALUES
    (2, '2026-06-01', '2026-12-31', 'Promoción válida solo durante el período indicado');

COMMIT;
