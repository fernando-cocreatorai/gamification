// Use this hook to manipulate incoming or outgoing data.
// For more information on hooks see: http://docs.feathersjs.com/api/hooks.html
const logger = require('../logger');

// eslint-disable-next-line no-unused-vars
module.exports = function (options = {}) {
  return async context => {
    logger.debug('Context params IsPeriodicReset: ' + context.params.isPeriodicReset);
    // If this is a periodic reset operation, skip the achievement rule checking
    if (context.data.current_amount == 0) {
      logger.debug("Skipping achievement cycle check for periodic reset");
      return context;
    }

    const rules = context.app.get('rules');
    return await enterAchievementCycle(context, true, false, rules['achievements']);
  };

  async function enterAchievementCycle(context, isFirstCycle, isLastCycle, achievementRules) {
    logger.debug("Entered achievement cycle");
    if (!isLastCycle) {
      // assume that no achievement will be given in this cycle
      isLastCycle = true;
      for (const achievementRule of achievementRules) {
        logger.debug("Trying to award achievement: " + achievementRule.name);
        if (await achievementRule.canBeAwarded(context) && await achievementRule.isFulfilled(context, isFirstCycle)) {
          // something changed in this cycle
          logger.debug("Achievement awarded: " + achievementRule.name);
          isLastCycle = false;
          const achievementService = context.app.service('achievements');
          const uniqueCombination = await achievementService.find({
            query: {
              user_id: context.data.user_id,
              name: achievementRule.name
            }
          });

          if (uniqueCombination.length > 0) {
            await achievementService.patch(uniqueCombination[0]._id, {
              current_amount: uniqueCombination[0].current_amount + 1,
              total_amount: uniqueCombination[0].total_amount + 1
            });
          } else {
            await achievementService.create({
              user_id: context.data.user_id,
              name: achievementRule.name,
              current_amount: 1,
              total_amount: 1,
              resetPeriod: achievementRule.resetPeriod // Add this line
            });
          }

          for (const replaceName of achievementRule.replaces) {
            const replacedAchievement = await achievementService.find({
              query: {
                user_id: context.data.user_id,
                name: replaceName
              }
            });

            if (replacedAchievement.length !== 0) {
              await achievementService.patch(replacedAchievement[0]._id, {
                current_amount: 0
              });
            }
          }
        }
      }
      return enterAchievementCycle(context, false, isLastCycle, achievementRules);
    } else {
      return context;
    }
  }
};
