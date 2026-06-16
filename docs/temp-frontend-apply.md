# Postulacion a vacante — Guia para frontend
# Generado el 15 de junio de 2026 
# Puede ser descartado cuando se implemente el frontend, pero sirve como referencia de como consumir el endpoint de postulacion a vacante.

## Endpoint

```
POST /api/employability/apply
```

**Publico** — no requiere token JNI.
**Rate limit:** 20 requests por 15 minutos por IP.

## Content-Type

`multipart/form-data` (se envia PDF + campos de texto).

## Campos del formulario

| Campo | Tipo | Obligatorio | Descripcion |
|-------|------|-------------|-------------|
| `file` | archivo PDF | si | Curriculum vitae en PDF. Max 20 MB. |
| `vacancyId` | string (UUID) | si | ID de la vacante a la que se postula. |
| `coverLetter` | string | no | Carta de presentacion. |
| `candidate` | string (JSON) | si | Datos del candidato **serializados como JSON string** (ver abajo). |

### Estructura del campo `candidate`

Debe ser un JSON string valido con esta forma:

```json
{
  "nationalId": "1234567890",
  "firstName": "Juan",
  "lastName": "Perez",
  "email": "juan@example.com",
  "phone": "+56912345678",
  "address": "Av. Siempre Viva 123, Santiago"
}
```

| Propiedad | Tipo | Obligatorio | Max |
|-----------|------|-------------|-----|
| `nationalId` | string | si | 20 |
| `firstName` | string | si | 100 |
| `lastName` | string | si | 100 |
| `email` | string (email) | si | 150 |
| `phone` | string | no | 20 |
| `address` | string | no | - |

## Como construir el FormData en el frontend

### JavaScript / TypeScript

```typescript
const formData = new FormData();

// 1. Archivo PDF
formData.append('file', pdfFile); // File object del input

// 2. ID de la vacante
formData.append('vacancyId', vacancyId);

// 3. Carta de presentacion (opcional)
formData.append('coverLetter', coverLetter);

// 4. Datos del candidato como JSON string
formData.append('candidate', JSON.stringify({
  nationalId: formDataValues.nationalId,
  firstName: formDataValues.firstName,
  lastName: formDataValues.lastName,
  email: formDataValues.email,
  phone: formDataValues.phone,
  address: formDataValues.address,
}));

// Enviar
const response = await fetch('/api/employability/apply', {
  method: 'POST',
  body: formData,
  // NO setear Content-Type — el browser lo pone solo con boundary
});
```

### Angular con HttpClient

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('vacancyId', vacancyId);
formData.append('candidate', JSON.stringify(candidateData));

this.http.post('/api/employability/apply', formData).subscribe({
  next: (res) => console.log('Postulacion exitosa', res),
  error: (err) => console.error('Error', err),
});
```

### React

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const formData = new FormData();
  formData.append('file', fileRef.current?.files?.[0]!);
  formData.append('vacancyId', vacancyId);
  formData.append('candidate', JSON.stringify({
    nationalId, firstName, lastName, email, phone, address,
  }));

  const res = await axios.post('/api/employability/apply', formData);
  // axios auto-detects multipart/form-data
};
```

## Respuesta exitosa (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "uuid-de-la-aplicacion",
    "state": "PENDING",
    "appliedAt": "2026-06-15T12:00:00.000Z",
    "candidate": {
      "id": "uuid-del-candidato",
      "firstName": "Juan",
      "lastName": "Perez",
      "email": "juan@example.com"
    },
    "vacancy": {
      "id": "uuid-de-la-vacante",
      "title": "Desarrollador Full Stack"
    }
  }
}
```

## Errores posibles

| Status | Codigo | Causa |
|--------|--------|-------|
| 400 | `BAD_REQUEST` | No se envio el PDF, o el JSON de `candidate` es invalido |
| 400 | `VALIDATION_ERROR` | Campos faltantes o con formato incorrecto (Zod validation) |
| 404 | `NOT_FOUND` | La vacante no existe, no esta publicada, o esta cerrada |
| 409 | `CONFLICT` | (No aplica en apply directo, pero el servicio lo maneja) |
| 413 | `MULTER_ERROR` | Archivo muy grande (>20 MB) |
| 415 | `MULTER_ERROR` | Archivo no es PDF |
| 429 | `RATE_LIMITED` | Demasiadas postulaciones desde esta IP |

Formato de error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "candidate.email", "message": "Invalid email" }
    ]
  }
}
```

## Flujo recomendado para el frontend

```
1. USUARIO ve lista de vacantes publicas
   GET /api/employability/vacancies/published?page=1&limit=20

2. USAURIO hace clic en "Postular" en una vacante
   → Mostrar formulario con:
     - Datos personales (nombre, email, RUN, telefono, direccion)
     - Carta de presentacion (opcional)
     - Input file para subir PDF

3. Enviar POST /api/employability/apply con FormData

4. Mostrar confirmacion con datos de la postulacion
```

## Consideraciones UX

- **Validar PDF en cliente**: solo archivos `.pdf`, max 20 MB.
- **Deshabilitar boton de envio** mientras se procesa la solicitud.
- **Manejar error 429**: mostrar mensaje "Has realizado demasiadas postulaciones. Intenta de nuevo en 15 minutos."
- **Manejar error 404**: la vacante pudo cerrarse entre que se listo y se postulo. Redirigir a la lista.
- **Types**: Los tipos `ApplyJobVacancyRequest` y `ApplyJobVacancyRequestSchema` estan en `@bopacorp/shared/employability`.
