# Fase 2E — cancelación y reprogramación autenticadas

Estado al 4 de octubre de 2026: **implementada, aplicada y verificada en Supabase
Development (`vvvugnkvtkcfuwxroies`)**. Frontend local integrado en Mis clases.
No se publicó la web, no se hizo git push y no se tocó producción.

## Arquitectura y migración

Cliente oficial existente → PostgREST con JWT → RPC autenticada → una transacción
PostgreSQL. Identidad: `auth.uid() → students.auth_user_id → student_id`.

Migración nueva, creada con CLI y aplicada tras dry-run:
`20261003215829_portal_lesson_management.sql`.

- `portal_cancel_class(p_booking_id uuid, p_request_id uuid,
  p_accept_credit_loss boolean default false)`.
- `portal_reschedule_class(p_booking_id uuid, p_slot_id uuid, p_request_id uuid,
  p_timezone text, p_accept_credit_loss boolean default false)`.
- Helper privado `booking_private.manage_lesson(...)`, compartido por ambas.
- Ampliación mínima de `portal_my_data()`: ID de la reserva propia, elegibilidad
  `manageable` calculada en servidor y estado `rescheduled` en el historial.
  No expone crédito, compra ni ID del alumno para ejecutar acciones.

Tabla nueva privada `booking_private.portal_lesson_requests`:
UUID de intento (PK), alumno/booking (FK), acción con CHECK cancel/reschedule,
fingerprint JSONB, resultado JSONB y fecha. Índices por alumno y booking.
Es auditoría de operaciones exitosas e idempotencia persistente, no un contador
mutable de créditos. Tiene RLS sin políticas públicas y todos los permisos de
acceso directo revocados, incluido service_role.

Las dos RPC son SECURITY DEFINER con `search_path = ''`; EXECUTE exclusivamente
para authenticated. El helper es invoker, privado y sin grants públicos. No nuevas
Edge Functions, dependencias, políticas abiertas ni cambios en Auth.

Se reutilizan sin modificar `portal_current_access()`, `credit_resolve_booking()`,
`portal_book_class()` y `portal_booking_slots()`. No se editó ninguna migración
histórica. Los hashes remotos de disponibilidad, booking_create, asignación,
resolución de crédito, puerta de acceso y las dos RPC de 2D permanecen iguales.
Solo `portal_my_data()` cambió de las funciones anteriores, por la extensión descrita.
Las Edge siguen en booking-availability v4, booking-create v3 y portal-access-request v3.

## Cancelación y reglas de crédito

1. Autenticar, validar UUID/argumentos, bloquear intento y alumno resuelto en servidor.
2. Verificar elegibilidad del portal, propiedad de booking y estado futuro confirmado
   con asignación reservada. Un ID ajeno o inexistente devuelve BOOKING_NOT_FOUND.
3. Calcular antelación con el reloj de PostgreSQL y llamar a la resolución existente.
4. Guardar auditoría/recibo junto con booking, allocation y credit_event, atómicamente.

- **≥12 horas:** devolución según las reglas existentes y expiración efectiva del crédito.
- **<12 horas:** consumo del crédito original.
- No-show, cancelación del profesor y extensión de 30 días del crédito expirado por
  cancelación del profesor no se modificaron; sus pruebas anteriores pasaron.
- No se autoriza cancelar clases ya iniciadas, canceladas, no confirmadas o sin
  asignación reservada a través de esta nueva operación del alumno.

El navegador muestra una estimación de la consecuencia. El servidor siempre decide.
`p_accept_credit_loss` expresa confirmación informada, NO modifica la regla: si se
cruzaron las 12 horas mientras el alumno tenía abierto el formulario, la primera
petición no cambia nada y exige confirmar otra vez la pérdida de crédito.

## Reprogramación atómica

BUSINESS_RULES.md sí define el caso <12 h: el crédito original se consume y el nuevo
horario requiere otro crédito elegible. No se inventó una regla comercial nueva.

