# Fase 2C · Mis clases, sesión y datos propios

29 de septiembre de 2026. Implementada únicamente en el checkout local
`sebaspanishv2/` y Supabase Development `vvvugnkvtkcfuwxroies`.
Sin publicación de GitHub Pages, producción ni cambios al home.

## 1. Arquitectura

Frontend vanilla → cliente oficial Supabase → Auth para la sesión → RPC privada
`public.portal_my_data()` para una instantánea coherente de los datos propios.

Se escogió RPC en lugar de una nueva Edge porque PostgREST ya valida el JWT y
PostgreSQL puede resolver identidad, elegibilidad y relaciones en la misma consulta.
No hace falta otra capa con service_role. La solicitud de enlaces conserva exactamente
la Edge `portal-access-request` de 2B, CORS local, allowlist y límites existentes.

La API no acepta argumentos de identidad. Responde a `POST /rest/v1/rpc/portal_my_data`
con `{}` y JWT de alumno; no recibe student_id ni email. Respuesta `Cache-Control: no-store`.
No se cambiaron tablas, datos históricos, precios, disponibilidad ni reglas de créditos.

## 2. Autorización y aislamiento

`auth.uid()` → `students.auth_user_id` → un único alumno.
Antes de leer, la RPC reutiliza `portal_current_access()` de 2B: identidad confirmada,
no eliminada/bloqueada/anónima, email actual coincidente y al menos una compra active.
Sigue sin depender de créditos restantes o vigentes. Conocer un email no autentica.

Sin vínculo/elegibilidad: SQLSTATE 42501 y mensaje constante PORTAL_ACCESS_DENIED.
Sin JWT válido: PostgREST rechaza la solicitud. Los parámetros de identidad extra
no corresponden a la firma de la función y se rechazan. Headers/email manipulados no
sustituyen auth.uid(). No existe lookup de alumno elegido por el navegador.

RPC SECURITY DEFINER, search_path vacío, EXECUTE exclusivamente authenticated.
Se revoca el permiso por defecto PUBLIC y no se concede EXECUTE a anon/service_role.
No se amplían permisos directos, USAGE del esquema privado ni políticas RLS.
Todos los filtros de compras/clases/créditos derivan del alumno obtenido en servidor.
Los datos se construyen con una lista explícita de campos, nunca row_to_json(*) sobre tablas.

## 3. Migración / endpoint

Nueva migración incremental: `202609290007_portal_my_data.sql`, aplicada en Development.
Crea solo `public.portal_my_data()` y su permiso/comentario. No crea tablas, índices
ni nuevas Edge Functions. Las ocho migraciones anteriores permanecen sin cambios.

## 4. Datos que muestra

- Perfil: nombre, email, idioma, país, nivel de español.
- Créditos: disponibles, reservados, consumidos, vencidos; próxima expiración de una
  unidad disponible. Si existe deuda histórica de revisión, se muestra el contador.
- Compras propias activadas y pendientes: oferta, número de clases en el nombre del
  plan, precio/moneda, fecha de creación o activación, expiración y estado.
- Próximas clases: futuras o en curso con estado pending/confirmed y no resueltas.
- Historial: pasadas, canceladas (aunque su fecha sea futura), realizadas/no-show
  cuando existe resolución. Una clase pasada sin resolución NO se inventa como realizada.
- Las fechas usan Intl y la zona IANA del navegador, visible en pantalla. La base
  conserva instantes UTC y reglas originales de Europe/Warsaw.

Reutiliza `student_credit_balances` sin alterar su cálculo. Las unidades vencidas y
pendientes de revisión no cuentan como disponibles. La próxima expiración considera
la expiración efectiva del crédito, incluida la excepción de profesor aprobada en 2B.

No se devuelven IDs de alumno/Auth/reserva/compra/crédito ni identificadores externos
de pagos/eventos, fingerprints, notas internas o datos de otro alumno.

**Límite deliberado:** las reservas de invitado con student_id NULL no se asocian por
email, ni se modifican retrospectivamente. Aparecen solo las clases explícitamente
vinculadas al alumno. El flujo Fase 1 continúa siendo independiente; enlazar reserva
+ alumno + crédito de forma transaccional pertenece al siguiente paso autorizado.

## 5. Sesión

`acceso.html` pide email y llama a la puerta genérica existente; nunca usa signup/OTP
público para crear cuentas. `auth-callback.html` recibe el enlace y deja al SDK procesar
la sesión. Después verifica Auth y elegibilidad antes de entrar en `mis-clases.html`.
El callback limpia también las URLs fallidas; no deja tokens en parámetros propios.

