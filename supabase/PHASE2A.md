# Fase 2A · Alumnos, compras y créditos

Nota posterior: la Fase 2B añade Auth Development y la excepción aprobada de 30 días;
ver [PHASE2B.md](PHASE2B.md). El resto de este documento describe el alcance original.

29 septiembre 2026. Base de dominio aplicada exclusivamente en Supabase Development
`vvvugnkvtkcfuwxroies`. No hay integración de pagos, autenticación, nuevos endpoints
HTTP, ni modificaciones del frontend. Las dos migraciones y los dos RPC de Fase 1
se conservan. `booking-config.js` continúa apuntando a Development.

## Arquitectura

Operaciones futuras de servidor → RPC autorizados → transacción PostgreSQL →
unidades de crédito + asignaciones históricas + eventos.

Una unidad por clase hace identificable qué compra pagó cada reserva. Las asignaciones
conservan los vínculos incluso tras devolver/reutilizar un crédito. Los eventos guardan
la causa y el recibo idempotente. No existe un contador mutable `remaining_credits`.
El saldo se deriva de los datos; no hay que sincronizar un contador separado.

El home y `reservar.html` mantienen el flujo de invitado anterior. Una reserva de Fase 1
no crea alumnos, compras o créditos automáticamente y sigue funcionando sin ellos.
No hay pagos ficticios ni conversión automática de las reservas antiguas a compras.

## Tablas y columna nueva

Todas las nuevas tablas están en `booking_private`:

| Tabla                | Datos y finalidad                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `students`           | UUID estable, email normalizado/único, nombre, teléfono opcional, idioma de contacto, país, nivel, creación/actualización.                      |
| `purchases`          | Alumno, oferta, snapshot de tipo/precio PLN/cantidad/duración; estado pending/active, activación, caducidad e identidad externa de transacción. |
| `credits`            | Unidad individual, compra y ordinal, caducidad efectiva, marca de revisión de vigencia tras devolución del profesor.                            |
| `credit_allocations` | Enlace unidad↔booking, estado reserved/consumed/returned, fechas y motivo de resolución. No se elimina la asignación devuelta.                  |
| `credit_events`      | Movimiento, compra/crédito/booking, fecha, clave de intento o evento externo, huella y recibo de resultado.                                     |

`bookings.student_id` es una FK **opcional**. Las reservas antiguas siguen siendo
válidas sin perfil. Los campos actuales de contacto de `bookings` siguen siendo
snapshots históricos y no se sobrescriben al actualizar el perfil.
El email se normaliza mediante `lower(btrim(...))`; no se eliminan puntos ni sufijos
`+` que puedan representar direcciones distintas. Identificar por email **no verifica
su titularidad**. Un futuro backend autenticado debe comprobarla antes de usar estos RPC.

## Constraints e índices

- UUID PK y FK entre alumno, compra, unidad, asignación y reserva.
- Email normalizado UNIQUE; validación de forma, longitudes e idiomas/niveles.
- PLN, precio positivo en grosze, 1/4/8 créditos, 60 minutos y coherencia
  pending/active con sus fechas e identificador externo.
- UNIQUE `(purchase_id, ordinal)` impide duplicar una unidad de una compra.
- UNIQUE `booking_id` en asignaciones: una clase solo puede tener una asignación.
- Índice parcial UNIQUE `credit_one_active_allocation(credit_id)` para estados
  reserved/consumed: ni dos reservas activas ni reutilización de una unidad consumida.
- Estado/motivo/fecha de resolución coherentes en cada asignación.
- UNIQUE `(external_source, external_payment_id)` en compras y
  `(external_source, external_event_id)` en eventos; UNIQUE `request_id` en eventos.
- Índices para reservas por alumno, compras por alumno/fecha, créditos por caducidad
  e historial por compra/crédito/booking.
- Continúa el constraint de Fase 1 `bookings_no_active_overlap`.

Los RPC derivan precio, cantidad, duración y vigencia del servidor; no los reciben
como parámetros. El snapshot queda fijado al preparar la compra y permite contrastar
un futuro cobro contra ese importe, aunque posteriormente cambie el catálogo.

## Permisos

