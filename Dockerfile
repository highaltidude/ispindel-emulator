FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY server/ ./server/
COPY public/ ./public/
EXPOSE 3009
ENV PORT=3009
ENV TIME_MULTIPLIER=100
CMD ["node", "server/index.js"]
