import { createClient, type RedisClientType } from "redis";

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

const createRedisClient = (): RedisClientType | null => {
  const url = process.env.REDIS_URL?.trim();

  if (!url) {
    return null;
  }

  return createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          return new Error("Redis reconnect limit reached");
        }

        return Math.min(retries * 100, 1_000);
      },
    },
  });
};

export const getRedisClient = async (): Promise<RedisClientType | null> => {
  if (!process.env.REDIS_URL?.trim()) {
    return null;
  }

  if (client?.isOpen) {
    return client;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        if (!client) {
          client = createRedisClient();
        }

        if (!client) {
          return null;
        }

        client.on("error", (error) => {
          console.warn("[redis] client error", error);
        });

        if (!client.isOpen) {
          await client.connect();
        }

        return client;
      } catch (error) {
        console.warn("[redis] failed to connect", error);
        client = null;
        return null;
      } finally {
        connectPromise = null;
      }
    })();
  }

  return connectPromise;
};
