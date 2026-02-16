// Database client
// apps/api/src/db.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