Las cinco tablas tienen RLS habilitado, sin políticas que abran lectura/escritura.
Se revoca acceso directo también a `service_role`; el backend usa exclusivamente RPC.
Los seis RPC son `SECURITY DEFINER`, `search_path = ''`, con nombres cualificados,
sin SQL dinámico y EXECUTE solo para `service_role`. `anon` y `authenticated` no
pueden ejecutarlos. El helper de caducidad permanece privado y revocado a esos roles.

No se añade secreto al navegador. No hay políticas de alumno basadas simplemente en
un email proporcionado por el cliente. En la fase de autenticación habrá que asociar
la identidad verificada a `students.id` antes de abrir acceso propio.

Los eventos son append-only mediante los permisos y las operaciones de dominio:
ningún RPC los edita o elimina. Esto no pretende impedir intervenciones controladas
del propietario/administrador de la base; no es un registro criptográficamente inmutable.

## RPC de servidor

| RPC                                                                                       | Responsabilidad                                                                                    |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `student_upsert(profile)`                                                                 | Alta/actualización normalizada y validada; reutiliza el UUID del mismo email.                      |
| `purchase_prepare(student_id, offer_code, request_id)`                                    | Compra pendiente con snapshot del catálogo activo; todavía no genera unidades.                     |
| `purchase_activate(purchase_id, external_source, external_payment_id, external_event_id)` | Activa una sola vez y genera exactamente las unidades oficiales + eventos en la misma transacción. |
| `student_credit_balances(student_id)`                                                     | Conteos available/reserved/consumed/expired/returnedPendingReview y total. Sin cron.               |
| `credit_allocate(student_id, booking_id, request_id, credit_id?)`                         | Reserva una unidad vigente para una clase del alumno; por defecto la que caduca antes.             |
| `credit_resolve_booking(booking_id, reason, request_id)`                                  | Resuelve la asignación: devolución o consumo según motivo/plazo, con recibo idempotente.           |

Helper privado: `booking_private.six_month_expiry(timestamptz)`.

No se añaden Edge Functions. Activar **no comprueba que se haya pagado**. Solo debe
llamarlo un proceso servidor autorizado tras comprobar el evento y el importe reales.
La futura integración deberá validar firma, estado del pago, moneda e importe contra
la compra y rechazar transacciones incoherentes antes de conceder derechos.

## Ciclo del crédito y política oficial

1. Compra pending: cero unidades utilizables.
2. Activación: una unidad para 65 PLN; cuatro para 230 PLN; ocho para 440 PLN.
3. Asignación: pasa de available a reserved, sin generar otras reservas.
4. Clase terminada o no-show: consumed. No-show solo desde el inicio; completed
   solo después del final. Nunca se consumen anticipadamente con esos motivos.
5. Cancelación/reprogramación del alumno con **12 horas o más**: returned;
   la unidad vigente vuelve a estar disponible. Exactamente 12 horas está incluido.
6. Con **menos de 12 horas**: consumed. Se cancela la reserva original.
7. Cancelación del profesor: returned siempre, con independencia del plazo.
8. Unidad libre con `expires_at <= now()`: expired, sin modificar físicamente la fila.

Un retorno no borra la compra ni su historial. Una unidad devuelta y reutilizada
conserva las dos asignaciones: la histórica returned y la nueva reserved.

La prueba gratuita conserva 30 minutos/precio cero en Fase 1; no es una compra pagada
ni produce créditos. DELE permanece fuera del catálogo activo. Sus precios futuros
80/300/560 PLN están documentados, pero no habilitados.

### Vigencia y excepción del profesor

Se calculan **seis meses calendario** desde la activación, en Europe/Warsaw, y se
almacena un instante `timestamptz`. No se aproxima a 180 días. El cálculo conserva
la hora local al cambiar de horario y ajusta al último día válido del mes destino.
Ejemplo comprobado: 31/08 10:00 de Varsovia → 28/02 10:00 de Varsovia.

La clase completa debe finalizar dentro de la vigencia, según BUSINESS_RULES.md §8.
Una unidad ya asignada conserva ese estado hasta resolver la clase; no se convierte
en disponible porque llegue su fecha de expiración.

