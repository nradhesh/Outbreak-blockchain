// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OutbreakTracking {
    address public owner;
    uint256 public outbreakRadius; // in meters
    
    struct InfectedIndividual {
        address individualAddress;
        string location; // GPS coordinates in format "latitude,longitude"
        bool testResult;
        uint256 timestamp;
    }
    
    struct OutbreakLocation {
        string location;
        uint256 infectedCount;
        uint256 timestamp;
    }
    
    struct Coordinate {
        int256 latitude;  // Latitude in 6 decimal precision (multiply by 1e6)
        int256 longitude; // Longitude in 6 decimal precision (multiply by 1e6)
    }
    
    InfectedIndividual[] public infectedIndividuals;
    OutbreakLocation[] public outbreakLocations;
    
    // Events for notifications
    event NewInfection(address indexed individualAddress, string location, uint256 timestamp);
    event PotentialOutbreak(string location, uint256 infectedCount, uint256 timestamp);
    event ProximityAlert(address indexed user, string userLocation, string outbreakLocation, uint256 distance);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor(uint256 _radius) {
        owner = msg.sender;
        outbreakRadius = _radius;
    }
    
    function reportInfection(address _individualAddress, string memory _location, bool _testResult) public {
        // In a real implementation, this function might be restricted to authorized medical facilities
        
        if (_testResult) {
            // Add to infected individuals
            infectedIndividuals.push(InfectedIndividual({
                individualAddress: _individualAddress,
                location: _location,
                testResult: _testResult,
                timestamp: block.timestamp
            }));
            
            // Check if this location is already marked as an outbreak area
            bool locationExists = false;
            for (uint256 i = 0; i < outbreakLocations.length; i++) {
                if (compareLocations(outbreakLocations[i].location, _location)) {
                    outbreakLocations[i].infectedCount++;
                    outbreakLocations[i].timestamp = block.timestamp;
                    locationExists = true;
                    
                    // Notify about increased infections at this location
                    emit PotentialOutbreak(_location, outbreakLocations[i].infectedCount, block.timestamp);
                    break;
                }
            }
            
            // If it's a new outbreak location
            if (!locationExists) {
                outbreakLocations.push(OutbreakLocation({
                    location: _location,
                    infectedCount: 1,
                    timestamp: block.timestamp
                }));
                
                // Notify about a new infection location
                emit NewInfection(_individualAddress, _location, block.timestamp);
            }
            
            // Check proximity to other outbreak locations and potentially merge them
            checkAndMergeOutbreaks(_location);
        }
    }
    
    function checkProximity(string memory _newLocation) public view returns (bool, string memory, uint256, uint256) {
        // Check if the new location is within the radius of any known outbreak
        uint256 closestDistance = type(uint256).max;
        uint256 closestIndex = 0;
        bool foundInRadius = false;
        
        for (uint256 i = 0; i < outbreakLocations.length; i++) {
            (bool inRadius, uint256 distance) = isWithinRadius(_newLocation, outbreakLocations[i].location, outbreakRadius);
            
            if (inRadius && distance < closestDistance) {
                closestDistance = distance;
                closestIndex = i;
                foundInRadius = true;
            }
        }
        
        if (foundInRadius) {
            return (true, outbreakLocations[closestIndex].location, outbreakLocations[closestIndex].infectedCount, closestDistance);
        }
        
        return (false, "", 0, 0);
    }
    
    function reportNewLocation(string memory _location) public {
        // Check if the new location is within the radius of any known outbreak
        (bool withinRadius, string memory outbreakLocation, uint256 infectedCount, uint256 distance) = checkProximity(_location);
        
        if (withinRadius) {
            // This is a notification for users who are near an outbreak area
            emit ProximityAlert(msg.sender, _location, outbreakLocation, distance);
            emit PotentialOutbreak(outbreakLocation, infectedCount, block.timestamp);
        }
    }
    
    // Helper function to check if a new outbreak location should be merged with existing ones
    function checkAndMergeOutbreaks(string memory _newLocation) internal {
        // This would be implemented in a real system to merge nearby outbreak locations
        // For simplicity, we'll just check for nearby outbreak locations
        for (uint256 i = 0; i < outbreakLocations.length; i++) {
            // Skip the new location itself
            if (compareLocations(outbreakLocations[i].location, _newLocation)) {
                continue;
            }
            
            (bool inRadius, ) = isWithinRadius(outbreakLocations[i].location, _newLocation, outbreakRadius);
            if (inRadius) {
                // We found a nearby outbreak location
                // In a real system, we might merge these locations or create a "hot zone"
                emit PotentialOutbreak(_newLocation, outbreakLocations[i].infectedCount, block.timestamp);
            }
        }
    }
    
    // Parse a coordinate string into a Coordinate struct
    function parseCoordinate(string memory _location) internal pure returns (Coordinate memory) {
        bytes memory locationBytes = bytes(_location);
        
        // Find the comma separator
        uint256 commaIndex = 0;
        for (uint256 i = 0; i < locationBytes.length; i++) {
            if (locationBytes[i] == ',') {
                commaIndex = i;
                break;
            }
        }
        
        require(commaIndex > 0 && commaIndex < locationBytes.length - 1, "Invalid coordinate format");
        
        // Parse latitude and longitude as strings
        string memory latStr = substring(_location, 0, commaIndex);
        string memory lonStr = substring(_location, commaIndex + 1, locationBytes.length - commaIndex - 1);
        
        // Convert strings to integers (with 6 decimal precision)
        int256 latitude = parseCoordinateValue(latStr);
        int256 longitude = parseCoordinateValue(lonStr);
        
        return Coordinate(latitude, longitude);
    }
    
    // Extract substring from a string
    function substring(string memory str, uint256 startIndex, uint256 length) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(length);
        
        for (uint256 i = 0; i < length; i++) {
            result[i] = strBytes[startIndex + i];
        }
        
        return string(result);
    }
    
    // Parse a decimal coordinate value to int256 with 6 decimal precision
    function parseCoordinateValue(string memory str) internal pure returns (int256) {
        bytes memory strBytes = bytes(str);
        bool isNegative = false;
        uint256 startIndex = 0;
        
        // Check for negative sign
        if (strBytes.length > 0 && strBytes[0] == '-') {
            isNegative = true;
            startIndex = 1;
        }
        
        int256 result = 0;
        int256 decimalMultiplier = 1000000; // 6 decimal places precision
        bool foundDecimal = false;
        
        for (uint256 i = startIndex; i < strBytes.length; i++) {
            if (strBytes[i] == '.') {
                foundDecimal = true;
                continue;
            }
            
            uint8 digit = uint8(strBytes[i]) - 48; // ASCII to number
            require(digit <= 9, "Invalid character in coordinate");
            
            if (!foundDecimal) {
                result = result * 10 + int256(uint256(digit));
            } else {
                decimalMultiplier /= 10;
                result = result + int256(uint256(digit)) * decimalMultiplier;
            }
        }
        
        if (!foundDecimal) {
            result *= 1000000; // If no decimal was found, multiply by 10^6
        }
        
        if (isNegative) {
            result = -result;
        }
        
        return result;
    }
    
    // Helper functions
    function compareLocations(string memory loc1, string memory loc2) internal pure returns (bool) {
        // Simple string comparison - returns true if the coordinates are exactly the same
        return keccak256(abi.encodePacked(loc1)) == keccak256(abi.encodePacked(loc2));
    }
    
    function isWithinRadius(string memory loc1, string memory loc2, uint256 radius) internal pure returns (bool, uint256) {
        // Calculate the distance between two GPS coordinates using the Haversine formula
        uint256 distance = calculateDistance(loc1, loc2);
        
        // Check if the distance is within the specified radius
        return (distance <= radius, distance);
    }
    
    // Implementation of the Haversine formula to calculate distance between two GPS coordinates
    function calculateDistance(string memory loc1, string memory loc2) internal pure returns (uint256) {
        Coordinate memory coord1 = parseCoordinate(loc1);
        Coordinate memory coord2 = parseCoordinate(loc2);
        
        // Earth radius in meters
        uint256 earthRadius = 6371000;
        
        // Convert latitude and longitude from millionths to radians
        // We're working with fixed point math where 1 = 1e6
        int256 precision = 1000000;
        
        // Convert lat1 to radians (lat1 * PI / 180)
        int256 lat1Rad = (coord1.latitude * 3141592) / (180 * precision);
        int256 lon1Rad = (coord1.longitude * 3141592) / (180 * precision);
        int256 lat2Rad = (coord2.latitude * 3141592) / (180 * precision);
        int256 lon2Rad = (coord2.longitude * 3141592) / (180 * precision);
        
        // Calculate differences
        int256 dLat = lat2Rad - lat1Rad;
        int256 dLon = lon2Rad - lon1Rad;
        
        // Haversine formula components
        // a = sin²(dLat/2) + cos(lat1) * cos(lat2) * sin²(dLon/2)
        // Since we don't have sin/cos functions in Solidity,
        // we'll use a simplified Pythagorean approximation for small distances
        
        // For small distances on Earth, we can use an approximation:
        // distance ≈ √((dLat*R)² + (dLon*R*cos(lat))²)
        
        // Approximate cos(lat) as 1 at equator, 0 at poles
        // cos(lat) ≈ (90° - |lat|) / 90°
        int256 cosLat1 = ((90 * precision) - abs(coord1.latitude / precision)) * precision / (90 * precision);
        
        // Calculate x and y components of distance
        int256 x = dLat * int256(earthRadius) / precision;
        int256 y = dLon * int256(earthRadius) * cosLat1 / (precision * precision);
        
        // Calculate distance using the Pythagorean theorem
        uint256 distance = uint256(sqrt((x * x + y * y)));
        
        return distance;
    }
    
    // Simple absolute value function for int256
    function abs(int256 x) internal pure returns (int256) {
        return x >= 0 ? x : -x;
    }
    
    // Square root function using Newton's method for uint256
    function sqrt(int256 x) internal pure returns (int256) {
        if (x <= 0) return 0;
        
        uint256 z = uint256(x);
        uint256 y = (z + 1) / 2;
        uint256 w = z;
        
        while (y < w) {
            w = y;
            y = (z / y + y) / 2;
        }
        
        return int256(w);
    }
    
    // Administrative functions
    function setOutbreakRadius(uint256 _newRadius) public onlyOwner {
        outbreakRadius = _newRadius;
    }
    
    function getInfectedCount() public view returns (uint256) {
        return infectedIndividuals.length;
    }
    
    function getOutbreakLocationsCount() public view returns (uint256) {
        return outbreakLocations.length;
    }
    
    // Get all outbreak locations for display on the frontend
    function getAllOutbreakLocations() public view returns (string[] memory locations, uint256[] memory counts) {
        locations = new string[](outbreakLocations.length);
        counts = new uint256[](outbreakLocations.length);
        
        for (uint256 i = 0; i < outbreakLocations.length; i++) {
            locations[i] = outbreakLocations[i].location;
            counts[i] = outbreakLocations[i].infectedCount;
        }
        
        return (locations, counts);
    }
    
    // Function to query if a user has been in proximity to any infected individuals
    function checkExposureRisk(string memory _userLocation, uint256 _timeThreshold) public view returns (bool exposed, uint256 exposureCount) {
        uint256 currentTime = block.timestamp;
        exposed = false;
        exposureCount = 0;
        
        for (uint256 i = 0; i < infectedIndividuals.length; i++) {
            // Skip records older than the threshold
            if (currentTime - infectedIndividuals[i].timestamp > _timeThreshold) {
                continue;
            }
            
            (bool inRadius, ) = isWithinRadius(_userLocation, infectedIndividuals[i].location, outbreakRadius);
            
            if (inRadius) {
                exposed = true;
                exposureCount++;
            }
        }
        
        return (exposed, exposureCount);
    }
}