import type { CatalogTemplate } from "../template-catalog.js";
import { pythonSqlalchemyAlembic } from "./python-sqlalchemy-alembic.js";

/** Built-in template registry — same "typed array" shape as
 * `AGENT_REGISTRY`. Add new built-in templates here. */
export const BUILT_IN_TEMPLATES: readonly Omit<CatalogTemplate, "origin">[] = [
  pythonSqlalchemyAlembic,
];
