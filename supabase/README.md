# SebaSpanish · Backend de reservas

Fase 1 permanece cerrada y conectada. La Fase 2A añade únicamente el dominio privado
de alumnos, compras y créditos: ver [PHASE2A.md](PHASE2A.md) para arquitectura, RPC,
pruebas y límites. No cambia el recorrido actual del navegador.

Fase 2B: [PHASE2B.md](PHASE2B.md) documenta la nueva puerta passwordless
Development, vinculación Auth, callback técnico y excepción de 30 días del profesor.
Fase 2C: [PHASE2C.md](PHASE2C.md) documenta Mis clases de solo lectura, sesión
persistente/renovable, cierre de sesión y aislamiento por auth.uid(). El callback
técnico de 2B evoluciona para entrar en este portal. Solo Development y frontend local.
El resto de esta guía conserva la arquitectura y evidencia de reservas de Fase 1.

Estado (28 septiembre 2026): frontend local conectado a Supabase **development**
`vvvugnkvtkcfuwxroies`, con `mode: "supabase"`. No se ha publicado la web en GitHub
ni cambiado producción. La configuración pública solo contiene la URL de las funciones.

La migración inicial y ambas Edge Functions ya estaban aplicadas/desplegadas manualmente.
En este cierre se registró la migración inicial en el historial del CLI, sin repetirla,
y se aplicó `202609280002_booking_notice_12h.sql`: ambos RPC aún usaban 24 h y ahora
aplican las 12 h aprobadas. La migración original se conserva intacta.

## Arquitectura y alcance

`reservas.js` (UI) → `booking-api.js` (adaptador) → dos Edge Functions → dos RPC SQL → PostgreSQL.

- `reservas-data.js` mantiene intacto el catálogo de presentación, UTC/IANA y el demo explícito.
- La configuración elige demo o Supabase. Sin configuración sigue la experiencia anterior: agenda vacía y botón para probar ejemplos. Un error en modo Supabase NUNCA usa fixtures.
- El recorrido de reservas no requiere SDK, dependencias nuevas ni autenticación.
  La base Auth separada se describe en PHASE2B.md y el portal privado de solo lectura
  en PHASE2C.md. No hay pagos, emails operativos ni Google Calendar.
- Packs: se guarda una reserva y el precio TOTAL del pack, con 1/4 u 1/8 sesiones programadas. No se generan reservas de las sesiones restantes ni se registra un pago.
- DELE se rechaza en el backend. No tiene precio ni disponibilidad reutilizados del 1 a 1.

## Tablas (schema `booking_private`, fuera de la API pública)

| Tabla | Propósito |
|---|---|
| `offers` | Catálogo autorizado: prueba 0 PLN/30 min; 1 clase 65 PLN, 4 clases 230 PLN, 8 clases 440 PLN, sesiones de 60 min. Dinero en enteros: grosze. |
| `availability_slots` | Un inicio ofrecido por fila; `ends_at` limita la duración; `enabled` retira ofertas concretas. Con disponibilidad real cargada en development. |
| `bookings` | Datos de alumno, idioma de interfaz y contacto, zona IANA, instantes UTC, snapshot del plan/precio/duración, estado e idempotencia. |

No se almacena fecha/hora local como dato independiente: `starts_at`/`ends_at` son `timestamptz`, la API devuelve ISO UTC y `Intl` convierte a la zona del alumno. Así no hay ambigüedad al cambiar de zona o durante DST.

Cada fila de disponibilidad ofrece **un único inicio**, no todas las horas del intervalo. Una fila de 60 minutos acepta prueba de 30 minutos o clase de 60. Para ofrecer 09:00 y 09:30 se crean dos filas; el constraint evita que se vendan solapadas. No se han insertado horarios de ejemplo en la migración.

Vacaciones/bloqueos: deshabilitar los inicios correspondientes mediante SQL privado. Las reservas existentes no se cancelan al deshabilitar disponibilidad. La disponibilidad cargada usa Europe/Warsaw: lunes–viernes 10:00–20:00, sábado 11:00–16:00, domingo cerrado y grid de 30 min. No existe aún automatización recurrente ni sincronización externa.

## Doble reserva, estados e idempotencia

- `bookings_no_active_overlap`: `EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE status IN ('pending','confirmed')`.
- PostgreSQL decide dentro de la transacción, incluso con conexiones simultáneas, distintas filas de disponibilidad o prueba vs clase de 60 min. Intervalos adyacentes sí están permitidos.
- `request_id UNIQUE` y un advisory lock transaccional serializan reintentos de la misma operación. El servidor compara la huella del payload; una clave reutilizada con datos distintos devuelve `IDEMPOTENCY_CONFLICT`.
- Un retry devuelve la misma referencia sin duplicar, aunque la primera respuesta HTTP se pierda. El navegador conserva el intento únicamente en memoria; se pierde al recargar/cerrar. No almacena PII ni tokens en URL/localStorage. Después de un fallo ambiguo se indica reintentar sin modificar datos.
- La reserva nace `confirmed`: confirma la plaza, **no el pago**. `pending` también bloquea, `cancelled` libera. No hay expiración automática ni endpoint público de edición/cancelación. Operaciones administrativas solo con SQL privado en esta fase.
- 12 horas de antelación y 60 días de horizonte. La migración incremental corrige ambos RPC y el frontend usa 12 h.
- La capa Edge conserva el mapeo de PostgreSQL `23P01` a HTTP 409 `SLOT_UNAVAILABLE`, además del error SQL controlado existente. Hay una prueba automatizada específica.

