// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"api-reference.mdx": () => import("../content/docs/api-reference.mdx?collection=docs"), "deployment.mdx": () => import("../content/docs/deployment.mdx?collection=docs"), "development.mdx": () => import("../content/docs/development.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "infrastructure.mdx": () => import("../content/docs/infrastructure.mdx?collection=docs"), "quick-start.mdx": () => import("../content/docs/quick-start.mdx?collection=docs"), "packages/common.mdx": () => import("../content/docs/packages/common.mdx?collection=docs"), "packages/index.mdx": () => import("../content/docs/packages/index.mdx?collection=docs"), "servers/auth.mdx": () => import("../content/docs/servers/auth.mdx?collection=docs"), "servers/file.mdx": () => import("../content/docs/servers/file.mdx?collection=docs"), "servers/finance.mdx": () => import("../content/docs/servers/finance.mdx?collection=docs"), "servers/index.mdx": () => import("../content/docs/servers/index.mdx?collection=docs"), "servers/investment.mdx": () => import("../content/docs/servers/investment.mdx?collection=docs"), "servers/storage.mdx": () => import("../content/docs/servers/storage.mdx?collection=docs"), "apps/admin.mdx": () => import("../content/docs/apps/admin.mdx?collection=docs"), "apps/auth.mdx": () => import("../content/docs/apps/auth.mdx?collection=docs"), "apps/docs.mdx": () => import("../content/docs/apps/docs.mdx?collection=docs"), "apps/finance.mdx": () => import("../content/docs/apps/finance.mdx?collection=docs"), "apps/index.mdx": () => import("../content/docs/apps/index.mdx?collection=docs"), "apps/investment.mdx": () => import("../content/docs/apps/investment.mdx?collection=docs"), "apps/web.mdx": () => import("../content/docs/apps/web.mdx?collection=docs"), }),
};
export default browserCollections;