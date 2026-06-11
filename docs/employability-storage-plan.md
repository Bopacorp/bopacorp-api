# Employability Storage Integration Plan

Plan de implementación para integrar Supabase Storage (API S3-compatible) con el módulo de empleabilidad. Incluye flujo público de postulación con subida de PDF, descarga proxy stream, y gestión de resumes para administradores.

---

## 1. Objetivo

Implementar un flujo completo para que un candidato pueda:

1. Ingresar sus datos personales.
2. Subir su CV en formato PDF.
3. Seleccionar una vacante y aplicar.

Todo en un **único endpoint público** (`POST /api/v1/employability/apply`), sin necesidad de autenticación previa. Además, los administradores podrán gestionar y descargar resumes desde el backend con autenticación RBAC.

---

## 2. Arquitectura de decisiones

| Decisión | Opción elegida | Justificación |
|----------|---------------|---------------|
| Upload de archivos | **Backend upload** (multipart/form-data) | Control total de validación, no se exponen credenciales, flujo unificado para candidatos |
| Acceso a archivos | **Proxy stream** (backend descarga de S3 y reenvía al cliente) | URLs de Supabase nunca se filtran, acceso controlado por RBAC, bucket puede ser privado |
| API S3 | **AWS SDK v3 con `@aws-sdk/client-s3`** | Interoperable, si se migra a S3/DigitalOcean Spaces no cambia el código |
| Autenticación del endpoint apply | **Público** (sin auth) | Cualquier candidato puede postular, sin cuenta previa |
| Rate limiting en apply | **Sí, agresivo** | Evita spam y abuso del endpoint público |
| Candidato duplicado | **Reusar y actualizar** (excepto cédula) | Si el email o cédula ya existe, se actualizan los datos y se crea nueva postulación |
| Estado inicial de postulación | **PENDING** | El formulario de aplicación es un único paso, no hay concepto de draft |
| Nombre de archivo en S3 | **Anonimizado** (`candidates/{candidateId}/{uuid}.pdf`) | Evita caracteres especiales, no expone datos personales en la ruta |
| Upload S3 | **`@aws-sdk/lib-storage`** (multipart) | Soporte para archivos grandes, más robusto |

---

## 3. Timeline

| Fecha | Fase | Descripción | Estado |
|-------|------|-------------|--------|
| **Día 1** | Fase 1 | Setup en Supabase Dashboard (bucket, policies, S3 keys) | Pendiente |
| **Día 1** | Fase 2 | Instalar dependencias (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `multer`) | Pendiente |
| **Día 1** | Fase 3 | Configurar variables de entorno (`env.ts`, `.env.example`) | Pendiente |
| **Día 2** | Fase 4 | Crear servicio de S3 (`src/lib/storage.ts`) | Pendiente |
| **Día 2** | Fase 5 | Crear middleware de upload (`src/shared/middleware/upload.ts`) | Pendiente |
| **Día 2** | Fase 6 | Actualizar `@bopacorp/shared` (schemas apply + upload) | Pendiente |
| **Día 3** | Fase 7 | Implementar endpoint `POST /api/v1/employability/apply` | Pendiente |
| **Día 3** | Fase 8 | Refactorizar `POST /candidate-resumes` para usar S3 | Pendiente |
| **Día 4** | Fase 9 | Implementar `GET /candidate-resumes/:id/download` (proxy stream) | Pendiente |
| **Día 4** | Fase 10 | Actualizar `DELETE /candidate-resumes` para borrar de S3 | Pendiente |
| **Día 5** | Fase 11 | Tests de integración (Vitest + Supertest) | Pendiente |
| **Día 5** | Fase 12 | Verificación final (`npm run check`, `npm test`, manual) | Pendiente |
| **Día 5** | Fase 13 | Deploy y configuración en producción | Pendiente |

---

## 4. Fase 1: Setup en Supabase Dashboard

### 4.1 Crear bucket

