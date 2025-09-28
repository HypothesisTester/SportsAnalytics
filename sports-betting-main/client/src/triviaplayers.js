import React, { useState, useEffect } from 'react';
import {
    VStack,
    Heading,
    Box,
    Text,
    Input,
    Button,
    Grid,
    FormControl,
    FormLabel,
    useToast, Tbody, Table, Thead, Th, Tr, Td, Flex, Center,
    useColorModeValue
} from '@chakra-ui/react';
import axios from 'axios';

// Players Trivia page frontend component
const TriviaPlayersPage = () => {
    
    const [playerMatchups, setPlayerMatchups] = useState([]);
    const [spreadPlayers, setSpreadPlayers] = useState([]);
    const [underdogPlayers, setUnderdogPlayers] = useState([]);
    const [minGamesSpread, setMinGamesSpread] = useState(50);
    const [minGamesSpreadInput, setMinGamesSpreadInput] = useState(50);
    const [minMatchupGames, setMinMatchupGames] = useState(5);
    const [minMatchupGamesInput, setMinMatchupGamesInput] = useState(5);
    const [minUnderdogGames, setMinUnderdogGames] = useState(10);
    const [minUnderdogGamesInput, setMinUnderdogGamesInput] = useState(10);

    // fetches data for default minimum game values initially
    // recalled when inputs are updated

    useEffect(() => {
        async function fetchData() {
            try {
                console.log(`/trivia/underdog_players`);
                const underdogRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/underdog_players/?minimum_games=${minUnderdogGames}`);
                setUnderdogPlayers(underdogRes.data);
            } catch(err) {
                console.log(err);
            }
        }

        fetchData();
    }, [minUnderdogGames]);

    useEffect(() => {
        async function fetchData() {
            try {
                console.log(`/trivia/spread_players`);
                const spreadRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/spread_players/?minimum_games=${minGamesSpread}`);
                setSpreadPlayers(spreadRes.data);
            } catch(err) {
                console.log(err);
            }
        }

        fetchData();
    }, [minGamesSpread]);

    useEffect(() => {
        async function fetchData() {
            try {
                console.log(`/trivia/top_matchups`);
                const matchupRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/top_matchups/?minimum_games=${minMatchupGames}`);
                setPlayerMatchups(matchupRes.data);
            } catch(err) {
                console.log(err);
            }
        }

        fetchData();
    }, [minMatchupGames]);

    // handles user updating input parameter
    // sanitizes inputs

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!isNaN(minGamesSpreadInput) && minGamesSpreadInput.trim().length !== 0) {
            if (minGamesSpreadInput < 0) {
                setMinGamesSpread(0);
            } else if (minGamesSpreadInput > 1000) {
                setMinGamesSpread(1000);
            } else {
                setMinGamesSpread(minGamesSpreadInput);
            }
        }
    };

    const handleSubmit2 = (event) => {
        event.preventDefault();
        if (!isNaN(minMatchupGamesInput) && minMatchupGamesInput.trim().length !== 0) {
            if (minMatchupGamesInput < 0) {
                setMinMatchupGames(0);
            } else if (minMatchupGamesInput > 57) {
                setMinMatchupGames(57);
            } else {
                setMinMatchupGames(minMatchupGamesInput);
            }
        }
    };

    const handleSubmit3 = (event) => {
        event.preventDefault();
        if (!isNaN(minUnderdogGamesInput) && minUnderdogGamesInput.trim().length !== 0) {
            if (minUnderdogGamesInput < 0) {
                setMinUnderdogGames(0);
            } else if (minUnderdogGamesInput > 517) {
                setMinUnderdogGames(517);
            } else {
                setMinUnderdogGames(minUnderdogGamesInput);
            }
        }
    };

    return (
        <Flex direction="row">
        <VStack spacing={6}>
            <Text fontSize="xl" fontWeight="bold">
            Top Player Matchups
          </Text>
          <form onSubmit={handleSubmit2}>
          <Grid templateColumns="repeat(3, 1fr)" gap={2}>
            <FormLabel><b>Minimum Matchup Games</b></FormLabel>
                <FormControl>
                    <Input
                        value={minMatchupGamesInput}
                        onChange={(e) => setMinMatchupGamesInput(e.target.value)}
                    />
                </FormControl>
                <Button type="submit" colorScheme="teal" ml={2}>
                        Submit
                    </Button>
            </Grid>
            </form>
            <Table mt={6} variant="simple" width="100%">
                <Thead>
                    <Tr>
                        <Th>Player 1</Th>
                        <Th>Player 2</Th>
                        <Th>Total Games</Th>
                        <Th>Average Percentage of Points Scored</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {playerMatchups.map((pair, index) => (
                                    <Tr key={index}>
                                        <Td>{pair.name1}</Td>
                                        <Td>{pair.name2}</Td>
                                        <Td>{pair.total_games}</Td>
                                        <Td>{(pair.avg_pct_pts * 100).toFixed(2)}%</Td>
                                    </Tr>
                                ))}
                </Tbody>
            </Table>
            <Text fontSize="xl" fontWeight="bold">
            Top Players for Spread Cover
          </Text>
          <form onSubmit={handleSubmit}>
            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
            <FormLabel><b>Minimum Total Games</b></FormLabel>
                <FormControl>
                    <Input
                        value={minGamesSpreadInput}
                        onChange={(e) => setMinGamesSpreadInput(e.target.value)}
                    />
                </FormControl>
                <Button type="submit" colorScheme="teal" ml={2}>
                        Submit
                    </Button>
            </Grid>
            </form>
            <Table mt={6} variant="simple" width="100%">
                <Thead>
                    <Tr>
                        <Th>Player</Th>
                        <Th>Spread Covers</Th>
                        <Th>Total Games</Th>
                        <Th>Spread Cover Percentage</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {spreadPlayers.map((x, index) => (
                                    <Tr key={index}>
                                        <Td>{x.display_first_last}</Td>
                                        <Td>{x.count}</Td>
                                        <Td>{x.total_games}</Td>
                                        <Td>{(x.spread_percentage * 100).toFixed(2)}%</Td>
                                    </Tr>
                                ))}
                </Tbody>
            </Table>
            <Text fontSize="xl" fontWeight="bold">
            Top Players as Underdogs
          </Text>
          <form onSubmit={handleSubmit3}>
          <Grid templateColumns="repeat(3, 1fr)" gap={2}>
            <FormLabel><b>Minimum Underdog Games</b></FormLabel>
                <FormControl>
                    <Input
                        value={minUnderdogGamesInput}
                        onChange={(e) => setMinUnderdogGamesInput(e.target.value)}
                    />
                </FormControl>
                <Button type="submit" colorScheme="teal" ml={2}>
                        Submit
                    </Button>
            </Grid>
            </form>
            <Table mt={6} variant="simple" width="100%">
                <Thead>
                    <Tr>
                        <Th>Player</Th>
                        <Th>Underdog Games</Th>
                        <Th>Underdog Wins</Th>
                        <Th>Total Money</Th>
                        <Th>Money Per Game</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {underdogPlayers.map((x, index) => (
                                    <Tr key={index}>
                                        <Td>{x.display_first_last}</Td>
                                        <Td>{x.total_games}</Td>
                                        <Td>{x.underdog_wins}</Td>
                                        <Td>{x.total_money.toFixed(2)}</Td>
                                        <Td>{x.money_per_game.toFixed(2)}</Td>
                                    </Tr>
                                ))}
                </Tbody>
            </Table>
        </VStack>
        </Flex>
    );
};

export default TriviaPlayersPage;
