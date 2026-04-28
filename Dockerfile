# Build Stage 1: Frontend
FROM node:18-slim AS build-frontend
RUN apt-get update && apt-get install -y openssl
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build Stage 2: Backend & Production Image
FROM node:18-slim
RUN apt-get update && apt-get install -y openssl
WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm install --production
COPY server/ ./server/
COPY --from=build-frontend /app/client/dist ./server/public

EXPOSE 5000
CMD ["node", "server/server.js"]
