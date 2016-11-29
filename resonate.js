const osmosis = require('osmosis'),
  R = require('ramda'),
  XLSX = require('XLSX'),
  Promise = require('bluebird'),
  request = Promise.promisifyAll(require('request')),
  Twitter = require('twitter'),
  path = require('path'),
  fs = require('fs'),
  cookie = require('cookie'),
  credentials = require('./credentials.json'),
  config = require('./config.json'),
  SlackUploader = Promise.promisifyAll(require('node-slack-upload')),
  slackUploader = Promise.promisifyAll(new SlackUploader(credentials.slackToken)),
  ws_name = "resonate profiles",
  twitterAttributes = ['username', 'followers_count', 'friends_count', 'statuses_count', 'favourites_count', 'listed_count'];

function Workbook() {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

var wb = new Workbook();
var ws = {};
var range = {s: {c: 0, r: 0}, e: {c: 0, r: 0}};
var currentCount = 0;
var userCount = 0;

var logWithCount = function (message) {
  console.log(`[${currentCount}/${userCount}]: ${message}`);
};

var getUserDirectory = function () {
  process.stdout.write('getting user directory... ');
  return request.getAsync({
    url: 'https://resonate.is/um-api/get.users/',
    qs: {
      number: 10,
      key: credentials.resonateKey,
      token: credentials.resonateToken
    },
    json: true
  })
    .then(function (res) {
      process.stdout.write("done.\n");
      userCount = R.values(res.body).length;
      console.log(`read ${userCount} users from API`);
      return R.values(res.body);
    });
};
var getTwitterInfo = function (twitterUrl) {
  logWithCount('getting twitter profile information')
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
      .error(logWithCount);
    //.debug(console.log);
  });
};
var getFullResonateProfileInfo = function (resonateProfile) {
  resonateProfile.profileLink = 'https://resonate.is/profile/' + resonateProfile.ID;
  currentCount++;
  logWithCount(`getting full profile information for user with login "${R.prop('user_login', resonateProfile)}"`);
  return new Promise(function (resolve, reject) {
    var profileInfo = {profileLink: resonateProfile.profileLink};
    osmosis
      .get(resonateProfile.profileLink)
      .set({
        //'username': "h1.entry-title[2]@value",
        'username': "h1[contains(@class, 'entry-title')][1]",
        'genres': "div[contains(@class, 'um-main-meta')]/div[contains(@class, 'genre')][1]/[2]",
        'label': "div[contains(@class, 'um-main-meta')]/div[contains(@class, 'genre')][2]/[2]",
        'location': "div[contains(@class, 'um-main-meta')]/div[contains(@class, 'genre')][3]/[2]",
        'twitterUrl': "a[@title='Twitter']/@href",
        'facebookUrl': "a[@title='Facebook']/@href",
        'instagramUrl': "a[@title='Instagram']/@href",
        'blogs': 'label[for="musicblogs-1885"]'
      })
      .data(function (result) {
        profileInfo = R.merge(profileInfo, result);
      })
      .done(function () {
        request.getAsync({
          url: 'https://resonate.is/um-api/get.user/',
          qs: {
            id: resonateProfile.ID,
            key: credentials.resonateKey,
            token: credentials.resonateToken,
            fields: 'musicblogs,instagram,twitter,facebook,display_name,user_nicename,mylabel,Musicstyles,user_registered'
          },
          json: true
        })
          .then(function (res) {
            profileInfo.blogs = R.split('\r\n', R.path(['body', 'musicblogs'], res));
            profileInfo.user_registered = R.path(['body', 'user_registered'], res);
            profileInfo.twitter = R.path(['body', 'twitter'], res);
            if (profileInfo.twitter && !(/(http(?:s)?:\/\/)?(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/.test(profileInfo.twitter))) {
              profileInfo.twitter = 'https://twitter.com/' + profileInfo.twitter;
            }
            resolve(profileInfo)
          })
          .catch(function (err) {
            resolve(profileInfo);
          });
      })
      //.log(console.log)
      .error(console.log);
    //.debug(console.log);
  });

  return request.getAsync({
    url: 'https://resonate.is/um-api/get.user/',
    qs: {
      id: resonateProfile.ID,
      key: credentials.resonateKey,
      token: credentials.resonateToken,
      fields: 'musicblogs,instagram,twitter,facebook,display_name,user_nicename,mylabel,Musicstyles,user_registered'
    },
    json: true
  })
    .then(function (res) {
      resonateProfile = R.merge(resonateProfile, R.path(['body'], res));
      if (resonateProfile.twitter && !(/(http(?:s)?:\/\/)?(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/.test(resonateProfile.twitter))) {
        resonateProfile.twitter = 'https://twitter.com/' + resonateProfile.twitter;
      }
      return resonateProfile;
    })
    .catch(function (err) {
      return resonateProfile
    });
};
var getAllInfo = function (resonateProfile) {
  return getFullResonateProfileInfo(resonateProfile)
    .then(function (fullResonateProfile) {
      if (fullResonateProfile.twitter) {
        return getTwitterInfo(fullResonateProfile.twitter)
          .then(function (twitterInfo) {
            var twitterInfoFiltered = R.fromPairs(R.filter(R.compose(R.contains(R.__, twitterAttributes), R.head), R.toPairs(twitterInfo)));
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

getUserDirectory()
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
      config.outputFile = `${dd}_${mm}_${yyyy}_${config.outputFile}`;
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
  })
  .catch(console.log);