import { Nav } from "@/component/navbar";
import { ArticleDetail, ArticleDetailData, ContentBlock } from "@/component/blog";
import { notion, databaseId } from "@/external/notion";
const { iteratePaginatedAPI } = require('@notionhq/client');

async function getArticle(slug: string) {  
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      "filter": {
        "property": "Slug",
        "rich_text": {
          "equals": slug
        }
      }
    });
    if (response.results.length === 0) {
      return undefined
    }
    const row = response.results[0]
    const pageID = row.id

    let content: Array<ContentBlock> = []
    for await (const block of iteratePaginatedAPI(notion.blocks.children.list, {
      block_id: pageID,
    })) {
      if (block[block.type].rich_text) {
        const line = block[block.type].rich_text.map((t: any) => t.plain_text).join("")
        content.push({
          id: block.id,
          content: line,
        })
      }
    }

    const article: ArticleDetailData = {
      tags: row.properties.Tags.multi_select.map((tag: any) => tag.name) || [],
      title: row.properties.Name.title[0]?.plain_text || "",
      content: content,
      createdAt: new Date(row.properties['Created time'].created_time),
    }
    return article
  } catch (error) {
    console.log(error)
  }

  return undefined
}

export default async function Page({ params }: { params: { slug: string } }) {
  const slugID = params.slug
  const article = await getArticle(slugID)
  return (
    <>
      <Nav></Nav>
      {article && <ArticleDetail tags={article.tags} title={article.title} content={article.content} createdAt={article.createdAt}></ArticleDetail>}
    </>
  )
}
