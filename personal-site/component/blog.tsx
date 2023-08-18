'use client'

import React from 'react';
import {
  Box,
  Heading,
  Link as ChakraLink,
  Text,
  HStack,
  Tag,
  useColorModeValue,
  Container,
  VStack,
  Image,
} from '@chakra-ui/react';
import Link from 'next/link'

export interface ArticleListData {
  articles: Array<ArticleData>;
}

export interface ArticleData {
  tags: Array<string>;
  title: string;
  preview: string;
  slug: string;
  createdAt: Date;
}

export const ArticleList: React.FC<ArticleListData> = (props) => {
  return (
    <Container maxW={'7xl'} p="12">
      <Heading as="h1">Blog</Heading>
      {props.articles.map((article) => {
        return (
          <Article key={article.slug} slug={article.slug} tags={article.tags} title={article.title} preview={article.preview} createdAt={article.createdAt}></Article>
        )
      })}
    </Container>
  );
};

interface ITags {
  tags: Array<string>;
}

const Tags: React.FC<ITags> = (props) => {
  return (
    <HStack spacing={2}>
      {props.tags?.map((tag) => {
        return (
          <Tag size={'md'} variant="solid" colorScheme="orange" key={tag}>
            {tag}
          </Tag>
        );
      })}
    </HStack>
  );
};

export interface ContentBlock {
  type: string;
  id: string;
  content: Array<SubContentBlock>;
}

export interface SubContentBlock {
  type: string;
  id: number;
  content: string;
  link: string;
}

export interface ArticleDetailData {
  tags: Array<string>;
  title: string;
  content: Array<ContentBlock>;
  createdAt: Date;
}

export const ArticleDetail: React.FC<ArticleDetailData> = (props) => {
  return (
    <Container maxW={'7xl'} p="12">
      <VStack paddingTop="40px" spacing="2" alignItems="flex-start">
        <Tags tags={props.tags} />
        <Heading as="h2">{props.title}</Heading>
        <Text>{props.createdAt?.toLocaleDateString()}</Text>
        {props.content.map((content) => {
          if (content.type === "image") {
            return (
              <Image src={content.content[0].content} key={content.id}></Image>
            )
          }
          if (content.type === "heading_1") {
            return (
              <Heading as="h1" key={content.id}>
                <br></br>
                {content.content[0].content}
              </Heading>
            )
          }
          return (
            <Text as="p" fontSize="lg" key={content.id}>
              {content.content.map((subcontent) => {
                if (subcontent.type === "link") {
                  return (
                    <ChakraLink href={subcontent.link} color='teal.500' isExternal key={subcontent.id}>
                      {subcontent.content}
                    </ChakraLink>
                  )
                }
                if (subcontent.type === "internal_link") {
                  return (
                    <ChakraLink as={Link} href={subcontent.link} color='teal.500' key={subcontent.id}>
                      {subcontent.content}
                    </ChakraLink>
                  )
                }
                return (
                  <Text as="span" key={subcontent.id}>{subcontent.content}</Text>
                )
              })}
            </Text>
          )
        })}
      </VStack>
    </Container>
  )
}

interface IArticle {
  tags: Array<string>;
  title: string;
  preview: string;
  slug: string;
  createdAt: Date;
}

export const Article: React.FC<IArticle> = (props) => {
  return (
    <Box
      marginTop={{ base: '1', sm: '5' }}
      display="flex"
      flexDirection={{ base: 'column', sm: 'row' }}
      justifyContent="space-between">
      <Box
        display="flex"
        flex="1"
        flexDirection="column"
        justifyContent="center"
        marginTop={{ base: '3', sm: '0' }}>
        <Tags tags={props.tags} />
        <Heading marginTop="1">
          <ChakraLink as={Link} textDecoration="none" _hover={{ textDecoration: 'none' }} href={"/articles/" + props.slug}>
            {props.title}
          </ChakraLink>
        </Heading>
        <Text
          as="p"
          marginTop="2"
          color={useColorModeValue('gray.700', 'gray.200')}
          fontSize="lg">
          { props.preview }
        </Text>
        <Text>{props.createdAt?.toLocaleDateString()}</Text>
      </Box>
    </Box>
  )
}
