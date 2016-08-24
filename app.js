var osmosis = require('osmosis'),
  R = require('ramda'),
  twitterUsernames = ['gfnork', 'Freundschaft'],
  XLSX = require('XLSX'),
  Promise = require('bluebird');

var ws_name = "twitter Results";
var attributes = ['username', 'followers', 'following', 'favorites', 'tweets', 'all_lists'];

function Workbook() {
  if (!(this instanceof Workbook)) return new Workbook();
  this.SheetNames = [];
  this.Sheets = {};
}

var wb = new Workbook();
var ws = {};
var range = {s: {c: 0, r: 0}, e: {c: 0, r: 0}};

var getTwitterInfo = function (twitterUsername) {
  return new Promise(function (resolve, reject) {
    osmosis
      .get('twitter.com/' + twitterUsername)
      .find("a[@data-nav='followers']/span.ProfileNav-value")
      .set('followers')
      .find("a[@data-nav='following']/span.ProfileNav-value")
      .set('following')
      .find("a[@data-nav='favorites']/span.ProfileNav-value")
      .set('favorites')
      .find("a[@data-nav='tweets']/span.ProfileNav-value")
      .set('tweets')
      .find("a[@data-nav='all_lists']/span.ProfileNav-value")
      .set('all_lists')
      .data(function (twitterInfo) {
        twitterInfo.username = twitterUsername;
        resolve(twitterInfo);
      })
      .log(console.log)
      .error(console.log)
      .debug(console.log);
  });
};


var getAllTwitterInfos = Promise.resolve(twitterUsernames).map(getTwitterInfo,{concurrency: 1 });

getAllTwitterInfos
  .then(function (results) {
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
    XLSX.writeFile(wb, 'results.xlsx');
  });