## Seguridad y RLS

Las tres tablas tienen RLS habilitado y NO tienen políticas `anon`/`authenticated`: acceso denegado. También se revocan privilegios de schema/tablas. No se expone la información de alumnos mediante ningún endpoint.

Solo `service_role` puede ejecutar `booking_available_slots` y `booking_create`. Ambas son `SECURITY DEFINER`, con `search_path = ''`, referencias de tablas cualificadas y entradas validadas. Las funciones auxiliares privadas no son invocables por los roles públicos. No hay SQL dinámico ni concatenación de entradas en consultas.

La clave `SUPABASE_SERVICE_ROLE_KEY` se lee únicamente en el entorno Edge; nunca se envía al navegador ni se imprime. El frontend no necesita anon/public key. Los endpoints HTTP son públicos por diseño porque todavía no hay login. `verify_jwt = false` SOLO en esos dos endpoints; esto NO concede permisos sobre tablas o RPC.

- JSON con campos exactos; no se acepta precio, duración, estado ni horas elegidas arbitrariamente.
- La transacción toma precio/duración de `offers`, inicio de una fila habilitada y vuelve a validar disponibilidad.
- Valida alumno, email, longitudes, idioma ES/EN/PL, contacto y zona horaria; las mismas reglas importantes se validan en Edge y SQL.
- Respuesta de reserva mínima, sin datos del alumno; los errores no incluyen detalles de SQL.
- CORS con lista exacta de orígenes; nunca `*`. **CORS no autentica ni impide bots**: un cliente ajeno al navegador puede falsificar Origin.
- Máximo de cinco reservas nuevas por email/hora, serializado por email. Esto es una defensa básica, no protege de emails falsos ni rotación de direcciones.
- Límite de cuerpo 16 KiB y timeouts de red; ninguna respuesta sensible se cachea.

**Antes de exponer públicamente:** definir protección antiabuso efectiva a nivel gateway/IP y/o CAPTCHA, verificación del email si se requiere, monitorización y límites. No se ha conectado un servicio antibot sin autorización. El sistema de invitado no demuestra que quien reserva sea titular del email.

## Endpoints

`POST /functions/v1/booking-availability`

```json
{"type":"1a1","plan":4}
```

Responde `{ "source": "live", "slots": [{ "id": "uuid", "startAt": "ISO UTC", "endAt": "ISO UTC" }] }`. Solo inicios habilitados, dentro del plazo y sin reserva activa. Prueba: `type: "prueba", plan: null`.

`POST /functions/v1/booking-create`

```json
{
  "type": "1a1", "plan": 4,
  "slotId": "UUID de disponibilidad", "requestId": "UUID v4 único por intento",
  "timezone": "Europe/Warsaw", "language": "es",
  "student": {
    "name": "Nombre", "email": "alumno@example.com", "phone": "",
    "language": "es", "country": "", "spanishLevel": "", "message": ""
  }
}
```

Respuesta: referencia, estado, plan, precio, moneda, sesiones, duración, slot e instantes UTC, zona horaria. No se confía en importes del navegador.

Errores: 400 `INVALID_PLAN` / `INVALID_REQUEST` / `INVALID_STUDENT`; 409 `SLOT_UNAVAILABLE` / `IDEMPOTENCY_CONFLICT`; 429 `RATE_LIMITED`; 503 configuración/servidor. Todos los mensajes de UI tienen ES/EN/PL. En conflicto la UI vuelve al calendario, refresca disponibilidad y conserva datos del alumno.

## Configuración de development

```js
export const BOOKING_API_CONFIG = Object.freeze({
  mode: "supabase",
  functionsUrl: "https://vvvugnkvtkcfuwxroies.supabase.co/functions/v1",
});
```

El frontend no requiere clave anon/publishable. `service_role` permanece en Edge.
Para trabajar deliberadamente con fixtures, cambiar solo `mode` a `"demo"`; los
fallos de Supabase nunca alteran este modo. Mantener las versiones de importación
sincronizadas al cambiar configuración. Los imports actuales usan `20260928-development1`.

Vista local comprobada:
`http://127.0.0.1:4181/sebaspanishv2/reservar.html?tipo=1a1&plan=1`.
Ese origen ya está autorizado; el puerto 4183 fue rechazado y se usó para probar
el estado de error sin ampliar CORS. GitHub Pages usa el origen
`https://sbastianbr.github.io` (sin ruta). No publicar esta configuración de
development como producción automáticamente.

