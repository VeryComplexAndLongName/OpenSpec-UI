import type { CatalogTemplate } from "../template-catalog.js";
import { adoptChangesets } from "./adopt-changesets.js";
import { aspnetEfcoreMigrations } from "./aspnet-efcore-migrations.js";
import { aspnetJwtBearerAuth } from "./aspnet-jwt-bearer-auth.js";
import { aspnetXunitTestingBaseline } from "./aspnet-xunit-testing-baseline.js";
import { craToVite } from "./cra-to-vite.js";
import { failFastEnvConfig } from "./fail-fast-env-config.js";
import { flaskToFastapi } from "./flask-to-fastapi.js";
import { flatToHexagonalArchitecture } from "./flat-to-hexagonal-architecture.js";
import { githubActionsCiPipeline } from "./github-actions-ci-pipeline.js";
import { jwtAuthMiddleware } from "./jwt-auth-middleware.js";
import { nodeVitestTestingBaseline } from "./node-vitest-testing-baseline.js";
import { prismaOrmMigrations } from "./prisma-orm-migrations.js";
import { productionDockerfile } from "./production-dockerfile.js";
import { pytestCoverageBaseline } from "./pytest-coverage-baseline.js";
import { pythonSqlalchemyAlembic } from "./python-sqlalchemy-alembic.js";
import { requestCorrelationId } from "./request-correlation-id.js";
import { structuredRequestLogging } from "./structured-request-logging.js";

/** Built-in template registry — same "typed array" shape as
 * `AGENT_REGISTRY`. Add new built-in templates here. */
export const BUILT_IN_TEMPLATES: readonly Omit<CatalogTemplate, "origin">[] = [
  pythonSqlalchemyAlembic,
  flaskToFastapi,
  flatToHexagonalArchitecture,
  nodeVitestTestingBaseline,
  pytestCoverageBaseline,
  prismaOrmMigrations,
  githubActionsCiPipeline,
  jwtAuthMiddleware,
  productionDockerfile,
  aspnetEfcoreMigrations,
  aspnetXunitTestingBaseline,
  aspnetJwtBearerAuth,
  structuredRequestLogging,
  requestCorrelationId,
  craToVite,
  failFastEnvConfig,
  adoptChangesets,
];
