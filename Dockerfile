FROM node:25-bookworm-slim

ENV HOST=0.0.0.0 \
	PORT=80 \
	STORAGE_ROOT=/storage \
	MEDIA_LOCAL_ROOT=/storage/media

RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		ffmpeg \
		postgresql \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build:shared
RUN npm run build

RUN chmod +x scripts/once-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
	CMD curl -fsS http://127.0.0.1/up || exit 1

ENTRYPOINT ["./scripts/once-entrypoint.sh"]
