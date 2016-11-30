function logger() {
  this.currentCount = 0;
  this.userCount = 0;
}

logger.prototype.logWithCount = function (message) {
  console.log(`[${this.currentCount}/${this.userCount}]: ${message}`);
};

logger.prototype.increment = function () {
  this.currentCount++;
};

module.exports = logger;