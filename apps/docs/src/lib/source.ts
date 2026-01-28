import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/docs/${segments.join("/")}`,
  };
}

export async function getLLMText(page: InferPageType<typeof source>) {
  // biome-ignore lint/suspicious/noExplicitAny: Fumadocs page data methods are dynamic
  const processed = await (page.data as any).getText("processed");

  // biome-ignore lint/suspicious/noExplicitAny: Fumadocs page data properties are dynamic
  return `# ${(page.data as any).title}

${processed}`;
}
