const Logger = require('../src/logger.js'),
  logger = new Logger(),
  ResonateScraper = require('../src/resonate.js'),
  credentials = require('../json/credentials.json'),
  resonateScraper = new ResonateScraper(credentials, logger),
  resonateProfiles = require('./mocks/resonateProfiles.json'),
  should = require('should');

describe('resonateScraper', function () {
  describe('#getFullResonateProfileInfo()', function () {
    it('should return test', function () {
      this.timeout(3000);
      return resonateScraper.getFullResonateProfileInfo(resonateProfiles[0])
        .then(function (fullResonateProfile) {
          fullResonateProfile.should.have.property('profileLink');
          fullResonateProfile.should.have.property('genres');
          fullResonateProfile.should.have.property('blogs');
          fullResonateProfile.should.have.property('facebook');
          fullResonateProfile.should.have.property('username');
          fullResonateProfile.should.have.property('user_registered');
          fullResonateProfile.should.have.property('twitter');
        });
    });
  });
});