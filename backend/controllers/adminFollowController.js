const adminFollowService = require("../services/adminFollowService");
const { success } = require("../utils/apiResponse");

function pickQueryValue(query, keys) {
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

exports.listAccountFollowing = async (req, res) => {
  const data = await adminFollowService.listUserFollowing(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
    search: pickQueryValue(req.query, ["search", "q"]),
  });
  return success(res, { data });
};

exports.listAccountFollowers = async (req, res) => {
  const data = await adminFollowService.listUserFollowers(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
    search: pickQueryValue(req.query, ["search", "q"]),
  });
  return success(res, { data });
};

exports.listShopFollowing = async (req, res) => {
  const data = await adminFollowService.listShopFollowing(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
    search: pickQueryValue(req.query, ["search", "q"]),
  });
  return success(res, { data });
};

exports.listShopFollowers = async (req, res) => {
  const data = await adminFollowService.listShopFollowers(req.params.id, {
    page: req.query.page,
    limit: req.query.limit,
    search: pickQueryValue(req.query, ["search", "q"]),
  });
  return success(res, { data });
};
