import React, { useEffect, useState } from 'react';
import {
    Box,
    VStack,
    Text,
    useColorModeValue,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    HStack,
    Input,
    Button,
} from '@chakra-ui/react';
import axios, { spread } from 'axios';

// frontend component for a team card
const TeamCard = ({ teamId }) => {
    const [localteamId, setLocalteamId] = useState(teamId);
    const [teamData, setteamData] = useState([]);
    const [teamPlayers, setteamPlayers] = useState([]);
    const [teamBetting, setteamBetting] = useState([]);
    const [spreadData, setSpreadData] = useState([]);
    const [underdogWinData, setUnderdogWinData] = useState([]);
    const [underdogMoneyData, setUnderdogMoneyData] = useState([]);
    const textColor = useColorModeValue('gray.700', 'white');
    const cardBg = useColorModeValue('gray.100', 'gray.900');

    useEffect(() => {
        setLocalteamId(teamId);
    }, [teamId]);

    // loads in data for specific team
    useEffect(() => {
        if (!localteamId) return;
        async function fetchData() {
            try {
                console.log(`/team/${localteamId}`)
                const teamRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/${localteamId}`);
                setteamData(teamRes.data);
                console.log(`/team/${localteamId}/top_players`)
                const teamPlayersRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/${localteamId}/top_players/?num_players=15`);
                setteamPlayers(teamPlayersRes.data);
                console.log(`/team/${localteamId}/betting`)
                const teamBettingRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/${localteamId}/betting`);
                setteamBetting(teamBettingRes.data);
                console.log(`/team/${localteamId}/spread_cover`)
                const spreadRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/${localteamId}/spread_cover`);
                setSpreadData(spreadRes.data);
                console.log(`/team/${localteamId}/underdog_wins`)
                const underdogWinRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/${localteamId}/underdog_wins`);
                setUnderdogWinData(underdogWinRes.data);
                console.log(`/team/${localteamId}/underdog_money`)
                const underdogMoneyRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/${localteamId}/underdog_money`);
                setUnderdogMoneyData(underdogMoneyRes.data);

            } catch (err) {
                console.error(err);
            }
        }

        fetchData();
    }, [localteamId]);
    return (
        <Box>
            {teamId && spreadData[0] && underdogWinData[0] && underdogMoneyData[0] && (
                <Box
                    borderWidth="1px"
                    borderRadius="lg"
                    p={4}
                    w="100%"
                    backgroundColor={cardBg}
                >
                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Team Data
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Name</Th>
                                    <Th>Abbreviation</Th>
                                    <Th>W</Th>
                                    <Th>L</Th>
                                    <Th>PPG</Th>
                                    <Th>APG</Th>
                                    <Th>RPG</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {teamData.map((team, index) => (
                                    <Tr key={index}>
                                        <Td>{team.name}</Td>
                                        <Td>{team.abbreviation}</Td>
                                        <Td>{team.number_wins}</Td>
                                        <Td>{team.number_losses}</Td>
                                        <Td>{team.avg_points.toFixed(1)}</Td>
                                        <Td>{team.avg_rebounds.toFixed(1)}</Td>
                                        <Td>{team.avg_assists.toFixed(1)}</Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>

                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Top Players
                        </Text>
                            {/* <Box key={teamIndex}> */}
                                <Table variant="simple">
                                    <Thead>
                                        <Tr>
                                            <Th>Player Name</Th>
                                            <Th>PPG</Th>
                                            <Th>RPG</Th>
                                            <Th>APG</Th>
                                            <Th>SPG</Th>
                                            <Th>BPG</Th>
                                            <Th>MPG</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {teamPlayers.map((player, index) => (
                                            <Tr key={index}>
                                                <Td>{player.display_first_last}</Td>
                                                <Td>{player.avg_pts.toFixed(1)}</Td>
                                                <Td>{player.avg_reb.toFixed(1)}</Td>
                                                <Td>{player.avg_ast.toFixed(1)}</Td>
                                                <Td>{player.avg_stl.toFixed(1)}</Td>
                                                <Td>{player.avg_blk.toFixed(1)}</Td>
                                                <Td>{player.avg_min.toFixed(1)}</Td>
                                            </Tr>
                                        ))}
                                    </Tbody>
                                </Table>
                            {/* </Box> */}
                    </Box>

                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Betting Data
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Book Name</Th>
                                    <Th>Average Moneyline</Th>
                                    <Th>Average Spread</Th>
                                    <Th>Average Over/Under</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {teamBetting.map((bet, index) => (
                                    <Tr key={index}>
                                        <Td>{bet.book_name}</Td>
                                        <Td>{bet.avg_moneyline_price.toFixed(2)}</Td>
                                        <Td>{bet.avg_spread.toFixed(1)}</Td>
                                        <Td>{bet.avg_total.toFixed(1)}</Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>

                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Advanced Betting Stats
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Total Games</Th>
                                    <Th>Spread Covers</Th>
                                    <Th>Spread Cover Percentage</Th>
                                    <Th>Underdog Games</Th>
                                    <Th>Underdog Wins</Th>
                                    <Th>Underdog Win Percentage</Th>
                                    <Th>Underdog Money Won/Lost</Th>
                                    <Th>Underdog Money Per Game</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                    <Tr>
                                        <Td>{spreadData[0].total_games}</Td>
                                        <Td>{spreadData[0].count}</Td>
                                        <Td>{`${(spreadData[0].spread_percentage * 100).toFixed(1)}%`}</Td>
                                        <Td>{underdogWinData[0].total_games}</Td>
                                        <Td>{underdogWinData[0].count}</Td>
                                        <Td>{`${(underdogWinData[0].percentage * 100).toFixed(1)}%`}</Td>
                                        <Td>{underdogMoneyData[0].money}</Td>
                                        <Td>{underdogMoneyData[0].money_per_game.toFixed(2)}</Td>
                                    </Tr>
                            </Tbody>
                        </Table>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default TeamCard;





