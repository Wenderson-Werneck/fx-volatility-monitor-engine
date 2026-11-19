FROM node:22-alpine

WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
COPY test ./test

RUN npm install --ignore-scripts && npm run build

ENV NODE_ENV=production
CMD ["node", "--test", "dist/test/engine.test.js"]