En la misma transacción SQL se resuelve el booking anterior con
`student_reschedule` y se llama a `portal_book_class()` para el nuevo slot. No hay
cancelación y reserva en dos solicitudes del navegador. Si falla disponibilidad,
crédito, vencimiento o cualquier otra validación, se propaga la excepción y se
revierte TODO: reserva original, allocation y eventos quedan intactos.

- Con ≥12 h se devuelve el crédito original conservando sus reglas de vencimiento.
- Con <12 h se consume el original y se reserva otra unidad. Sin otra unidad válida,
  el cambio falla sin consumir el original ni cancelar la clase.
- La selección sigue earliest-expiry-first de 2D; no se fuerza un credit_id desde UI.
- La clase nueva respeta disponibilidad configurada, duración 60 min, aviso mínimo
  12 h, horizonte 60 días, vencimiento hasta el final de clase y límite existente.
- El historial identifica la clase anterior como reprogramada; la nueva aparece en
  Próximas clases. No se produce un nuevo cobro ni se cambia el precio de la compra.

## Idempotencia y concurrencia

Un advisory lock por `portal-management-request:<UUID>` serializa el mismo intento.
La fila del alumno y la reserva original se bloquean siguiendo el orden de dominio
existente. La fila del alumno se comparte con reserva/asignación/resolución de 2A/2D.
Las restricciones existentes de no solapamiento y una asignación activa por crédito
siguen como defensa final.

El fingerprint incluye acción, alumno derivado, booking, slot, zona y consentimiento.
Mismo requestId y payload devuelve el mismo recibo sin volver a resolver créditos.
Payload/propietario diferente devuelve IDEMPOTENCY_CONFLICT. Los intentos fallidos
no guardan un éxito parcial. IDs de operaciones internas generados por servidor:
no se reutiliza un UUID elegido por cliente en otros espacios de locks del dominio.

Dos acciones diferentes sobre el mismo booking se serializan: tras la ganadora,
la segunda encuentra la reserva cancelada y no crea otra reserva/devolución/consumo.
Dos alumnos disputando el destino: solo uno gana; el perdedor conserva su origen.
Esto se comprobó con solicitudes realmente simultáneas en PostgreSQL Development,
no se dedujo solo de mocks ni de la ejecución WASM.

## Frontend e idiomas

Mis clases añade Cancelar y Reprogramar solo a reservas propias manejables. Reutiliza
clases CSS del portal: no se cambió portal.css ni el diseño de la home.

Confirmación con clase original, consecuencias, zona IANA, selector de día/hora,
offset UTC y resumen del nuevo horario. La disponibilidad viene de 2D; no se fabrican
horarios. El selector compartido se extrajo a `portal-slots.js` para evitar duplicar
su formato en reserva y reprogramación. No contiene lógica de negocio.

Después del éxito se vuelve a consultar el portal: próximas clases, historial y
saldo. Conflicto de horario recarga opciones sin tocar datos del perfil. Sesión
expirada sigue el acceso existente. Error desconocido se presenta de forma genérica,
sin detalles SQL ni fallback demo. Una respuesta perdida mantiene el requestId y
bloquea cambiar selección hasta comprobar el resultado con el mismo intento.

Foco al abrir, Escape para mantener la clase antes del envío, botones nativos,
labels y avisos aria-live. Mientras se procesa o hay resultado incierto no se permite
cerrar el formulario y arrancar otra acción desde él.

24 claves nuevas, con cobertura equivalente ES / EN / PL. Incluyen controles,
consecuencias temprana/tardía, error/conflicto, confirmación renovada y estado
reprogramada. No cambios a las traducciones anteriores del home.

## Archivos

Modificados:
- `mis-clases.html`: formulario/avisos accesibles dentro de Próximas clases.
- `portal.js`: botones por reserva, conexión al ciclo de render/sesión/refresh.
- `portal-session.js`: métodos autenticados, recibos validados y reintento estable.
- `portal-booking.js`: reutilización del selector compartido; flujo 2D conservado.
- `portal-i18n.js`: 24 claves nuevas por idioma.

