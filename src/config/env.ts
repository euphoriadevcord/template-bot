const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing env ${name}`);
  
  return value;
};

export const loadConfig = () => ({
  isProduction: process.env.NODE_ENV === "production",
  token: required("DISCORD_TOKEN"),
  clientId: required("DISCORD_CLIENT_ID"),
  guildId: required("DISCORD_GUILD_ID"),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL"),
});

export type Config = ReturnType<typeof loadConfig>;
