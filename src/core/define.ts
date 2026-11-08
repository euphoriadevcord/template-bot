import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  GatewayIntentBits,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
} from "discord.js";
import type { Fail } from "@/lib/result";
import type { EventMap } from "@/runtime/bus";
import type { AppContext } from "./context";

export type HandlerResult = void | Fail<string>;

export type ChatInputHandler = (
  interaction: ChatInputCommandInteraction<"cached">,
  ctx: AppContext,
) => Promise<HandlerResult>;

export type Guard = ChatInputHandler;

type Behavior = {
  ephemeral?: boolean;
  defer?: boolean;
  guards?: Guard[];
};

export type SubcommandDef = Behavior & {
  execute: ChatInputHandler;
};

type CommandBase = Behavior & {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  autocomplete?: (interaction: AutocompleteInteraction<"cached">, ctx: AppContext) => Promise<void>;
};

export type CommandDef = CommandBase &
  (
    | { execute: ChatInputHandler; subcommands?: never }
    | { subcommands: Record<string, SubcommandDef>; execute?: never }
  );

export type ComponentInteractionMap = {
  button: ButtonInteraction<"cached">;
  modal: ModalSubmitInteraction<"cached">;
  "string-select": StringSelectMenuInteraction<"cached">;
  "user-select": UserSelectMenuInteraction<"cached">;
  "role-select": RoleSelectMenuInteraction<"cached">;
  "channel-select": ChannelSelectMenuInteraction<"cached">;
};

export type ComponentKind = keyof ComponentInteractionMap;

export type ComponentPayload<S> = {
  state: S;
  args: string[];
  key: string | undefined;
};

export interface ComponentDef<K extends ComponentKind, S> {
  id: `${string}:${string}`;
  kind: K;
  state?: S extends undefined ? never : "get" | "take";
  authorOnly?: S extends { authorId: string } ? boolean : never;
  handle: (
    interaction: ComponentInteractionMap[K],
    payload: ComponentPayload<S>,
    ctx: AppContext,
  ) => Promise<HandlerResult>;
}

export type Component<K extends ComponentKind, S> = ComponentDef<K, S> & {
  customId: (...parts: (string | number)[]) => string;
};

export type AnyComponent = Component<any, any>;

export interface EventDef<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (ctx: AppContext, ...args: ClientEvents[K]) => Promise<void>;
}

export interface ListenerDef<K extends keyof EventMap = keyof EventMap> {
  event: K;
  handle: (payload: EventMap[K], ctx: AppContext) => Promise<void>;
}

export interface JobDef {
  name: string;
  intervalSec: number;
  runOnStart?: boolean;
  run: (ctx: AppContext) => Promise<void>;
}

export interface ModuleHandlers {
  commands?: CommandDef[];
  components?: AnyComponent[];
  events?: EventDef<any>[];
  listeners?: ListenerDef<any>[];
  jobs?: JobDef[];
}

export interface ModuleDef {
  key: string;
  dependsOn?: string[];
  intents?: GatewayIntentBits[];
  setup: (ctx: AppContext) => ModuleHandlers | Promise<ModuleHandlers>;
}

const CUSTOM_ID_LIMIT = 100;

export const defineModule = (def: ModuleDef) => def;
export const defineCommand = (def: CommandDef) => def;
export const defineEvent = <K extends keyof ClientEvents>(def: EventDef<K>) => def;
export const defineListener = <K extends keyof EventMap>(def: ListenerDef<K>) => def;
export const defineJob = (def: JobDef) => def;

export const defineComponent = <K extends ComponentKind, S = undefined>(
  def: ComponentDef<K, S>,
): Component<K, S> => ({
  ...def,
  customId: (...parts) => {
    const id = [def.id, ...parts].join(":");
    if (id.length > CUSTOM_ID_LIMIT) throw new Error(`customId too long: ${id}`);

    return id;
  },
});