Nuevos:
- `portal-lessons.js`: controlador de cancelar/reprogramar.
- `portal-slots.js`: presentación compartida de fechas/horas.
- `supabase/migrations/20261003215829_portal_lesson_management.sql`.
- `supabase/tests/portal-management.sql`.
- `supabase/tests/portal-management.test.mjs`.
- `supabase/tests/portal-management-browser.test.mjs`.
- `supabase/tests/portal-management-development.test.mjs`.
- `supabase/PHASE2E.md`.

Ya existían cambios ajenos a esta fase en index.html, style.css, script.js,
images/pisti.png y el nuevo images/ron.jpg. Se conservaron, sin editar ni revertir.
La comparación SHA-256 con el inicio detectó además que style.css cambió durante
la tarea por fuera de esta implementación. No se intervino ni revirtió ese archivo;
los cambios de 2E están limitados a los archivos enumerados arriba.

## Pruebas y resultados

- **Node: 72/73 pasan.** Las 5 nuevas pasan y 67/68 anteriores pasan. El único fallo
  ya estaba presente al iniciar: `i18n.test.mjs`, falta `en: review_ron` para un
  testimonio añadido previamente en la home. No se corrigió porque es ajeno a 2E.
  No se afirma que toda la suite histórica esté verde.
- PostgreSQL WASM desechable: todas las migraciones y booking.sql, credits.sql,
  portal.sql, portal-data.sql, portal-booking.sql y portal-management.sql pasan.
  La nueva suite contiene 41 assertions. Sin dependencias instaladas en el proyecto.
- Development real: runner completo aprobado, ocho grupos de comprobaciones,
  incluyendo carreras, Auth real, SDK/navegador real, Edge guest y cinco suites SQL
  (credits, portal, portal-data, portal-booking y portal-management).
- Navegador 2E con HTTP simulado: ES/EN/PL en 360/768/1024/1440 px, teclado,
  confirmación antes de mutar, slot ocupado, respuesta perdida tras commit y reintento
  con mismo UUID, cambio de umbral 12 h y nuevo consentimiento: aprobado.
  Sin overflow horizontal ni errores JS; capturas revisadas en escritorio y móvil.
- Navegador previo de reserva 2D en esos cuatro tamaños y tres idiomas: aprobado.
- Navegador previo del portal: sesión, teclado/idioma, texto largo no confiable,
  errores de backend, refresh rechazado y logout fallido remotamente: aprobado.
- Sintaxis de módulos y `git diff --check`: comprobados.

| Caso mínimo solicitado en Development | Resultado |
| --- | --- |
| 1. Cancelación ≥12 h | Devuelve; probado también exactamente a las 12 h. |
| 2. Cancelación <12 h | Consume tras consentimiento; sin consentimiento no modifica. |
| 3. Cancelación repetida | Mismo recibo y un único evento; dos pestañas, una resolución. |
| 4. A no cancela a B | BOOKING_NOT_FOUND; mismo rechazo para reprogramación ajena. |
| 5. Reprogramación válida | Origen en historial, nueva clase propia confirmada. |
| 6. Destino ocupado | Origen confirmado y misma allocation reservada; sin eventos parciales. |
| 7. Fallo de crédito | Origen intacto, tanto falta de unidad extra como vencimiento insuficiente. |
| 8. Dos cambios simultáneos | Solo uno gana; una auditoría/reemplazo. |
| 9. Dos alumnos/un destino | Uno gana, otro SLOT_UNAVAILABLE sin perder el origen. |
| 10. Portal actualizado | Cancelar y reprogramar en Chrome contra Development: éxito y refresh. |
| 11. Historial | Cancelada/reprogramada visibles con estado correcto. |
| 12. Guest anterior | Edge crea plan 4 por 230 zł, student_id NULL; sin vinculación por email. |
| 13. Reserva 2D | RPC, suite SQL y navegador aprobados; funciones originales sin cambios. |
| 14. Suites anteriores | SQL y portal pasan; única excepción: traducción home review_ron preexistente. |

También pasó cancelar contra reprogramar concurrentemente, reintento del mismo
requestId y rechazo del mismo requestId con distinto booking, destino o consentimiento.

## Seguridad revisada

