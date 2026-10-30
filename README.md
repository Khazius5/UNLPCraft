# UNLP Craft Discord Bot

Bot de Discord para gestionar recompensas de boosters. No procesa pagos, no consulta compras del backend y no ofrece el login OAuth de la tienda.

[Ver Patch Notes](./PatchNotes.MD)

## Funciones

### Recompensas por boosters

- Detecta los mensajes de boost del servidor y agrupa los boosts de cada usuario durante una ventana de 20 segundos.
- El booster reclama la recompensa con `/reclamar-boost`, indicando su nickname de Minecraft.
- Mediante RCON, entrega dinero y un grupo temporal de LuckPerms; en Discord, asigna el rol Diamante durante 30 días.
- Guarda recompensas pendientes, boosts en agrupación, derechos de roles y estados de entrega en `data/boosts.json`.
- Si una conexión RCON falla de forma ambigua, la operación queda en revisión manual y no se reenvía automáticamente para evitar duplicar recompensas.
- Reintenta retirar roles vencidos si Discord falla temporalmente.

### Vínculo de cuentas Minecraft↔Discord

- `/link` genera un código privado de un solo uso, válido durante cinco minutos. Se puede volver a usar para actualizar los roles tras cambios en LuckPerms.
- El jugador canjea el código en Minecraft con `/discord link <codigo>`; el plugin obtiene su UUID autenticado y grupos heredados de LuckPerms.
- `/discord sync` vuelve a consultar los grupos heredados actuales de LuckPerms y actualiza los roles Discord del UUID vinculado, sin necesitar otro código.
- `POST /api/minecraft/link` valida el secreto del plugin, canjea el código y guarda el vínculo en `data/account-links.json`.
- El bot asigna o retira únicamente los roles gestionados por este sincronizador, según el mapeo explícito del archivo JSON de configuración.
- Si LuckPerms envía varios rangos VIP heredados, solo se asigna el de mayor prioridad: Netherite+ > Netherite > Diamante > Oro. Los roles de facultad se sincronizan aparte.
- El mapeo editable de grupos y roles está en [`src/config/luckperms-role-map.json`](./src/config/luckperms-role-map.json); los grupos sin rol configurado se ignoran.
- El rol de booster no se incluye en el mapeo: Discord lo asigna automáticamente cuando una persona boostea el servidor.
- El proyecto del plugin Purpur está en [`minecraft-plugin/`](./minecraft-plugin/).

El hosting debe conservar `data/` entre reinicios y ejecutar una sola instancia del bot para mantener el estado de vínculos y códigos.

## Requisitos

- Node.js 18 o superior.
- Una aplicación y un bot de Discord agregados al servidor.
- RCON habilitado en el servidor de Minecraft.
- LuckPerms instalado en Minecraft para asignar el grupo temporal de la recompensa de booster.

## Instalación y ejecución

1. Instalá las dependencias:

   ```bash
   npm install
   ```

2. Configurá las variables de entorno indicadas abajo, usando `.env` localmente o el gestor de secretos del hosting.
3. Iniciá para producción:

   ```bash
   npm start
   ```

   Para desarrollo con reinicio automático:

   ```bash
   npm run dev
   ```

El servidor HTTP escucha en el puerto `3000` por defecto. Podés cambiarlo con `PORT`.

Para ejecutar las pruebas automatizadas:

```bash
npm test
```

## Variables de entorno

### Discord

| Variable | Descripción |
| --- | --- |
| `DISCORD_TOKEN` | Token del bot. |
| `GUILD_ID` | ID del servidor donde opera el bot y registra los comandos slash. |

### Minecraft / RCON

| Variable | Descripción |
| --- | --- |
| `RCON_HOST` | Host del servidor Minecraft. |
| `RCON_PORT` | Puerto RCON. |
| `RCON_PASSWORD` | Contraseña RCON. |

### Vínculo Minecraft↔Discord

| Variable | Descripción |
| --- | --- |
| `MINECRAFT_LINK_API_KEY` | Secreto compartido con el plugin; el bot lo valida en `X-Api-Key`. Debe configurarse también en `plugins/UNLPCraftLink/config.yml`. |

Generá `MINECRAFT_LINK_API_KEY` como un secreto aleatorio independiente (por ejemplo, con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), y cargá el mismo valor en el bot y el plugin. Configurá el endpoint del plugin como `https://<dominio-publico-del-bot>/api/minecraft/link`. Para cambiar los roles sincronizados, editá `src/config/luckperms-role-map.json` y reiniciá el bot.

### Opcionales

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto HTTP. Por defecto `3000`. |
| `NODE_ENV` | Configurá `production` en el hosting para desactivar las herramientas de prueba. |
| `DEV_TOOLS_KEY` | Clave opcional para la ruta local de simulación de boosts. No configurarla en producción. |

## Configuración de Discord

- Habilitá los intents de servidor y miembros (`Guilds`, `GuildMembers`) y mensajes de servidor (`GuildMessages`) en el Developer Portal.
- Dale al bot permiso para ver el servidor y administrar roles.
- Ubicá el rol del bot por encima de los roles que deba asignar o quitar.
- Configurá los IDs de roles de rangos y facultades en `src/config/luckperms-role-map.json`.
- Mantené el bot en el servidor indicado por `GUILD_ID`.
- Para el vínculo Minecraft, editá `src/config/luckperms-role-map.json`; el bot nunca asigna roles que no estén mapeados.

Los IDs de Discord son identificadores de configuración, no credenciales secretas. No publiques el token ni las contraseñas de RCON.

## Estado

- Las recompensas de compras y el OAuth de la tienda no forman parte de este bot.
- El servidor HTTP permanece activo; la ruta de prueba `/dev/fake-boost` solo se registra cuando existe `DEV_TOOLS_KEY` y `NODE_ENV` no es `production`.
- El comando `/reclamar-boost` procesa las recompensas que genera el sistema de boosts.
- `/link` y `/api/minecraft/link` vinculan cuentas; `/discord sync` vuelve a sincronizar los roles mapeados desde LuckPerms.