## Evidencia de cierre

Pruebas remotas previas comunicadas por Sebastián: disponibilidad real,
creación 200/confirmed, idempotencia, conflicto de idempotencia 409, doble reserva
409, retirada del slot, CORS 403 para origen no permitido y concurrencia real
(una solicitud 200 y otra 409 tras corregir `23P01`). Esa concurrencia **ya está
validada en Supabase real**; no se confunde con el test local omitido.

Verificado nuevamente en este cierre desde el navegador y PostgreSQL:
- Consulta de disponibilidad, cambio de día/hora y reserva individual de 65 PLN.
- Confirmación real `659ce517-3afe-4cae-a058-3543855835a2`, 30/09/2026 11:00 Europe/Warsaw.
- Segundo navegador sobre el mismo slot: conflicto, regreso al calendario, slot
  retirado y datos del alumno conservados. Una única fila confirmada en la base.
- ES/EN/PL en confirmación; sin overflow a 360, 768, 1024 y 1440 px.
- Error CORS deliberado desde otro origen: mensaje controlado, sin demo.
- No cambios en home, CSS, layout ni traducciones.

Limpieza identificada y mostrada antes de borrar, con ID + nombre + email exactos:

| ID técnico | Identidad |
|---|---|
| `65acc9ea-c28c-4c6d-9f5c-b8e6696e76b8` | Test Phase 1 / phase1-test@example.com |
| `e3c47d0d-5d42-49fd-ac27-705319218de4` | Concurrent Test B / concurrent-b@example.com |
| `8e13285c-804a-4c2a-bc7a-c5cdfeee10a1` | Concurrent Test B / concurrent-b2@example.com |

Las tres se eliminaron y se comprobó que sus slots reaparecieron. La reserva E2E
de este cierre se identifica aparte como `E2E Phase 1 / phase1-e2e@example.com`;
no representa un alumno real. Se eliminó tras comprobar el conflicto, usando ID,
nombre y email exactos, y se verificó la liberación del slot. Total: cuatro
reservas técnicas eliminadas; ninguna reserva del intento conflictivo.

## Pendientes de producción (fuera de esta tarea)

- Separar configuración/datos de producción de development antes de publicar.
- Completar protección antiabuso, seguimiento operativo y decisiones legales.
- La política de cancelación/reprogramación ya está aprobada: >=12 h devuelve,
  <12 h consume; no-show consume; cancelación del profesor devuelve siempre.
  Está implementada en el dominio privado de Fase 2A; su acceso público sigue pendiente.
- La base de créditos y vigencia está implementada, pero no conectada al frontend.
  Una prueba gratuita por email, pagos verificados, portal/autenticación, emails,
  Calendar y DELE continúan pendientes.
- La disponibilidad cargada no se renueva automáticamente: mantener los slots y
  bloqueos administrativos mientras no se implemente esa fase.
- La clave de idempotencia del navegador vive solo en memoria; recargar pierde el
  intento. El constraint sigue impidiendo ocupar dos veces el mismo intervalo.

## Pruebas

Sin dependencias de aplicación:

```sh
node --test reservas-data.test.mjs i18n.test.mjs booking-api.test.mjs
```

SQL de Fase 1 (solo base local desechable, migraciones aplicadas):

```sh
psql "$BOOKING_TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/booking.sql
BOOKING_TEST_ALLOW_LOCAL=yes node --test supabase/tests/concurrency.test.mjs
```

`BOOKING_TEST_DATABASE_URL` debe señalar localhost/127.0.0.1. El segundo test usa `psql` y dos procesos concurrentes; se omite explícitamente cuando no hay conexión configurada. No usar una base con datos reales. Opcionalmente `PSQL_BIN` indica la ruta al ejecutable.

La sesión de implementación comprobó migración y aserciones SQL con PostgreSQL en WASM (PGlite temporal fuera del proyecto); eso prueba SQL, constraints y permisos, **no concurrencia real entre conexiones ni el gateway de Supabase**. La aplicación no depende de PGlite. El test concurrente local sigue disponible y se omite sin PostgreSQL local; no invalida la concurrencia real ya comprobada en development.

Resultado del cierre: 29 tests aprobados (13 API, 11 datos, 5 i18n), 0 fallos y 1 test local de concurrencia omitido. Ambas migraciones y las aserciones SQL —incluidos los bordes de 12 horas, permisos, precios, idempotencia y solapamientos— pasan en PGlite temporal, sin dependencias nuevas en la aplicación.

## Fuentes de diseño

- [Supabase: funciones y permisos](https://supabase.com/docs/guides/database/functions)
- [Supabase: secretos del entorno Edge](https://supabase.com/docs/guides/functions/secrets)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL: constraints de rangos](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT)
