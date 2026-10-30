package pro.unlpcraft.link;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletionException;
import java.util.logging.Level;
import java.util.Locale;
import java.util.stream.Stream;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.PluginCommand;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

public final class UNLPCraftLinkPlugin extends JavaPlugin implements CommandExecutor, TabCompleter {
    private static final String LINK_USAGE = "Uso: /discord link <codigo> o /discord sync";
    private static final String LINK_CODE_PATTERN = "[A-Za-z0-9-]{6,128}";

    private HttpClient httpClient;
    private LuckPerms luckPerms;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(getTimeoutSeconds()))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        luckPerms = LuckPermsProvider.get();

        PluginCommand discordCommand = getCommand("discord");
        if (discordCommand == null) {
            getLogger().severe("El comando discord no está declarado en plugin.yml.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        discordCommand.setExecutor(this);
        discordCommand.setTabCompleter(this);
        getLogger().info("Plugin habilitado. Comandos disponibles: /discord link <codigo> y /discord sync");
    }

    @Override
    public List<String> onTabComplete(
            CommandSender sender,
            Command command,
            String alias,
            String[] args
    ) {
        if (args.length != 1) {
            return List.of();
        }

        String input = args[0].toLowerCase(Locale.ROOT);
        return Stream.of("link", "sync")
                .filter(subcommand -> subcommand.startsWith(input))
                .toList();
    }

    @Override
    public boolean onCommand(
            CommandSender sender,
            Command command,
            String label,
            String[] args
    ) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Este comando solo puede usarlo un jugador.");
            return true;
        }

        boolean isLink = args.length == 2 && args[0].equalsIgnoreCase("link");
        boolean isSync = args.length == 1 && args[0].equalsIgnoreCase("sync");
        if (!isLink && !isSync) {
            player.sendMessage(LINK_USAGE);
            return true;
        }

        String code = isLink ? args[1] : null;
        if (isLink && !code.matches(LINK_CODE_PATTERN)) {
            player.sendMessage("El código no tiene un formato válido. Pedí uno nuevo desde Discord.");
            return true;
        }

        URI endpoint = getLinkEndpoint();
        String apiKey = getConfig().getString("api-key", "").trim();
        if (endpoint == null || apiKey.isEmpty() || apiKey.equals("REEMPLAZAR")) {
            player.sendMessage("La integración de vinculación todavía no está configurada.");
            return true;
        }

        UUID playerId = player.getUniqueId();
        String playerName = player.getName();
        player.sendMessage(isSync
                ? "Sincronizando tus grupos de LuckPerms con Discord..."
                : "Verificando tu cuenta y tus grupos de LuckPerms...");

        luckPerms.getUserManager().loadUser(playerId)
                .thenCompose(user -> sendAccountRequest(endpoint, apiKey, isSync ? "sync" : "link", code,
                        playerId, playerName, user))
                .whenComplete((response, error) -> Bukkit.getScheduler().runTask(this, () -> {
                    if (!player.isOnline()) {
                        return;
                    }
                    if (error != null) {
                        Throwable cause = error instanceof CompletionException && error.getCause() != null
                                ? error.getCause()
                                : error;
                        getLogger().log(Level.WARNING, "Falló la solicitud de vinculación de Minecraft.", cause);
                        player.sendMessage("No se pudo completar la vinculación. Probá de nuevo más tarde.");
                        return;
                    }

                    if (response.statusCode() >= 200 && response.statusCode() < 300) {
                        player.sendMessage(isSync
                                ? "¡Tus roles de Discord fueron sincronizados con tus grupos actuales!"
                                : "¡Cuenta vinculada! Ya podés cerrar este mensaje.");
                    } else if (isSync && response.statusCode() == 404) {
                        player.sendMessage("Tu cuenta todavía no está vinculada. Usá /link en Discord y luego /discord link <codigo>.");
                    } else if (response.statusCode() == 400 || response.statusCode() == 401
                            || response.statusCode() == 403 || response.statusCode() == 404
                            || response.statusCode() == 409) {
                        player.sendMessage("No se pudo vincular. Revisá que el código sea válido y no haya vencido.");
                    } else {
                        getLogger().warning("El endpoint de vinculación respondió HTTP " + response.statusCode() + ".");
                        player.sendMessage("El servicio de vinculación no está disponible. Probá más tarde.");
                    }
                }));
        return true;
    }

    private java.util.concurrent.CompletionStage<HttpResponse<String>> sendAccountRequest(
            URI endpoint,
            String apiKey,
            String action,
            String code,
            UUID playerId,
            String playerName,
            User user
    ) {
        List<String> groups = user.getInheritedGroups(user.getQueryOptions()).stream()
                .map(Group::getName)
                .distinct()
                .sorted()
                .toList();

        StringBuilder body = new StringBuilder("{");
        body.append("\"action\":\"").append(action).append("\",");
        if (code != null) {
            body.append("\"code\":\"").append(escapeJson(code)).append("\",");
        }
        body.append("\"player\":{\"uuid\":\"").append(playerId)
                .append("\",\"name\":\"").append(escapeJson(playerName)).append("\"},")
                .append("\"groups\":[")
                .append(groups.stream().map(group -> "\"" + escapeJson(group) + "\"")
                        .reduce((left, right) -> left + "," + right)
                        .orElse(""))
                .append("]}");

        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(getTimeoutSeconds()))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json; charset=utf-8")
                .header("X-Api-Key", apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString());
    }

    private URI getLinkEndpoint() {
        String configured = getConfig().getString("link-endpoint", "").trim();
        try {
            URI uri = URI.create(configured);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || uri.getHost() == null
                    || uri.getUserInfo() != null
                    || uri.getFragment() != null) {
                throw new IllegalArgumentException("El endpoint debe ser una URL HTTPS pública.");
            }
            return uri;
        } catch (IllegalArgumentException error) {
            getLogger().warning("Configuración link-endpoint inválida; se requiere una URL HTTPS.");
            return null;
        }
    }

    private int getTimeoutSeconds() {
        return Math.max(1, Math.min(60, getConfig().getInt("request-timeout-seconds", 10)));
    }

    private static String escapeJson(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) {
                        escaped.append("\\u%04x".formatted((int) character));
                    } else {
                        escaped.append(character);
                    }
                }
            }
        }
        return escaped.toString();
    }
}
