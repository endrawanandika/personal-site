'use client'

import {
  Box,
  Flex,
  HStack,
  Button,
  useColorModeValue,
  Stack,
  useColorMode,
} from '@chakra-ui/react'
import { MoonIcon, SunIcon } from '@chakra-ui/icons'
import Link from 'next/link'

interface Props {
  children: React.ReactNode
  link: string
}

const NavLink = (props: Props) => {
  const { children } = props

  return (
    <Link href={props.link}>
      <Box
        px={2}
        py={1}
        rounded={'md'}
        _hover={{
          textDecoration: 'none',
          bg: useColorModeValue('gray.200', 'gray.700'),
        }}>
        {children}
      </Box>
    </Link>
  )
}

const Links = [['Home', '/'], ['Blogs', '/articles'], ['Conference App (WebRTC)', '/conference']]

export const Nav = () => {
  const { colorMode, toggleColorMode } = useColorMode()
  return (
    <>
      <Box bg={useColorModeValue('gray.100', 'gray.900')} px={4}>
        <Flex h={16} alignItems={'center'} justifyContent={'space-between'}>
          <HStack as={'nav'} spacing={4} display={{ base: 'none', md: 'flex' }}>
            <Box>Endra's Web</Box>
            {Links.map((link) => (
            <NavLink link={link[1]} key={link[0]}>{link[0]}</NavLink>
            ))}
          </HStack>

          <Flex alignItems={'center'}>
            <Stack direction={'row'} spacing={7}>
              <Button onClick={toggleColorMode}>
                {colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              </Button>
            </Stack>
          </Flex>
        </Flex>
      </Box>
    </>
  )
}
