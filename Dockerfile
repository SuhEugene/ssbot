FROM node:20-alpine AS base
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
RUN apk add --update --no-cache libc6-compat
RUN apk add --update --no-cache pkgconf
RUN apk add --update --no-cache make build-base cairo-dev pango-dev libjpeg-turbo-dev giflib-dev librsvg-dev
RUN apk add --update --no-cache ffmpeg

ENV PYTHONUNBUFFERED=1
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools

COPY ./package.json ./pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS deploy
COPY . .
VOLUME ./plugs /app/plugs

CMD pnpm start
