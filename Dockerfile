FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install packages and copy files
USER root

WORKDIR /app

# Copy package.json and install backend dependencies
COPY package*.json ./
RUN npm install

# Copy frontend package.json and install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all project files
COPY . .

# Build the frontend
RUN cd frontend && npm run build

# Change ownership to the pptruser (provided by the base image)
RUN chown -R pptruser:pptruser /app

# Switch back to pptruser for security
USER pptruser

EXPOSE 5000
ENV PORT=5000

CMD ["node", "server.js"]
