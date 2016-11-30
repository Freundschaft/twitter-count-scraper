const Logger = require('../src/logger.js'),
  logger = new Logger(),
  ResonateScraper = require('../src/resonate.js'),
  resonateScraper = new ResonateScraper(credentials, logger);

resonateScraper.getFullResonateProfileInfo({
  "ID": "72",
  "user_login": "mattblack",
  "user_nicename": "mattblack",
  "user_email": "mattb@ninjatune.net",
  "user_url": "",
  "user_registered": "2016-07-14 19:12:47",
  "display_name": "Matt Black",
  "spam": "0",
  "deleted": "0",
  "roles": [
    "subscriber"
  ],
  "first_name": "Matt",
  "last_name": "Black",
  "community_role": "member",
  "account_status": "approved",
  "profile_pic_original": "https:\/\/resonate.is\/wp-content\/uploads\/ultimatemember\/544\/profile_photo.jpg?1480468003",
  "profile_pic_normal": "https:\/\/resonate.is\/wp-content\/uploads\/ultimatemember\/544\/profile_photo-300.jpg?1480468003",
  "profile_pic_small": "https:\/\/resonate.is\/wp-content\/uploads\/ultimatemember\/544\/profile_photo-40.jpg?1480468003",
  "cover_photo": ""
});

resonateProfiles = [{
  "ID": "72",
  "user_login": "mattblack",
  "user_nicename": "mattblack",
  "user_email": "mattb@ninjatune.net",
  "user_url": "",
  "user_registered": "2016-07-14 19:12:47",
  "display_name": "Matt Black",
  "spam": "0",
  "deleted": "0",
  "roles": [
    "subscriber"
  ],
  "first_name": "Matt",
  "last_name": "Black",
  "community_role": "member",
  "account_status": "approved",
  "profile_pic_original": "https:\/\/resonate.is\/wp-content\/uploads\/ultimatemember\/544\/profile_photo.jpg?1480468003",
  "profile_pic_normal": "https:\/\/resonate.is\/wp-content\/uploads\/ultimatemember\/544\/profile_photo-300.jpg?1480468003",
  "profile_pic_small": "https:\/\/resonate.is\/wp-content\/uploads\/ultimatemember\/544\/profile_photo-40.jpg?1480468003",
  "cover_photo": ""
}];
