FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN npm install
WORKDIR /app/apps/web
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "dev"]
