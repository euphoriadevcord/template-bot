import {
  ApplicationCommandOptionType,
  GatewayIntentBits,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { AppContext } from "./context";
import type { AnyComponent, CommandDef, JobDef, ModuleDef } from "./define";

export interface ScheduledJob {
  id: string;
  job: JobDef;
  ctx: AppContext;
}

export interface Registry {
  commands: Map<string, CommandDef>;
  components: Map<string, AnyComponent>;
  jobs: ScheduledJob[];
}

const sortByDependsOn = (modules: ModuleDef[]) => {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  const state = new Map<string, "visiting" | "done">();
  const sorted: ModuleDef[] = [];

  const visit = (m: ModuleDef, path: string[]) => {
    if (state.get(m.key) === "done") return;
    if (state.get(m.key) === "visiting") {
      throw new Error(`circular dependency: ${[...path, m.key].join(" -> ")}`);
    }

    state.set(m.key, "visiting");

    for (const dep of m.dependsOn ?? []) {
      const target = byKey.get(dep);
      if (!target) throw new Error(`module "${m.key}" depends on unknown "${dep}"`);
      visit(target, [...path, m.key]);
    }

    state.set(m.key, "done");
    sorted.push(m);
  };

  for (const m of modules) visit(m, []);

  return sorted;
};

const declaredSubcommands = (json: RESTPostAPIChatInputApplicationCommandsJSONBody) =>
  (json.options ?? []).flatMap((option) => {
    if (option.type === ApplicationCommandOptionType.Subcommand) return [option.name];
    if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
      return (option.options ?? []).map((sub) => `${option.name} ${sub.name}`);
    }

    return [];
  });

const validateCommand = (command: CommandDef) => {
  const name = command.data.name;
  const declared = declaredSubcommands(command.data.toJSON()).sort();
  const handled = Object.keys(command.subcommands ?? {}).sort();

  if (command.execute && declared.length > 0) {
    throw new Error(`/${name} declares subcommands but has execute`);
  }

  if (command.subcommands && declared.join() !== handled.join()) {
    throw new Error(`/${name} subcommands mismatch: declared [${declared}] handled [${handled}]`);
  }
};

export const collectIntents = (modules: ModuleDef[]) => [
  ...new Set([GatewayIntentBits.Guilds, ...modules.flatMap((m) => m.intents ?? [])]),
];

export const loadModules = async (modules: ModuleDef[], ctx: AppContext): Promise<Registry> => {
  const registry: Registry = { commands: new Map(), components: new Map(), jobs: [] };

  for (const m of sortByDependsOn(modules)) {
    const moduleCtx: AppContext = { ...ctx, logger: ctx.logger.child({ module: m.key }) };
    const handlers = await m.setup(moduleCtx);

    for (const command of handlers.commands ?? []) {
      validateCommand(command);

      if (registry.commands.has(command.data.name)) {
        throw new Error(`duplicate command /${command.data.name}`);
      }

      registry.commands.set(command.data.name, command);
    }

    for (const component of handlers.components ?? []) {
      if (!component.id.startsWith(`${m.key}:`)) {
        throw new Error(`component ${component.id} must start with "${m.key}:"`);
      }

      if (registry.components.has(component.id)) {
        throw new Error(`duplicate component ${component.id}`);
      }

      registry.components.set(component.id, component);
    }

    for (const listener of handlers.listeners ?? []) {
      ctx.bus.on(listener.event, (payload) => listener.handle(payload, moduleCtx));
    }

    for (const event of handlers.events ?? []) {
      const execute = event.execute as (c: AppContext, ...args: unknown[]) => Promise<void>;
      const run = (...args: unknown[]) =>
        void execute(moduleCtx, ...args).catch((err) =>
          moduleCtx.logger.error({ err, event: event.name }, "event failed"),
        );
        
      if (event.once) ctx.client.once(event.name, run);
      else ctx.client.on(event.name, run);
    }

    for (const job of handlers.jobs ?? []) {
      registry.jobs.push({ id: `${m.key}:${job.name}`, job, ctx: moduleCtx });
    }

    moduleCtx.logger.info("module loaded");
  }

  return registry;
};
