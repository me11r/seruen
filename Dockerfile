FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY public ./public
COPY lib ./lib
COPY data ./data
COPY scripts/build.mjs ./scripts/build.mjs
COPY server.mjs ./
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/dist ./
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