Actualización incremental de Fase 2B: si el profesor devuelve una unidad todavía
vigente, conserva su caducidad; si venció mientras estaba asignada, se devuelve con
30 días calendario desde la cancelación (Europe/Warsaw), sin otros seis meses.
El recibo audita ambas caducidades y el retry no extiende de nuevo. La columna de
revisión se conserva para historial/compatibilidad, sin nuevas revisiones pendientes.

## Concurrencia e idempotencia

Asignación y resolución toman bloqueos en el mismo orden: alumno → reserva → crédito.
Esto serializa movimientos del mismo alumno y evita que dos llamadas lean simultáneamente
el mismo saldo libre. La protección final es el índice UNIQUE parcial sobre la unidad.

Cada operación con `request_id` tiene un advisory lock transaccional y un evento/recibo
único. El mismo intento y payload devuelve el recibo original; cambiarlo genera
`IDEMPOTENCY_CONFLICT`. Repetir una resolución con otro intento también se rechaza:
la asignación ya no está reserved.

Activación bloquea la identidad de evento, después la de transacción externa y luego
la compra. El mismo evento devuelve el mismo recibo. Un evento nuevo para el mismo
pago/compra tampoco genera unidades adicionales. Reutilizar ese pago/evento para otra
compra o una huella distinta se rechaza. Los identificadores incluyen un origen neutral,
sin nombres ni dependencia de un proveedor de pagos.

## Integración futura: límites explícitos

- Crear una reserva y asignarle el crédito deberá ocurrir **en una misma transacción
  SQL**, mediante un wrapper de servidor. No encadenar dos peticiones del navegador.
  El wrapper reutilizará validaciones de disponibilidad, 12 h, horizonte e idempotencia.
- `student_reschedule` representa solo el desenlace del crédito de la reserva original.
  No mueve una clase. La futura operación completa debe crear/validar el nuevo slot,
  resolver la anterior y reasignar una unidad en una transacción, o revertirlo todo.
- Los motivos de resolución deben autorizarse por actor. Un alumno futuro no podrá
  enviar libremente `teacher_cancel` ni actuar sobre otro alumno. Hoy ningún alumno
  puede ejecutar estos RPC.
- Cancelar una reserva no bloquea automáticamente la agenda del profesor. Disponibilidad
  y bloqueos siguen siendo la responsabilidad administrativa existente.
- No se enlazan ni facturan automáticamente reservas previas. La transición de invitado
  a compra/créditos tendrá que ser explícita y verificada.
- No se han diseñado estados ficticios de pago/refund ni añadido frontend de producción.

## Migración y pruebas

Migración incremental: `202609290001_students_purchases_credits.sql`.
Primero comprobada en un PostgreSQL WASM temporal ya disponible fuera del proyecto;
las dos migraciones anteriores y sus assertions también pasaron allí. No se añadió
ninguna dependencia de aplicación. El dry-run remoto listó únicamente esta migración
antes de aplicarla a Development.

Pruebas de Fase 1, sin dependencias nuevas:

```sh
node --test reservas-data.test.mjs i18n.test.mjs booking-api.test.mjs
```

Pruebas SQL de Fase 2A (propietario de base local desechable o Development autorizado):

```sh
supabase db query --linked --file supabase/tests/credits.sql --output json
```

El archivo actualizado para la regla de 30 días contiene 101 assertions. Solo crea/actualiza sus fixtures propios, usa
slots iniciales deshabilitados fuera del horizonte público y termina con ROLLBACK.
Si una assertion falla, PostgreSQL revierte toda la transacción. No se deben cambiar
los datos de alumnos existentes para hacer pasar pruebas.

Prueba real concurrente mediante CLI ya autenticado, **solo** este Development:

```sh
CREDIT_TEST_ALLOW_DEVELOPMENT=yes \
CREDIT_TEST_PROJECT_REF=vvvugnkvtkcfuwxroies \
node --test supabase/tests/credits-concurrency.test.mjs
```

