import React, { useState, useEffect, useRef } from 'react';
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
import TeamCard from './teamcard';

// frontend component for the team page
const TeamPage = () => {
    const [teamData, setTeamData] = useState(null);
    const [teamName, setTeamName] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState(null);
  // On narrow screens the details sit below the list, so bring them into view
  // when a row is chosen; otherwise the tap looks like it did nothing.
  const detailsRef = useRef(null);
  useEffect(() => {
    if (selectedTeamId && detailsRef.current && window.innerWidth < 1280) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedTeamId]);
    const hoverBgColor = useColorModeValue('gray.200', 'gray.700');


    const toast = useToast();

    // handles a search on player name
    const handleSearch = async (name = teamName) => {
        try {

            const queryParams = {};

            if (name) {
                queryParams['name-or-abbreviation'] = name;
            } else {
                queryParams['name-or-abbreviation'] = '';
            }

            console.log(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/search`)
            const response = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/search`, {
                params: queryParams,
            });
            setTeamData(response.data);
        } catch (error) {
            console.log(error);
            toast({
                title: 'Error',
                description: 'An error occurred during the search. Please try again.',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        }
    };


    useEffect(() => {
        handleSearch();
    }, []);

    const handleTeamClick = (teamId) => {
        console.log('Team clicked:', teamId);
        setSelectedTeamId(teamId);
    };

    const handleReset = () => {
        setTeamName('');
        handleSearch('');
    };

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
                    <FormLabel>Team</FormLabel>
                    <Input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
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
                        <Th>Team Name</Th>
                        <Th>Abbreviation</Th>
                    </Tr>
                </Thead>
                <Tbody>
                    {teamData &&
                        teamData.map((team) => (
                            <Tr
                                key={team.team_id}
                                onClick={() => handleTeamClick(team.team_id)}
                                cursor="pointer"
                                _hover={{ bg: hoverBgColor, transition: "all 0.2s" }}
                            >
                            <Td fontWeight="bold">{team.name}</Td>
                                <Td fontWeight="bold">{team.abbreviation}</Td>
                            </Tr>
                        ))}
                </Tbody>
            </Table></TableContainer>
        </VStack>
            <Box flex="1" width="100%" minW={0} ref={detailsRef} scrollMarginTop={4}>
                <TeamCard teamId={selectedTeamId} />
            </Box>
        </Flex>
    );
};

export default TeamPage;
