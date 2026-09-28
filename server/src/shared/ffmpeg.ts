// مسیرِ باینریِ ffmpeg — FFMPEG_PATH یا ffmpegِ رویِ PATH. (runnerها عمداً مشترک نیستند: timeout و مدیریتِ خطایِ
// هر مصرف‌کننده فرق دارد.)
export const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
