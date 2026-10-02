# Fase 2D — reserva autenticada con crédito

Estado al 2 de octubre de 2026: **Fase 2D implementada y verificada en Supabase
Development (`vvvugnkvtkcfuwxroies`)**. Migración aplicada, frontend integrado y doce
casos obligatorios comprobados. No se publicó GitHub Pages ni se tocó producción.

La implementación y ocho subpruebas reales ya estaban terminadas antes de la
interrupción. Al reanudar se verificó el estado existente, se completaron las suites
SQL pendientes y se cerró la limpieza de los fixtures que habían quedado en remoto.
No se recrearon RPC, migraciones ni frontend; en esta reanudación solo se actualizó
este informe dentro del repositorio.

## Arquitectura

Cliente oficial ya instalado → PostgREST (JWT validado) → dos RPC:

- `portal_booking_slots()`: exige sesión/elegibilidad y reutiliza
  `booking_available_slots('1a1',1)`; no inventa disponibilidad.
- `portal_book_class(p_slot_id uuid,p_request_id uuid,p_timezone text)`:
  única transacción. Deriva `auth.uid() → students.auth_user_id → student_id`;
  reutiliza `portal_current_access()`, `booking_create()` y `credit_allocate()`.

Migración nueva: `20261001194840_portal_credit_booking.sql`, creada con la CLI.
No tablas, índices o Edge Functions nuevas. Ninguna migración aplicada se modifica.
No cambia booking-create/availability, catálogo, horarios, precios ni cancelaciones.

## Transacción, locks y reintentos

1. Validar JWT/argumentos; tomar advisory locks `booking-request` y `credit-request`
   para el UUID del intento, compartidos con las operaciones existentes.
2. Bloquear la fila del alumno (`FOR UPDATE`) resuelta desde `auth.uid()` y verificar
   el acceso confirmado/compra activa con la puerta de 2B.
3. Buscar reintento: fingerprint `portal:` de alumno resuelto + slot + timezone.
   Mismo payload devuelve el mismo booking incluso tras cambios al perfil; distinto
   dueño/slot/zona horaria o colisión con guest devuelve `IDEMPOTENCY_CONFLICT`.
   Un reintento tras cancelación devuelve la misma reserva cancelada, sin recrearla.
4. Leer/bloquear slot; distinguir INVALID_SLOT y BOOKING_TOO_SOON. Crear reserva con
   perfil exclusivamente de servidor y oferta individual de 60 minutos, reutilizando
   validación de oferta, horizonte de 60 días, aviso 12 h, duración y límite por email.
5. Llamar `credit_allocate(student,booking,request)` SIN credit_id. Reutiliza el orden
   existente: expiración efectiva, created_at, ordinal, id. Los dos últimos son el
   desempate estable. Compra active, no asignado/consumido/review, no vencido, clase
   termina antes o en el vencimiento. Mantiene selección y bloqueo exclusivamente SQL.
6. Allocation, vínculo student_id y credit_event quedan en la misma transacción.
   Si algo falla se propaga la excepción: rollback del booking y todo lo asociado.

Dos reservas de un alumno se serializan por su fila; dos alumnos que compiten por
horarios iguales o solapados quedan protegidos por `bookings_no_active_overlap`.
`credit_one_active_allocation` impide doble uso como última defensa. Se respeta el
orden estudiante → booking → crédito de asignación/cancelación, después de los locks
por intento. No se usa SKIP LOCKED: no se salta el crédito que vence antes.
No contador mutable de créditos.

El snapshot monetario interno de booking_create sigue siendo el catálogo individual;
NO es otro cobro ni altera la compra/importe del pack. La compra vinculada al crédito
continúa como fuente del pago. La RPC del portal devuelve solo id/estado/horario/zona/
duración, sin precio, crédito, compra o datos personales.

## Seguridad

Las dos RPC usan SECURITY DEFINER, search_path vacío y nombres de esquema explícitos.
EXECUTE solo authenticated; revocado PUBLIC, anon y service_role. Se exige identidad
real en cada entrada; no se acepta email/student_id/credit_id/precio/plan del navegador.
La firma rechaza parámetros extra. No se abren USAGE del esquema privado, grants de
tablas ni políticas RLS. No se usa service_role en frontend ni se crea otra Edge.
Cache-Control no-store en respuestas. Errores internos desconocidos no llegan al UI.

Errores estables: UNAUTHENTICATED, STUDENT_NOT_FOUND, PORTAL_ACCESS_DENIED,
NO_AVAILABLE_CREDITS, SLOT_UNAVAILABLE, BOOKING_TOO_SOON, IDEMPOTENCY_CONFLICT,
INVALID_SLOT, INVALID_REQUEST. INVALID_PLAN/RATE_LIMITED del backend anterior conservados.
PostgREST rechaza anon/JWT inválido antes de entrar; UNAUTHENTICATED cubre también ausencia
 de auth.uid dentro de la función. Los créditos reservados solo se consumen al resolver
la clase según las reglas anteriores, no al hacer clic en confirmar.

