# Deployment Guide

## Production Considerations
- Replace all default secrets in environment variables.
- Use managed PostgreSQL/Redis/Mongo in cloud.
- Configure HTTPS (TLS termination at ingress/load balancer).
- Use external object storage for dataset artifacts.
- Use Kubernetes manifests under `infra/k8s/` as deployment base.
- Enable centralized logging and tracing.

