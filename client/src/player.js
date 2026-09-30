import React, { useState, useEffect, useRef } from "react";
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
    TableContainer,
} from "@chakra-ui/react";
import axios from "axios";
import PlayerCard from "./playercard";

// PlayerPage frontend component
const PlayerPage = () => {
  const [playerData, setPlayerData] = useState(null);
  const [playerName, setPlayerName] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  // On narrow screens the details sit below the list, so bring them into view
  // when a row is chosen; otherwise the tap looks like it did nothing.
  const detailsRef = useRef(null);
  useEffect(() => {
    if (selectedPlayer && detailsRef.current && window.innerWidth < 1280) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedPlayer]);
  const hoverBgColor = useColorModeValue("gray.200", "gray.700");

  const toast = useToast();

  // handles a search on player name
  const handleSearch = async (page = 1, name = playerName) => {
    try {
      const queryParams = {
        page: page,
      };

      if (name) {
        queryParams["name"] = name;
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

  };

  /*
    Handles resetting the search form
  */
  const handleReset = () => {
    setPlayerName("");
    handleSearch(1, "");
  };

  /*
    Handles submitting the search form
  */
  const handleSubmit = (event) => {
    event.preventDefault();
    handleSearch();
  };

  return (
    <Flex direction={{ base: "column", xl: "row" }} width="100%" gap={6} align="start">
      <VStack spacing={6} width={{ base: "100%", xl: "30%" }} flexShrink={0}>
        <form onSubmit={handleSubmit}>
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
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
        <TableContainer w="100%"><Table mt={6} variant="simple" width="100%">
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
                  <Td>{ game.height_feet != null && game.height_inches != null ? 
                    game.height_feet + "'" + game.height_inches + '"' : "N/A"}</Td>
                    <Td>{game.weight ? game.weight : "N/A"}</Td>
                </Tr>
              ))}
          </Tbody>
        </Table></TableContainer>
        <Flex mt={6} justifyContent="space-between" width="100%">
          <Button onClick={handlePrevPage} isDisabled={page <= 1}>
            Previous
          </Button>
          <Text fontWeight="bold">Page {page}</Text>
          <Button onClick={handleNextPage} isDisabled={!playerData || playerData.length < 20}>Next</Button>
        </Flex>
      </VStack>
      <Box flex="1" width="100%" minW={0} ref={detailsRef} scrollMarginTop={4}>
        <PlayerCard player={selectedPlayer} />
      </Box>
    </Flex>
  );
};

export default PlayerPage;
