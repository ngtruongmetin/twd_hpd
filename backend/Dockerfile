FROM node:22-bookworm-slim

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev
RUN npm rebuild sqlite3 --build-from-source

COPY backend/. ./

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
