import { Nav } from "@/component/navbar";
import { ArticleDetail, ArticleDetailData, ContentBlock } from "@/component/blog";
import { notion, databaseId } from "@/external/notion";
const { iteratePaginatedAPI } = require('@notionhq/client');

const prefix = "http://localhost:3000";

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
      if (block.type === "image") {
        content.push({
          type: "image",
          id: block.id,
          content: [{
            id: 0,
            type: "",
            link: "",
            content: block.image.file.url,
          }],
        })
      } else if (block[block.type].rich_text) {
        let idx = 0; // sub content doesn't have id from notion, and because this is server component, it should be okay (once per request, doesnt rerender).
        const line = block[block.type].rich_text.map((t: any) => {
          idx += 1;

          let type = ""
          let link = ""

          if (t.href) {
            type = "link"
            link = t.href
            if (t.href.startsWith(prefix)) {
              type = "internal_link"
              link = t.href.slice(prefix.length)
            }
          }

          return {
            id: idx,
            type: type,
            link: link,
            content: t.plain_text,
          }
        })
        content.push({
          type: block.type,
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