Advisors tras aplicar: diez INFO RLS sin policies en tablas privadas (denegación
intencional), seis WARN por RPC SECURITY DEFINER accesibles a authenticated
(cuatro anteriores y dos nuevas). Revisados identidad, propiedad, search_path y
grants; no se abrieron tablas para suprimir avisos. Se informó además protección
de contraseñas filtradas desactivada: configuración Auth anterior, no cambiada
por esta fase passwordless. No equivale a una auditoría externa completa.

Datos personales solo mediante el snapshot propio ya existente. No student_id,
credit_id, purchase_id, auth_user_id ni email enviado como identidad en nuevas RPC.
Cache-Control no-store. Ninguna credencial de servidor se incorporó al frontend,
repositorio, capturas o informe.

## Limpieza verificada

Runner creó tres alumnos y usuarios Auth técnicos, compras/créditos, bookings y
16 slots temporales en una ventana previamente libre. Manifest local de UUIDs
persistido antes de crear fixtures para recuperación ante interrupción.

Al terminar, se borraron SOLO esos datos por UUID/email técnico exactos, en orden
compatible con FK: auditoría de gestión, eventos, allocations, créditos, compras,
bookings, slots y alumnos. Sesiones revocadas y usuarios eliminados por Auth Admin.
Verificado cero alumnos/slots de los UUIDs del manifiesto. Consulta posterior
independiente: cero alumnos Phase2E, compras phase2e-only, bookings técnicos y
usuarios example.invalid recientes. Las suites SQL terminaron en rollback.
No se borraron horarios ni alumnos legítimos. Los logs de seguridad Auth/Supabase
permanecen como auditoría; no son fixtures operativos. Manifest temporal eliminado
solo después de confirmar limpieza.

## Reproducir las comprobaciones

Servidor local existente en 127.0.0.1:4181 y Playwright instalado fuera del proyecto.
No ejecutar pruebas remotas en producción.

```sh
node --test reservas-data.test.mjs i18n.test.mjs booking-api.test.mjs \
  supabase/tests/portal-access.test.mjs supabase/tests/auth-callback.test.mjs \
  supabase/tests/portal-session.test.mjs supabase/tests/portal-booking.test.mjs \
  supabase/tests/portal-management.test.mjs

PLAYWRIGHT_MODULE=/ruta/existente/playwright/index.mjs \
  node --test supabase/tests/portal-management-browser.test.mjs

# Opt-in explícito y ref fija: solo Development, crea y elimina fixtures.
PORTAL_MANAGEMENT_TEST_DEVELOPMENT=yes \
PORTAL_MANAGEMENT_TEST_PROJECT_REF=vvvugnkvtkcfuwxroies \
PLAYWRIGHT_MODULE=/ruta/existente/playwright/index.mjs \
  node --test supabase/tests/portal-management-development.test.mjs
```

## Limitaciones y siguiente paso

- Idempotencia persistente en PostgreSQL; el intento del navegador sigue en memoria.
  Tras recargar ante un resultado incierto, revisar Próximas clases e Historial.
  El estado cerrado del origen evita una segunda cancelación o reprogramación exitosa.
- La disponibilidad reutilizada excluye horarios actualmente ocupados, incluido el
  original. No se añadió una fuente especial para destinos que solapen la propia
  reserva mientras aún está activa.
- Se conserva el límite de creación por hora heredado de 2D, también para reemplazos.
- El servidor es autoridad de las 12 h; la indicación inicial depende del reloj local,
  pero el servidor exige consentimiento si corresponde pérdida no aceptada.
- No se extendió vencimiento por cancelación del alumno ni se modificó excepción del
  profesor. No se añadieron horarios reales, reglas comerciales ni cargos.
- Pendiente fuera de esta fase: completar review_ron EN/PL y volver a dejar toda la
  cobertura de la home en verde. No hubo regresión nueva de 2E en las pruebas.
- Producción, Stripe, SMTP, emails, Calendar, DELE, materiales y panel del profesor
  siguen fuera de alcance. Esta entrega no declara el sistema listo para producción.

Siguiente paso recomendado: revisión funcional contigo de Cancelar/Reprogramar en
el portal local conectado a Development, y acordar la siguiente fase sin publicar.
