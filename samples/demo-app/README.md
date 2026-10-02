# sailwind-demo-app

A minimal Express.js app used to exercise the full Sailwind deployment pipeline.

## Usage

```bash
npm install
npm start           # production
npm run dev         # with --watch
```

The server listens on `PORT` (default `8080`).

## Endpoints

| Method | Path      | Description                        |
|--------|-----------|------------------------------------|
| GET    | `/`       | Welcome message + route listing    |
| GET    | `/health` | Health check (probed by Sailwind)      |
| GET    | `/items`  | List in-memory items               |
| POST   | `/items`  | Create an item `{ "name": "..." }` |

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```
