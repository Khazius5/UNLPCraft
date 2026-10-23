# UNLP Craft Discord Bot

Bot de Discord para gestionar roles de la comunidad, recompensas por boosts y notificaciones de compras. La entrega de rangos comprados se realiza **solo en Discord**; la conexión con Minecraft se conserva únicamente para las recompensas de boosters.

[Ver Patch Notes](./PatchNotes.MD)

## Funciones

### Rangos por compra

- Asigna el rol de Discord correspondiente a los productos `rango_oro`, `rango_diamante`, `rango_netherita` y `rango_netherite_plus`.
- Si el usuario sube de rango, retira los roles de rango anteriores.
- Netherite+ requiere el rol Netherite. Si ambos se compran juntos, asigna ambos; el rol Netherite+ vence a los 30 días y el Netherite base se conserva.
- El backend procesa y confirma los pagos de Mercado Pago. El bot consulta sus notificaciones de compra cuando `BACKEND_URL` está configurada y asigna el rol de Discord correspondiente.

### Recompensas por boosters

- Detecta los mensajes de boost del servidor y registra una recompensa pendiente.
- El booster la reclama con `/reclamar-boost`, indicando su nickname de Minecraft.
- Mediante RCON, entrega dinero y un grupo temporal de LuckPerms; en Discord, asigna el rol Diamante durante 30 días.
- Guarda las recompensas pendientes y los vencimientos en `data/boosts.json`. El bot revisa periódicamente y retira los roles de Discord vencidos.

> Las recompensas de Minecraft son exclusivas de los boosters. Los pagos no usan RCON ni asignan rangos de Minecraft.

## Requisitos

- Node.js 18 o superior.
- Una aplicación y un bot de Discord agregados al servidor.
- Un backend que procese los pagos y exponga las notificaciones para habilitar el consumidor de compras (opcional).
- RCON habilitado en el servidor de Minecraft para entregar recompensas de boosters.

## Instalación

1. Cloná el repositorio y entrá en la carpeta del proyecto.
2. Instalá las dependencias:

   ```bash
   npm install
   ```

3. Creá un archivo `.env` en la raíz del proyecto. Completá las variables necesarias de las secciones siguientes; no compartas ni subas este archivo con credenciales reales.
4. Configurá el bot y los permisos de Discord.
5. Iniciá el bot:

   ```bash
   npm run dev
   ```

   Para ejecutarlo sin Nodemon:

   ```bash
   node src/index.js
   ```

El servidor HTTP escucha en el puerto `3000` por defecto. Podés cambiarlo con `PORT`.

## Variables de entorno

### Discord (necesarias)

| Variable | Descripción |
| --- | --- |
| `DISCORD_TOKEN` | Token del bot. |
| `GUILD_ID` | ID del servidor donde opera el bot y registra `/reclamar-boost`. |
| `ROLE_ID_ORO` | ID del rol de Discord Rango Oro. |
| `ROLE_ID_DIAMANTE` | ID del rol de Discord Rango Diamante. |
| `ROLE_ID_NETHERITE` | ID del rol de Discord Rango Netherite. |
| `ROLE_ID_NETHERITE_PLUS` | ID del rol de Discord Rango Netherite+. |

### Boosters y Minecraft (necesarias para entregar recompensas de Minecraft)

| Variable | Descripción |
| --- | --- |
| `RCON_HOST` | Host del servidor Minecraft. |
| `RCON_PORT` | Puerto RCON. |
| `RCON_PASSWORD` | Contraseña RCON. |

### Compras desde el backend (opcionales)

El consumidor se inicia únicamente cuando `BACKEND_URL` está definida.

| Variable | Descripción |
| --- | --- |
| `BACKEND_URL` | URL base del backend. El bot consulta sus rutas `/api/payments/...` y `/api/purchase-notifications/...`. |
| `BACKEND_INTERNAL_KEY` | Clave enviada en el encabezado `X-Api-Key`. |
| `CONSUMER_ID` | Identificador del consumidor; por defecto `unlp-craft-dsbot`. |

### Vinculación OAuth con Discord (si se usa el flujo de la tienda)

| Variable | Descripción |
| --- | --- |
| `CLIENT_ID` | ID de la aplicación de Discord. |
| `DISCORD_CLIENT_SECRET` | Client secret de la aplicación. |
| `DISCORD_LINK_SECRET` | Secreto privado para firmar el token de vinculación. |
| `PUBLIC_URL` | URL pública base del bot, sin `/` al final. |
| `FRONT_ORIGINS` | Orígenes permitidos para `returnTo`, separados por comas. |

En el portal de desarrolladores de Discord, registrá como redirect URI:

```text
<PUBLIC_URL>/auth/discord/callback
```

Para generar un `DISCORD_LINK_SECRET` aleatorio:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

### Otras

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto HTTP. Por defecto `3000`. |

## Configuración de Discord

- Habilitá los intents de servidor y miembros (`Guilds`, `GuildMembers`) y mensajes de servidor (`GuildMessages`) en el Developer Portal.
- Dale al bot permiso para ver el servidor y administrar roles.
- Ubicá el rol del bot por encima de los roles de rango y boosters que deba asignar o quitar.
- Configurá los IDs de roles en las variables `ROLE_ID_*` del `.env`; los nombres y precios están en `src/config/ranks.js`. Los beneficios por booster están en `src/config/boosts.js`.
- Mantené el bot en el servidor indicado por `GUILD_ID`.

Los IDs de Discord son identificadores de configuración, no credenciales secretas; se leen desde `.env` para evitar valores específicos del servidor en el código. El `.env` está excluido de Git y no se debe publicar.

## Rutas HTTP

| Ruta | Uso |
| --- | --- |
| `GET /auth/discord` | Inicia OAuth de Discord para vincular una cuenta desde la tienda. Requiere `returnTo` permitido por `FRONT_ORIGINS`. |
| `GET /auth/discord/callback` | Callback OAuth; devuelve al frontend un token firmado en el fragmento de la URL. |

## Configuración de productos y recompensas

- `src/config/ranks.js`: nombres, precios, IDs de roles de Discord y requisito/duración de Netherite+.
- `src/services/purchases.js`: mapeo de IDs de productos del backend, reglas de reemplazo de roles y vencimiento de Netherite+.
- `src/config/boosts.js`: dinero, rango de Discord/Minecraft, duración y permiso de tag por cantidad de boosts.
- `src/services/boosts.js`: entrega y vencimiento de las recompensas de booster.

## Estado actual y notas

- La confirmación de pagos y el webhook de Mercado Pago pertenecen al backend. Este bot no recibe notificaciones de pago directamente; consume la cola de compras aprobadas del backend para entregar roles.
- El consumidor del backend procesa notificaciones cada 15 segundos y reconcilia pagos pendientes aproximadamente cada minuto.