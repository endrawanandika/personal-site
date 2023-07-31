import 'server-only'

const dotenv = require('dotenv');
const { Client } = require('@notionhq/client');

dotenv.config();

export const notion = new Client({ auth: process.env.NOTION_API_KEY });
export const databaseId = process.env.NOTION_DATABASE_ID;