Advisors finales: nueve INFO por RLS sin policies en tablas privadas (denegación
intencional) y cuatro WARN por las RPC SECURITY DEFINER accesibles a authenticated:
las dos anteriores del portal y las dos nuevas. Se revisaron identidad, permisos,
filtros y search_path; no se abrieron tablas para silenciar estos avisos.
La primera lectura también devolvió un aviso de protección de contraseñas filtradas;
la lectura final no lo devolvió. Esta fase no cambió configuración de Auth.

Se comparó el hash de las definiciones remotas anteriores y posteriores: sin cambios
en booking_available_slots, booking_create, credit_allocate, credit_resolve_booking,
portal_current_access y portal_my_data. Permanecen las mismas tres Edge Functions:
booking-availability v4, booking-create v3 y portal-access-request v3.

## Frontend

Mis clases añade un panel discreto reutilizando portal-panel/portal-form/portal-button:
selección de día/hora, zona IANA visible, offset UTC para horas repetidas por DST,
resumen de un crédito y confirmación. No selección de crédito, datos de identidad,
reglas comerciales ni cálculo monetario en JavaScript.

Se conserva SDK/sesión/logout. El backend es autoridad; el saldo mostrado solo ayuda
al usuario. Al confirmar, se consulta de nuevo portal_my_data para saldo/próximas clases.
Ante conflicto se borra la selección y consulta disponibilidad; no datos de perfil.
Ante timeout se bloquea cambiar horario y se ofrece reintentar con el mismo requestId.
Intentos solo en memoria, como el flujo anterior: tras recargar, revisar Próximas clases
antes de una nueva selección si había una respuesta incierta. No garantiza persistencia
de intentos entre recargas/dispositivos. Sin fallback demo ni emails.

## Archivos

Modificados:
- mis-clases.html
- portal.css (select reutiliza regla de input; espacio del panel)
- portal.js (conectar panel al ciclo de sesión)
- portal-session.js (dos métodos RPC y reintento)
- portal-i18n.js (22 claves nuevas completas ES/EN/PL)

Nuevos:
- portal-booking.js
- supabase/migrations/20261001194840_portal_credit_booking.sql
- supabase/tests/portal-booking.sql
- supabase/tests/portal-booking.test.mjs
- supabase/tests/portal-booking-browser.test.mjs
- supabase/tests/portal-booking-development.test.mjs
- supabase/PHASE2D.md

Home, su CSS/JS, frontend guest, Auth/Edge/config y migraciones anteriores no editados.
Se detectó edición externa de style.css durante la tarea; se conservó sin intervenir.

## Verificación completada

- 68/68 pruebas Node aprobadas: 64 previas + 4 nuevas del adaptador de reservas.
- PostgreSQL WASM desechable (PGlite 0.3.14, carpeta temporal, sin dependencia del
  proyecto): todas las migraciones, suites booking.sql, credits.sql, portal.sql,
  portal-data.sql y 48 assertions nuevas de portal-booking.sql aprobadas.
- SQL nuevo: éxito, orden expiración/antigüedad, agotado/vencido/fin de clase tras
  vencimiento, inválido/ocupado/fuera de horizonte/menos de12h, rollback, reintento,
  payload conflictivo, aislamiento, rechazo guest colisionante, saldos/portal,
  cancelación temprana y reserva guest sin student_id ni crédito, RLS/grants.
- Suite de navegador anterior aprobada: sesión, teclado, error, refresh/logout.
- Nueva suite navegador con SDK real + HTTP simulado: ES/EN/PL a360/768/1024/1440,
  teclado, conflicto sin descontar, error de red y retry mismo UUID, próxima clase,
  saldo actualizado; sin overflow ni errores JS. Una primera ejecución simultánea
  agotó la espera inicial; su repetición aislada pasó en todos los tamaños.
- git diff --check y sintaxis JS comprobados.

Las pruebas WASM no se usaron como evidencia de concurrencia. La concurrencia sí
se comprobó después mediante solicitudes simultáneas contra PostgreSQL real de
Development, con JWT emitidos por Auth y cuentas técnicas separadas.

## Resultados reales de Development

| Caso obligatorio | Resultado / evidencia |
| --- | --- |
| 1. Alumno autenticado con crédito | OK por RPC y navegador con SDK/Auth real. |
| 2. Sin créditos disponibles | NO_AVAILABLE_CREDITS; ninguna reserva adicional. |
| 3. Crédito expirado | Rechazado; también se validó que cubra hasta el fin de clase. |
| 4. Slot ocupado | SLOT_UNAVAILABLE; crédito del perdedor intacto. |
| 5. Dos pestañas, último crédito | Una gana; la otra revierte completamente. |
| 6. Dos alumnos, mismo slot | Una reserva; el otro conserva su crédito. |
| 7. Misma requestId y payload | Mismo resultado, sin nueva asignación. |
| 8. requestId con otro payload | IDEMPOTENCY_CONFLICT; también con otro dueño. |
| 9. Aislamiento | Datos separados; identidad/crédito/precio extra rechazados; anon rechazado. |
| 10. Próximas clases | Navegador real muestra la clase y actualiza saldo a cero. |
| 11. Guest/legacy | Edge booking-create sigue creando plan 4 por 230 zł, sin student_id ni crédito. |
| 12. Cancelaciones | Suite previa aprobada: >=12h devuelve; <12h/no-show consume; profesor devuelve; vencido recibe 30 días. |

