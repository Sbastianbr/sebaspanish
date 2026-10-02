# Fase 2B · Puerta de acceso passwordless

29 de septiembre de 2026. Solo Supabase Development `vvvugnkvtkcfuwxroies`.
No hay publicación web, integración de pagos ni interfaz completa de Mis clases.

## Estado inicial y elegibilidad

Fases 1/2A ya aplicadas. Se conservaron las cinco migraciones anteriores, incluidas
las manuales `202609290002_student_auth_foundation.sql` y
`202609290003_portal_access_eligibility.sql`.

Se encontró el perfil técnico `phase2b-no-purchase@example.com`, sin compras ni Auth.
Se comprobó 0 filas sin compra, 0 con pending y 1 tras activar técnicamente una
individual 1a1-1: 6500 grosze, una unidad y el mismo UUID con email normalizado.
Se eliminaron exclusivamente ese perfil y su compra/crédito/eventos técnicos.
Activación técnica NO significa cobro real.

La elegibilidad sigue siendo `EXISTS purchases.status = 'active'`: nunca depende
del saldo de créditos. No existen estados de reembolso futuros inventados.
Prueba gratuita, email inexistente, perfil sin compra y pending no habilitan acceso.
Créditos vencidos o agotados no quitan acceso a quien ya tuvo una compra activada.

## Arquitectura implementada

`POST /functions/v1/portal-access-request` → validar `{email}` → respuesta genérica
→ trabajo protegido con `EdgeRuntime.waitUntil` → límite SQL → eligibility gate
→ vinculación/reutilización Auth → envío passwordless al correo autorizado.

- JSON estricto de una propiedad; correo normalizado; máximo 254 caracteres.
- Reutiliza el lector JSON de reservas: límite real de 16384 bytes sobre el stream.
  Exportarlo fue el único cambio al helper anterior; comportamiento idéntico.
- No SDK ni dependencias nuevas. REST oficial de Supabase Auth y RPC existentes.
- Ningún dato del alumno ni identificador Auth llega en la respuesta pública.
- No consultas directas del navegador a tablas privadas.
- `service_role` solo existe en Edge; el callback contiene únicamente la clave pública anon.

### Primer acceso e identidades existentes

1. Consultar `portal_auth_link(student_id, null)` después de eligibility y allowlist.
2. Si ya hay identidad válida, reutilizarla, sin cambiar arbitrariamente el vínculo.
3. Si no existe, usar **Admin Invite (`POST /auth/v1/invite`)**: crea una identidad
   passwordless sin confirmar el email y envía el enlace de primer acceso.
4. Vincular el UUID retornado mediante la RPC. No mandar un segundo correo.
5. Ante respuesta de invitación perdida, buscar de nuevo la identidad mediante la
   misma RPC segura. No crear otra identidad ni repetir automáticamente el envío.
6. Para identidad ya existente pero sin confirmar, reenviar invitación; para una
   confirmada, `POST /auth/v1/otp` con **`create_user:false`** y clave pública.
7. Antes de reenviar se lee exclusivamente ese Auth UUID y se contrasta el email.

Se comprobó el código oficial de Supabase: `/admin/users` genera una contraseña
interna aunque se omita el campo; `/otp` deriva identidades sin confirmar al signup;
y confirmar una invitación también añade posteriormente una contraseña aleatoria
interna de Auth. La implementación usa `/invite` para el primer acceso con signup
cerrado, sin pedir ni enviar contraseñas ni marcar titularidad manualmente. El usuario
accede siempre por email. La identidad técnica del intento inicial fallido se retiró.
La migración 006 permite reutilizar una identidad ya comprobada/vinculada después
de esa confirmación, sin relajar la validación de cuentas desconocidas con contraseña.

Se guardó **Allow new users to sign up = OFF**, con autorización expresa del usuario,
y se verificó `disable_signup:true`. Confirm email continúa activado; anonymous sign-in
y manual linking continúan desactivados. La solicitud OTP de un desconocido con
`create_user:false` se rechaza y no crea una identidad. No se tocaron redirects.

