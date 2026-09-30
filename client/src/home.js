import React from 'react';
import {
    Box,
    Heading,
    Button,
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Container,
    useColorModeValue,
    extendTheme,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import { ColorModeScript } from '@chakra-ui/color-mode';
import GamePage from './game';
import TeamPage from './team';
import TriviaPage from './trivia';
import { IconButton, useColorMode } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import PlayerPage from './player';
import TriviaPlayersPage from './triviaplayers';


const theme = extendTheme({
    colors: {
        primary: {
            500: '#4FD1C5', // Teal
            300: '#81E6D9', // Light teal
        },
        secondary: {
            500: '#4299E1', // Blue
        },
    },
});

/*
Chakra UI color mode switcher component
*/
const ColorModeSwitcher = () => {
    const { colorMode, toggleColorMode } = useColorMode();
    return (
        <IconButton
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            aria-label="Toggle color mode"
            position={{ base: 'absolute', md: 'fixed' }}
            top="1rem"
            right="1rem"
            zIndex="10"
            colorScheme="teal"
        />
    );
};

// frontend component for the home page
const HomePage = () => {
    const headingColor = useColorModeValue('gray.700', 'white');
    const buttonColor = 'primary.500';
    const bgColor = 'primary.300';
    const titleGradient = 'linear-gradient(90deg, #4FD1C5 0%, #4299E1 100%)';

    return (
        <ChakraProvider theme={theme}>
            <ColorModeScript initialColorMode="light" />
            <ColorModeSwitcher />
            <Container maxW="7xl" px={{ base: 3, md: 6 }} pt={{ base: 16, md: 12 }} pb={{ base: 8, md: 12 }}>
                <Heading
                    as="h1"
                    size={{ base: 'xl', md: '2xl' }}
                    textAlign="center"
                    pb={6}
                    background={titleGradient}
                    color="transparent"
                    backgroundClip="text"
                >
                    Basketball Betting Statistics
                </Heading>
                {/* Tabs mount when first opened, so the page doesn't query every tab on load. */}
                <Tabs mt={4} isLazy lazyBehavior="keepMounted">
                    <TabList overflowX="auto" overflowY="hidden" whiteSpace="nowrap">
                        <Tab>Game</Tab>
                        <Tab>Player</Tab>
                        <Tab>Team</Tab>
                        <Tab>Betting Trivia</Tab>
                        <Tab>Player Trivia</Tab>
                    </TabList>

                    <TabPanels>
                        <TabPanel px={{ base: 0, md: 4 }}>
                            <GamePage />
                        </TabPanel>
                        <TabPanel px={{ base: 0, md: 4 }}>
                            <PlayerPage />
                        </TabPanel>
                        <TabPanel px={{ base: 0, md: 4 }}>
                            <TeamPage />
                        </TabPanel>
                        <TabPanel px={{ base: 0, md: 4 }}>
                            <TriviaPage />
                        </TabPanel>
                        <TabPanel px={{ base: 0, md: 4 }}>
                            <TriviaPlayersPage />
                        </TabPanel>
                    </TabPanels>
                </Tabs>
            </Container>
        </ChakraProvider>
    );
};

export default HomePage;
