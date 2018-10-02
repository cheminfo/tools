'use strict';

const util = require('../../src/util');

describe('util', function () {
  describe('getOrgFromPackage', function () {
    const getOrgFromPackage = util.getOrgFromPackage;
    it('repository full url', function () {
      expect(
        getOrgFromPackage({
          repository: 'https://github.com/org/repo.git'
        })
      ).toBe('org');
    });
    it('repository github shorthand', function () {
      expect(
        getOrgFromPackage({
          repository: 'org/repo'
        })
      ).toBe('org');
    });
    it('repository git url', function () {
      expect(
        getOrgFromPackage({
          repository: 'git@github.com:cheminfo/rest-on-couch-client.git'
        })
      ).toBe('cheminfo');
    });
    it('homepage', function () {
      expect(
        getOrgFromPackage({
          homepage: 'https://github.com/org/repo#readme'
        })
      ).toBe('org');
    });
    it('invalid', function () {
      expect(getOrgFromPackage({})).toBeNull();
    });
  });
});