### Vinculación y permisos

`portal_auth_link(uuid, uuid default null)`:

- SECURITY DEFINER, `search_path=''`, EXECUTE solo service_role.
- Bloquea la fila del alumno y vuelve a exigir compra active.
- Contrasta email normalizado; rechaza identidad ausente, eliminada, bloqueada,
  anónima o ambigua. En la PRIMERA asociación rechaza cuentas con contraseña;
  el hash interno posterior de una invitación ya vinculada no bloquea sus reintentos.
  Identidades antiguas dudosas requieren revisión.
- No sobrescribe un vínculo existente; idempotente si recibe el mismo UUID.
- Conserva el índice UNIQUE parcial de Auth y FK `ON DELETE SET NULL` existentes.
- Borrar Auth no elimina alumno, compras, créditos, reservas ni historial.
- La vinculación preparada todavía NO demuestra control del correo.

`portal_current_access()` es la única RPC nueva ejecutable por authenticated.
Devuelve solo un booleano para comprobar el callback, nunca datos de alumno.
Exige JWT validado por Supabase, `auth.uid()`, email confirmado/coincidente, identidad
no bloqueada/eliminada/anónima y compra active. No acepta email ni student_id del cliente.
No es una API de historial/créditos ni concede acceso directo a tablas.

## Migraciones incrementales

- `202609290004_portal_access.sql`: tabla privada `portal_request_limits` con PK
  y constraints, RLS sin políticas públicas, RPC `portal_request_claim`,
  `portal_auth_link` y `portal_current_access` y permisos mínimos.
- `202609290005_teacher_credit_return_30d.sql`: sustituye únicamente la definición
  actual de `credit_resolve_booking` para la excepción de vigencia aprobada.
  No cambia ninguna migración ya aplicada.
- `202609290006_portal_confirmed_identity.sql`: corrección incremental de reutilización
  tras confirmar una invitación real; conserva el rechazo de contraseñas en primera asociación.

Profesor cancela: si la unidad sigue vigente conserva exactamente su expiración;
si venció mientras estaba asignada, vuelve disponible hasta 30 días calendario desde
la cancelación, calculados en Europe/Warsaw. No recibe seis meses nuevos. El evento
registra expiración previa/nueva y si hubo prórroga. Reintentar devuelve el mismo
recibo sin volver a prolongarla. Las otras reglas de resolución no cambian.

`requires_expiry_review` se conserva por compatibilidad histórica; no se crea deuda
nueva de revisión en este caso. Se verificó que Development no tenía unidades
antiguas pendientes de revisión. No se reescriben eventos históricos.

## CORS, respuesta pública y abuso

Solo `http://127.0.0.1:4181`, obtenido al restringir `BOOKING_ALLOWED_ORIGINS` al origen
local autorizado. Nunca `*`; no se abren producción ni GitHub Pages. CORS no autentica
bots ni sustituye controles de dominio. POST/OPTIONS; otros métodos 405; origen 403;
JSON/correo inválido 400, formato 415 y exceso de bytes 413.

Para correos bien formados: siempre **200 `{"ok":true}`**, incluidos inexistentes,
inelegibles, limitados, errores de infraestructura o de envío. `Cache-Control:no-store`.
El trabajo asíncrono evita que la latencia de Auth/SMTP revele elegibilidad. No ofrece
una promesa de entrega del correo. Solo se registra el código constante
`PORTAL_ACCESS_FAILED`, sin email, UUID, motivo SQL, token o enlace.

Límites compartidos en PostgreSQL, antes de consultar elegibilidad:

- una solicitud admitida por correo cada 60 segundos;
- máximo tres por correo y hora;
- máximo 30 globales por hora;
- advisory lock transaccional impide que llamadas concurrentes salten el cupo;
- claves HMAC-SHA256 del email con secreto exclusivo de servidor, no emails crudos;
- contadores viejos se depuran en la siguiente solicitud pasadas 24 horas.

