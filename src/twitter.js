const osmosis = require('osmosis'),
  R = require('ramda');

function twitterScraper(logger) {
  this.logger = logger;
}

twitterScraper.prototype.getTwitterInfo = function (twitterUrl) {
  this.logger.logWithCount('getting twitter profile information');
  var self = this;
  return new Promise(function (resolve, reject) {
    var twitterUsername = twitterUrl.substr(twitterUrl.lastIndexOf('/') + 1);
    var twitterInfo = {username: twitterUsername};
    osmosis
      .get(twitterUrl)
      .find("#init-data/@value")
      .set('jsonData')
      .data(function (result) {
        twitterInfo = R.merge(twitterInfo, JSON.parse(result.jsonData).profile_user);
      })
      .done(function () {
        resolve(twitterInfo);
      })
      //.log(console.log)
      .error(self.logger.logWithCount);
    //.debug(console.log);
  });
};

module.exports = twitterScraper;