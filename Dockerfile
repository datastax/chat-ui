# syntax=docker/dockerfile:1
# read the doc: https://huggingface.co/docs/hub/spaces-sdks-docker
# you will also find guides on how best to write your Dockerfile
FROM node:20 as builder-production

WORKDIR /app

COPY --link --chown=1000 package-lock.json package.json ./

COPY --link --chown=1000 . .

RUN npm install -g pm2

COPY --link --chown=1000 package.json /app/package.json

CMD pm2 start /app/build/index.js -i $CPU_CORES --no-daemon
