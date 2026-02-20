FROM node:20-slim

WORKDIR /app

# Build shared package first
COPY packages/shared/package*.json ./packages/shared/
WORKDIR /app/packages/shared
RUN npm install

COPY packages/shared/ ./
RUN npm run build

# Build API
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm install
RUN npm install /app/packages/shared

COPY apps/api/prisma ./prisma/
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src/

RUN npx prisma generate
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
