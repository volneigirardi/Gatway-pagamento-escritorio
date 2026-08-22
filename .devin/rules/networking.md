---
description: "Networking, TLS, and service mesh rules"
trigger: model_decision
---

# Networking Rules

- TLS 1.3 for all public traffic.
- Internal service traffic protected by mTLS where feasible.
- NetworkPolicy in Kubernetes; overlay networks in Swarm.
- Do not expose internal ports or debug endpoints publicly.
- CORS restricted to known origins per environment.
- Rate limiting at ingress and application layers.
- DNS and certificate management automated where possible.
