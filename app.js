const R = require('ramda'),
  XLSX = require('XLSX'),
  Promise = require('bluebird'),
  path = require('path'),
  fs = require('fs'),
  cookie = require('cookie'),
  credentials = require('./json/credentials.json'),
  SlackUploader = Promise.promisifyAll(require('node-slack-upload')),
  slackUploader = Promise.promisifyAll(new SlackUploader(credentials.slackToken)),
  ws_name = "resonate profiles",
  config = require('./json/config.json'),
  Logger = require('./src/logger.js'),
  logger = new Logger(),
  ResonateScraper = require('./src/resonate.js'),
  resonateScraper = new ResonateScraper(credentials, logger),
  TwitterScraper = require('./src/twitter.js'),
  twitterScraper = new TwitterScraper(logger);

function Workbook() {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

var wb = new Workbook();
var ws = {};
var range = {s: {c: 0, r: 0}, e: {c: 0, r: 0}};

var getAllInfo = function (resonateProfile) {
  return resonateScraper.getFullResonateProfileInfo(resonateProfile)
    .then(function (fullResonateProfile) {
      if (fullResonateProfile.twitter) {
        return twitterScraper.getTwitterInfo(fullResonateProfile.twitter)
          .then(function (twitterInfo) {
            var twitterInfoFiltered = R.fromPairs(R.filter(R.compose(R.contains(R.__, config.twitterAttributes), R.head), R.toPairs(twitterInfo)));
            var twitterInfoPrefixed = R.fromPairs(R.map(function (pair) {
              pair[0] = R.compose(R.concat('twitter_', R.__), R.head)(pair);
              return pair;
            }, R.toPairs(twitterInfoFiltered)));
            return R.merge(fullResonateProfile, twitterInfoPrefixed);
          });
      } else {
        return fullResonateProfile;
      }
    });
};

console.time('script execution duration');
resonateScraper.getUserDirectory()
  .bind({})
  .then(function (resonateProfiles) {
    console.log('start retrieving profile information for users...');
    return Promise.resolve(resonateProfiles)
      .map(getAllInfo, {concurrency: 1});
  })
  .then(function (results) {
    console.log('processing results...');
    //var columnTitles = R.keys(R.mergeAll(results));
    var columnTitles = config.outputAttributes;

    R.addIndex(R.forEach)(function (heading, headingIndex) {
      var cell_ref = XLSX.utils.encode_cell({c: headingIndex, r: 0});
      ws[cell_ref] = {t: "s", v: heading};
      range.e.c = headingIndex;
    }, columnTitles);

    R.addIndex(R.forEach)(function (userInfo, index) {
      R.addIndex(R.forEach)(function (key, keyIndex) {
        var cell_ref = XLSX.utils.encode_cell({c: keyIndex, r: index + 1});
        if (R.isArrayLike(userInfo[key])) {
          ws[cell_ref] = {t: "s", v: R.join(',', userInfo[key])};
        }
        else if (isNaN(userInfo[key])) {
          ws[cell_ref] = {t: "s", v: userInfo[key]};
        } else {
          ws[cell_ref] = {t: "n", v: userInfo[key]};
        }
        range.e.r = index + 1;
      }, columnTitles);
    }, results);

    ws['!ref'] = XLSX.utils.encode_range(range);

    /* add worksheet to workbook */
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;
    /* write file */

    console.log('writing results...');

    if (config.prependDate) {
      var today = new Date();
      var dd = today.getDate();
      var mm = today.getMonth() + 1; //January is 0!
      var yyyy = today.getFullYear();
      config.outputFile = `./results/${dd}_${mm}_${yyyy}_${config.outputFile}`;
    }

    XLSX.writeFile(wb, config.outputFile);

    if (config.upload) {
      slackUploader.uploadFileAsync({
        file: fs.createReadStream(config.outputFile),
        filetype: 'auto',
        title: config.outputFile,
        channels: '#twitterscraper'
      })
        .then(function (data) {
          console.log('Uploaded file details: ', data);
        })
        .catch(function (err) {
          console.log(err);
        });
    }
    console.log('done.');
    console.timeEnd('script execution duration');
  })
  .catch(console.log);