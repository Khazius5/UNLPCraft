# UNLP Craft Link (plugin Purpur)

Plugin Java mínimo para vincular un jugador de Minecraft con una cuenta de Discord usando LuckPerms. Está configurado para la instalación reportada: Purpur `26.2.build.2633-stable`, Java 25 y LuckPerms API 5.5.

## Alcance actual

- Registra `/unlpcraftlink:discord link <codigo>` y `/unlpcraftlink:discord sync` en el servidor, incluso si otro plugin también registra `/discord`.
- Solo acepta comandos de jugadores, no de consola.
- Obtiene el UUID y nick de la sesión autenticada del jugador.
- Consulta los grupos heredados de LuckPerms desde su API.
- Envía el código, UUID, nick y grupos al endpoint HTTPS configurado, usando `X-Api-Key`.
- `/unlpcraftlink:discord sync` envía el UUID y los grupos actuales sin código; el bot solo sincroniza cuentas ya vinculadas.
- No registra el código ni la clave en logs.

## Endpoint del bot

El bot recibe la solicitud en `POST /api/minecraft/link`. Antes de desplegar ambos componentes, configurá `MINECRAFT_LINK_API_KEY` en el entorno del bot y el mismo valor en `api-key` en el plugin. Configurá los grupos y roles permitidos en `src/config/luckperms-role-map.json` del bot.

Solicitud `POST` a la URL configurada en `link-endpoint`:

```json
{
  "action": "link",
  "code": "CODIGO_DE_UN_SOLO_USO",
  "player": {
    "uuid": "UUID_AUTENTICADO_EN_MINECRAFT",
    "name": "NickDelJugador"
  },
  "groups": ["grupo_ejemplo"]
}
```

Para una sincronización posterior, el plugin envía el mismo formato pero con `"action": "sync"` y sin `code`. Si el UUID aún no está vinculado, el endpoint devuelve `404` y hay que completar primero `/link` en Discord y `/discord link <codigo>` en Minecraft.

Encabezados:

```text
Content-Type: application/json
X-Api-Key: <secreto compartido>
```

El endpoint valida la clave y el código, comprueba su vencimiento y uso único, y vincula el UUID con el usuario de Discord que generó el código. Los grupos sin rol configurado en el archivo de mapeo no otorgan roles. Un error al sincronizar roles devuelve un estado no exitoso; el plugin puede reintentar la solicitud sin crear un segundo vínculo.

Después de cambiar grupos en LuckPerms, el jugador ejecuta `/unlpcraftlink:discord sync` en Minecraft. El plugin envía los grupos actuales sin código y el bot actualiza los roles del UUID ya vinculado. Si el jugador aún no vinculó su cuenta, debe completar `/link` en Discord y `/unlpcraftlink:discord link <codigo>` primero.

## Compilar

Se requiere Gradle y JDK 25:

```bash
gradle build
```

El proyecto resuelve las dependencias de Purpur, LuckPerms, Mojang y PaperMC desde sus repositorios Maven correspondientes.

El JAR se genera en `build/libs/`. Copialo a la carpeta `plugins/` del servidor Purpur y reiniciá el servidor.

LuckPerms debe estar instalado antes de iniciar el plugin.

## Configuración

Al primer inicio se crea `plugins/UNLPCraftLink/config.yml`. Configurá:

- `link-endpoint`: URL HTTPS pública del endpoint del bot, no la URL de la tienda ni SFTP.
- `api-key`: mismo secreto interno que valide el endpoint del bot. Guardalo solo en el servidor; nunca lo subas a Git.
- `request-timeout-seconds`: tiempo máximo de espera HTTP.

La URL debe apuntar al dominio HTTPS público del bot, por ejemplo `https://bot.example.com/api/minecraft/link`. No uses la URL de la tienda ni una dirección SFTP.
