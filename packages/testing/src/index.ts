export function randomUuid(): string {
  return crypto.randomUUID();
}

export function randomEmail(): string {
  return `user-${randomUuid().slice(0, 8)}@example.com`;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
