const Promise = require('bluebird'),
  request = Promise.promisifyAll(require('request')),
  R = require('ramda'),
  musicStyles = require('../json/musicstyles.json');

function resonateScraper(credentials, logger) {
  this.credentials = credentials;
  this.logger = logger;
}

resonateScraper.prototype.getUserDirectory = function () {
  process.stdout.write('getting user directory... ');
  return request.getAsync({
    url: 'https://resonate.is/um-api/get.users/',
    qs: {
      number: 100,
      key: this.credentials.resonateKey,
      token: this.credentials.resonateToken
    },
    json: true
  })
    .bind(this)
    .then(function (res) {
      process.stdout.write("done.\n");
      var userCount = R.values(res.body).length;
      console.log(`read ${userCount} users from API`);
      this.logger.userCount = userCount;
      return R.values(res.body);
    });
};

resonateScraper.prototype.getFullResonateProfileInfo = function (resonateProfile) {
  resonateProfile.profileLink = 'https://resonate.is/profile/' + resonateProfile.ID;
  this.logger.increment();
  this.logger.logWithCount(`getting full profile information for user with login "${R.prop('user_login', resonateProfile)}"`);

  var profileInfo = {profileLink: resonateProfile.profileLink};
  return request.getAsync({
    url: 'https://resonate.is/um-api/get.user/',
    qs: {
      id: resonateProfile.ID,
      key: this.credentials.resonateKey,
      token: this.credentials.resonateToken,
      fields: 'musicblogs,instagram,twitter,facebook,display_name,user_nicename,mylabel,Musicstyles,user_registered'
    },
    json: true
  })
    .then(function (res) {
      var regex = /"(.*?)"/g;
      var matches, musicStyleIds = [];
      while (matches = regex.exec(R.path(['body', 'Musicstyles'], res))) {
        musicStyleIds.push(matches[1]);
      }

      profileInfo.genres = R.join(',', R.map(function (styleId) {
        return R.prop('name', R.find(R.propEq('term_id', parseInt(styleId, 10)))(musicStyles));
      }, musicStyleIds));

      profileInfo.blogs = R.split('\r\n', R.path(['body', 'musicblogs'], res));
      profileInfo.facebook = R.path(['body', 'facebook'], res);
      profileInfo.username = R.path(['body', 'username'], res);
      profileInfo.instagram = R.path(['body', 'instagram'], res);
      profileInfo.user_registered = R.path(['body', 'user_registered'], res);
      profileInfo.twitter = R.path(['body', 'twitter'], res);
      if (profileInfo.twitter && !(/(http(?:s)?:\/\/)?(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/.test(profileInfo.twitter))) {
        profileInfo.twitter = 'https://twitter.com/' + profileInfo.twitter;
      }
      var labelId = R.path(['body', 'mylabel'], res);
      if (labelId) {
        return request.getAsync({
          url: 'https://resonate.is/um-api/get.user/',
          qs: {
            id: labelId,
            key: credentials.resonateKey,
            token: credentials.resonateToken,
            fields: 'musicblogs,instagram,twitter,facebook,display_name,user_nicename,mylabel,Musicstyles,user_registered'
          },
          json: true
        });
      } else {
        return;
      }
    })
    .then(function (res) {
      if (res) {
        profileInfo.label = R.path(['body', 'username'], res);
      }
      return profileInfo
    })
    .catch(function (err) {
      return profileInfo;
    });

};

module.exports = resonateScraper;