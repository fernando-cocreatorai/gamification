const { disallow } = require('feathers-hooks-common');

const achievementActions = require('../../hooks/achievement-actions');
const periodicReset = require('../../hooks/periodic-reset');

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [disallow('external'), updateTimestamp(), periodicReset()],
    patch: [disallow('external'), updateTimestamp(), periodicReset()],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [achievementActions()],
    update: [achievementActions()],
    patch: [achievementActions()],
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

function updateTimestamp() {
  return async context => {
    context.data.updatedAt = new Date();
    return context;
  };
}