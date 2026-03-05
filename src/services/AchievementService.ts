import { Achievement, UserAchievement } from '../models';
import { Types } from 'mongoose';

export class AchievementService {
  /**
   * Проверить и выдать ачивку пользователю
   */
  async unlock(userId: string, code: string, meta?: Record<string, any>) {
    // Проверяем, есть ли уже ачивка
    const exists = await UserAchievement.findOne({ userId, achievementCode: code });
    if (exists) return false;
    await UserAchievement.create({ userId, achievementCode: code, meta });
    return true;
  }

  /**
   * Получить все ачивки пользователя
   */
  async getUserAchievements(userId: string) {
    return UserAchievement.find({ userId });
  }

  /**
   * Получить все доступные ачивки
   */
  async getAllAchievements() {
    return Achievement.find();
  }

  /**
   * Инициализация стандартных ачивок (один раз)
   */
  async seedDefaultAchievements() {
    const defaults = [
      {
        code: 'first_win',
        name: 'Первый выигрыш',
        description: 'Выиграйте свой первый аукцион',
        icon: '🏆',
        criteria: 'Победа хотя бы в одном раунде',
      },
      {
        code: 'five_wins',
        name: '5 побед подряд',
        description: 'Победите 5 раз подряд',
        icon: '🔥',
        criteria: '5 побед подряд без поражений',
      },
      {
        code: 'big_bid',
        name: 'Крупная ставка',
        description: 'Сделайте ставку больше 1000',
        icon: '💰',
        criteria: 'Ставка > 1000',
      },
      {
        code: 'ten_auctions',
        name: 'Участник 10 аукционов',
        description: 'Примите участие в 10 аукционах',
        icon: '🎉',
        criteria: '10 разных аукционов',
      },
    ];
    for (const ach of defaults) {
      await Achievement.updateOne({ code: ach.code }, ach, { upsert: true });
    }
  }
}

export const achievementService = new AchievementService();
export default achievementService;
