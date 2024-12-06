const ruleChecker = require('../../hooks/event-actions');
const achievementRuleChecker = require('../../hooks/achievement-rule-checker');
const periodicReset = require('../../hooks/periodic-reset');

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [periodicReset()],
    update: [],
    patch: [],
    remove: []
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
