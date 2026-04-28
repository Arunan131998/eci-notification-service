# Notification Service

ECI Notification service for email/SMS notification logs and event-driven dispatch.

## Features
- Idempotent notification send endpoint
- Event endpoint for order/payment/shipping integrations
- Paginated notification log listing
- Structured logging and metrics
- Persistent delivery log with audit trail

## Quick Start

### Option 1: Local Development (No Docker)
1. Ensure PostgreSQL is running and `notification_db` exists.
2. Create `.env` from `.env.example`.
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Service runs on `http://localhost:3006`

### Option 2: Docker (Single Service)
1. Build the Docker image:
   ```bash
   docker build -t eci-notification-service:latest .
   ```
2. Create Docker network (if not exists):
   ```bash
   docker network create eci-net
   ```
3. Run PostgreSQL container:
   ```bash
   docker run -d --name notification-db --network eci-net \
     -e POSTGRES_USER=user \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_DB=notification_db \
     -p 5436:5432 \
     postgres:16-alpine
   ```
4. Run the service container:
   ```bash
   docker run -d --name notification-service --network eci-net \
     -e DATABASE_URL=postgres://user:password@notification-db:5432/notification_db \
     -e APP_PORT=3006 \
     -p 3006:3006 \
     eci-notification-service:latest
   ```
5. Verify running:
   ```bash
   curl http://localhost:3006/health
   ```

### Option 3: Docker Compose (Full Stack - from root directory)
From the `FullApplication/` root directory:
```bash
# Build all services and start the stack
docker compose -f docker-compose.yml up --build -d

# View logs
docker compose -f docker-compose.yml logs -f notification-service

# Stop all services
docker compose -f docker-compose.yml down
```

### Seeding (PowerShell)
Run from the `FullApplication/` root directory:
```powershell
# Notification service has no dataset seed by design.
# It is populated only by runtime events from Order/Payment/Shipping services.
```

## Endpoints
- `GET /health` — Health check
- `POST /v1/notifications` — Send notification directly (idempotent, channel/event_type/recipient/content)
- `GET /v1/notifications` — List notifications with pagination/filtering (event_type, channel, status)
- `POST /v1/notifications/events` — Event intake from Order/Payment/Shipping services
- `GET /docs` — OpenAPI Swagger UI
- `GET /metrics` — Prometheus metrics

## Supported Events
- `ORDER_CONFIRMED` — From Order service
- `ORDER_CANCELLED` — From Order service
- `PAYMENT_COMPLETED` — From Payment service
- `PAYMENT_FAILED` — From Payment service
- `SHIPMENT_SHIPPED` — From Shipping service
- `SHIPMENT_DELIVERED` — From Shipping service

## Kubernetes Deployment (Minikube)

### Prerequisites
- Minikube running: `minikube start`
- kubectl configured
- Image available in Minikube

### Deployment Steps

1. **Build image for Minikube**:
   ```bash
   eval $(minikube docker-env)
   docker build -t eci-notification-service:latest .
   ```

2. **Apply Kubernetes manifests** (from service root):
   ```bash
   kubectl apply -f k8s/notification-config.yaml
   kubectl apply -f k8s/notification-db.yaml
   kubectl rollout status statefulset/notification-db
   kubectl apply -f k8s/notification-service.yaml
   kubectl rollout status deployment/notification-service
   ```

3. **Verify deployment**:
   ```bash
   kubectl get pods -l app=notification-service
   kubectl get svc notification-service
   kubectl logs -l app=notification-service -f
   ```

4. **Access the service** (port-forward):
   ```bash
   kubectl port-forward svc/notification-service 3006:3006
   curl http://localhost:3006/health
   # Open browser: http://localhost:3006/docs
   ```

5. **Cleanup**:
   ```bash
   kubectl delete -f k8s/notification-service.yaml
   kubectl delete -f k8s/notification-db.yaml
   kubectl delete -f k8s/notification-config.yaml
   ```

## Integration Points
Receives async callbacks from:
- **Order service**: ORDER_CONFIRMED, ORDER_CANCELLED
- **Payment service**: PAYMENT_COMPLETED, PAYMENT_FAILED
- **Shipping service**: SHIPMENT_SHIPPED, SHIPMENT_DELIVERED