1. Ir a **Supabase Dashboard** → **Storage** → **New bucket**.
2. Nombre: `resumes`.
3. **Desmarcar "Public bucket"** — debe ser privado.
4. Guardar.

### 4.2 Configurar Row Level Security (RLS)

**Bucket-level policies:**

| Policy | Operation | Target roles | Definition |
|--------|-----------|-------------|------------|
| `Allow service_role full access` | All | `service_role` | `true` |

**Object-level policies:**

| Policy | Operation | Target roles | Definition |
|--------|-----------|-------------|------------|
| `Allow service_role full access to objects` | All | `service_role` | `true` |

### 4.3 Obtener credenciales S3

1. Ir a **Storage** → **S3 Access Keys**.
2. Generar nuevo par de credenciales.
3. Guardar `Access Key ID` y `Secret Access Key`.
4. Notar el endpoint S3: `https://<project>.supabase.co/storage/v1/s3`

### 4.4 Configurar CORS

Si el backend accede desde dominio específico:

1. Ir a **Storage** → **Policies** → **CORS**.
2. Agregar origen del backend o `*` en desarrollo.

---

## 5. Fase 2: Dependencias

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage multer
npm install -D @types/multer
```

Paquetes:

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `@aws-sdk/client-s3` | latest | Cliente S3 para Supabase Storage |
| `@aws-sdk/lib-storage` | latest | Upload multipart (archivos grandes) |
| `multer` | latest | Middleware multipart/form-data |
| `@types/multer` | latest | Tipos de multer |

---

## 6. Fase 3: Variables de entorno

### 6.1 `src/config/env.ts`

Agregar al schema de Zod:

```typescript
SUPABASE_URL: z.string().url(),
SUPABASE_S3_ENDPOINT: z.string().url(),
SUPABASE_S3_ACCESS_KEY_ID: z.string().min(1),
SUPABASE_S3_SECRET_ACCESS_KEY: z.string().min(1),
SUPABASE_STORAGE_BUCKET: z.string().default('resumes'),
```

### 6.2 `.env` y `.env.example`

```bash
# Supabase Storage (S3-compatible)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_S3_ENDPOINT=https://<project>.supabase.co/storage/v1/s3
SUPABASE_S3_ACCESS_KEY_ID=<access-key-id>
SUPABASE_S3_SECRET_ACCESS_KEY=<secret-access-key>
SUPABASE_STORAGE_BUCKET=resumes
```

---

## 7. Fase 4: Servicio de S3

**Nuevo archivo:** `src/lib/storage.ts`

```typescript
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '@config/env.js';

const s3Client = new S3Client({
  region: 'eu-west-1',
  endpoint: env.SUPABASE_S3_ENDPOINT,
  credentials: {
    accessKeyId: env.SUPABASE_S3_ACCESS_KEY_ID,
    secretAccessKey: env.SUPABASE_S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

export const storageBucket = env.SUPABASE_STORAGE_BUCKET;

export async function uploadFile(path: string, buffer: Buffer, contentType: string) {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: storageBucket,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    },
  });
  return upload.done();
}

export async function downloadFile(path: string) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: storageBucket,
      Key: path,
    })
  );
  return response.Body;
}

export async function deleteFile(path: string) {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: storageBucket,
      Key: path,
    })
  );
}
```

---

## 8. Fase 5: Middleware de Upload

**Nuevo archivo:** `src/shared/middleware/upload.ts`

```typescript
import multer from 'multer';
import { BadRequestError } from '@shared/errors/http-error.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new BadRequestError('Only PDF files are allowed'));
    }
    cb(null, true);
  },
});

