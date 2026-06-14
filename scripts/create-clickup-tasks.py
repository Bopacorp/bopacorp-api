#!/usr/bin/env python3
"""Create BOPADIGITAL ClickUp tasks — comprehensive plan from zero to deploy."""

import json
import time
import requests
import sys

TOKEN = "pk_101235845_NFXI27LSURDY08HHSUA1P3K1BAA3835J"
SPACE_ID = "90176024370"
HEADERS = {"Authorization": TOKEN, "Content-Type": "application/json"}
BASE = "https://api.clickup.com/api/v2"

# ClickUp user IDs
M = {
    "GT": 101235845,   # Gabriel Tumbaco — Backend, DevOps lead
    "ND": 216131439,   # Nahim Díaz — Backend, DevOps
    "SM": 101235842,   # Salvador Muñoz — Backend, some Frontend
    "SA": 101235844,   # Shirley Aragón — Frontend
    "AN": 101235843,   # Anthony Navarrete — Frontend, Mobile
}

SPRINTS = {
    "Sprint 1": {"start": "2026-05-11", "end": "2026-05-24"},
    "Sprint 2": {"start": "2026-05-25", "end": "2026-06-07"},
    "Sprint 3": {"start": "2026-06-08", "end": "2026-06-21"},
    "Sprint 4": {"start": "2026-06-22", "end": "2026-06-24"},
}

PRIO = {"urgent": 1, "high": 2, "normal": 3, "low": 4}


def ms(d):
    from datetime import datetime, timezone
    return int(datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000)


def api(method, path, data=None):
    for _ in range(3):
        r = getattr(requests, method)(f"{BASE}{path}", headers=HEADERS, json=data)
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", 2)))
            continue
        if r.status_code >= 400:
            print(f"  ERR {r.status_code}: {r.text[:150]}")
            return None
        return r.json()
    return None


def task(list_id, name, desc, assignees, prio, status, dates, parent=None):
    d = {
        "name": name,
        "description": desc,
        "assignees": assignees,
        "priority": prio,
        "status": status,
        "start_date": ms(dates[0]),
        "start_date_time": False,
        "due_date": ms(dates[1]),
        "due_date_time": False,
    }
    if parent:
        d["parent"] = parent
    return api("post", f"/list/{list_id}/task", d)


# ============================================================
# COMPREHENSIVE TASK PLAN
# Roles: BE=Backend, FE=Frontend, DO=DevOps, QA=Testing, DOC=Documentation
# Status: completadas | en curso | pendiente
# ============================================================

