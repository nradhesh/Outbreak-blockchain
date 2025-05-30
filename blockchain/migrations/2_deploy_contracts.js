const OutbreakTracking = artifacts.require("OutbreakTracking");

module.exports = function (deployer) {
    // Deploy with a default radius of 5000 meters (5km)
    deployer.deploy(OutbreakTracking, 5000);
};