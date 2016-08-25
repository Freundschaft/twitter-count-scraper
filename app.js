var osmosis = require('osmosis'),
  R = require('ramda'),
  XLSX = require('XLSX'),
  Promise = require('bluebird'),
  Twitter = require('twitter'),
  cookie = require('cookie'),
  client = new Twitter({
    consumer_key: '',
    consumer_secret: '',
    access_token_key: '',
    access_token_secret: ''
  }),
  resonateUsername = '',
  resonatePassword = '';

var ws_name = "twitter Results";
var attributes = ['username', 'followers_count', 'friends_count', 'statuses_count', 'favourites_count', 'listed_count'];

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
    var twitterUsernames = [];

    osmosis
      .get('https://resonate.is/directories/latest-musicians-twitter/?members_page=1')
      .login(resonateUsername, resonatePassword)
      .then(function (result) {
        var cookies = cookie.parse(result.request.headers.cookie);
        osmosis.config('cookies', cookies);
      })
      .paginate("a[@title='Next']")
      .find("a[@title='Twitter']/@href")
      .set('twitterUsername')
      .data(function (twitterUsername) {
        twitterUsernames.push((/^.*twitter.com\/(.*)$/gm).exec(twitterUsername.twitterUsername)[1]);
      })
      .done(function () {
        resolve(twitterUsernames);
      })
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};

var getTwitterInfo = function (twitterUsername) {
  return new Promise(function (resolve, reject) {
    var twitterInfo = {username: twitterUsername};
    osmosis
      .get('twitter.com/' + twitterUsername)
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

getUserDirectory()
  .then(function (twitterUsernames) {
    var getAllTwitterInfos = Promise.resolve(twitterUsernames).map(getTwitterInfo, {concurrency: 1});
    return getAllTwitterInfos;
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