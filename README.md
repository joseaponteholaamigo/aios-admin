# aios-admin

El panel de superadministración de ENSŌ: la herramienta interna con la que el equipo ensō da de alta y opera a sus clientes, hace el onboarding (entrevistas, documentos, skills) y, más adelante, mira los tableros del negocio.

Reemplaza al panel `/administrador` de beenso. Corre en AWS (cuenta `enso`, us-east-2) y le pide los datos de clientes a la API de admin de `aios-backend` (`/v1/admin/*`). Nunca toca las tablas del backend directamente.

## Stack

- React Router 8 en modo framework, con servidor propio, sobre Node 24 y TypeScript estricto.
- AWS: Lambda Web Function (o Lambda clásica con Web Adapter) detrás de CloudFront, DynamoDB y S3. La infraestructura está en CDK, en `infra/`.
- Login con el pool de Cognito del equipo, con MFA. Ese pool vive en el stack de `aios-backend`.
- El código va en inglés; los textos de la pantalla y la documentación, en español.

## Estado

En especificación. La fase M1 (login con MFA y API de admin) está en `specs/2026-10-21-spec-m1-superadmin.md`.
