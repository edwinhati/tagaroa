// @ts-nocheck
import * as __fd_glob_20 from "../content/docs/servers/storage.mdx?collection=docs"
import * as __fd_glob_19 from "../content/docs/servers/investment.mdx?collection=docs"
import * as __fd_glob_18 from "../content/docs/servers/index.mdx?collection=docs"
import * as __fd_glob_17 from "../content/docs/servers/finance.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/servers/file.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/servers/auth.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/packages/index.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/packages/common.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/apps/web.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/apps/investment.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/apps/index.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/apps/finance.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/apps/docs.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/apps/auth.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/apps/admin.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/quick-start.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/infrastructure.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/development.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/deployment.mdx?collection=docs"
import * as __fd_glob_0 from "../content/docs/api-reference.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {}, {"api-reference.mdx": __fd_glob_0, "deployment.mdx": __fd_glob_1, "development.mdx": __fd_glob_2, "index.mdx": __fd_glob_3, "infrastructure.mdx": __fd_glob_4, "quick-start.mdx": __fd_glob_5, "apps/admin.mdx": __fd_glob_6, "apps/auth.mdx": __fd_glob_7, "apps/docs.mdx": __fd_glob_8, "apps/finance.mdx": __fd_glob_9, "apps/index.mdx": __fd_glob_10, "apps/investment.mdx": __fd_glob_11, "apps/web.mdx": __fd_glob_12, "packages/common.mdx": __fd_glob_13, "packages/index.mdx": __fd_glob_14, "servers/auth.mdx": __fd_glob_15, "servers/file.mdx": __fd_glob_16, "servers/finance.mdx": __fd_glob_17, "servers/index.mdx": __fd_glob_18, "servers/investment.mdx": __fd_glob_19, "servers/storage.mdx": __fd_glob_20, });