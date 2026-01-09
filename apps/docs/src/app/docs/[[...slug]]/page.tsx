import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

type PageProps = {
	params: Promise<{ slug?: string[] }>;
};

export default async function Page(props: Readonly<PageProps>) {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	// biome-ignore lint/suspicious/noExplicitAny: Fumadocs page data structure is dynamic
	const pageData = page.data as any;
	const MDX = pageData.body || pageData.default;

	return (
		<DocsPage toc={pageData.toc} full={pageData.full}>
			<DocsTitle>{pageData.title}</DocsTitle>
			<DocsDescription>{pageData.description}</DocsDescription>
			<DocsBody>
				<MDX
					components={getMDXComponents({
						// this allows you to link to other pages with relative file paths
						a: createRelativeLink(source, page),
					})}
				/>
			</DocsBody>
		</DocsPage>
	);
}

export async function generateStaticParams() {
	return source.generateParams();
}

export async function generateMetadata(
	props: Readonly<PageProps>,
): Promise<Metadata> {
	const params = await props.params;
	const page = source.getPage(params.slug);
	if (!page) notFound();

	return {
		title: page.data.title,
		description: page.data.description,
		openGraph: {
			images: getPageImage(page).url,
		},
	};
}
