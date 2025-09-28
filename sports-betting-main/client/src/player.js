import React, { useState, useEffect } from "react";
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
  useToast,
  Tbody,
  Table,
  Thead,
  Th,
  Tr,
  Td,
  Flex,
  Center,
  useColorModeValue,
} from "@chakra-ui/react";
import axios from "axios";
import PlayerCard from "./playercard";

// PlayerPage frontend component
const PlayerPage = () => {
  const [playerData, setPlayerData] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerUnderdog, setPlayerUnderdog] = useState([]);
  const hoverBgColor = useColorModeValue("gray.200", "gray.700");

  const toast = useToast();

  // handles a search on player name
  const handleSearch = async (page = 1) => {
    try {
      const queryParams = {
        page: page,
      };

      if (playerName) {
        queryParams["name"] = playerName;
      } else {
        queryParams["name"] = '';
      }

      console.log(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/player/search`);
      const response = await axios.get(
        `${process.env.REACT_APP_EXPRESS_APP_API_URL}/player/search`,
        {
          params: queryParams,
        }
      );
      console.log(response.data);
      setPlayerData(response.data);
      setPage(page);
    } catch (error) {
      console.log(error);
      toast({
        title: "Error",
        description: "An error occurred during the search. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    handleSearch(1);
  }, []);

  /*
    Handles moving to the previous page of results
  */
  const handlePrevPage = () => {
    if (page > 1) {
      handleSearch(page - 1);
    }
  };

  /*
    Handles moving to the next page of results
  */
  const handleNextPage = () => {
    handleSearch(page + 1);
  };

  // calls routes to fetch data for player clicked
  const handlePlayerClick = (person_id) => {
    const curPlayer = playerData.filter((p) => p.person_id === person_id)[0];
    console.log(curPlayer);
    setSelectedPlayer(curPlayer);

    console.log(`/player/${curPlayer}/underdog_money`)
    const underdogMoneyRes = axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/player/${curPlayer}/underdog_money`);
    setPlayerUnderdog(underdogMoneyRes.data);
  };

  /*
    Handles resetting the search form
  */
  const handleReset = () => {
    setPlayerName("");
    handleSearch();
  };

  /*
    Handles submitting the search form
  */
  const handleSubmit = (event) => {
    event.preventDefault();
    handleSearch();
  };

  return (
    <Flex direction="row">
      <VStack spacing={6}>
        <form onSubmit={handleSubmit}>
          <Grid templateColumns="repeat(3, 1fr)" gap={4}>
            <FormControl>
              <FormLabel>Player Name</FormLabel>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </FormControl>
          </Grid>
          <Center mt={4}>
            <Button onClick={handleReset} colorScheme="teal" mr={2}>
              Reset
            </Button>
            <Button type="submit" colorScheme="teal" ml={2}>
              Search
            </Button>
          </Center>
        </form>
        <Table mt={6} variant="simple" width="100%">
          <Thead>
            <Tr>
              <Th>Player Name</Th>
              <Th>Height</Th>
              <Th>Weight (lbs)</Th>
            </Tr>
          </Thead>
          <Tbody>
            {playerData &&
              playerData.map((game) => (
                <Tr
                  key={game.person_id}
                  onClick={() => handlePlayerClick(game.person_id)}
                  cursor="pointer"
                  _hover={{ bg: hoverBgColor, transition: "all 0.2s" }}
                >
                  <Td fontWeight="bold">{game.display_first_last}</Td>
                  <Td>{ game.height_feet && game.height_inches ? 
                    game.height_feet + "'" + game.height_inches + '"' : "N/A"}</Td>
                    <Td>{game.weight ? game.weight : "N/A"}</Td>
                </Tr>
              ))}
          </Tbody>
        </Table>
        <Flex mt={6} justifyContent="space-between" width="100%">
          <Button onClick={handlePrevPage} disabled={page <= 1}>
            Previous
          </Button>
          <Text fontWeight="bold">Page {page}</Text>
          <Button onClick={handleNextPage}>Next</Button>
        </Flex>
      </VStack>
      <Box p={6}>
        <PlayerCard player={selectedPlayer} />
      </Box>
    </Flex>
  );
};

export default PlayerPage;
