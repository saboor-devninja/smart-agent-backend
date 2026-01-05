const jwt = require("jsonwebtoken");
const User = require("../../../models/User");
const AppError = require("../../../utils/appError");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const config = require("../../../config/config");

exports.isLoggedIn = tryCatchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("You are not logged in. Please log in to get access.", 401));
  }

  const decoded = jwt.verify(token, config.jwt.secret);

  const user = await User.findById(decoded.userId);

  if (!user) {
    return next(new AppError("The user belonging to this token no longer exists.", 401));
  }

  if (!user.isActive) {
    return next(new AppError("Your account has been deactivated.", 401));
  }

  req.user = user;
  next();
});

