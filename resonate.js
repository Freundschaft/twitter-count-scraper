var osmosis = require('osmosis'),
  R = require('ramda'),
  XLSX = require('XLSX'),
  Promise = require('bluebird'),
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
var attributes = ['username', 'Genres', 'Label', 'Location'];

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
      .get('https://resonate.is/directories/latest-musicians-twitter/?members_page=50')
      .login(credentials.resonateUsername, credentials.resonatePassword)
      .then(function (result) {
        var cookies = cookie.parse(result.request.headers.cookie);
        osmosis.config('cookies', cookies);
      })
      .paginate("a[@title='Next']")
      .find("div[contains(@class, 'um-member-photo')]//a@href")
      .set('resonateProfileLink')
      .data(function (data) {
        resonateProfileLinks.push(data.resonateProfileLink);
      })
      .done(function () {
        resolve(resonateProfileLinks);
      })
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};

var getResonateProfileInfo = function (resonateProfileLink) {
  return new Promise(function (resolve, reject) {
    var profileInfo = {profileLink: resonateProfileLink};
    osmosis
      .get(resonateProfileLink)
      .set({
        'Genres': "div[contains(@class, 'um-main-meta')]/div[contains(@class, 'genre')][1]/[2]",
        'Label': "div[contains(@class, 'um-main-meta')]/div[contains(@class, 'genre')][2]/[2]",
        'Location': "div[contains(@class, 'um-main-meta')]/div[contains(@class, 'genre')][3]/[2]"
      })
      .data(function (result) {
        profileInfo = R.merge(profileInfo, result);
      })
      .done(function () {
        resolve(profileInfo);
      })
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};

getUserDirectory()
  .then(function (resonateProfileLinks) {
    return Promise.resolve(resonateProfileLinks)
      .map(getResonateProfileInfo, {concurrency: 4});
  })
  .then(function (results) {
    console.log('processing results...');
    R.addIndex(R.forEach)(function (heading, headingIndex) {
      var cell_ref = XLSX.utils.encode_cell({c: headingIndex, r: 0});
      ws[cell_ref] = {t: "s", v: heading};
      range.e.c = headingIndex;
    }, attributes);
    R.addIndex(R.forEach)(function (twitterInfo, index) {
      R.addIndex(R.forEach)(function (key, keyIndex) {
        var cell_ref = XLSX.utils.encode_cell({c: keyIndex, r: index + 1});
        if (isNaN(twitterInfo[key])) {
          ws[cell_ref] = {t: "s", v: twitterInfo[key]};
        } else {
          ws[cell_ref] = {t: "n", v: twitterInfo[key]};
        }
        range.e.r = index + 1;
      }, attributes);
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