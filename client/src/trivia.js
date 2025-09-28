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

// frontend component for trivia betting page
const TriviaPage = () => {
    
    const hoverBgColor = useColorModeValue('gray.200', 'gray.700');
    const [middleTotal, setMiddleTotal] = useState([]);
    const [middleSpread, setMiddleSpread] = useState([]);
    const [arbitrage, setArbitrage] = useState([]);
    const [threshold, setThreshold] = useState(2);
    const [thresholdInput, setThresholdInput] = useState(2);
    const [page, setPage] = useState(1);

    const toast = useToast();

    // loads middling data with default threshold initially
    // recalled when threshold reset by user
    useEffect(() => {
        async function fetchData() {
            try {
                setMiddleTotal([]);
                setMiddleSpread([]);
                console.log(`/trivia/middling_total`);
                const middleTotalRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/middling_total/?threshold=${threshold}`);
                setMiddleTotal(middleTotalRes.data);
                console.log(`/trivia/middling_spread`);
                const middleSpreadRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/middling_spread?threshold=${threshold}`);
                setMiddleSpread(middleSpreadRes.data);
            } catch (err) {
                console.error(err);
            }
        }

        fetchData();
    }, [threshold]);

    // loads arbitrage games with page 1
    useEffect(() => {
        async function fetchData2() {
            try {
                console.log(`/trivia/arbitrage`);
                const arbRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/arbitrage`);
                setArbitrage(arbRes.data);
            } catch (err) {
                console.log(err);
            }
        }

        fetchData2();
    }, []);

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

    const fetchArbitrageData = async (page) => {
        try {
            console.log(`/trivia/arbitrage`);
            const arbRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/trivia/arbitrage?page=${page}`);
            setArbitrage(arbRes.data);
        } catch (err) {
            console.log(err);
        }
    };

    useEffect(() => {
        fetchArbitrageData(page);
    }, [page]);

    // handles pagination

    const handlePrevPage = () => {
        if (page > 1) {
            setPage(page - 1);
            fetchArbitrageData(page - 1);
        }
    };

    const handleNextPage = () => {
        setPage(page + 1);
        fetchArbitrageData(page + 1);
    };


    return (
        <Flex direction="row">
        <VStack spacing={6}>
        <Text fontSize="xl" fontWeight="bold">
            Middling Betting Strategies
          </Text>
          <Text fontSize="m" w="70%">
            A middle opportunity is when there is a gap between an over/under or spread line between two books for the same game.
            For example, if 5Dimes O/U line is 200 and Bovada has a line of 197, then you can bet the under on 5Dimes and over on Bovada.
            Most of the time, you will only lose a marginal amount of money as one of your bets is guaranteed to hit. However, when the total score is 198 or 199, you win big.
          </Text>
          <form onSubmit={handleSubmit}>
            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
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
            <Table mt={6} variant="simple" width="100%">
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
                                    <Td>{middleTotal[0] ? middleTotal[0].middles_total_won : "-"}</Td>
                                    <Td>{middleTotal[0] ? middleTotal[0].middles_total_lost : "-"}</Td>
                                    <Td>{middleTotal[0] ? middleTotal[0].middle_total_money.toFixed(2) : "-"}</Td>
                                    <Td>{middleSpread[0] ? middleSpread[0].middles_total_won : "-"}</Td>
                                    <Td>{middleSpread[0] ? middleSpread[0].middles_total_lost : "-"}</Td>
                                    <Td>{middleSpread[0] ? middleSpread[0].middle_total_money.toFixed(2) : "-"}</Td>
                                </Tr>
                </Tbody>
            </Table>
            
            <Text fontSize="xl" fontWeight="bold">
            Arbitrage Opportunities
          </Text>
            <Text fontSize="m" w="70%">
                Arbitrage betting is when odds line up between two different books on the same game such that you can guarantee a profit by betting a certain amount on one provider and a certain amount on the other provider. The arbitrage percentage is a measure of how drastic the difference in odds are. An opportunity is profitable only if the arbitrage percentage is less than 100%.
            </Text>
            <Table mt={6} variant="simple" width="100%">
                <Thead>
                    <Tr>
                        <Th>Matchup</Th>
                        <Th>Game Date</Th>
                        <Th>Book 1</Th>
                        <Th>Book 2</Th>
                        <Th>Spread 1</Th>
                        <Th>Spread 2</Th>
                        <Th>Arbitrage Percentage</Th>
                    </Tr>
                </Thead>
                <Tbody>
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
                </Table>
            <Center mt={4}>
                <Button onClick={handlePrevPage} disabled={page === 1} mr={4}>
                    Previous
                </Button>
                <Button onClick={handleNextPage}>
                    Next
                </Button>
            </Center>
        </VStack>
        </Flex>
    );
};

export default TriviaPage;