Se incluye la distribución oficial UMD **@supabase/supabase-js 2.117.2**, fijada y local,
con licencia MIT e integridad npm verificada (ver vendor/README.md). Es la dependencia
necesaria para no implementar manualmente persistencia, refresh, locks o eventos Auth.
No hay framework, CDN en ejecución ni proceso de build.

SDK: persistSession y autoRefreshToken activados, debug desactivado; detectSessionInUrl
solo en callback. Se mantiene el flujo de invitación/fragmento ya probado en 2B.
El SDK es dueño de `sebaspanish-development-auth` en su almacenamiento estándar de
navegador. La aplicación NO copia tokens en storage propio, HTML, logs ni query params.
Un refresh token sí necesita persistir dentro del almacenamiento gestionado por el SDK
para restaurar sesión; esto no equivale a una cookie HttpOnly de un backend SSR.

`getSession()` restaura/renueva, pero no se usa como prueba suficiente de identidad:
`getUser()` verifica con Auth y la RPC vuelve a autorizar en PostgreSQL. El portal
revalida al volver a la pestaña/BFCache y al vencer el token; esconde/elimina el DOM
privado al salir de la página, ante error o logout. Un contador de generación evita
que respuestas antiguas vuelvan a pintar datos después de cambiar de sesión.

Los eventos Auth se manejan sin esperar llamadas async dentro del lock del SDK.
Logout usa `auth.signOut({scope:'local'})`, comprueba la eliminación de la sesión y
redirige a acceso; los eventos entre pestañas retiran datos en las demás pestañas.
También se probó pérdida de conexión al revocar: el SDK elimina la sesión local.
Si falla la revocación remota, no se afirma que el servidor haya revocado el refresh.
Como en Supabase Auth, un access JWT emitido no se revoca individualmente antes de su
expiración: no se promete invalidación remota instantánea de un token ya extraído.

Un fallo de renovación anticipada no expulsa una sesión cuyo token sigue válido;
al caducar realmente y fallar el refresh, se vuelve a acceso. No hay fallback demo.

## 6. Frontend y alcance visual

Nuevos: acceso.html, mis-clases.html, portal-client.js, portal-session.js, portal.js,
portal-i18n.js, portal.css y vendor/ con distribución/licencia/procedencia.
Actualizados: auth-callback.html y auth-callback.js para la sesión persistente.

Se reutilizan estilo base, fuente, variables de marca, logo, navbar y selector de
idiomas existentes. CSS nuevo está limitado a `.portal-page`/clases del portal.
Los datos entran por textContent, no por HTML. Las páginas tienen noindex, no-referrer,
CSP restringida sin scripts inline/eval y rutas relativas. ES/EN/PL cubren etiquetas,
estados, fechas, monedas y errores sin tocar los diccionarios del home/reservas.

Solo `http://127.0.0.1:4181` está habilitado por la configuración del portal. URLs:
- http://127.0.0.1:4181/sebaspanishv2/acceso.html
- http://127.0.0.1:4181/sebaspanishv2/mis-clases.html

Sin sesión la segunda redirige al acceso. No se ha añadido un enlace nuevo al navbar
del home ni se ha convertido esta fase en una publicación pública.

## 7. Pruebas

- Node: 64/64 (29 previas de API/reservas/i18n, 20 puerta de acceso 2B, 5 callback
  actualizadas al SDK conservando sus comprobaciones de seguridad, 10 nuevas de sesión).
- SQL desechable PostgreSQL WASM ya disponible: booking.sql, 101 assertions créditos,
  70 de acceso 2B y 69 nuevas de datos propios aprobadas. Ningún motor instalado.
- Development PostgreSQL: suites créditos/portal/portal-data aprobadas con rollback.
- HTTP con Auth real: A y B reciben exclusivamente sus datos; usuario sin vínculo y
  anónimo rechazados; student_id/email/p_student_id extras rechazados; no IDs externos;
  saldos, próximas/historial y compras correctos; cabecera no-store comprobada.
- Navegador y SDK real: callback válido, URL limpia, recarga, rotación real del refresh,
  logout y propagación entre pestañas. Respuesta genérica de formulario con mock.
- ES/EN/PL en 360/768/1024/1440: sin overflow, logout visible; consola sin errores
  en el recorrido correcto, ningún recurso local roto.
- Navegador con HTTP simulado, SDK real: foco/idioma por teclado, 390/1440, nombres
  largos/HTML malicioso renderizados como texto, error de backend sin datos antiguos,
  retry, caducidad real simulada del reloj y refresh rechazado, logout con error remoto.
