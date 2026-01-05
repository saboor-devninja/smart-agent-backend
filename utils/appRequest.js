const tryCatchAsync = require("./tryCatchAsync");

exports.appRequest = tryCatchAsync(async (req, res, next) => {
  req.isApp = true;
  next();
});

