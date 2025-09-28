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
import TeamCard from './teamcard';

// frontend component for the team page
const TeamPage = () => {
    const [teamData, setTeamData] = useState(null);
    const [teamName, setTeamName] = useState('');
    const [page, setPage] = useState(1);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const hoverBgColor = useColorModeValue('gray.200', 'gray.700');


    const toast = useToast();

    // handles a search on player name
    const handleSearch = async (page = 1) => {
        try {

            const queryParams = {
                'page': page,
            };

            if (teamName) {
                queryParams['name-or-abbreviation'] = teamName;
            } else {
                queryParams['name-or-abbreviation'] = '';
            }

            console.log(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/search`)
            const response = await axios.get(`${process.env.REACT_APP_EXPRESS_APP_API_URL}/team/search`, {
                params: queryParams,
            });
            setTeamData(response.data);
            setPage(page);
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
        handleSearch(1);
    }, []);

    const handlePrevPage = () => {
        if (page > 1) {
            handleSearch(page - 1);
        }
    };

    const handleNextPage = () => {
        handleSearch(page + 1);
    };

    const handleTeamClick = (teamId) => {
        console.log('Team clicked:', teamId);
        setSelectedTeamId(teamId);
    };

    const handleReset = () => {
        setTeamName('');
        handleSearch();
    };

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
            <Table mt={6} variant="simple" width="100%">
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
            </Table>
            <Flex mt={6} justifyContent="space-between" width="100%">
                <Button onClick={handlePrevPage} disabled={page <= 1}>
                    Previous
                </Button>
                <Text fontWeight="bold">Page {page}</Text>
                <Button onClick={handleNextPage}>
                    Next
                </Button>
            </Flex>
        </VStack>
            <Box p={6}>
                <TeamCard teamId={selectedTeamId} />
            </Box>
        </Flex>
    );
};

export default TeamPage;
