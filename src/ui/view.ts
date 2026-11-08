import type { ContainerBuilder, MessageMentionOptions } from "discord.js";
import { messageCard } from "./card";

export type View = {
  components: ContainerBuilder[];
  ephemeral?: boolean;
  allowedMentions?: MessageMentionOptions;
};

export const view = (
  container: ContainerBuilder | ContainerBuilder[],
  options: Omit<View, "components"> = {},
): View => ({
  components: Array.isArray(container) ? container : [container],
  ...options,
});

export const errorView = (message: string): View =>
  view(messageCard("Ошибка", `> ${message}`), { ephemeral: true });
