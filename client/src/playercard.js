import React, { useEffect, useState } from "react";
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
} from "@chakra-ui/react";
import axios from "axios";

// frontend component for a player card
const PlayerCard = ({ player }) => {
  const [underdogStats, setUnderdogStats] = useState(null);
  const [spreadStats, setSpreadStats] = useState(null);
  const textColor = useColorModeValue("gray.700", "white");
  const cardBg = useColorModeValue("gray.100", "gray.900");

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("fetching data");
        const [underdogResponse, spreadResponse] = await Promise.all([
          axios.get(
            `${process.env.REACT_APP_EXPRESS_APP_API_URL}/player/${player.person_id}/player_underdog`
          ),
          axios.get(
            `${process.env.REACT_APP_EXPRESS_APP_API_URL}/player/${player.person_id}/spread_performance`
          ),
        ]);
        setUnderdogStats(underdogResponse.data[0]);
        setSpreadStats(spreadResponse.data[0]);
        console.log(underdogResponse.data);
        console.log(spreadResponse.data);
      } catch (error) {
        console.error(error);
      }
    };
    if (player) {
        setUnderdogStats(null);
        setSpreadStats(null);
      fetchData();
    }
  }, [player]);

return (
  <Box>
    {player && (
      <Box
        borderWidth="1px"
        borderRadius="lg"
        p={4}
        w="100%"
        backgroundColor={cardBg}
      >
        <Box w="100%">
          <Text fontSize="xl" fontWeight="bold">
            Player Information
          </Text>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Height</Th>
                <Th>Weight</Th>
                <Th>Career Span</Th>
                <Th>Jersey</Th>
                <Th>School</Th>
                <Th>Country</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>{player.display_first_last || "N/A"}</Td>
                <Td>
                  {player.height_feet && player.height_inches
                    ? player.height_feet + "'" + player.height_inches + '"'
                    : "N/A"}
                </Td>
                <Td>{player.weight ? player.weight + " lbs" : "N/A"}</Td>
                <Td>
                  {player.from_year && player.to_year
                    ? player.from_year + "-" + player.to_year
                    : "N/A"}
                </Td>
                <Td>{player.jersey || "N/A"}</Td>
                <Td>{player.school || "N/A"}</Td>
                <Td>{player.country || "N/A"}</Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>

        <Box w="100%">
          <Text fontSize="xl" fontWeight="bold">
            Counting Averages
          </Text>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>PTS</Th>
                <Th>AST</Th>
                <Th>RBD</Th>
                <Th>STL</Th>
                <Th>BLK</Th>
                <Th>MIN</Th>
                <Th>TOV</Th>
                <Th>PF</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>{player.pts ? player.pts.toFixed(2) : "N/A"}</Td>
                <Td>{player.ast ? player.ast.toFixed(2) : "N/A"}</Td>
                <Td>{player.reb ? player.reb.toFixed(2) : "N/A"}</Td>
                <Td>{player.stl ? player.stl.toFixed(2) : "N/A"}</Td>
                <Td>{player.blk ? player.blk.toFixed(2) : "N/A"}</Td>
                <Td>{player.min ? player.min.toFixed(2) : "N/A"}</Td>
                <Td>{player.tov ? player.tov.toFixed(2) : "N/A"}</Td>
                <Td>{player.pf ? player.pf.toFixed(2) : "N/A"}</Td>
              </Tr>
            </Tbody>
          </Table>
        </Box>
        <Box w="100%">
          <Text fontSize="xl" fontWeight="bold">
            Shooting Averages
          </Text>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>FG</Th>
                <Th>FG%</Th>
                <Th>FT</Th>
                <Th>FT%</Th>
                <Th>3P</Th>
                <Th>3P%</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>{`${player.fgm ? player.fgm.toFixed(1) : "N/A"} / ${
                  player.fga ? player.fga.toFixed(1) : "N/A"
                }`}</Td>
                <Td>
                  {player.fga && player.fgm
                    ? ((player.fgm / player.fga) * 100).toFixed(1) + "%"
                    : "N/A"}
                </Td>
                <Td>{`${player.ftm ? player.ftm.toFixed(1) : "N/A"} / ${
                  player.fta ? player.fta.toFixed(1) : "N/A"
                }`}</Td>
                <Td>
                  {player.fta && player.ftm
                    ? ((player.ftm / player.fta) * 100).toFixed(1) + "%"
                    : "N/A"}
                </Td>
                <Td>{`${player.fg3m ? player.fg3m.toFixed(1) : "N/A"} / ${
                  player.fg3a ? player.fg3a.toFixed(1) : "N/A"
                }`}</Td>
                <Td>
                  {player.fg3a && player.fg3m
                    ? ((player.fg3m / player.fg3a) * 100).toFixed(1) + "%"
                    : "N/A"}
                </Td>
              </Tr>
            </Tbody>
          </Table>
          <Text fontSize="xl" fontWeight="bold">
            Underdog Stats
          </Text>
          {underdogStats ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Underdog Games</Th>
                  <Th>Underdog Wins</Th>
                  <Th>Total Money</Th>
                  <Th>Money Per Game</Th>
                </Tr>
              </Thead>
              <Tbody>
                <Tr>
                  <Td>{underdogStats.total_games || "N/A"}</Td>
                  <Td>{underdogStats.underdog_wins || "N/A"}</Td>
                  <Td>{underdogStats.total_money || "N/A"}</Td>
                  <Td>{underdogStats.money_per_game || "N/A"}</Td>
                </Tr>
              </Tbody>
            </Table>
          ) : (
            <Text>No underdog stats available</Text>
          )}

          <Text fontSize="xl" fontWeight="bold">
            Spread Stats
          </Text>
          {spreadStats ? (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Spread Covers</Th>
                  <Th>Total Games</Th>
                  <Th>Spread Percentage</Th>
                </Tr>
              </Thead>
              <Tbody>
                <Tr>
                  <Td>{spreadStats.count || "N/A"}</Td>
                  <Td>{spreadStats.total_games || "N/A"}</Td>
                  <Td>{spreadStats ? (spreadStats.spread_percentage * 100).toFixed(1) : 'N/A'}%</Td>
                </Tr>
              </Tbody>
            </Table>
          ) : (
            <Text>No spread stats available</Text>
          )}
        </Box>
      </Box>
    )}
  </Box>
);
        };


export default PlayerCard;
