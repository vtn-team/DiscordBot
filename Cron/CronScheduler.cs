using System;
using System.Threading;
using System.Threading.Tasks;

namespace DiscordBot.Cron
{
    /// <summary>
    /// 毎日指定時刻にジョブを実行するスケジューラ
    /// </summary>
    public class CronScheduler
    {
        private Timer? _timer;
        private readonly TimeSpan _targetTime;
        private readonly Func<Task> _job;

        /// <param name="targetTime">実行時刻（例: 22:00）</param>
        /// <param name="job">実行するジョブ</param>
        public CronScheduler(TimeSpan targetTime, Func<Task> job)
        {
            _targetTime = targetTime;
            _job = job;
        }

        public void Start()
        {
            ScheduleNext();
        }

        public void Stop()
        {
            _timer?.Dispose();
            _timer = null;
        }

        private void ScheduleNext()
        {
            var now = DateTime.Now;
            var nextRun = now.Date + _targetTime;

            // 今日の実行時刻を過ぎていたら翌日に設定
            if (nextRun <= now)
            {
                nextRun = nextRun.AddDays(1);
            }

            var delay = nextRun - now;
            Console.WriteLine($"[CronScheduler] 次回実行: {nextRun:yyyy/MM/dd HH:mm:ss} (残り {delay.TotalMinutes:F1} 分)");

            _timer?.Dispose();
            _timer = new Timer(async _ =>
            {
                try
                {
                    Console.WriteLine($"[CronScheduler] ジョブ実行開始: {DateTime.Now:yyyy/MM/dd HH:mm:ss}");
                    await _job();
                    Console.WriteLine($"[CronScheduler] ジョブ実行完了: {DateTime.Now:yyyy/MM/dd HH:mm:ss}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[CronScheduler] ジョブ実行エラー: {ex.Message}");
                }
                finally
                {
                    // 次回のスケジュールを設定
                    ScheduleNext();
                }
            }, null, delay, Timeout.InfiniteTimeSpan);
        }
    }
}
