# 0061. Share the host CI resource budget

Status: Accepted, 2026-11-23.

OpenSpec quality jobs use the existing root Docker executor with --cgroup-parent=user.slice. The hppiigit host configures that parent with CPUQuota=300%, MemoryHigh=11G and MemoryMax=13G. Per-job 2 CPU/6 GiB caps and the Docker socket prohibition remain enforced. Native rootless PR engines use the standard user-UID.slice hierarchy under that same parent. Small operator login sessions also join this parent; Gitea and MinIO Docker services remain in system.slice.

Independent job caps do not limit aggregate pressure. A custom slice for rootless user managers was rejected because runc 1.3.6 uses D-Bus OwnerUID detection, which requires the standard user slice hierarchy. A separate CI VM remains a stronger future boundary but is outside this capacity change.

Host policy and rollout: [DocsAI ADR 0037](http://hppiigit:3000/HimPromProekt/DocsAI/src/branch/main/docs/adr/0037-isolated-pr-runner-pool.md). Install the host slice drop-in before deploying this config; without that prerequisite the parent alone supplies no aggregate quota. At concurrent peak memory requests the CI ceiling can cause OOM, protecting the server rather than guaranteeing every job's maximum.
