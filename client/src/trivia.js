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
    useColorModeValue,
    TableContainer,
} from '@chakra-ui/react';
import axios from 'axios';

// frontend component for trivia betting page
const TriviaPage = () => {
    
    const hoverBgColor = useColorModeValue('gray.200', 'gray.700');
    const [middleTotal, setMiddleTotal] = useState([]);
    const [middleSpread, setMiddleSpread] = useState([]);
    const [arbitrage, setArbitrage] = useState([]);
    const [middlingLoading, setMiddlingLoading] = useState(true);
    const [arbitrageLoading, setArbitrageLoading] = useState(true);
    const [threshold, setThreshold] = useState(2);
    const [thresholdInput, setThresholdInput] = useState(2);
    const [page, setPage] = useState(1);

    const toast = useToast();

    // Middling results for the current threshold. Both totals and spreads are
    // requested together; each takes about a second.
    useEffect(() => {
        async function fetchData() {
            setMiddleTotal([]);
            setMiddleSpread([]);
            setMiddlingLoading(true);
            try {
                const api = process.env.REACT_APP_EXPRESS_APP_API_URL;
                const [totalRes, spreadRes] = await Promise.all([
                    axios.get(`${api}/trivia/middling_total?threshold=${threshold}`),
                    axios.get(`${api}/trivia/middling_spread?threshold=${threshold}`),
                ]);
                setMiddleTotal(totalRes.data);
                setMiddleSpread(spreadRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setMiddlingLoading(false);
            }
        }

        fetchData();
    }, [threshold]);

    // sanitizes inputs to threshold
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!isNaN(thresholdInput)) {
            if (thresholdInput < 0) {
                setThreshold(0);
            } else if (thresholdInput > 20) {
                setThreshold(20);
            } else {
                setThreshold(thresholdInput);
            }
        }
    };

    // One page of arbitrage opportunities, fetched whenever the page changes.
    useEffect(() => {
        async function fetchArbitrage() {
            setArbitrageLoading(true);
            try {
                const arbRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/arbitrage?page=${page}`);
                setArbitrage(arbRes.data);
            } catch (err) {
                console.log(err);
            } finally {
                setArbitrageLoading(false);
            }
        }
        fetchArbitrage();
    }, [page]);

    const handlePrevPage = () => {
        if (page > 1) setPage(page - 1);
    };

    const handleNextPage = () => {
        setPage(page + 1);
    };

    return (
        <Flex direction="column" width="100%">
        <VStack spacing={6}>
        <Text fontSize="xl" fontWeight="bold">
            Middling Betting Strategies
          </Text>
          <Text fontSize="m" w={{ base: "100%", md: "70%" }}>
            A middle opportunity is when there is a gap between an over/under or spread line between two books for the same game.
            For example, if 5Dimes O/U line is 200 and Bovada has a line of 197, then you can bet the under on 5Dimes and over on Bovada.
            Most of the time, you will only lose a marginal amount of money as one of your bets is guaranteed to hit. However, when the total score is 198 or 199, you win big.
          </Text>
          <form onSubmit={handleSubmit}>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={2} alignItems="center">
            <FormLabel><b>Threshold</b> (gap between <br></br> spreads/totals required):</FormLabel>
                <FormControl>
                    <Input
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                    />
                </FormControl>
                <Button type="submit" colorScheme="teal" ml={2}>
                        Calculate
                    </Button>
            </Grid>
            </form>
            <TableContainer w="100%"><Table mt={6} variant="simple" width="100%">
                <Thead>
                    <Tr>
                        <Th>O/U Middles Won</Th>
                        <Th>O/U Middles Lost</Th>
                        <Th>O/U Middle Money</Th>
                        <Th>Spread Middles Won</Th>
                        <Th>Spread Middles Lost</Th>
                        <Th>Spread Middle Money</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    <Tr>
                                    <Td>{middleTotal[0] ? middleTotal[0].middles_total_won : middlingLoading ? "…" : "-"}</Td>
                                    <Td>{middleTotal[0] ? middleTotal[0].middles_total_lost : middlingLoading ? "…" : "-"}</Td>
                                    <Td>{middleTotal[0] ? middleTotal[0].middle_total_money.toFixed(2) : middlingLoading ? "…" : "-"}</Td>
                                    <Td>{middleSpread[0] ? middleSpread[0].middles_total_won : middlingLoading ? "…" : "-"}</Td>
                                    <Td>{middleSpread[0] ? middleSpread[0].middles_total_lost : middlingLoading ? "…" : "-"}</Td>
                                    <Td>{middleSpread[0] ? middleSpread[0].middle_total_money.toFixed(2) : middlingLoading ? "…" : "-"}</Td>
                                </Tr>
                </Tbody>
            </Table></TableContainer>
            
            <Text fontSize="xl" fontWeight="bold">
            Arbitrage Opportunities
          </Text>
            <Text fontSize="m" w={{ base: "100%", md: "70%" }}>
                Arbitrage betting is when odds line up between two different books on the same game such that you can guarantee a profit by betting a certain amount on one provider and a certain amount on the other provider. The arbitrage percentage is a measure of how drastic the difference in odds are. An opportunity is profitable only if the arbitrage percentage is less than 100%.
            </Text>
            <TableContainer w="100%"><Table mt={6} variant="simple" width="100%">
                <Thead>
                    <Tr>
                        <Th>Matchup</Th>
                        <Th>Game Date</Th>
                        <Th>Book 1</Th>
                        <Th>Book 2</Th>
                        <Th>Spread Price 1</Th>
                        <Th>Spread Price 2</Th>
                        <Th>Arbitrage Percentage</Th>
                    </Tr>
                </Thead>
                <Tbody>
                {arbitrageLoading && arbitrage.length === 0 && (
                    <Tr><Td colSpan={7} color="gray.500">Finding arbitrage opportunities…</Td></Tr>
                )}
                {arbitrage.map((x, index) => (
                                    <Tr key={index}>
                                        <Td>{x.matchup}</Td>
                                        <Td>{x.game_date.substring(0, 10)}</Td>
                                        <Td>{x.book1}</Td>
                                        <Td>{x.book2}</Td>
                                        <Td>{x.spread_price1}</Td>
                                        <Td>{x.spread_price2}</Td>
                                        <Td>{(x.arbitrage_percentage * 100).toFixed(2)}%</Td>
                                    </Tr>
                                ))}
                </Tbody>
                </Table></TableContainer>
            <Center mt={4}>
                <Button onClick={handlePrevPage} isDisabled={page === 1 || arbitrageLoading} mr={4}>
                    Previous
                </Button>
                <Button onClick={handleNextPage} isDisabled={arbitrageLoading || arbitrage.length < 20}>
                    Next
                </Button>
            </Center>
        </VStack>
        </Flex>
    );
};

export default TriviaPage;
