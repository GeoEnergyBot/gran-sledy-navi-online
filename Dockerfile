FROM node:20-alpine

WORKDIR /app
COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

EXPOSE 8080
CMD ["npm", "start"]
