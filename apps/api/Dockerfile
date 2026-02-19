FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/

RUN npm ci
RUN npx prisma generate
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
