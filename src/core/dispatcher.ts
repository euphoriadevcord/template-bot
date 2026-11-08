import {
  Events,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
} from "discord.js";
import type { AppContext } from "./context";
import type { ComponentKind, HandlerResult, SubcommandDef } from "./define";
import type { Registry } from "./loader";
import { replyError, type ComponentInteraction } from "./respond";

const kindOf = (interaction: ComponentInteraction): ComponentKind | null => {
  if (interaction.isButton()) return "button";
  if (interaction.isModalSubmit()) return "modal";
  if (interaction.isStringSelectMenu()) return "string-select";
  if (interaction.isUserSelectMenu()) return "user-select";
  if (interaction.isRoleSelectMenu()) return "role-select";
  if (interaction.isChannelSelectMenu()) return "channel-select";

  return null;
};

const subcommandKey = (interaction: ChatInputCommandInteraction<"cached">) => {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand(false);
  if (!sub) return null;

  return group ? `${group} ${sub}` : sub;
};

export const attachDispatcher = (registry: Registry, ctx: AppContext) => {
  const handleAutocomplete = async (interaction: AutocompleteInteraction<"cached">) => {
    await registry.commands.get(interaction.commandName)?.autocomplete?.(interaction, ctx);
  };

  const handleCommand = async (interaction: ChatInputCommandInteraction<"cached">) => {
    const command = registry.commands.get(interaction.commandName);
    if (!command) return ctx.logger.warn({ command: interaction.commandName }, "unknown command");

    const key = subcommandKey(interaction);
    const handler: SubcommandDef | undefined = key
      ? command.subcommands?.[key]
      : command.execute
        ? { execute: command.execute }
        : undefined;

    if (!handler) return ctx.logger.warn({ command: interaction.commandName, key }, "no handler");

    const ephemeral = handler.ephemeral ?? command.ephemeral ?? false;
    const defer = handler.defer ?? command.defer ?? true;

    if (defer) {
      await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    }

    const run = async (): Promise<HandlerResult> => {
      for (const guard of [...(command.guards ?? []), ...(handler.guards ?? [])]) {
        const denied = await guard(interaction, ctx);
        if (denied) return denied;
      }

      return handler.execute(interaction, ctx);
    };

    const result = await run();
    if (result) await replyError(interaction, result.error, defer ? ephemeral : undefined);
  };

  const handleComponent = async (interaction: ComponentInteraction) => {
    const [module, name, ...rest] = interaction.customId.split(":");
    const component = registry.components.get(`${module}:${name}`);
    if (!component) return ctx.logger.warn({ customId: interaction.customId }, "no component");
    if (component.kind !== kindOf(interaction)) {
      return ctx.logger.warn({ customId: interaction.customId }, "component kind mismatch");
    }

    let state: unknown;
    let key: string | undefined;
    let args = rest;

    if (component.state) {
      [key, ...args] = rest;
      if (!key) return replyError(interaction, "Время на ответ истекло!");

      const peek = await ctx.state.get<{ authorId?: string }>(key);
      if (!peek) return replyError(interaction, "Время на ответ истекло!");
      if (component.authorOnly && peek.authorId !== interaction.user.id) {
        return replyError(interaction, "Вы не являетесь автором этого взаимодействия!");
      }

      state = component.state === "take" ? await ctx.state.take(key) : peek;
      if (!state) return replyError(interaction, "Время на ответ истекло!");
    }

    const result = await component.handle(interaction as never, { state, args, key }, ctx);
    if (result) await replyError(interaction, result.error);
  };

  ctx.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.inCachedGuild()) return;

    try {
      if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);
      if (interaction.isChatInputCommand()) return await handleCommand(interaction);
      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        return await handleComponent(interaction);
      }
    } catch (err) {
      ctx.logger.error({ err, interaction: interaction.id }, "interaction failed");
      if (
        interaction.isChatInputCommand() ||
        interaction.isMessageComponent() ||
        interaction.isModalSubmit()
      ) {
        await replyError(interaction, "Что-то пошло не так, попробуй позже!").catch(() => {});
      }
    }
  });
};
