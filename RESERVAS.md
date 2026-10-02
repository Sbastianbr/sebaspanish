# Reservas de SebaSpanish

Frontend incremental, sin servicios externos, pagos ni reservas reales.
El home permanece intacto. Los enlaces existentes `reservar.html?tipo=1a1&plan=1|4|8`
preseleccionan el pack. `tipo=prueba` selecciona 30 minutos gratis.
`tipo=dele&nivel=A1|A2|B1|B2|C1|C2` prepara el nivel, sin asignar precios de 1 a 1.

## Archivos y responsabilidades

- `reservar.html`: navbar compartido y pasos semánticos del formulario.
- `reservas.css`: estilos exclusivos de reservas; reutiliza variables de `style.css`.
- `reservas.js`: estado, render, validación, idiomas ES/EN/PL y navegación.
- `reservas-data.js`: catálogo, adaptador asíncrono, fechas UTC y objeto de reserva.
- `reservas-data.test.mjs`: pruebas sin dependencias (`node --test reservas-data.test.mjs`).

## Disponibilidad y demostración

La fuente normal `unconnected` devuelve cero horarios. No existe una agenda implícita.
El botón **Probar flujo de demostración** activa explícitamente nueve fixtures futuros
para revisar calendario, formulario y confirmación visual. No son citas ofrecidas.
Salir de la demostración o cambiar de servicio limpia la selección de horario.
DELE queda pendiente de catálogo, duración, precio y disponibilidad propios.

Reemplazar el adaptador de `reservas-data.js` por una API propia asíncrona.
Entrada: tipo, plan y rango de consulta. Respuesta prevista:

```json
{
  "source": "live",
  "slots": [
    { "id": "opaque-slot-id", "startAt": "2026-10-25T09:00:00Z", "endAt": "2026-10-25T10:00:00Z" }
  ]
}
```

Todos los instantes usan ISO UTC, nunca horas locales sin zona. `Intl` agrupa los días
y presenta horas en la zona IANA seleccionada por el alumno. El offset mostrado se
calcula para cada sesión, incluyendo DST. Cambiar de zona conserva el mismo instante.
No deducir la zona desde el idioma, ni usar el offset actual para fechas futuras.
El navegador maneja carga, ausencia de horarios, error/reintento y respuestas obsoletas.

## Confirmación y datos

`prepareBooking` es el punto de integración futuro. Actualmente devuelve únicamente
`draft_local`, con `slotId`, `startAt`, `endAt`, zona IANA, tipo, plan, sesiones,
precio orientativo, moneda PLN y datos del alumno. El resumen es temporal en memoria:
no hay envío, almacenamiento de datos personales, email, evento ni enlace Meet.
El pack selecciona la primera sesión; la organización de las restantes queda pendiente.

## Pendiente para producción

1. Definir y conectar catálogo DELE y reglas de agenda reales (duración, margen,
   antelación, festivos, cancelaciones y horizonte de reserva).
2. API y base de datos: validar todos los campos, recalcular precio/duración en servidor,
   revalidar disponibilidad al confirmar y crear la reserva mediante una transacción
   con protección contra doble reserva, reintentos y claves de idempotencia.
3. Integrar Google Calendar y Google Meet desde el servidor, con credenciales fuera del
   frontend; definir qué hacer si falla la creación del evento o de la videollamada.
4. Email de confirmación y estados de entrega, enviados tras confirmación real.
5. Elegir proveedor de pagos y reglas de packs antes de implementar cobros/webhooks.
6. Definir privacidad, conservación de datos, protección antispam y límites de solicitudes.
7. Mostrar «reserva confirmada» exclusivamente al recibir una confirmación válida del
   backend. Nunca transformar un fixture demo ni un borrador local en una plaza real.

Ninguna integración externa está habilitada en esta fase.

## Pulido del flujo demo

Los pasos se mantienen como **Clase → Horario → Tus datos → Revisar → Listo**, con
sus equivalentes en EN/PL. El resumen lateral omite datos redundantes; el paso Revisar
incluye los datos completos. Cambiar tipo, plan o nivel DELE limpia el horario previo.
El plan de ocho clases conserva su acento verde; DELE mantiene el violeta.

La zona se detecta automáticamente y no cambia con el idioma. Su lectura compacta usa
nombres localizados de regiones horarias mediante Intl, sin un diccionario de ciudades;
si no se obtiene un nombre fiable, se muestra el ID IANA. El offset corresponde a la
sesión seleccionada, al día elegido o a hoy, en ese orden. El selector IANA completo
solo aparece al pulsar «Cambiar zona horaria» y se cierra con el mismo control o Escape.

La pantalla Listo identifica explícitamente el resultado como demostración sin bloqueo
de horario, pago, email ni reserva guardada. El adaptador rechaza respuestas con formato
incorrecto y filtra entradas inválidas. Antes de crear el borrador se revalidan también
la duración, la disponibilidad y la fecha local de la sesión.