export const uploadSinglePdf = upload.single('file');
```

---

## 9. Fase 6: Actualizar `@bopacorp/shared`

### 9.1 Nuevos schemas en `request.ts`

```typescript
// Flujo público de aplicación
export const ApplyJobVacancyRequestSchema = z.object({
  candidate: z.object({
    nationalId: z.string().min(1).max(20),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email(),
    phone: z.string().max(20).optional(),
    address: z.string().optional(),
  }),
  vacancyId: UuidSchema,
  coverLetter: z.string().optional(),
});
export type ApplyJobVacancyRequest = z.infer<typeof ApplyJobVacancyRequestSchema>;

// Schema para upload de resume (multipart, body JSON)
export const UploadCandidateResumeRequestSchema = z.object({
  candidateId: UuidSchema,
  applicationId: UuidSchema.optional(),
});
export type UploadCandidateResumeRequest = z.infer<typeof UploadCandidateResumeRequestSchema>;
```

### 9.2 Nuevos schemas en `response.ts`

```typescript
export const JobApplicationPublicResponseSchema = z.object({
  id: UuidSchema,
  state: ApplicationStateSchema,
  appliedAt: z.string().datetime(),
  candidate: z.object({
    id: UuidSchema,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
  }),
  vacancy: z.object({
    id: UuidSchema,
    title: z.string(),
  }),
});
export type JobApplicationPublicResponse = z.infer<typeof JobApplicationPublicResponseSchema>;
```

### 9.3 Actualizar `index.ts`

Exportar `ApplyJobVacancyRequestSchema`, `UploadCandidateResumeRequestSchema`, y sus tipos.

---

## 10. Fase 7: Endpoint `POST /api/v1/employability/apply`

### 10.1 Ruta

```typescript
employabilityRoutes.post(
  '/apply',
  uploadSinglePdf, // Multer primero
  validate({ body: ApplyJobVacancyRequestSchema }),
  controller.applyJobVacancy
);
```

> **Nota:** No lleva `authenticate` ni `authorize`. Es público.

### 10.2 Rate limiting

Agregar rate limit específico para este endpoint en `server.ts` o en el router:

```typescript
import rateLimit from 'express-rate-limit';

const applyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 aplicaciones por IP
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many applications from this IP' } },
});

