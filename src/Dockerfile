# Use the Bun image as the base image
FROM oven/bun:1.2-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY .. .

# Install dependencies
RUN bun install --frozen-lockfile

# Expose the port on which the API will listen
EXPOSE 3000

# Run the server when the container launches
CMD ["bun", "start"]
