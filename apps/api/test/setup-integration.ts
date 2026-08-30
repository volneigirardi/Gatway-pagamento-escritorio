import { generateKeyPairSync } from "node:crypto";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

const jwtKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let postgresContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;

export function getJwtTestKeys(): typeof jwtKeys {
  return jwtKeys;
}

export async function setup(): Promise<void> {
  postgresContainer = await new GenericContainer("postgres:18.4")
    .withEnvironment({
      POSTGRES_USER: "test",
      POSTGRES_PASSWORD: "test",
      POSTGRES_DB: "saas_test",
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  redisContainer = await new GenericContainer("redis:7.4-alpine")
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  process.env.DATABASE_URL = `postgres://test:test@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/saas_test`;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.JWT_PRIVATE_KEY = jwtKeys.privateKey;
  process.env.JWT_PUBLIC_KEY = jwtKeys.publicKey;
  process.env.JWT_ISSUER = "https://app.blupo.com.br";
  process.env.JWT_PLATFORM_AUDIENCE = "blupo-platform";
  process.env.JWT_TENANT_AUDIENCE = "blupo-tenant";
  process.env.JWT_KEY_ID = "integration-test-key";
  process.env.COOKIE_SECRET =
    "integration-cookie-secret-at-least-32-characters";
  process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  process.env.ARGON2_MEMORY_KIB = "8192";
  process.env.ARGON2_ITERATIONS = "1";
  process.env.ARGON2_PARALLELISM = "1";
  process.env.CORS_ORIGINS = "http://localhost:3004";
  process.env.NODE_ENV = "test";
}

export async function teardown(): Promise<void> {
  await postgresContainer?.stop();
  await redisContainer?.stop();
}
