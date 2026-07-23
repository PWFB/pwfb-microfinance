import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_postgresql://pwfb_microfinance_postgre_user:5AJvpBOpvE48N9iupH9Ej2cJaVrlSKA0@dpg-d9f2q8rtqb8s73bgc0f0-a/pwfb.
  },
});
