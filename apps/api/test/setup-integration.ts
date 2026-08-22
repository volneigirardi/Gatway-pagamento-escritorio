import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";

let postgresContainer: StartedTestContainer;
let redisContainer: StartedTestContainer;

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
  process.env.JWT_SECRET = "test-secret-32-bytes-long-for-tests-only";
  process.env.CORS_ORIGINS = "http://localhost:3004";
  process.env.NODE_ENV = "test";
}

export async function teardown(): Promise<void> {
  await postgresContainer?.stop();
  await redisContainer?.stop();
}