- Concurrencia existente 2A: tres escenarios / cuatro resultados Node aprobados y
  limpieza: misma activación, mismo crédito entre dos reservas, reintento idempotente.
- Disponibilidad existente: prueba y planes 1/4/8 responden 200/source=live.
- Hashes de home/reservas/CSS/traducciones/migraciones/Edge anteriores intactos.

La primera ejecución de booking.sql en Development falló en su expectativa de que
solo existieran tres slots: ese test asume una base vacía, mientras Development ya
tiene disponibilidad legítima. Su transacción se revirtió. NO se borraron slots
existentes ni se cambió la lógica para hacer pasar el test; se ejecutó satisfactoriamente
en la base desechable. El test legado concurrency.test.mjs sigue requiriendo PostgreSQL
local desechable; no se presenta como ejecutado en esta fase. La concurrencia 2A arriba
sí fue real en Development.

Comandos desde V2:

```sh
node --test reservas-data.test.mjs i18n.test.mjs booking-api.test.mjs \
  supabase/tests/portal-access.test.mjs supabase/tests/auth-callback.test.mjs \
  supabase/tests/portal-session.test.mjs
supabase db query --linked --file supabase/tests/portal-data.sql --output json
```

Prueba de navegador repetible sin credenciales ni envío de emails, con el servidor
local ya iniciado y una instalación existente de Playwright:

```sh
PLAYWRIGHT_MODULE=/ruta/existente/playwright/index.mjs \
  node --test supabase/tests/portal-browser.test.mjs
```

Este último archivo se omite deliberadamente sin PLAYWRIGHT_MODULE; no instala
navegadores. Intercepta todas las solicitudes a Supabase con fixtures, no prueba una
cuenta real. Los recorridos de Auth/HTTP reales anteriores se ejecutaron aparte.

## 8. Datos técnicos y limpieza

Pruebas SQL: todo rollback. Prueba real: tres alumnos técnicos únicos, compras/créditos,
reservas/slots identificados `phase2c-only`, tres identidades Auth técnicas. Usó
Admin generate_link para invitaciones de prueba y verify para JWT reales; **no envió
emails** ni cambió la allowlist de 2B. Ninguno representa un pago real.

Limpieza exacta, por UUID y referencias técnicas, siguiendo FK. Resultado comprobado:
cero alumnos, compras, reservas e identidades de esa prueba; los créditos/asignaciones/
eventos y slots relacionados se retiraron antes. Se conservan logs de auditoría Auth.
No se tocaron clientes reales. La suite de concurrencia limpió sus propios fixtures.

## 9. Archivos modificados y preservados

Nuevos: migración 007; tests/portal-data.sql; tests/portal-session.test.mjs;
tests/portal-browser.test.mjs; frontend enumerado arriba; este PHASE2C.md.
Modificados: auth-callback.html, auth-callback.js, tests/auth-callback.test.mjs,
BUSINESS_RULES.md y supabase/README.md (estado/documentación).

No se editó ninguna migración anterior, Edge/helper 1/2B, configuración de reservas,
configuración Auth/CORS, home, style.css, script.js, reservas ni sus traducciones.
2B pasa de callback técnico no persistente a la sesión solicitada para 2C; no se rehace
su lógica server-side de elegibilidad, creación de identidad o email.

## 10. Pendientes antes de pagos / siguiente paso

Siguiente paso recomendado, SIN implementarlo: definir y probar una operación
transaccional autenticada para reservar/reprogramar con crédito, derivando al alumno
de auth.uid(), asignando student_id y evitando consumir/devolver unidades parcialmente.

Decidir una migración/reconciliación explícita de reservas antiguas sin vínculo;
no equiparar automáticamente email coincidente con autorización histórica.

Antes de producción: HTTPS/dominio/orígenes y redirects aprobados, SMTP/entregabilidad,
protección contra abuso, observabilidad sin datos personales, cabeceras del hosting,
política de duración/revocación de sesión, pruebas de carga y paginación de historiales
cuando el volumen lo requiera. La RPC actual devuelve la instantánea completa de un
solo alumno; no se ha construido paginación innecesaria para este primer alcance.

Pagos y webhooks verificados, compra desde portal, materiales/tareas, Calendar, DELE,
cancelaciones/reprogramación visual y emails comerciales siguen SIN implementar.

## Referencias verificadas

- https://supabase.com/docs/reference/javascript/initializing
- https://supabase.com/docs/reference/javascript/auth-getsession
- https://supabase.com/docs/reference/javascript/auth-signout
- Código de la distribución oficial fijada, incluidos refresh y borrado local en logout.
