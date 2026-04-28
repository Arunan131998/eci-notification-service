# Notification Service

ECI Notification service for email/SMS notification logs and event-driven dispatch.

## Features
- Idempotent notification send endpoint
- Event endpoint for order/payment/shipping integrations
- Paginated notification log listing
- Structured logging and metrics

## Endpoints
- `POST /v1/notifications`
- `GET /v1/notifications`
- `POST /v1/notifications/events`

## Kubernetes
- `k8s/notification-config.yaml`
- `k8s/notification-db.yaml`
- `k8s/notification-service.yaml`
