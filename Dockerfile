# Stage 1: Build the React app
FROM node:22-alpine as build
WORKDIR /app

# RUN git clone https://github.com/Cloud-Pipelines/pipeline-studio-app.git .

# Enable Corepack so the pinned pnpm version from package.json is used.
RUN corepack enable

# Leverage caching by installing dependencies first
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code and build for production
COPY . .
# Extracting the commit SHA and setting VITE_GIT_COMMIT
# ADD .git/refs/heads/master ./master_commit
# Our base image does not have git. So we have to use Shell scripts.
### RUN echo VITE_GIT_COMMIT=\"$(git rev-parse --short HEAD | tr -d "\n")\" >.env
# RUN echo VITE_GIT_COMMIT=\"$(< ./master_commit tr -d "\n")\" | tee .env
RUN pnpm run build

# Stage 3: Production environment
FROM nginxinc/nginx-unprivileged:alpine AS production

# Copy nginx config to eanble the health check route
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy the production build artifacts from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the default NGINX port
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
