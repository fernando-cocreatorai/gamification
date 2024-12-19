const moment = require('moment');
const logger = require('../logger');

module.exports = function() {
  return async context => {
    const { app, data } = context;
    logger.debug('Periodic reset hook triggered', { userId: data.user_id });
    const achievementService = app.service('achievements');
    const userId = data.user_id;

    const resetPeriods = ['daily', 'weekly', 'monthly'];
    const achievements = await achievementService.find({
      query: {
        user_id: userId,
        resetPeriod: { $in: resetPeriods }
      }
    });

    logger.debug('Found achievements to check for reset', { count: achievements.length });
    for (const achievement of achievements) {
      const lastAwardedDate = moment(achievement.updatedAt);
      const now = moment();
      let shouldReset = false;

      logger.debug('Checking achievement for reset', { 
        achievementId: achievement._id, 
        resetPeriod: achievement.resetPeriod,
        lastAwardedDate: lastAwardedDate.format(),
        currentDate: now.format()
      });
      switch (achievement.resetPeriod) {
        case 'daily':
          shouldReset = lastAwardedDate.isBefore(now, 'day');
          break;
        case 'weekly':
          shouldReset = lastAwardedDate.isBefore(now.startOf('isoWeek'));
          break;
        case 'monthly':
          shouldReset = lastAwardedDate.isBefore(now.startOf('month'));
          break;
      }

      if (shouldReset) {
        logger.debug('Resetting achievement', { achievementId: achievement._id });
        await achievementService.patch(achievement._id, 
          { current_amount: 0 }
        );
        context.params.isPeriodicReset = true;
        logger.debug('Context after setting isPeriodicReset:', JSON.stringify(context.params, null, 2));

      } else {
        logger.debug('Achievement does not need reset', { achievementId: achievement._id });
      }
    }

    return context;
  };
};
