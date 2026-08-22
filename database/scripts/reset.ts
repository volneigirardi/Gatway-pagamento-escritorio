if (process.env["NODE_ENV"] === "production") {
  console.error("db:reset is not allowed in production");
  process.exit(1);
}

console.log(
  "Reset script placeholder. Implement with explicit confirmation in development only.",
);