Antes del corte quedaron registradas ocho subpruebas reales aprobadas, incluida la UI.
No se conserva un cierre completo exitoso del runner de aquella ejecución; no se
presenta como tal. Al reanudar se ejecutaron individualmente las suites pendientes:
credits.sql, portal.sql y portal-data.sql, todas aprobadas y revertidas con rollback.
portal-booking.sql pasó sus 48 assertions en Development, también con rollback.
No fue necesario repetir las carreras ya verificadas ni crear nuevas cuentas.

Las 68 pruebas Node se repitieron al cierre: 68 aprobadas, cero fallos/skips.
La matriz de navegador previa cubrió ES/EN/PL a 360, 768, 1024 y 1440 px, teclado,
conflicto y reintento tras error de red sin overflow ni errores JS. No se modificó
frontend después de esa validación. git diff --check pasó al cierre.

## Limpieza comprobada

Quedaban tres alumnos/cuentas Auth técnicos, tres compras con sus créditos,
cuatro reservas y ocho slots temporales de la ejecución interrumpida. Se identificaron
por UUID exactos, nombre técnico, dominio example.invalid, fuente phase2d-only y
fecha de creación. Se eliminaron sus eventos/asignaciones y datos relacionados;
se revocaron las sesiones y se borraron las identidades mediante Auth Admin.

Consulta final: cero alumnos, compras, créditos, eventos, reservas, slots, usuarios
Auth y sesiones asociados a esos fixtures. Las referencias de asignaciones están
protegidas por claves foráneas y se eliminaron antes de los créditos/bookings.
Los horarios preexistentes y alumnos reales se conservaron. Los logs de auditoría
de Supabase/Auth permanecen como registros de seguridad; no son fixtures operativos.
Las suites SQL adicionales terminaron con rollback, sin dejar datos.

## Comandos de verificación para futuras ejecuciones

Solo Development y con autorización para datos técnicos; no es necesario repetirlos
para dar por cerrada esta fase. Las pruebas remotas no deben ejecutarse en producción.

```sh
node --test reservas-data.test.mjs i18n.test.mjs booking-api.test.mjs \
  supabase/tests/portal-access.test.mjs supabase/tests/auth-callback.test.mjs \
  supabase/tests/portal-session.test.mjs supabase/tests/portal-booking.test.mjs

PLAYWRIGHT_MODULE=/ruta/existente/playwright/index.mjs \
  node --test supabase/tests/portal-booking-browser.test.mjs

# SOLO después de aplicar la migración revisada, nunca producción:
PORTAL_BOOKING_TEST_DEVELOPMENT=yes \
PORTAL_BOOKING_TEST_PROJECT_REF=vvvugnkvtkcfuwxroies \
PLAYWRIGHT_MODULE=/ruta/existente/playwright/index.mjs \
  node --test supabase/tests/portal-booking-development.test.mjs
```

El runner exige opt-in + ref exacta + proyecto CLI vinculado correcto. Crea tres
identidades técnicas con generate_link/verify SIN envío de emails, compras/créditos
técnicos y slots temporales en una ventana libre; no cambia horarios existentes.
Prueba dos pestañas/último crédito, dos alumnos/un slot, retries, payload, aislamiento,
rechazo de manipulación, expirado, rollback, guest Edge y UI con Auth real.
Reejecuta las suites previas de cancelaciones con rollback. Limpieza exacta por UUID
al finalizar; conservados los logs de seguridad de Auth. Si se interrumpe el proceso,
comprobar explícitamente la limpieza remota antes de declarar terminada una ejecución.

## Limitaciones y siguiente paso

- La idempotencia PostgreSQL es persistente para el mismo requestId. El navegador
  conserva el intento solo en memoria; después de recargar ante una respuesta
  incierta debe revisarse Próximas clases. No se promete retry entre dispositivos.
- El panel y la confirmación usan disponibilidad real existente; no se añadieron
  horarios ni reglas comerciales. No se implementó cancelación/reprogramación visual.
- La reserva asigna/reserva un crédito; la liquidación posterior decide si se consume
  o devuelve según las reglas vigentes. No hay segundo cobro ni contador mutable.
- Los avisos SECURITY DEFINER intencionales requieren conservar estas comprobaciones
  de identidad y permisos en futuros cambios. No equivalen a una auditoría externa.
- Desarrollo está validado; esto no declara producción lista. Pagos, SMTP/emails,
  Calendar, DELE, materiales y publicación continúan fuera de esta fase.

Siguiente paso recomendado: revisar contigo el flujo local de Mis clases conectado
a Development y acordar el alcance de la próxima fase antes de integrar servicios
externos. No se ha iniciado otra fase ni publicado nada.

Referencias verificadas:
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/auth/architecture
- https://www.postgresql.org/docs/current/explicit-locking.html
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