Opcional: `SUPABASE_BIN=/ruta/al/cli`. Sin opt-in se omite; otro proyecto se rechaza.
El runner crea identidades `@example.invalid`, slots deshabilitados después del
horizonte público, compras y reservas técnicas. Lanza peticiones RPC HTTP simultáneas y comprueba sus respuestas y el estado SQL final.
La credencial service_role de Development se obtiene del CLI autenticado solo en
memoria del proceso de pruebas; nunca se imprime, escribe a disco ni envía al navegador.
La configuración del frontend no la incluye. Los pasos SQL de preparación/limpieza
son secuenciales para evitar reinicializaciones concurrentes del usuario del CLI.
La limpieza por UUID en `finally` elimina únicamente los fixtures de esa ejecución.
No ejecutar contra producción ni detener abruptamente el proceso durante la prueba;
un corte del proceso/red puede requerir limpieza administrativa de sus fixtures.

### Resultados de esta fase

- 29/29 tests existentes: 13 API, 11 datos/reservas, 5 cobertura i18n; sin fallos.
- 97 assertions SQL nuevas aprobadas tanto en PGlite temporal como en PostgreSQL
  Development. Cubren normalización, 1/4/8 unidades, catálogo, expiración/DST,
  idempotencia, reutilización con historial, doble asignación, límites de 12 h,
  no-show, cancelación del profesor, snapshots históricos, RLS y permisos.
- Assertions SQL originales de Fase 1 aprobadas después de aplicar la nueva migración
  en el motor temporal; no se reescribieron esos tests ni las migraciones previas.
- 3 escenarios remotos de concurrencia/reintento aprobados (Node informa 4/4 al
  incluir el test contenedor): activación duplicada → una unidad y un evento;
  dos bookings sobre una unidad → una asignación y un CREDIT_UNAVAILABLE;
  retry → mismo recibo. Fixtures propios eliminados al finalizar y verificados.
- Smoke SQL remoto de Fase 1: reserva de invitado confirmada a 65 PLN, repetición
  idempotente y rechazo de slot ocupado; todo dentro de una transacción revertida.
- Definiciones remotas de booking_create y booking_available_slots verificadas
  idénticas antes/después mediante hash. Home, reservas, estilos, traducciones,
  adaptador, configuración, Edge compartido y las dos migraciones anteriores
  verificados sin cambios mediante SHA-256.
- Disponibilidad HTTP real: prueba y planes 1/4/8 devuelven 200/source=live;
  un origen no permitido obtiene 403. No se crean reservas en estas consultas.
- Historial de migraciones sincronizado: 202609280001, 202609280002 y 202609290001.
  Comprobación final: cero perfiles técnicos Phase 2A restantes.
- No se repitió la auditoría visual ni se modificaron CSS/HTML/JS del frontend.
  La evidencia de responsive previa sigue en README, separada de las pruebas de hoy.
- El runner local antiguo de concurrencia sigue omitido sin PostgreSQL/psql local;
  eso no afecta a la prueba real nueva realizada en Development.

Durante la construcción del test remoto se agotó el tiempo de varios procesos CLI
que inicializaban conexión simultáneamente. Esos intentos NO se contaron como éxito.
El runner final usa SQL secuencial para fixtures y RPC HTTP concurrentes para las
operaciones: todas sus comprobaciones pasaron. No fue necesario cambiar las funciones
ni instalar software. Se verificó que no quedaron alumnos técnicos de esos intentos.

## Pendientes y siguiente fase

Antes de abrir este dominio a alumnos: identidad de email verificada, autorización
por actor/propiedad, wrapper transaccional de reserva+crédito, rescheduling atómico,
sesiones persistentes y protección antiabuso de producción. La extensión de
30 días del profesor y la base Auth ya se implementan en Fase 2B.
Antes de pagos: proveedor autorizado por Sebastián, validación de webhooks/importes,
holds y conciliación/idempotencia entre compra, pago y primera reserva. Nada de ello
está activo. Siguen fuera del alcance Mis clases visual y emails operativos,
Calendar, materiales, reembolsos monetarios y DELE.

Siguiente paso recomendado: revisar y aprobar el contrato de la futura integración
compra confirmada → crédito → reserva autenticada, incluida la vigencia de las
excepciones, antes de implementar pagos o Mis clases. Esta recomendación no los inicia.
