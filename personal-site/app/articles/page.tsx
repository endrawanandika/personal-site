import { Nav } from "@/component/navbar";
import { ArticleList, ArticleData } from "@/component/blog";
import { notion, databaseId } from "@/external/notion";
const { iteratePaginatedAPI } = require('@notionhq/client');

async function getArticle(id: string) {  
  try {
    for await (const block of iteratePaginatedAPI(notion.blocks.children.list, {
      block_id: id,
    })) {
      if (block[block.type].rich_text) {
        return block[block.type].rich_text.map((t: any) => t.plain_text).join("")
      }
    }
  } catch (error) {
    console.log(error)
  }

  return ""
}

async function getArticles() {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      "filter": {
        "property": "Published",
        "checkbox": {
          "equals": true
        }
      }
    });

    const res: Array<ArticleData> = await Promise.all(response.results.map((async (article: any) => {
      const rowID = article.id
      const preview = await getArticle(rowID)

      return {
        tags: article.properties.Tags.multi_select.map((tag: any) => tag.name) || [],
        title: article.properties.Name.title[0]?.plain_text || "",
        preview: preview,
        slug: article.properties.Slug.rich_text[0]?.plain_text || "",
        createdAt: new Date(article.properties['Created time'].created_time),
      }
    })))
    
    return res
  } catch (error) {
    console.log(error)
    return []
  }
}

export default async function Page() {
  const articles = await getArticles()
  
  return (
    <>
      <Nav></Nav>
      <ArticleList articles={articles}></ArticleList>
    </>
  )
}
