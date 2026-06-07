# MemKarti online server — container image for Bunny Magic Containers (or any
# container host). Runs the SAME engine as solo/LAN via tsx (no build step).
#
# IMPORTANT: the server imports the shared engine from
#   ../../MemKarti-cloud/apps/mobile-v2/src/game
# which lives OUTSIDE server/. So this image must be built from the REPOSITORY
# ROOT as the build context, and we replicate the repo layout inside the image:
#   /app/server                              <- the server
#   /app/MemKarti-cloud/apps/mobile-v2/src/game  <- the shared engine
#
# Build (from repo root):
#   docker build -f server/Dockerfile -t memkarti-server .
# Run:
#   docker run -p 3000:3000 memkarti-server

FROM node:22-alpine

WORKDIR /app/server

# Install dependencies first (better layer caching).
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Server source.
COPY server/ ./

# Shared game engine (resolved via ../../MemKarti-cloud/... from /app/server/src).
COPY MemKarti-cloud/apps/mobile-v2/src/game /app/MemKarti-cloud/apps/mobile-v2/src/game

ENV NODE_ENV=production
# PORT is provided by the host (Bunny/Render); default 3000 for local runs.
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
