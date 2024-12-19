const logger = require('../logger');

module.exports = function (options = {}) {
  return async context => {
    logger.debug('Context params IsPeriodicReset: ' + context.params.isPeriodicReset);
    // If this is a periodic reset operation, skip the achievement action triggering
    if (context.data.current_amount == 0) {
      logger.debug("Skipping achievement actions for periodic reset");
      return context;
    }

    logger.info('Achievement action triggered');

    // Log specific parts of the context instead of the whole object
    logger.debug('Context method: ' + JSON.stringify(context.method));
    logger.debug('Context path: ' + JSON.stringify(context.path));
    logger.debug('Context data: ' + JSON.stringify(context.data));
    logger.debug('Context params: ' + JSON.stringify(context.params));
    const rules = context.app.get('rules');
    logger.debug("Rules: " + rules);

    // Check if we're dealing with a single achievement or multiple
    const achievements = Array.isArray(context.result) ? context.result : [context.result];

    for (const achievement of achievements) {
      logger.debug('Processing achievement: ', achievement);

      const achievementRule = rules['achievements'].find(rule => rule.name === achievement.name);

      if (achievementRule) {
        logger.info('Achievement action triggered for ' + achievement.name);
        const achievementActions = achievementRule.actions;

        for (const action of achievementActions) {
          logger.info('Achievement action triggered for ' + achievement.name + ', action: ' + action.name);
          const appFromContext = context.app;
          const xpService = appFromContext.service('xp');
          const uniqueCombination = await xpService.find({
            query: {
              user_id: achievement.user_id,
              name: action['xp']['name']
            }
          });

          if (uniqueCombination.length > 0) {
            logger.info('Achievement action triggered for ' + achievement.name + ', action: ' + action.name + ', patching XP');
            await xpService.patch(uniqueCombination[0]._id, {amount: uniqueCombination[0].amount + action['xp']['amount']});
          } else {
            logger.info('Achievement action triggered for ' + achievement.name + ', action: ' + action.name + ', creating XP');
            await xpService.create({user_id: achievement.user_id, name: action['xp']['name'], amount: action['xp']['amount']});
          }
        }
      } else {
        logger.warn('No achievement rule found for:', achievement.name);
      }
    }

    return context;
  };
};