employabilityRoutes.post('/apply', applyRateLimit, uploadSinglePdf, validate({ body: ApplyJobVacancyRequestSchema }), controller.applyJobVacancy);
```

### 10.3 Controller

```typescript
export async function applyJobVacancy(req: Request, res: Response) {
  if (!req.file) {
    throw new BadRequestError('No PDF file provided');
  }

  const data = await service.applyJobVacancy(
    req.body as ApplyJobVacancyRequest,
    req.file.buffer,
    req.file.originalname,
    req.file.size,
    req.file.mimetype
  );

  res.status(201).json({ success: true, data });
}
```

### 10.4 Service

```typescript
export async function applyJobVacancy(
  data: ApplyJobVacancyRequest,
  fileBuffer: Buffer,
  originalName: string,
  fileSizeBytes: number,
  mimeType: string
) {
  // 1. Validar que la vacante exista, esté publicada y activa
  const vacancy = await db.query.jobVacancies.findFirst({
    where: and(
      eq(jobVacancies.id, data.vacancyId),
      eq(jobVacancies.isPublished, true),
      eq(jobVacancies.isActive, true),
      isNull(jobVacancies.deletedAt)
    ),
  });

  if (!vacancy) {
    throw new NotFoundError('Job vacancy', data.vacancyId);
  }

  // 2. Buscar candidato existente por email o cédula
  const existingCandidate = await db.query.candidates.findFirst({
    where: or(
      eq(candidates.email, data.candidate.email),
      eq(candidates.nationalId, data.candidate.nationalId)
    ),
  });

  let candidateId: string;

  if (existingCandidate) {
    // Actualizar datos que no sean la cédula
    candidateId = existingCandidate.id;
    await db.update(candidates)
      .set({
        firstName: data.candidate.firstName,
        lastName: data.candidate.lastName,
        email: data.candidate.email,
        phone: data.candidate.phone,
        address: data.candidate.address,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));
  } else {
    // Crear nuevo candidato
    const [newCandidate] = await db.insert(candidates)
      .values({
        nationalId: data.candidate.nationalId,
        firstName: data.candidate.firstName,
        lastName: data.candidate.lastName,
        email: data.candidate.email,
        phone: data.candidate.phone,
        address: data.candidate.address,
      })
      .returning();

    if (!newCandidate) {
      throw new InternalServerError('Failed to create candidate');
    }
    candidateId = newCandidate.id;
  }

  // 3. Subir CV a S3
  const fileExtension = originalName.split('.').pop() || 'pdf';
  const filename = `${crypto.randomUUID()}.${fileExtension}`;
  const storagePath = `candidates/${candidateId}/${filename}`;

  await uploadFile(storagePath, fileBuffer, mimeType);

  // 4. Guardar metadata del resume en DB
  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  const [resume] = await db.insert(candidateResumes)
    .values({
      candidateId,
      filename: originalName,
      fileExtension,
      fileSizeMb: fileSizeMb.toFixed(2),
      storagePath,
      mimeType,
    })
    .returning();

  if (!resume) {
    await deleteFile(storagePath); // Rollback S3
    throw new InternalServerError('Failed to save resume metadata');
  }

  // 5. Crear postulación (PENDING)
  const [application] = await db.insert(jobApplications)
    .values({
      vacancyId: data.vacancyId,
      candidateId,
      state: 'PENDING',
      coverLetter: data.coverLetter,
      appliedAt: new Date(),
    })
    .returning();

  if (!application) {
    throw new InternalServerError('Failed to create job application');
  }

  // 6. Asociar resume a la postulación (opcional)
  await db.update(candidateResumes)
    .set({ applicationId: application.id })
    .where(eq(candidateResumes.id, resume.id));

  return {
    id: application.id,
    state: application.state,
    appliedAt: application.appliedAt ? application.appliedAt.toISOString() : '',
    candidate: {
      id: candidateId,
      firstName: data.candidate.firstName,
      lastName: data.candidate.lastName,
      email: data.candidate.email,
    },
    vacancy: {
      id: vacancy.id,
      title: vacancy.title,
    },
  };
}
```

---

## 11. Fase 8: Refactorizar `POST /candidate-resumes` (admin)

El endpoint actual recibe metadata JSON. Se reemplaza para recibir multipart y subir a S3.

### 11.1 Ruta

```typescript
employabilityRoutes.post(
  '/candidate-resumes',
  authenticate,
  authorize('candidate_resumes.create'),
  uploadSinglePdf,
  validate({ body: UploadCandidateResumeRequestSchema }),
  controller.uploadCandidateResume
);
```

### 11.2 Service

```typescript
export async function uploadCandidateResume(
  data: UploadCandidateResumeRequest,
  fileBuffer: Buffer,
  originalName: string,
  fileSizeBytes: number,
  mimeType: string
) {
  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, data.candidateId),
  });

  if (!candidate) {
    throw new NotFoundError('Candidate', data.candidateId);
  }

  if (data.applicationId) {
    const application = await db.query.jobApplications.findFirst({
      where: and(eq(jobApplications.id, data.applicationId), isNull(jobApplications.deletedAt)),
    });
    if (!application) {
      throw new NotFoundError('Job application', data.applicationId);
    }
  }

  const fileExtension = originalName.split('.').pop() || 'pdf';
  const filename = `${crypto.randomUUID()}.${fileExtension}`;
  const storagePath = `candidates/${data.candidateId}/${filename}`;

  await uploadFile(storagePath, fileBuffer, mimeType);

  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  const [resume] = await db.insert(candidateResumes)
    .values({
      candidateId: data.candidateId,
      applicationId: data.applicationId,
      filename: originalName,
      fileExtension,
      fileSizeMb: fileSizeMb.toFixed(2),
      storagePath,
      mimeType,
    })
    .returning();

  if (!resume) {
    await deleteFile(storagePath);
    throw new InternalServerError('Failed to save resume metadata');
  }

  return getCandidateResumeById(resume.id);
}
```

---

## 12. Fase 9: Endpoint de descarga `GET /candidate-resumes/:id/download`

### 12.1 Ruta

```typescript
employabilityRoutes.get(
  '/candidate-resumes/:id/download',
  authenticate,
  authorize('candidate_resumes.read'),
  validate({ params: IdParamSchema }),
  controller.downloadCandidateResume
);
```

### 12.2 Controller

```typescript
export async function downloadCandidateResume(req: Request<{ id: string }>, res: Response) {
  const { stream, resume } = await service.downloadCandidateResume(req.params.id);

  res.setHeader('Content-Type', resume.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${resume.filename}"`);

  if (stream && typeof stream.pipe === 'function') {
    stream.pipe(res);
  } else {
    // Fallback para streams no-compatibles
    const chunks: Buffer[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    res.send(Buffer.concat(chunks));
  }
}
```

### 12.3 Service

```typescript
export async function downloadCandidateResume(id: string) {
  const resume = await getCandidateResumeById(id);
  const stream = await downloadFile(resume.storagePath);

  if (!stream) {
    throw new NotFoundError('Resume file', id);
  }

  return { stream, resume };
}
```

---

## 13. Fase 10: Actualizar `DELETE /candidate-resumes/:id`

```typescript
export async function removeCandidateResume(id: string) {
  const resume = await getCandidateResumeById(id);
  await deleteFile(resume.storagePath); // Borrar de S3
  await db.delete(candidateResumes).where(eq(candidateResumes.id, id));
}
```

---

## 14. Fase 11: Tests de integración

**Nuevo archivo:** `src/modules/employability/employability.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '@server';

describe('Employability - Apply', () => {
  it('should apply to a vacancy with PDF', async () => {
    const response = await request(app)
      .post('/api/v1/employability/apply')
      .field('candidate[nationalId]', '123456789')
      .field('candidate[firstName]', 'Juan')
      .field('candidate[lastName]', 'Perez')
      .field('candidate[email]', 'juan@test.com')
      .field('vacancyId', vacancyId)
      .attach('file', Buffer.from('test pdf content'), 'resume.pdf');

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.state).toBe('PENDING');
  });

  it('should reject non-PDF files', async () => {
    const response = await request(app)
      .post('/api/v1/employability/apply')
      .attach('file', Buffer.from('test'), 'image.jpg');

    expect(response.status).toBe(400);
  });

  it('should reject applications without file', async () => {
    const response = await request(app)
      .post('/api/v1/employability/apply')
      .field('candidate[nationalId]', '123456789')
      .field('candidate[firstName]', 'Juan')
      .field('candidate[lastName]', 'Perez')
      .field('candidate[email]', 'juan@test.com')
      .field('vacancyId', vacancyId);

    expect(response.status).toBe(400);
  });
});

describe('Employability - Resume Download', () => {
  it('should download a resume as PDF', async () => {
    const response = await request(app)
      .get(`/api/v1/employability/candidate-resumes/${resumeId}/download`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
  });
});
```

---

## 15. Fase 12: Verificación final

```bash
# Lint + format + typecheck
npm run check

# Tests
npm test

# Dev server
npm run dev
```

### Manual testing checklist

- [ ] `POST /api/v1/employability/apply` con PDF válido → 201 + application creada
- [ ] `POST /api/v1/employability/apply` sin PDF → 400
- [ ] `POST /api/v1/employability/apply` con JPG → 400
- [ ] `POST /api/v1/employability/apply` con vacante inexistente → 404
- [ ] `POST /api/v1/employability/apply` con candidato existente → reutiliza + actualiza
- [ ] `POST /api/v1/employability/candidate-resumes` (admin) con PDF → 201
- [ ] `GET /api/v1/employability/candidate-resumes/:id/download` (admin) → 200 + PDF stream
- [ ] `DELETE /api/v1/employability/candidate-resumes/:id` (admin) → borra de S3 y DB
- [ ] Rate limit en `/apply` → 429 después de 5 intentos

---

## 16. Fase 13: Deploy en producción

1. Configurar variables de entorno en servidor de producción:
   - `SUPABASE_URL`
   - `SUPABASE_S3_ENDPOINT`
   - `SUPABASE_S3_ACCESS_KEY_ID`
   - `SUPABASE_S3_SECRET_ACCESS_KEY`
   - `SUPABASE_STORAGE_BUCKET`

2. Verificar que el bucket `resumes` existe en producción.
3. Verificar que RLS policies están correctas en producción.
4. Deploy de `bopacorp-shared` (nuevo versionado).
5. Deploy de `bopacorp-api`.
6. Monitorizar logs de upload y errores de S3.

---

## 17. Manejo de errores y rollback

| Escenario | Acción del backend |
|-----------|-------------------|
| Upload a S3 falla | Lanzar error. No se guarda nada en DB. |
| DB insert de `candidates` falla | Lanzar error. No hay nada en S3 todavía. |
| DB insert de `candidateResumes` falla después de S3 upload | Borrar archivo de S3, luego lanzar error. |
| DB insert de `jobApplications` falla | El candidato y resume quedan guardados. El candidato puede aplicar de nuevo. |
| Archivo no existe en S3 al descargar | `NotFoundError` con mensaje claro. |
| Archivo excede 10MB | `BadRequestError` desde multer. |
| Tipo no es PDF | `BadRequestError` desde multer. |
| Vacante no existe o no está publicada | `NotFoundError` (404). |

---

## 18. Checklist de seguridad

- [ ] Bucket `resumes` es **privado** (no público).
- [ ] RLS policies solo permiten `service_role`.
- [ ] `SUPABASE_S3_SECRET_ACCESS_KEY` nunca se expone al frontend.
- [ ] Rate limiting agresivo en `/apply` (5 por IP cada 15 min).
- [ ] RBAC en endpoints de admin: `candidate_resumes.read`, `candidate_resumes.create`, `candidate_resumes.delete`.
- [ ] Proxy stream en descarga — URLs de Supabase nunca llegan al cliente.
- [ ] No se expone `storagePath` directamente en responses públicos.
- [ ] Validación de mimetype en multer + validación de extensión.
- [ ] Archivos anonimizados en S3 (`{uuid}.pdf` en lugar de nombre original).

---

## 19. Archivos a modificar/crear

### Nuevos archivos

| Archivo | Descripción |
|---------|-------------|
| `src/lib/storage.ts` | Servicio S3 para Supabase Storage |
| `src/shared/middleware/upload.ts` | Middleware multer para PDF |

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `src/config/env.ts` | Nuevas variables de entorno Supabase |
| `.env.example` | Nuevas variables de entorno |
| `package.json` | Dependencias `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `multer` |
| `src/modules/employability/employability.routes.ts` | Nuevas rutas: `/apply`, `/candidate-resumes/:id/download`, refactor upload |
| `src/modules/employability/employability.controller.ts` | Nuevos controllers: `applyJobVacancy`, `uploadCandidateResume`, `downloadCandidateResume` |
| `src/modules/employability/employability.service.ts` | Nuevos services: `applyJobVacancy`, `uploadCandidateResume`, `downloadCandidateResume`, `removeCandidateResume` |
| `src/server.ts` | Rate limit en `/apply` (opcional) |
| `@bopacorp/shared` | Nuevos schemas: `ApplyJobVacancyRequestSchema`, `UploadCandidateResumeRequestSchema`, `JobApplicationPublicResponseSchema` |

---

*Plan creado: 2026-06-08*
*Estado: Pendiente de ejecución*
