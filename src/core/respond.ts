import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type MessageComponentInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { errorView, type View } from "@/ui/view";

export type ComponentInteraction =
  | MessageComponentInteraction<"cached">
  | ModalSubmitInteraction<"cached">;

export type Repliable = ChatInputCommandInteraction<"cached"> | ComponentInteraction;

const flagsOf = (v: View) =>
  v.ephemeral ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral : MessageFlags.IsComponentsV2;

const body = (v: View) => ({ components: v.components, allowedMentions: v.allowedMentions });

export const respond = async (interaction: Repliable, v: View) => {
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ ...body(v), flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (interaction.replied) {
    await interaction.followUp({ ...body(v), flags: flagsOf(v) });
    return;
  }

  await interaction.reply({ ...body(v), flags: flagsOf(v) });
};

export const update = async (interaction: ComponentInteraction, v: View) => {
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) return respond(interaction, v);
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ ...body(v), flags: MessageFlags.IsComponentsV2 });
    return;
  }

  await interaction.update({ ...body(v), flags: MessageFlags.IsComponentsV2 });
};

export const replyError = async (
  interaction: Repliable,
  message: string,
  deferredEphemeral?: boolean,
) => {
  const v = errorView(message);

  if (!interaction.deferred && !interaction.replied) {
    await interaction.reply({ ...body(v), flags: flagsOf(v) });
    return;
  }

  if (interaction.deferred && !interaction.replied && deferredEphemeral !== undefined) {
    if (deferredEphemeral) {
      await interaction.editReply({ ...body(v), flags: MessageFlags.IsComponentsV2 });
      return;
    }

    await interaction.deleteReply();
  }
  
  await interaction.followUp({ ...body(v), flags: flagsOf(v) });
};
