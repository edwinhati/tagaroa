# Tagaroa

A comprehensive full-stack platform built as a Turborepo monorepo, featuring multiple applications, microservices, and shared packages for building modern web applications.

## What's inside?

This Turborepo includes the following packages/apps:

### Frontend Applications

- `web`: Main landing page (Next.js 16)
- `auth`: Authentication app (Next.js 16)
- `admin`: Admin dashboard (Next.js 16)
- `finance`: Finance management app (Next.js 16)
- `docs`: Documentation site (Next.js 16 with Fumadocs)

### Backend Services

- `servers/auth`: Authentication service (TypeScript/Hono/Bun)
- `servers/finance`: Finance service (Go)
- `servers/investment`: Investment service (Rust)
- `servers/storage`: Storage service (TypeScript/Hono/Bun)

### Shared Packages

- `@repo/ui`: Shared UI component library (Radix UI + Tailwind CSS 4)
- `@repo/common`: Common utilities, hooks, and stores
- `@repo/shared`: Multi-language shared code (Go, Hono, Rust, Proto)
- `@repo/posthog-config`: PostHog analytics configuration
- `@repo/sentry-config`: Sentry error tracking configuration
- `@repo/typescript-config`: Shared TypeScript configurations

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/), Go, or Rust.

### Infrastructure

- **Docker Compose**: PostgreSQL, Kafka, MinIO, n8n, Traefik
- **Kubernetes**: Flux CD, MetalLB, ingress-nginx
- **Database**: PostgreSQL with Drizzle ORM (TypeScript) and sqlx (Rust)
- **Message Queue**: Kafka for event-driven architecture
- **Storage**: MinIO for S3-compatible object storage
- **API Gateway**: Traefik for routing and load balancing

### Utilities

This Turborepo has some additional tools already setup for you:

- [Bun](https://bun.sh/) for fast package management and runtime
- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [Biome](https://biomejs.dev/) for code linting and formatting
- [Turborepo](https://turborepo.com/) for efficient builds and caching

### Quick Start

```bash
# Install dependencies
bun install

# Setup environment files
make env-setup

# Start infrastructure services
make docker-up

# Initialize databases
make db-init

# Run all apps in development
bun run dev
```

### Build

To build all apps and packages:

```bash
# Build all
make build

# Or using Turborepo
turbo build

# Or using Bun
bun run build
```

Build specific packages:

```bash
# Build specific app
turbo build --filter=web

# Build specific server
make build-server SERVER=finance
```

### Develop

Run all frontend apps:

```bash
bun run dev
```

Run specific app:

```bash
turbo dev --filter=web
turbo dev --filter=auth
```

Run backend services (in separate terminals):

```bash
# TypeScript/Bun services
cd servers/auth && bun run dev
cd servers/storage && bun run dev

# Go services
cd servers/finance && go run ./cmd/main.go
cd file && go run ./cmd/main.go

# Rust service
cd servers/investment && cargo run
```

### Testing

```bash
# Run all tests
make test

# Run specific tests
cd servers/auth && bun test
cd servers/finance && go test ./...
cd servers/investment && cargo test
```

### Linting

```bash
# Lint all code
make lint

# Or using Turborepo
turbo lint

# Or using Bun
bun run lint
```

### Docker

```bash
# Start services
make docker-up

# Stop services
make docker-down

# View logs
make docker-logs

# Build Docker images
make docker-build
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
