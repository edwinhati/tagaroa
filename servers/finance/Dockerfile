# Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Install git (needed for Go modules)
RUN apk add --no-cache git

# Copy shared package first (needed for go mod)
COPY packages/shared/go/ ./packages/shared/go/

# Copy go mod files from the correct location
COPY servers/finance/go.mod servers/finance/go.sum ./servers/finance/

# Set working directory to the server location
WORKDIR /app/servers/finance

# Download dependencies
RUN go mod download

# Copy the rest of the source code
COPY servers/finance/ ./

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o finance-server ./cmd/main.go

# Runtime stage
FROM alpine:latest AS runner

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy the binary from builder stage
COPY --from=builder /app/servers/finance/finance-server .

# Change ownership to non-root user
RUN chown appuser:appgroup finance-server

# Switch to non-root user
USER appuser

# Expose port (adjust if your server uses a different port)
EXPOSE 8080

# Run the binary
CMD ["./finance-server"]