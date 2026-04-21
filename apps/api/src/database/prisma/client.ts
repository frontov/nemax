import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

function createPrismaAdapter() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create PrismaClient");
  }

  return new PrismaPg({ connectionString });
}

export class AppPrismaClient extends PrismaClient {
  constructor() {
    super({
      adapter: createPrismaAdapter(),
    });
  }
}

export type { Prisma } from "../../generated/prisma/client";
