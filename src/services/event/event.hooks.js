const ruleChecker = require('../../hooks/event-actions');
const achievementRuleChecker = require('../../hooks/achievement-rule-checker');
const periodicReset = require('../../hooks/periodic-reset');
const { disallow } = require('feathers-hooks-common');

module.exports = {
  before: {
    all: [],
    find: [disallow('external')],
    get: [disallow('external')],
    create: [],
    update: [disallow('external')],
    patch: [disallow('external')],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [ruleChecker(), achievementRuleChecker()],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
