FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --only=production

COPY index.js ./

VOLUME /app/data

ENV NODE_ENV=production
ENV PROBE_CREDENTIALS_FILE=/app/data/.probe-credentials.json

CMD ["node", "index.js"]
