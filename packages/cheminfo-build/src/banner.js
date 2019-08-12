'use strict';

function getMainBanner(pkg) {
  let result = `/**
 * ${pkg.name}`;
  if (pkg.description) result += ` - ${pkg.description}`;
  result += `
 * @version v${pkg.version}
`;
  if (pkg.homepage) {
    result += ` * @link ${pkg.homepage}
`;
  }
  if (pkg.license) {
    result += ` * @license ${pkg.license}
`;
  }
  return `${result} */`;
}

module.exports = {
  getMainBanner,
};