PLAN = {
    "Sprint 1": [
        # ── INFRASTRUCTURE & PROJECT SETUP ──
        {
            "name": "Creación y Configuración de Repositorios",
            "desc": "Crear repos en GitHub: bopacorp-api, bopacorp-web, bopacorp-shared. Configurar .gitignore, README, branch protection.",
            "assignees": [M["GT"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("Init repo bopacorp-api (Express + TS + ESM)", [M["GT"]], "completadas"),
                ("Init repo bopacorp-web (React + Vite + TS)", [M["GT"]], "completadas"),
                ("Init repo bopacorp-shared (Zod schemas + TS)", [M["GT"]], "completadas"),
                ("Configurar .gitignore, .env.example, .npmrc.example", [M["GT"]], "completadas"),
                ("Publicar @bopacorp/shared en GitHub Packages", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Configuración de Herramientas de Calidad de Código",
            "desc": "Biome (linter+formatter), Husky (pre-commit hooks), commitlint (Conventional Commits), lint-staged. [RUBRIC: Coding Standards 10pts]",
            "assignees": [M["GT"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("Configurar Biome en api, web y shared", [M["GT"]], "completadas"),
                ("Configurar Husky + lint-staged pre-commit hooks", [M["GT"]], "completadas"),
                ("Configurar commitlint (Conventional Commits)", [M["GT"]], "completadas"),
                ("Documentar estándares de código en CLAUDE.md", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Diseño y Modelado de Base de Datos",
            "desc": "Diseño del esquema PostgreSQL en Supabase. Drizzle ORM config. Schemas: app_auth, core, catalog, employability.",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("Diseñar schema app_auth (9 tablas, 4 enums)", [M["GT"]], "completadas"),
                ("Diseñar schema core (5 tablas: employees, departments, org_roles)", [M["GT"]], "completadas"),
                ("Diseñar schema catalog (20 tablas)", [M["GT"]], "completadas"),
                ("Diseñar schema employability (4 tablas, 1 enum)", [M["GT"]], "completadas"),
                ("Configurar Drizzle ORM + migraciones + drizzle.config.ts", [M["GT"]], "completadas"),
                ("Configurar dual connection strings (pooled + direct)", [M["ND"]], "completadas"),
            ]
        },
        {
            "name": "Fundamentos del Servidor Express",
            "desc": "Express 5 + TypeScript 6. Entry point, env validation (Zod), Pino logging, error handling, path aliases.",
            "assignees": [M["GT"], M["SM"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("Crear entry point (index.ts → server.ts)", [M["GT"]], "completadas"),
                ("Validación de env con Zod (config/env.ts)", [M["GT"]], "completadas"),
                ("Middleware de errores + HttpError classes", [M["GT"]], "completadas"),
                ("Configurar Pino logger", [M["SM"]], "completadas"),
                ("Configurar path aliases (@config, @lib, @modules, @shared)", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Sistema de Autenticación JWT",
            "desc": "Login/logout, JWT access+refresh tokens, bcrypt password hashing. [RUBRIC: Auth Framework +1pt]",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("Implementar login endpoint con JWT", [M["GT"]], "completadas"),
                ("Token refresh + blacklist de refresh tokens", [M["GT"]], "completadas"),
                ("Bcrypt hashing (salt ≥12 chars per RNF-004)", [M["ND"]], "completadas"),
                ("Middleware de autenticación (requireAuth)", [M["GT"]], "completadas"),
                ("Shared types: auth requests/responses", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "RBAC — Roles y Permisos Globales",
            "desc": "Sistema de roles, permisos y módulos. Permisos embebidos en JWT. Guard middleware.",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("CRUD de roles, módulos y permisos (admin)", [M["GT"]], "completadas"),
                ("Embed permissions en JWT payload", [M["ND"]], "completadas"),
                ("Guard middleware requirePermission()", [M["GT"]], "completadas"),
                ("Seed scripts para roles y permisos base", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Login Portal Web (Frontend)",
            "desc": "Página de login con email/password. AuthContext, RequireAuth, proactive token refresh.",
            "assignees": [M["AN"], M["SM"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("LoginPage con formulario email/password", [M["AN"]], "completadas"),
                ("AuthContext con user state, login(), logout(), hasPermission()", [M["SM"]], "completadas"),
                ("RequireAuth wrapper + PermissionRoute", [M["SM"]], "completadas"),
                ("Axios interceptor con token refresh (proactivo + reactivo)", [M["SM"]], "completadas"),
                ("Auth storage (localStorage tokens)", [M["SM"]], "completadas"),
            ]
        },
        {
            "name": "Estructura Landing Page y Vistas Públicas",
            "desc": "Landing page con hero, servicios, about, CTA. Páginas públicas: Services, About, Jobs.",
            "assignees": [M["SA"], M["AN"]],
            "prio": PRIO["high"],
            "status": "en curso",
            "subtasks": [
                ("Layout base + routing (React Router v7)", [M["AN"]], "completadas"),
                ("Landing page con secciones (hero, services grid, about, CTA)", [M["SA"]], "completadas"),
                ("ServicesPage — catálogo de servicios", [M["SA"]], "en curso"),
                ("AboutPage — historia, misión, visión, valores", [M["SA"]], "en curso"),
                ("JobsPage — vacantes disponibles", [M["AN"]], "en curso"),
            ]
        },
        {
            "name": "Shared Types Library — Módulos Base",
            "desc": "Tipos compartidos para common, auth, core. Publicar @bopacorp/shared a GitHub Packages.",
            "assignees": [M["GT"], M["SM"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("Common: UUID, Email, Pagination, API envelope schemas", [M["GT"]], "completadas"),
                ("Auth: Login, User, Role, Permission, Module schemas", [M["GT"]], "completadas"),
                ("Core: Employee, Department, OrgRole schemas", [M["GT"]], "completadas"),
                ("Configurar exports map + subpath imports", [M["GT"]], "completadas"),
                ("Pipeline de publicación (npm version + npm publish)", [M["SM"]], "completadas"),
            ]
        },
        {
            "name": "Configuración de ClickUp y Planificación SCRUM",
            "desc": "Workspace ClickUp, backlogs, sprint planning. [RUBRIC: SCRUM 10pts + Teamwork Tool 10pts]",
            "assignees": [M["ND"], M["GT"]],
            "prio": PRIO["normal"],
            "status": "completadas",
            "subtasks": [
                ("Crear workspace ClickUp e invitar miembros", [M["ND"]], "completadas"),
                ("Definir Product Backlog con user stories", [M["ND"]], "completadas"),
                ("Sprint 1 planning y asignación de tareas", [M["GT"]], "completadas"),
            ]
        },

        # ── SPRINT 2 ──────────────────────────────────────────
    ],
    "Sprint 2": [
        {
            "name": "Módulo Catálogo API (Backend)",
            "desc": "CRUD completo para categorías, items, content types, segments, tiers, benefit types, geo zones, contract types.",
            "assignees": [M["GT"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("CRUD categorías con árbol jerárquico", [M["GT"]], "completadas"),
                ("CRUD catalog items con detalles", [M["GT"]], "completadas"),
                ("Lookup tables (segments, tiers, benefit types, etc.)", [M["GT"]], "completadas"),
                ("Contact requests endpoint", [M["GT"]], "completadas"),
                ("Shared types: catalog schemas (20+ tipos)", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Módulo CMS (Backend + Frontend)",
            "desc": "Content blocks CRUD, CMS landing endpoint, admin UI con búsqueda y paginación.",
            "assignees": [M["SM"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("CMS API: content blocks CRUD + landing endpoint", [M["SM"]], "completadas"),
                ("Seed CMS landing content", [M["SM"]], "completadas"),
                ("CMS admin page con paginación + búsqueda", [M["SM"]], "completadas"),
                ("CMS edit dialog (inline text update)", [M["SM"]], "completadas"),
                ("Integración CMS landing con web pública", [M["SM"]], "completadas"),
            ]
        },
        {
            "name": "Módulo Empleabilidad API (Backend)",
            "desc": "Vacantes, candidatos, aplicaciones, hojas de vida. Upload de CVs a S3.",
            "assignees": [M["GT"], M["SM"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("CRUD vacantes (job vacancies)", [M["GT"]], "completadas"),
                ("CRUD candidatos", [M["GT"]], "completadas"),
                ("Aplicaciones a vacantes (create, update, list)", [M["GT"]], "completadas"),
                ("Upload de CVs a S3 (resumes)", [M["SM"]], "completadas"),
                ("Endpoint público para aplicar a vacante", [M["SM"]], "completadas"),
                ("Shared types: employability schemas", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Módulo Organización (Backend)",
            "desc": "Departments, employees, org-roles, advisor-supervisors. Separar identidad org de RBAC.",
            "assignees": [M["GT"]],
            "prio": PRIO["normal"],
            "status": "completadas",
            "subtasks": [
                ("CRUD departamentos", [M["GT"]], "completadas"),
                ("CRUD empleados con soft-delete y paginación", [M["GT"]], "completadas"),
                ("CRUD org-roles (roles organizacionales)", [M["GT"]], "completadas"),
                ("Advisor-supervisor relationships endpoints", [M["GT"]], "completadas"),
                ("Shared types: core schemas (Employee, Department, etc.)", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Módulo Usuarios (Backend)",
            "desc": "CRUD usuarios con asignación de roles y audit logging.",
            "assignees": [M["GT"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("CRUD usuarios (create, update, list, get)", [M["GT"]], "completadas"),
                ("Asignar/remover roles a usuarios", [M["GT"]], "completadas"),
                ("Centralizar audit logging en lib/audit.ts", [M["GT"]], "completadas"),
                ("GET /auth/me endpoint para datos del usuario actual", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Frontend Web — Auth + UI Components",
            "desc": "Refactor auth con RBAC real, proactive token refresh, UI primitives.",
            "assignees": [M["GT"], M["SM"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("RBAC con permisos reales del JWT", [M["GT"]], "completadas"),
                ("Shared UI primitives (PageLoader, ErrorState, etc.)", [M["GT"]], "completadas"),
                ("Restructurar admin module en layout modular", [M["GT"]], "completadas"),
                ("DOMPurify sanitizer para XSS prevention", [M["SM"]], "completadas"),
            ]
        },
        {
            "name": "Frontend Web — Empleabilidad UI",
            "desc": "Formulario de aplicación a empleo, módulo de empleabilidad.",
            "assignees": [M["AN"], M["SA"]],
            "prio": PRIO["normal"],
            "status": "en curso",
            "subtasks": [
                ("Formulario de aplicación a vacante", [M["AN"]], "completadas"),
                ("UI módulo empleabilidad (listado vacantes)", [M["AN"]], "en curso"),
                ("Actualizar landing con datos reales de Bopacorp", [M["SA"]], "completadas"),
            ]
        },
        {
            "name": "Init Proyecto CRM Web",
            "desc": "Crear repositorio bopacorp-crm. React + Vite + TS + Tailwind + shadcn/ui.",
            "assignees": [M["GT"], M["AN"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("Init repo con React 19 + Vite + TS + Tailwind v4", [M["GT"]], "completadas"),
                ("Configurar Biome + Husky + commitlint", [M["GT"]], "completadas"),
                ("Setup Radix UI + shadcn components", [M["AN"]], "completadas"),
            ]
        },
    ],
    "Sprint 3": [
        {
            "name": "Módulo CRM API (Backend)",
            "desc": "Business clients, negotiations (states, history), visits (types, GPS). 20+ endpoints.",
            "assignees": [M["GT"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("Schema CRM: 6 tablas + relaciones", [M["GT"]], "completadas"),
                ("CRUD business clients con paginación", [M["GT"]], "completadas"),
                ("CRUD negociaciones + estados + historial", [M["GT"]], "completadas"),
                ("CRUD visitas + tipos de visita + GPS", [M["GT"]], "completadas"),
                ("Shared types: crm schemas", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Módulo Matrices API (Backend)",
            "desc": "Offer matrices, line items, attachments, state machine (draft→pending→approved/rejected). 14 endpoints.",
            "assignees": [M["GT"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("Schema matrices: 4 tablas + enum MatrixState", [M["GT"]], "completadas"),
                ("CRUD offer matrices", [M["GT"]], "completadas"),
                ("CRUD line items + attachments", [M["GT"]], "completadas"),
                ("State transitions + history", [M["GT"]], "completadas"),
                ("Shared types: matrices schemas", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Módulo Documentos API (Backend)",
            "desc": "Document types config, negotiation documents, state machine. 15 endpoints.",
            "assignees": [M["GT"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("Schema documents: 3 tablas + enum DocumentState", [M["GT"]], "completadas"),
                ("CRUD document types (mandatory/optional config)", [M["GT"]], "completadas"),
                ("CRUD negotiation documents + state changes", [M["GT"]], "completadas"),
                ("Shared types: documents schemas", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "Módulos Reports & Notifications API (Backend)",
            "desc": "Report exports, sales objectives, notifications CRUD.",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("Schema reports + notifications", [M["GT"]], "completadas"),
                ("Reports API: exports + sales objectives", [M["GT"]], "completadas"),
                ("Notifications API: CRUD + list", [M["GT"]], "completadas"),
                ("RBAC seeds para nuevos módulos", [M["GT"]], "completadas"),
                ("Shared types: reports + notifications schemas", [M["GT"]], "completadas"),
            ]
        },
        {
            "name": "CRM Web — Scaffolding y Estructura",
            "desc": "11 rutas, layout principal, sidebar, breadcrumb, componentes shared.",
            "assignees": [M["AN"]],
            "prio": PRIO["urgent"],
            "status": "completadas",
            "subtasks": [
                ("MainLayout (sidebar + header + content)", [M["AN"]], "completadas"),
                ("Sidebar con navegación colapsable", [M["AN"]], "completadas"),
                ("AppBreadcrumb automático por ruta", [M["AN"]], "completadas"),
                ("11 páginas scaffolded (empty state)", [M["AN"]], "completadas"),
                ("Shared UI: KpiCard, FilterBar, EntityTable, StateBadge, TimelinePanel", [M["AN"]], "completadas"),
            ]
        },
        {
            "name": "CRM Web — Integración con API Real",
            "desc": "Conectar páginas scaffolded con endpoints reales. Prioridad: Login, Overview, Negociaciones.",
            "assignees": [M["SM"], M["AN"]],
            "prio": PRIO["urgent"],
            "status": "en curso",
            "subtasks": [
                ("Login real (reemplazar mock auth)", [M["SM"]], "en curso"),
                ("Overview: KPIs reales + leaderboard", [M["SM"]], "pendiente"),
                ("Negociaciones: lista con filtros + paginación", [M["AN"]], "pendiente"),
                ("Negociaciones/:id — detalle con timeline + visitas + docs", [M["AN"]], "pendiente"),
                ("Catálogo: matrices list + detail", [M["SM"]], "pendiente"),
            ]
        },
        {
            "name": "Web Pública — Completar Páginas Stub",
            "desc": "Implementar ServicesPage, AboutPage, JobsPage con datos del API.",
            "assignees": [M["SA"], M["AN"]],
            "prio": PRIO["high"],
            "status": "en curso",
            "subtasks": [
                ("ServicesPage — catálogo con filtros por categoría", [M["SA"]], "en curso"),
                ("AboutPage — historia, misión, visión, valores de Bopacorp", [M["SA"]], "en curso"),
                ("JobsPage — listado de vacantes + formulario de aplicación", [M["AN"]], "en curso"),
            ]
        },
        {
            "name": "CI/CD Pipelines (Todos los Repos)",
            "desc": "GitHub Actions: lint → typecheck → test → build. [RUBRIC: Build Automation 5pts]",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["high"],
            "status": "completadas",
            "subtasks": [
                ("CI pipeline bopacorp-api", [M["GT"]], "completadas"),
                ("CI pipeline bopacorp-web", [M["GT"]], "completadas"),
                ("CI pipeline bopacorp-crm", [M["GT"]], "completadas"),
                ("CI pipeline bopacorp-shared", [M["GT"]], "completadas"),
                ("Configurar NPM_TOKEN secret para GitHub Packages", [M["ND"]], "en curso"),
            ]
        },
        {
            "name": "Dockerización y Despliegue a Producción",
            "desc": "Dockerfiles para API, Web, CRM. Docker-compose. Deploy. CRÍTICO: -100pts si no hay deploy. [RUBRIC: Deployment 10pts]",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["urgent"],
            "status": "pendiente",
            "subtasks": [
                ("Dockerfile para bopacorp-api", [M["GT"]], "pendiente"),
                ("Dockerfile para bopacorp-web (nginx + static)", [M["GT"]], "pendiente"),
                ("Dockerfile para bopacorp-crm (nginx + static)", [M["ND"]], "pendiente"),
                ("Docker-compose para desarrollo local", [M["GT"]], "pendiente"),
                ("Deploy a servidor de producción", [M["GT"], M["ND"]], "pendiente"),
                ("Configurar dominio + HTTPS/TLS (RNF-005)", [M["ND"]], "pendiente"),
            ]
        },
        {
            "name": "Inicializar App Móvil (React Native / Expo)",
            "desc": "Init proyecto bopacorp-mobile. Login, navegación base, estructura.",
            "assignees": [M["AN"], M["SM"]],
            "prio": PRIO["urgent"],
            "status": "pendiente",
            "subtasks": [
                ("Init repo con Expo + TypeScript", [M["AN"]], "pendiente"),
                ("Login con JWT (reutilizar auth service)", [M["AN"]], "pendiente"),
                ("Navegación base (tab navigator + stack)", [M["AN"]], "pendiente"),
                ("Lista de clientes asignados", [M["SM"]], "pendiente"),
                ("Detalle de cliente + negociación", [M["SM"]], "pendiente"),
            ]
        },
        {
            "name": "Suite de Pruebas — API (Vitest)",
            "desc": "Tests unitarios e integración para módulos del API. [RUBRIC: Test Cases 10pts, RNF-021 ≥80%]",
            "assignees": [M["ND"], M["SM"]],
            "prio": PRIO["high"],
            "status": "pendiente",
            "subtasks": [
                ("Configurar Vitest + test database", [M["ND"]], "pendiente"),
                ("Tests auth module (login, refresh, RBAC)", [M["ND"]], "pendiente"),
                ("Tests catalog module (CRUD categories, items)", [M["SM"]], "pendiente"),
                ("Tests CRM module (clients, negotiations, visits)", [M["ND"]], "pendiente"),
                ("Tests employability module", [M["SM"]], "pendiente"),
            ]
        },
        {
            "name": "Detección Preventiva de Errores (SAST)",
            "desc": "Análisis estático de seguridad. npm audit, ESLint security rules o SonarQube. [RUBRIC: Preemptive Error Detection 15pts]",
            "assignees": [M["ND"], M["SM"]],
            "prio": PRIO["high"],
            "status": "pendiente",
            "subtasks": [
                ("Configurar npm audit en CI pipeline", [M["ND"]], "pendiente"),
                ("Integrar herramienta SAST (SonarQube / CodeClimate / Snyk)", [M["ND"]], "pendiente"),
                ("Documentar resultados del análisis estático", [M["SM"]], "pendiente"),
            ]
        },
    ],
    "Sprint 4": [
        {
            "name": "CRM Web — Módulos Restantes",
            "desc": "Completar integración: documentos, reportes/dashboard, empleabilidad.",
            "assignees": [M["SM"], M["AN"], M["SA"]],
            "prio": PRIO["urgent"],
            "status": "pendiente",
            "subtasks": [
                ("Documentación: queue de pendientes + approval UI", [M["AN"]], "pendiente"),
                ("Matrices: creación + line items + attachments + aprobación", [M["SA"]], "pendiente"),
                ("Reportes: dashboard con charts (Recharts) + KPIs", [M["SM"]], "pendiente"),
                ("Empleabilidad: gestión vacantes + aplicantes", [M["AN"]], "pendiente"),
                ("Notificaciones: bandeja de notificaciones", [M["SA"]], "pendiente"),
            ]
        },
        {
            "name": "App Móvil — Funcionalidades CRM",
            "desc": "Registro visitas con GPS, check-in/check-out, upload documentos.",
            "assignees": [M["AN"], M["SM"]],
            "prio": PRIO["high"],
            "status": "pendiente",
            "subtasks": [
                ("Registro de visita con GPS automático", [M["AN"]], "pendiente"),
                ("Check-in/Check-out con notas y observaciones", [M["AN"]], "pendiente"),
                ("Upload de documentos desde cámara/galería", [M["SM"]], "pendiente"),
                ("Vista de métricas individuales del asesor", [M["SM"]], "pendiente"),
            ]
        },
        {
            "name": "Suite de Pruebas — Frontend (React Testing Library)",
            "desc": "Tests de componentes y flujos principales Web + CRM. [RUBRIC: Test Cases 10pts]",
            "assignees": [M["SA"], M["AN"]],
            "prio": PRIO["high"],
            "status": "pendiente",
            "subtasks": [
                ("Configurar Vitest + RTL en bopacorp-web", [M["SA"]], "pendiente"),
                ("Tests landing + auth flow", [M["SA"]], "pendiente"),
                ("Tests CMS admin page", [M["AN"]], "pendiente"),
                ("Configurar Vitest + RTL en bopacorp-crm", [M["AN"]], "pendiente"),
            ]
        },
        {
            "name": "Guía de Despliegue e Instalación",
            "desc": "Manual de usuario, guía de instalación, requisitos del sistema. [RUBRIC: Deployment Guide 10pts]",
            "assignees": [M["ND"], M["SA"]],
            "prio": PRIO["high"],
            "status": "pendiente",
            "subtasks": [
                ("Guía de instalación (Docker, env vars, DB setup)", [M["ND"]], "pendiente"),
                ("Manual de usuario por rol (Advisor, Supervisor, Admin)", [M["SA"]], "pendiente"),
                ("Documentación de API endpoints", [M["ND"]], "pendiente"),
            ]
        },
        {
            "name": "Informe Final del Proyecto (PDF)",
            "desc": "Documento auto-contenido: contexto, proceso, testing, deployment, evidencias SCRUM. [RUBRIC: Report 10pts]",
            "assignees": [M["ND"], M["SA"]],
            "prio": PRIO["urgent"],
            "status": "pendiente",
            "subtasks": [
                ("Secciones: intro, scope, stakeholders, constraints", [M["SA"]], "pendiente"),
                ("Secciones: arquitectura, decisiones técnicas, diagramas", [M["ND"]], "pendiente"),
                ("Secciones: proceso SCRUM, sprints, evidencias", [M["SA"]], "pendiente"),
                ("Secciones: testing, resultados, cobertura", [M["ND"]], "pendiente"),
                ("Secciones: deployment, guía instalación", [M["ND"]], "pendiente"),
                ("Contribuciones individuales + carta de aceptación", [M["SA"]], "pendiente"),
            ]
        },
        {
            "name": "Presentación y Video Demo (10 min)",
            "desc": "Grabación de demostración del sistema. Todos participan. [RUBRIC: Presentation 15pts]",
            "assignees": [M["GT"], M["ND"], M["SM"], M["SA"], M["AN"]],
            "prio": PRIO["urgent"],
            "status": "pendiente",
            "subtasks": [
                ("Preparar slides con plantilla ESPOL", [M["SA"]], "pendiente"),
                ("Demo: intro del sistema + alcance + user stories", [M["GT"]], "pendiente"),
                ("Demo: arquitectura + decisiones técnicas", [M["GT"]], "pendiente"),
                ("Demo: features por rol (Advisor, Supervisor, Admin, Candidate)", [M["AN"], M["SM"]], "pendiente"),
                ("Demo: test cases + resultados", [M["ND"]], "pendiente"),
                ("Grabar video (10 min, participación equitativa)", [M["GT"]], "pendiente"),
            ]
        },
        {
            "name": "Carta de Aceptación del Cliente",
            "desc": "Obtener carta firmada por Mgtr. Christian Pauta. CRÍTICO: -100pts sin ella.",
            "assignees": [M["GT"], M["ND"]],
            "prio": PRIO["urgent"],
            "status": "pendiente",
            "subtasks": [
                ("Coordinar reunión sprint review con cliente", [M["GT"]], "pendiente"),
                ("Obtener firma en carta de aceptación", [M["ND"]], "pendiente"),
            ]
        },
        {
            "name": "Compilación de Evidencias SCRUM",
            "desc": "Sprint reviews, retrospectives, daily standups, burndown charts. [RUBRIC: SCRUM 10pts]",
            "assignees": [M["SA"], M["ND"]],
            "prio": PRIO["high"],
            "status": "pendiente",
            "subtasks": [
                ("Screenshots de ClickUp por sprint", [M["SA"]], "pendiente"),
                ("Evidencias de comunicaciones (WhatsApp, meetings)", [M["ND"]], "pendiente"),
                ("Índice de evidencias (tabla con archivos, fechas, participantes)", [M["SA"]], "pendiente"),
                ("Sprint review notes + retrospective", [M["ND"]], "pendiente"),
            ]
        },
        {
            "name": "Application Profiling",
            "desc": "Perfilado de rendimiento del API. [RUBRIC: Profiling +1pt extra]",
            "assignees": [M["ND"]],
            "prio": PRIO["low"],
            "status": "pendiente",
            "subtasks": [
                ("Configurar clinic.js / 0x profiler para Node.js", [M["ND"]], "pendiente"),
                ("Generar flamegraph y reportar bottlenecks", [M["ND"]], "pendiente"),
            ]
        },
        {
            "name": "Polish Final y QA",
            "desc": "Responsive check, cross-browser testing, security review final.",
            "assignees": [M["SA"], M["SM"]],
            "prio": PRIO["normal"],
            "status": "pendiente",
            "subtasks": [
                ("Responsive check 360px–1440px (RNF-007)", [M["SA"]], "pendiente"),
                ("Cross-browser testing Chrome/Firefox/Edge (RNF-006)", [M["SM"]], "pendiente"),
                ("Security review: OWASP Top 10 compliance (RNF-011)", [M["SM"]], "pendiente"),
                ("Session timeout 15min inactivity (RNF-024)", [M["ND"]], "pendiente"),
            ]
        },
    ],
}


def main():
    print("=" * 60)
    print("BOPADIGITAL — Full project plan creation")
    print("=" * 60)

    folder = api("post", f"/space/{SPACE_ID}/folder", {"name": "BOPADIGITAL"})
    if not folder:
        sys.exit(1)
    folder_id = folder["id"]
    print(f"Folder: {folder_id}")

    sprint_lists = {}
    for name, dates in SPRINTS.items():
        lst = api("post", f"/folder/{folder_id}/list", {"name": name})
        if lst:
            sprint_lists[name] = lst["id"]
            print(f"  {name}: {lst['id']}")
        time.sleep(0.3)

    total = 0
    failed = 0

    for sprint_name, tasks_list in PLAN.items():
        list_id = sprint_lists.get(sprint_name)
        if not list_id:
            continue
        dates = SPRINTS[sprint_name]
        print(f"\n--- {sprint_name} ---")

        for t in tasks_list:
            parent = task(
                list_id, t["name"], t["desc"], t["assignees"],
                t["prio"], t["status"], (dates["start"], dates["end"])
            )
            if parent:
                total += 1
                print(f"  + {t['name']} ({t['status']})")
                for sub_name, sub_assignees, sub_status in t.get("subtasks", []):
                    s = task(
                        list_id, sub_name, "", sub_assignees,
                        None, sub_status, (dates["start"], dates["end"]),
                        parent=parent["id"]
                    )
                    if s:
                        total += 1
                    else:
                        failed += 1
                    time.sleep(0.15)
            else:
                failed += 1
            time.sleep(0.25)

    print(f"\n{'=' * 60}")
    print(f"DONE. Created: {total} | Failed: {failed}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
