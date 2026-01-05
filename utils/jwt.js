const jwt = require("jsonwebtoken");
const config = require("../config/config");

exports.signToken = (userId, role) => {
  return jwt.sign({ userId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

exports.verifyToken = (token) => {
  return jwt.verify(token, config.jwt.secret);
};

