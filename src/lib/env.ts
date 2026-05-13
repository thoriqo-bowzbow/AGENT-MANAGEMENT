import "server-only";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export const env = {
  databaseUrl: () => requiredEnv("DATABASE_URL"),
  masterEncryptionKey: () => requiredEnv("MASTER_ENCRYPTION_KEY"),
  sessionSecret: () => requiredEnv("SESSION_SECRET"),
  internalApiToken: () => process.env.RIQO_INTERNAL_API_TOKEN,
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Riqo AI Hub",
};
