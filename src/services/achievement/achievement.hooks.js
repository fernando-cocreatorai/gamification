const { disallow } = require('feathers-hooks-common');

const achievementActions = require('../../hooks/achievement-actions');

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [disallow('external'), updateTimestamp()],
    patch: [disallow('external'), updateTimestamp()],
    remove: [disallow('external')]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [achievementActions()],
    update: [],
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