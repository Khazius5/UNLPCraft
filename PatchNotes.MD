# Patch Notes

Registro de cambios del bot. Esta primera entrada resume las diferencias entre el código actual y la versión que ya estaba versionada en GitHub al iniciar este registro. Las modificaciones descritas aquí son cambios locales hasta que se publiquen en el repositorio.

## 23-10-2026 — Configuración externa de roles

### Modificado

- `src/config/ranks.js`: los IDs de los roles de Discord ahora se leen desde `ROLE_ID_*` en `.env`; la aplicación informa explícitamente si falta alguna variable requerida.
- `README.md`: se documentaron las variables para los roles y se aclaró que `.env` no debe publicarse.

## 23-10-2026 — Funciones de compras y boosters

### Agregado

- Flujo de recompensas por boosts de Discord: detección de boosts, registro de recompensas pendientes y comando `/reclamar-boost`.
- Entrega de recompensas de booster: dinero y rango temporal en Minecraft mediante RCON/LuckPerms, además del rol temporal de Discord.
- Persistencia local del estado de recompensas, vencimientos y compras procesadas en `data/boosts.json`.
- Consumidor de notificaciones de compra aprobadas del backend, con confirmación del resultado del procesamiento.
- Asignación de roles de Discord para rangos comprados, con reemplazo de roles anteriores y vencimiento de Netherite+.
- Configuración de rangos y recompensas en `src/config/ranks.js` y `src/config/boosts.js`.
- Inicio de sesión OAuth de Discord para vincular una cuenta desde la tienda y servir archivos de `public/`.

### Modificado

- `src/index.js`: ahora inicia el servidor HTTP, sirve la tienda estática y registra las rutas de OAuth. Se habilitó el intent de mensajes requerido para detectar boosts.
- `src/events/ready.js`: ahora registra `/reclamar-boost`, inicia el consumidor de compras cuando se configura el backend y activa la tarea de vencimientos.
- `src/services/minecraft.js`: ahora serializa los comandos RCON, aplica timeout y reintenta ante fallos.
- `README.md`: se reemplazó el contenido inicial por documentación de funciones, instalación, configuración y rutas.

### Eliminado

- `src/events/guildMemberUpdate.js`: se retiró la asignación automática del grupo `booster` de LuckPerms al iniciar o terminar un boost. El handler no tenía una cuenta de Minecraft vinculada y su nick estaba fijado a `null`; las recompensas se reclaman ahora mediante el flujo explícito de boosters.

### Aclaración del flujo de pagos

El backend procesa y confirma los pagos de Mercado Pago. El bot consume las notificaciones de compras aprobadas y asigna roles de Discord; las compras no otorgan rangos ni ejecutan comandos en Minecraft. La integración con Minecraft permanece únicamente en las recompensas reclamadas por boosters.