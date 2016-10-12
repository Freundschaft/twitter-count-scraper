var osmosis = require('osmosis'),
  R = require('ramda'),
  XLSX = require('XLSX'),
  Promise = require('bluebird'),
  request = Promise.promisifyAll(require('request')),
  Twitter = require('twitter'),
  cookie = require('cookie'),
  credentials = require('./credentials.json'),
  client = new Twitter({
    consumer_key: '',
    consumer_secret: '',
    access_token_key: '',
    access_token_secret: ''
  });

var ws_name = "resonate profiles";
var attributes = ['resonateProfileLink', 'genres', 'label', 'location'];
var twitterAttributes = ['username', 'followers_count', 'friends_count', 'statuses_count', 'favourites_count', 'listed_count'];

function Workbook() {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

var wb = new Workbook();
var ws = {};
var range = {s: {c: 0, r: 0}, e: {c: 0, r: 0}};

var getUserDirectory = function () {
  return new Promise(function (resolve, reject) {
    var resonateProfileLinks = [];

    osmosis
      .get('https://resonate.is/directories/latest-musicians-twitter/?members_page=1')
      .login(credentials.resonateUsername, credentials.resonatePassword)
      .then(function (result) {
        var cookies = cookie.parse(result.request.headers.cookie);
        osmosis.config('cookies', cookies);
      })
      .paginate("a[@title='Next']")
      .find("div[contains(@class, 'um-member-photo')]//a@href")
      .set('resonateProfileLink')
      .data(function (data) {
        resonateProfileLinks.push(data.resonateProfileLink.split('/')[data.resonateProfileLink.split('/').length - 2]);
      })
      .done(function () {
        resolve(resonateProfileLinks);
      })
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};

var getTwitterInfo = function (twitterUrl) {
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
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};

var getResonateProfileInfo = function (resonateProfileId) {
  return new Promise(function (resolve, reject) {
    var resonateProfileLink = 'https://resonate.is/profile/' + resonateProfileId;
    var profileInfo = {profileLink: resonateProfileLink};
    osmosis
      .get(resonateProfileLink)
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
            id: resonateProfileId,
            key: credentials.resonateKey,
            token: credentials.resonateToken,
            fields: 'musicblogs,instagram,twitter,facebook,display_name,user_nicename,mylabel,Musicstyles'
          },
          json: true
        })
          .then(function (res) {
            profileInfo.blogs = R.split('\r\n', R.path(['body', 'musicblogs'], res));
            resolve(profileInfo)
          })
          .catch(function (err) {
            resolve(profileInfo);
          });
      })
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};

function getAllInfo(resonanteProfileId) {
  return getResonateProfileInfo(resonanteProfileId).bind(this)
    .then(function (profileInfo) {
      this.profileInfo = profileInfo;
      if (profileInfo.twitterUrl) {
        return getTwitterInfo(profileInfo.twitterUrl)
          .then(function (twitterInfo) {
            var twitterInfoFiltered = R.fromPairs(R.filter(R.compose(R.contains(R.__, twitterAttributes), R.head), R.toPairs(twitterInfo)));
            var twitterInfoPrefixed = R.fromPairs(R.map(function (pair) {
              pair[0] = R.compose(R.concat('twitter_', R.__), R.head)(pair);
              return pair;
            }, R.toPairs(twitterInfoFiltered)));
            return R.merge(this.profileInfo, twitterInfoPrefixed);
          });
      } else {
        return this.profileInfo;
      }
    });
}

getUserDirectory()
  .then(function (resonateProfileIds) {
    return Promise.resolve(resonateProfileIds)
      .map(getAllInfo, {concurrency: 1});
  })
  .then(function (results) {
    console.log('processing results...');
    R.addIndex(R.forEach)(function (heading, headingIndex) {
      var cell_ref = XLSX.utils.encode_cell({c: headingIndex, r: 0});
      ws[cell_ref] = {t: "s", v: heading};
      range.e.c = headingIndex;
    }, R.keys(R.mergeAll(results)));
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
      }, R.keys(R.mergeAll(results)));
    }, results);

    ws['!ref'] = XLSX.utils.encode_range(range);

    /* add worksheet to workbook */
    wb.SheetNames.push(ws_name);
    wb.Sheets[ws_name] = ws;
    /* write file */
    console.log('writing results...');
    XLSX.writeFile(wb, 'results.xlsx');
    console.log('done.');
  })
  .catch(console.log);

/*

 var params = {screen_name: 'resonatecoop'};
 client.get('followers/ids', params, function (error, tweets, response) {
 if (!error) {
 console.log(tweets);
 }
 });
 */