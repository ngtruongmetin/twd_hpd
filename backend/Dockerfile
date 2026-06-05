FROM node:22-bookworm-slim

WORKDIR /app/backend

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/. ./

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "server.js"]