El registro `global` y hashes son estado operativo antiabuso, no compras/perfiles.
No se borran para saltar el límite durante pruebas. Rotar el secreto reinicia en la
práctica los límites por email; reservar esa operación para gestión controlada.

También siguen aplicándose las restricciones del proveedor Auth. El SMTP integrado
no es SMTP de producción: destinatarios autorizados y cupos pequeños. Las invitaciones
usan contexto administrativo; por eso los límites propios son esenciales, no se supone
que tengan idénticos límites a OTP público. Development restringe además cualquier
creación/envío a una lista explícita de correos autorizados; lista vacía deshabilita envío.

Riesgos pendientes: ataques pueden agotar el cupo global o el cupo de un correo;
CORS no impide peticiones directas. La respuesta neutral no elimina todos los canales
laterales del proveedor Auth. `waitUntil` no es una cola durable. Antes de producción:
SMTP, CAPTCHA/controles de abuso, métricas sin datos personales y política de reintentos.
No se ha añadido una infraestructura ficticia para ocultar esas limitaciones.

## Configuración Development

Variables nuevas de Edge:

- `PORTAL_RATE_LIMIT_SECRET`: secreto aleatorio HMAC de al menos 32 caracteres.
- `PORTAL_ACCESS_ALLOWED_EMAILS`: lista explícita de destinatarios autorizados para pruebas.
- `PORTAL_AUTH_REDIRECT_URL`: exactamente
  `http://127.0.0.1:4181/sebaspanishv2/auth-callback.html`.

Reutiliza SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY y
BOOKING_ALLOWED_ORIGINS. No se modifican las variables de las reservas.
Configurar con archivo temporal privado, nunca valores secretos en commits o logs.

Site URL conserva `http://127.0.0.1:4181/sebaspanishv2/`; allowlist de Auth conserva
`http://127.0.0.1:4181/sebaspanishv2/**`. El callback es local y no se publica.

## Callback técnico mínimo

`auth-callback.html` / `auth-callback.js`: noindex, no-referrer, CSP restringida y estilos
existentes. Retira inmediatamente los tokens del fragmento de URL, verifica el JWT
contra `/auth/v1/user` y consulta el booleano `portal_current_access()`.
No muestra datos privados ni guarda access/refresh tokens en localStorage/sessionStorage.
No renueva sesiones ni implementa Mis clases. Recargar después de limpiar la URL
requiere un nuevo enlace; es una prueba técnica deliberadamente no persistente.
El enlace debe abrirse en el mismo Mac que sirve el callback local.

## Pruebas y evidencia

```sh
node --test reservas-data.test.mjs i18n.test.mjs booking-api.test.mjs \
  supabase/tests/portal-access.test.mjs supabase/tests/auth-callback.test.mjs
supabase db query --linked --file supabase/tests/portal.sql --output json
supabase db query --linked --file supabase/tests/credits.sql --output json
CREDIT_TEST_ALLOW_DEVELOPMENT=yes CREDIT_TEST_PROJECT_REF=vvvugnkvtkcfuwxroies \
  node --test supabase/tests/credits-concurrency.test.mjs
```

Las pruebas SQL usan transacción completa con ROLLBACK, no correos. La prueba de
límites usa contadores temporales dentro de esa transacción; no resetea cupos vivos.
No ejecutar esos archivos en producción. La suite concurrente usa sus UUID propios
y elimina sus fixtures en finally. No modifica alumnos anteriores.

Resultados:

- 54/54 pruebas Node: 29 anteriores + 20 puerta de acceso + 5 callback.
- El test legado `tests/concurrency.test.mjs` quedó omitido: exige un PostgreSQL
  local desechable (`BOOKING_TEST_DATABASE_URL`) que no está configurado. No se
  cambió su restricción ni se instaló software. No se presenta como una prueba
  ejecutada; es distinto de la concurrencia 2A real en Development descrita abajo.
- 101 assertions de créditos y 70 de portal en PostgreSQL WASM desechable; además
  assertions de booking.sql. Motor temporal ya disponible; ninguna dependencia instalada.
