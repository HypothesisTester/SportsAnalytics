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
import axios from 'axios';
import {useLocation, useParams} from "react-router-dom";

// frontend component for specific game card
const GameCard = ({ gameId: propGameId}) => {
    const { gameId } = useParams();
    const [localGameId, setLocalGameId] = useState(propGameId || gameId);
    const [inputGameId, setInputGameId] = useState('');
    const [gameData, setGameData] = useState([]);
    const [gamePlayers, setGamePlayers] = useState([[], []]);
    const [gameBetting, setGameBetting] = useState([]);
    const [matchupStats, setMatchupStats] = useState([]);
    const [matchupTopPairs, setMatchupTopPairs] = useState([]);
    const textColor = useColorModeValue('gray.700', 'white');
    const cardBg = useColorModeValue('gray.100', 'gray.900');

    useEffect(() => {
        setLocalGameId(propGameId || gameId);
    }, [propGameId, gameId]);

    // fetches data for game page
    useEffect(() => {
        if (!localGameId) return;
        async function fetchData() {
            try {
                console.log(`/game/${localGameId}`)
                const gameRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/game/${localGameId}`);
                setGameData(gameRes.data);
                console.log(gameData);
                console.log(`/game/${localGameId}/players`)
                const gamePlayersRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/game/${localGameId}/players`);
                setGamePlayers(gamePlayersRes.data);
                console.log(`/game/${localGameId}/betting`)
                const gameBettingRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/game/${localGameId}/betting`);
                setGameBetting(gameBettingRes.data);
                console.log(`/game/${localGameId}/matchup_stats`)
                const matchupStatsRes = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/game/${localGameId}/matchup_stats`);
                setMatchupStats(matchupStatsRes.data);
                console.log(`/game/${localGameId}/matchup_top_pairs`)
                const matchupTopPairs = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/game/${localGameId}/matchup_top_pairs`);
                setMatchupTopPairs(matchupTopPairs.data);
            } catch (err) {
                console.error(err);
            }
        }

        fetchData();
    }, [localGameId]);

    return (
        <Box>
            {localGameId && gameData && gameData[0] && gameData[1] && (
                <Box
                    borderWidth="1px"
                    borderRadius="lg"
                    p={4}
                    w="100%"
                    backgroundColor={cardBg}
                >
                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Game Data
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Matchup</Th>
                                    <Th>Home Team</Th>
                                    <Th>Away Team</Th>
                                    <Th>Home Score</Th>
                                    <Th>Away Score</Th>
                                    <Th>Game Date</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                <Tr>
                                    <Td>{gameData[0].matchup}</Td>
                                    <Td>{gameData[0].name}</Td>
                                    <Td>{gameData[1].name}</Td>
                                    <Td>{gameData[0].pts}</Td>
                                    <Td>{gameData[1].pts}</Td>
                                    <Td>{gameData[0].game_date.substring(0, 10)}</Td>
                                </Tr>
                            </Tbody>
                        </Table>
                    </Box>

                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Game Players
                        </Text>
                        {gamePlayers.map((teamPlayers, teamIndex) => (
                            <Box key={teamIndex}>
                                <Text fontWeight="bold" color={textColor}>
                                    {teamIndex === 0 ? 'Home Team Players' : 'Away Team Players'}
                                </Text>
                                <Table variant="simple">
                                    <Thead>
                                        <Tr>
                                            <Th>Player</Th>
                                            <Th>MIN</Th>
                                            <Th>PT</Th>
                                            <Th>RBD</Th>
                                            <Th>AST</Th>
                                            <Th>STL</Th>
                                            <Th>BLK</Th>
                                            <Th>FG</Th>
                                            <Th>FT</Th>
                                            <Th>3P</Th>
                                            <Th>PF</Th>
                                            <Th>+/-</Th>
                                        </Tr>
                                    </Thead>
                                    <Tbody>
                                        {teamPlayers.map((player, index) => (
                                            <Tr key={index}>
                                                <Td>{player.display_first_last}</Td>
                                                <Td>{player.min}</Td>
                                                <Td>{player.pts}</Td>
                                                <Td>{player.reb}</Td>
                                                <Td>{player.ast}</Td>
                                                <Td>{player.stl}</Td>
                                                <Td>{player.blk}</Td>
                                                <Td>{`${player.fgm} / ${player.fga}`}</Td>
                                                <Td>{`${player.ftm} / ${player.fta}`}</Td>
                                                <Td>{`${player.fg3m} / ${player.fg3a}`}</Td>
                                                <Td>{player.pf}</Td>
                                                <Td>{player.plus_minus}</Td>
                                            </Tr>
                                        ))}
                                        <Tr>
                                                <Td><b>{gameData[teamIndex].abbreviation}</b></Td>
                                                <Td></Td>
                                                <Td><b>{gameData[teamIndex].pts}</b></Td>
                                                <Td><b>{gameData[teamIndex].reb}</b></Td>
                                                <Td><b>{gameData[teamIndex].ast}</b></Td>
                                                <Td><b>{gameData[teamIndex].stl}</b></Td>
                                                <Td><b>{gameData[teamIndex].blk}</b></Td>
                                                <Td><b>{`${gameData[teamIndex].fgm} / ${gameData[teamIndex].fga}`}</b></Td>
                                                <Td><b>{`${gameData[teamIndex].ftm} / ${gameData[teamIndex].fta}`}</b></Td>
                                                <Td><b>{`${gameData[teamIndex].fg3m} / ${gameData[teamIndex].fg3a}`}</b></Td>
                                                <Td><b>{gameData[teamIndex].pf}</b></Td>
                                                <Td></Td>
                                        </Tr>
                                    </Tbody>
                                </Table>
                            </Box>
                        ))}
                    </Box>

                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Betting Data
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Book Name</Th>
                                    <Th>Moneyline Price Away</Th>
                                    <Th>Moneyline Price Home</Th>
                                    <Th>Spread Away</Th>
                                    <Th>Spread Price Away</Th>
                                    <Th>Spread Home</Th>
                                    <Th>Spread Price Home</Th>
                                    <Th>Over/Under</Th>
                                    <Th>Over Price</Th>
                                    <Th>Under Price</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {gameBetting.map((bet, index) => (
                                    <Tr key={index}>
                                        <Td>{bet.book_name}</Td>
                                        <Td>{bet.moneyline_price1}</Td>
                                        <Td>{bet.moneyline_price2}</Td>
                                        <Td>{bet.spread1}</Td>
                                        <Td>{bet.spread_price1}</Td>
                                        <Td>{bet.spread2}</Td>
                                        <Td>{bet.spread_price2}</Td>
                                        <Td>{bet.total1}</Td>
                                        <Td>{bet.total_price1}</Td>
                                        <Td>{bet.total_price2}</Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>

                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Matchup Stats
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Home Team Wins</Th>
                                    <Th>Away Team Wins</Th>
                                    <Th>Home Team Average Points</Th>
                                    <Th>Away Team Average Points</Th>
                                    <Th>Average Home Spread</Th>
                                    <Th>Average Away Spread</Th>
                                    <Th>Average Over/Under</Th>
                                    <Th>Average Moneyline Price Home</Th>
                                    <Th>Average Moneyline Price Away</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {matchupStats.map((x, index) => (
                                    <Tr key={index}>
                                        <Td>{x.team1_wins}</Td>
                                        <Td>{x.team2_wins}</Td>
                                        <Td>{x.avg_pts_team1.toFixed(1)}</Td>
                                        <Td>{x.avg_pts_team2.toFixed(1)}</Td>
                                        <Td>{x.avg_spread_team1.toFixed(1)}</Td>
                                        <Td>{x.avg_spread_team2.toFixed(1)}</Td>
                                        <Td>{x.average_total.toFixed(1)}</Td>
                                        <Td>{x.avg_moneyline_price_team1.toFixed(2)}</Td>
                                        <Td>{x.avg_moneyline_price_team2.toFixed(2)}</Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>
                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Advanced Matchup Stats
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Spread Covers Home</Th>
                                    <Th>Spread Covers Away</Th>
                                    <Th>Underdog Wins Home</Th>
                                    <Th>Underdog Wins Away</Th>
                                    <Th>Underdog Money Home</Th>
                                    <Th>Underdog Money Away</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {matchupStats.map((x, index) => (
                                    <Tr key={index}>
                                        <Td>{x.spread_success_team1}</Td>
                                        <Td>{x.spread_success_team2}</Td>
                                        <Td>{x.underdog_wins_team1}</Td>
                                        <Td>{x.underdog_wins_team2}</Td>
                                        <Td>{x.total_money_team1.toFixed(2)}</Td>
                                        <Td>{x.total_money_team2.toFixed(2)}</Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>
                    <Box w="100%">
                        <Text fontSize="xl" fontWeight="bold">
                            Top Player Matchups
                        </Text>
                        <Table variant="simple">
                            <Thead>
                                <Tr>
                                    <Th>Home Team Player</Th>
                                    <Th>Away Team Player</Th>
                                    <Th>Total Games Played</Th>
                                    <Th>Average Percentage of Points Scored</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {matchupTopPairs.map((y, index) => (
                                    <Tr key={index}>
                                        <Td>{y.player1}</Td>
                                        <Td>{y.player2}</Td>
                                        <Td>{y.total_games}</Td>
                                        <Td>{`${(y.avg_pct_pts * 100).toFixed(1)}%`}</Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default GameCard;





