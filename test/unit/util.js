'use strict';

const should = require('should');
const util = require('../../src/util');

describe('util', function () {
    describe('getOrgFromPackage', function () {
        const getOrgFromPackage = util.getOrgFromPackage;
        it('repository full url', function () {
            getOrgFromPackage({
                repository: 'https://github.com/org/repo.git'
            }).should.equal('org');
        });
        it('repository github shorthand', function () {
            getOrgFromPackage({
                repository: 'org/repo'
            }).should.equal('org');
        });
        it('repository git url', function () {
            getOrgFromPackage({
                repository: 'git@github.com:cheminfo/rest-on-couch-client.git'
            }).should.equal('cheminfo');
        });
        it('homepage', function () {
            getOrgFromPackage({
                homepage: 'https://github.com/org/repo#readme'
            }).should.equal('org');
        });
        it('invalid', function () {
            should(getOrgFromPackage({})).equal(undefined);
        });
    });
});