- Suites SQL de créditos y portal también ejecutadas en PostgreSQL Development con rollback.
- Concurrencia real de Fase 2A: 3 escenarios / 4 resultados Node aprobados,
  con limpieza final: una activación, una unidad para dos reservas concurrentes, retry.
- HTTP desplegado: email inexistente/elegible dan idéntico 200/body/CORS;
  origen no autorizado 403; propiedades adicionales 400; RPC privados rechazados con anon;
  OTP de desconocido rechazado con signup cerrado, sin generar cuenta.
- Prueba real de primer email: invitación enviada al único destinatario que el usuario
  autorizó; confirmó «Acceso verificado correctamente». La base confirmó email verificado.
  Dos reintentos concurrentes reutilizaron correctamente la misma identidad confirmada.
- No se mandaron emails a direcciones arbitrarias. Los intentos iniciales fallidos no se
  contaron como envíos. La rama OTP posterior para usuarios confirmados se comprobó
  con mocks del contrato REST; no se mandó un segundo correo para evitar saltarse
  los límites de esta sesión de pruebas.
- Callback sin enlace/token comprobado en navegador: rechazo genérico. Sus pruebas
  cubren token falso/expirado, identidad sin compra y error de red; no persisten tokens.
- SHA-256 confirma home, reservas, CSS, traducciones, configuración y cinco migraciones
  previas intactos; helper de reservas cambia solo la exportación de readJSON.
- Hash remoto de los dos RPC de reservas y de student_upsert, credit_allocate y
  student_credit_balances sin cambios. La única regla 2A alterada es la excepción aprobada.
- Consulta real de disponibilidad: prueba y planes 1/4/8, todos 200/source=live.

Limpieza final completada y verificada por UUID exacto: cero registros técnicos
restantes de perfiles, compras, créditos/eventos y cuentas Auth creados en la tarea.
Se borró Auth primero y se comprobó que el alumno, la compra y el crédito permanecían;
después se retiraron explícitamente esos datos técnicos en el orden de sus FK.
Los logs de seguridad del proveedor y contadores HMAC con caducidad se conservan.
El enlace de prueba deja de valer al eliminar la identidad; no representa una cuenta real.
No se repitió una auditoría responsive general, puesto que ese frontend no cambió.

## Archivos

Nuevos: las tres migraciones, `_shared/portal.mjs`,
`functions/portal-access-request/index.ts`, `tests/portal.sql`,
`tests/portal-access.test.mjs`, `tests/auth-callback.test.mjs`, este documento y
`auth-callback.html` / `auth-callback.js` en la raíz de V2.

Modificados: `functions/_shared/booking.mjs` (solo export readJSON), `config.toml`
(registro de la nueva función), `tests/credits.sql` (regla de 30 días),
`BUSINESS_RULES.md`, `README.md` y `PHASE2A.md` (estado y regla aprobada).

## Pendientes reales

Mis clases visual y navegación de acceso; persistencia/renovación/logout de sesión;
endpoints/RLS de lectura de los datos propios; pruebas entre alumnos; autorización
por actor; wrapper transaccional reserva+crédito y reprogramación atómica; materiales;
pagos y verificación de webhooks/importes; emails operativos/localizados; SMTP de
producción y antiabuso; Calendar; DELE. Ninguno se activa con esta fase.

Siguiente paso: revisar esta puerta de identidad y definir el contrato de lectura
privada de Mis clases, antes de abrir datos de compras, créditos o reservas.

## Referencias oficiales consultadas

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/rate-limits
- https://github.com/supabase/auth/blob/master/internal/api/invite.go
- https://github.com/supabase/auth/blob/master/internal/api/magic_link.go
- https://github.com/supabase/auth/blob/master/internal/api/admin.go
- https://github.com/supabase/auth/blob/master/internal/api/verify.go
- https://github.com/supabase/auth-js/blob/master/src/GoTrueAdminApi.ts
