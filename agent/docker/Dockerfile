FROM node:20-alpine

RUN apk add --no-cache iputils bind-tools curl

WORKDIR /app

COPY agent/infininoc-probe-agent.js /app/infininoc-probe-agent.js
COPY agent/package.json /app/package.json

ENV SERVER="http://127.0.0.1:3001"
ENV PROBE_ID=""
ENV TOKEN=""
ENV API_KEY=""

ENTRYPOINT ["node", "/app/infininoc-probe-agent.js"]
