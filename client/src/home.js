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
    VStack,
    useColorModeValue,
    extendTheme, Center,
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
            position="fixed"
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
            <Center>
            <Container maxW="100%" py={12}>
                <Center>
                    <VStack>
                <Box pos="relative" display="inline-block" p={6}>
                    <Heading as="h1" size="2xl" background={titleGradient} color="transparent" backgroundClip="text">
                        Basketball Betting Statistics
                    </Heading>
                </Box>
                <VStack spacing={16} align="start" width="100%" >
                    <Tabs mt={4}>
                        <TabList>
                            <Tab>Game</Tab>
                            <Tab>Player</Tab>
                            <Tab>Team</Tab>
                            <Tab>Betting Trivia</Tab>
                            <Tab>Player Trivia</Tab>
                        </TabList>

                        <TabPanels>
                            <TabPanel>
                                <GamePage />
                            </TabPanel>
                            <TabPanel>
                                <PlayerPage />
                            </TabPanel>
                            <TabPanel>
                                <TeamPage />
                            </TabPanel>
                            <TabPanel>
                                <TriviaPage />
                            </TabPanel>
                            <TabPanel>
                                <TriviaPlayersPage />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </VStack>
                    </VStack>
                </Center>
            </Container>
            </Center>
        </ChakraProvider>
    );
};

export default HomePage;
