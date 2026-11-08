import { ContainerBuilder, type GuildMember, type User } from "discord.js";

type CardOptions = {
  member?: GuildMember | User;
};

export const baseCard = (title: string, options: CardOptions = {}) => {
  const container = new ContainerBuilder()
  const heading = `### ${title}`;

  if (options.member) {
    const avatar = options.member.displayAvatarURL({ size: 256 });
    container.addSectionComponents((section) =>
      section
        .addTextDisplayComponents((text) => text.setContent(heading))
        .setThumbnailAccessory((thumbnail) => thumbnail.setURL(avatar)),
    );
  } else {
    container.addTextDisplayComponents((text) => text.setContent(heading));
  }

  return container;
};

export const messageCard = (title: string, body: string, options: CardOptions = {}) =>
  baseCard(title, options).addTextDisplayComponents((text) => text.setContent(body));
